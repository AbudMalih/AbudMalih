import { NextResponse, type NextRequest } from "next/server";
import { clientIp, originAllowed } from "@/lib/request";
import { normaliseQuote, validateQuote } from "@/lib/quote/schema";
import { deliverQuote } from "@/lib/quote/deliver";

/**
 * POST /api/quote — freight quote request (China → Germany).
 * Same protections as /api/contact: server-side validation, honeypot and
 * minimum fill time, same-origin, per-IP rate limit, fixed recipient, and
 * 503 while delivery is not connected (never a fake success).
 */
export const runtime = "nodejs";
export const preferredRegion = "fra1";
export const maxDuration = 20;

const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const MIN_FILL_MS = 4000;
const hits = new Map<string, number[]>();

function limited(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > MAX_PER_WINDOW;
}

export async function POST(req: NextRequest) {
  if (!originAllowed(req.headers))
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    const text = await req.text();
    if (text.length > 20000)
      return NextResponse.json({ error: "too_large" }, { status: 413 });
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const filledHoneypot = typeof body.fax === "string" && body.fax.trim() !== "";
  const tooFast =
    typeof body.elapsed !== "number" || body.elapsed < MIN_FILL_MS;
  if (filledHoneypot || tooFast)
    return NextResponse.json({ ok: true }, { status: 202 });

  const ip = clientIp(req.headers);
  if (limited(ip))
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const quote = normaliseQuote(body);
  const errors = validateQuote(quote);
  if (Object.keys(errors).length)
    return NextResponse.json(
      { error: "invalid", fields: errors },
      { status: 422 },
    );

  const locale = ["de", "en", "ar"].includes(body.locale as string)
    ? (body.locale as string)
    : "de";
  const result = await deliverQuote(quote, { locale });
  if (!result.ok)
    return NextResponse.json(
      { error: "delivery_unavailable" },
      { status: 503 },
    );
  return NextResponse.json({ ok: true }, { status: 200 });
}
