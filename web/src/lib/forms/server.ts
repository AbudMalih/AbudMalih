import "server-only";
import { randomBytes } from "node:crypto";
import type { ZodType } from "zod";
import { getMailer, type MailAttachment } from "@/lib/mail";
import { renderSubmissionEmail, type SubmissionEmail } from "@/lib/mail/templates";
import { extensionOf, FILE_RULES, sniffMatches } from "./files";
import type { ResultCode } from "./messages";

type Result = { ok: true; reference: string } | { ok: false; code: ResultCode; error?: string };
const json = (r: Result, status = 200) => Response.json(r, { status, headers: { "Cache-Control": "no-store" } });

/* ---------------- Abuse protection (best effort, per server instance) ---------------- */

const hits = new Map<string, number[]>();
function rateLimited(key: string, max = 8, windowMs = 10 * 60 * 1000): boolean {
  const now = Date.now();
  const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  list.push(now);
  hits.set(key, list);
  if (hits.size > 5000) hits.clear();
  return list.length > max;
}

/** Recently processed submission ids → reference (drops accidental duplicates). */
const seen = new Map<string, { reference: string; at: number }>();
function duplicateOf(id: string | null): string | null {
  if (!id) return null;
  const now = Date.now();
  for (const [k, v] of seen) if (now - v.at > 30 * 60 * 1000) seen.delete(k);
  return seen.get(id)?.reference ?? null;
}

function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

/** Rejects cross-site form posts (the browser always sends Origin for fetch POSTs). */
function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try {
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function reference(prefix: string): string {
  return `${prefix}-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

/** Strip line breaks/control characters from values used in mail headers. */
export const headerSafe = (s: string) => s.replace(/[\r\n\t\u0000-\u001f\u007f]+/g, " ").trim().slice(0, 140);

/* ---------------- Uploads ---------------- */

async function readFiles(form: FormData): Promise<{ files: MailAttachment[]; error: string | null }> {
  const entries = form.getAll("files").filter((v): v is File => typeof v !== "string" && v.size > 0);
  if (entries.length > FILE_RULES.maxFiles) return { files: [], error: `Maximal ${FILE_RULES.maxFiles} Dateien.` };
  let total = 0;
  const files: MailAttachment[] = [];
  for (const f of entries) {
    const ext = extensionOf(f.name);
    const mimes = FILE_RULES.types[ext];
    if (!mimes) return { files: [], error: `Der Dateityp von „${f.name.slice(0, 60)}“ ist nicht erlaubt (PDF, Word, JPG, PNG).` };
    if (f.size > FILE_RULES.maxFileBytes) return { files: [], error: `„${f.name.slice(0, 60)}“ ist größer als 10 MB.` };
    total += f.size;
    if (total > FILE_RULES.maxTotalBytes) return { files: [], error: "Die Anhänge sind zusammen größer als 20 MB." };
    const buf = Buffer.from(await f.arrayBuffer());
    if (!sniffMatches(ext, new Uint8Array(buf.subarray(0, 8)))) return { files: [], error: `„${f.name.slice(0, 60)}“ ist keine gültige ${ext.toUpperCase()}-Datei.` };
    const base = f.name.slice(0, f.name.length - ext.length - 1).normalize("NFC");
    const safe = base.replace(/[^\p{L}\p{N} ._-]+/gu, "_").replace(/^[._ ]+/, "").slice(0, 80) || "dokument";
    files.push({ filename: `${safe}.${ext}`, content: buf, contentType: mimes[0]! });
  }
  return { files, error: null };
}

/** Multipart text fields → plain object (arrays for repeated keys). */
function fieldsOf(form: FormData, arrays: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of form.entries()) {
    if (typeof v !== "string" || k === "files") continue;
    if (!arrays.includes(k)) out[k] = v;
    else if (Array.isArray(out[k])) (out[k] as string[]).push(v);
    else out[k] = [v];
  }
  for (const a of arrays) out[a] ??= [];
  if ("consent" in out) out.consent = out.consent === "true";
  return out;
}

/* ---------------- Pipeline ---------------- */

type Options<T> = {
  req: Request;
  scope: string;
  refPrefix: string;
  /** Schema, or a function choosing one from the raw fields (e.g. by application kind). */
  schema: ZodType<T> | ((fields: Record<string, unknown>) => ZodType<T>);
  arrays?: string[];
  allowFiles: boolean;
  recipient: string | null;
  /** Builds subject, reply-to and the e-mail content from validated data. */
  build: (data: T, ctx: { reference: string; receivedAt: Date; files: MailAttachment[] }) => {
    subject: string;
    replyTo: string;
    email: Omit<SubmissionEmail, "reference" | "receivedAt" | "attachments">;
  };
};

const MAX_BODY = 22 * 1024 * 1024;

export async function processSubmission<T>(o: Options<T>): Promise<Response> {
  const { req } = o;
  if (!sameOrigin(req)) return json({ ok: false, code: "forbidden" }, 403);
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY) return json({ ok: false, code: "too_large" }, 413);
  if (rateLimited(`${o.scope}:${clientIp(req)}`)) return json({ ok: false, code: "rate_limited" }, 429);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json({ ok: false, code: "invalid" }, 400);
  }

  const submissionId = String(form.get("submissionId") ?? "").slice(0, 64) || null;
  const dup = duplicateOf(submissionId);
  if (dup) return json({ ok: true, reference: dup });

  const fields = fieldsOf(form, o.arrays ?? []);
  // Bots: honeypot filled or form submitted faster than a human could.
  if (fields.website || Number(fields.elapsed ?? 99999) < 1500) return json({ ok: true, reference: reference(o.refPrefix) });
  delete fields.elapsed;
  delete fields.submissionId;

  const schema = typeof o.schema === "function" ? o.schema(fields) : o.schema;
  const parsed = schema.safeParse(fields);
  if (!parsed.success) return json({ ok: false, code: "invalid", error: parsed.error.issues[0]?.message }, 400);

  const { files, error } = o.allowFiles ? await readFiles(form) : { files: [], error: null };
  if (error) return json({ ok: false, code: "upload", error }, 400);

  const mailer = getMailer();
  if (!mailer || !o.recipient) return json({ ok: false, code: "not_configured" }, 503);

  const ref = reference(o.refPrefix);
  const receivedAt = new Date();
  const built = o.build(parsed.data, { reference: ref, receivedAt, files });
  const { html, text } = renderSubmissionEmail({
    ...built.email,
    reference: ref,
    receivedAt,
    attachments: files.map((f) => ({ filename: f.filename, size: f.content.length })),
  });

  try {
    await mailer.send({ to: o.recipient, replyTo: built.replyTo, subject: headerSafe(built.subject), html, text, attachments: files });
  } catch (e) {
    // Log only a technical code – never form contents or addresses.
    const code = (e as { code?: string; responseCode?: number })?.code ?? (e as { responseCode?: number })?.responseCode ?? "unknown";
    console.error(`[${o.scope}] mail delivery failed (code=${code})`);
    return json({ ok: false, code: "failed" }, 502);
  }
  if (submissionId) seen.set(submissionId, { reference: ref, at: Date.now() });
  return json({ ok: true, reference: ref });
}
