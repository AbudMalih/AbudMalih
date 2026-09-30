import "server-only";
import { randomBytes } from "node:crypto";
import type { MailAttachment } from "@/lib/mail";
import { extensionOf, FILE_RULES, sniffMatches } from "./files";

/** Best-effort in-memory rate limit per endpoint + IP (per server instance). */
const hits = new Map<string, number[]>();
export function rateLimited(key: string, max = 8, windowMs = 10 * 60 * 1000): boolean {
  const now = Date.now();
  const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  list.push(now);
  hits.set(key, list);
  return list.length > max;
}

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

export function reference(prefix: string): string {
  return `${prefix}-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

/** Collect & validate uploaded files from multipart data. */
export async function readFiles(form: FormData, field = "files"): Promise<{ files: MailAttachment[]; error: string | null }> {
  const entries = form.getAll(field).filter((v): v is File => typeof v !== "string" && v.size > 0);
  if (entries.length > FILE_RULES.maxFiles) return { files: [], error: `Maximal ${FILE_RULES.maxFiles} Dateien.` };
  let total = 0;
  const files: MailAttachment[] = [];
  for (const f of entries) {
    const ext = extensionOf(f.name);
    const mimes = FILE_RULES.types[ext];
    if (!mimes) return { files: [], error: `Dateityp von „${f.name}“ ist nicht erlaubt.` };
    if (f.size > FILE_RULES.maxFileBytes) return { files: [], error: `„${f.name}“ ist größer als 10 MB.` };
    total += f.size;
    if (total > FILE_RULES.maxTotalBytes) return { files: [], error: "Die Dateien sind zusammen größer als 20 MB." };
    const buf = Buffer.from(await f.arrayBuffer());
    if (!sniffMatches(ext, new Uint8Array(buf.subarray(0, 8)))) return { files: [], error: `„${f.name}“ entspricht nicht dem angegebenen Dateityp.` };
    const safeName = f.name.replace(/[^\w.\-äöüÄÖÜß ]+/g, "_").slice(0, 120);
    files.push({ filename: safeName, content: buf, contentType: mimes[0]! });
  }
  return { files, error: null };
}

/** Parse multipart text fields into a plain object (arrays for repeated keys). */
export function fieldsOf(form: FormData, arrays: string[] = []): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of form.entries()) {
    if (typeof v !== "string") continue;
    if (!arrays.includes(k)) out[k] = v;
    else if (Array.isArray(out[k])) (out[k] as string[]).push(v);
    else out[k] = [v];
  }
  for (const a of arrays) out[a] ??= [];
  if ("consent" in out) out.consent = out.consent === "true";
  return out;
}

export function lines(pairs: [string, string | undefined | null | string[]][]): string {
  return pairs
    .map(([k, v]) => [k, Array.isArray(v) ? v.join(", ") : v] as const)
    .filter(([, v]) => v && String(v).trim())
    .map(([k, v]) => `${k}:\n${v}\n`)
    .join("\n");
}

export type ApiResult = { ok: true; reference: string } | { ok: false; error: string; code: "invalid" | "not_configured" | "rate_limited" | "failed" };

export function json(result: ApiResult, status = 200) {
  return Response.json(result, { status });
}
