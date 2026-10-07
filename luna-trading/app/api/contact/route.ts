import { NextResponse, type NextRequest } from "next/server";
import { normalise, validate } from "@/lib/contact/schema";
import { deliver } from "@/lib/contact/deliver";

/**
 * POST /api/contact — receives a contact inquiry.
 * - authoritative server-side validation (the client check is only UX)
 * - invisible spam protection: honeypot field, minimum fill time,
 *   same-origin check, per-IP rate limit (best effort per instance)
 * - the recipient is fixed on the server (lib/contact/deliver.ts);
 *   nothing from the request can choose or add recipients
 * - responds 503 while delivery is not connected: never a fake success
 */
export const runtime = "nodejs";
// executed in Frankfurt (vercel.json sets fra1 for every function as well)
export const preferredRegion = "fra1";

const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const MIN_FILL_MS = 2500;
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
  // same-origin only
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (origin && host && new URL(origin).host !== host) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    const text = await req.text();
    if (text.length > 20000) return NextResponse.json({ error: "too_large" }, { status: 413 });
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  // honeypot / too fast: answer like a normal acceptance, deliver nothing
  const filledHoneypot = typeof body.fax === "string" && body.fax.trim() !== "";
  const tooFast = typeof body.elapsed !== "number" || body.elapsed < MIN_FILL_MS;
  if (filledHoneypot || tooFast) return NextResponse.json({ ok: true }, { status: 202 });

  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "local";
  if (limited(ip)) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const inquiry = normalise(body);
  const errors = validate(inquiry);
  if (Object.keys(errors).length) return NextResponse.json({ error: "invalid", fields: errors }, { status: 422 });

  const locale = ["de", "en", "ar"].includes(body.locale as string) ? (body.locale as string) : "de";
  const result = await deliver(inquiry, { locale });
  if (!result.ok) return NextResponse.json({ error: "delivery_unavailable" }, { status: 503 });
  return NextResponse.json({ ok: true }, { status: 200 });
}
