/* Dependency-free (safe for middleware / edge and Node route handlers). */
import { SITE_HOST } from "./origin";

/**
 * Request facts behind a reverse proxy (Hostinger Node.js hosting) or on
 * Vercel, read defensively.
 *
 * Forwarded headers (X-Forwarded-Host, X-Forwarded-For, X-Real-IP) can be
 * sent by any client. They are therefore only used when the operator has
 * declared that a trusted proxy sits in front of the app (TRUST_PROXY=1, set
 * in the hosting panel), and even then only in ways where a forged value
 * cannot widen access:
 *  - the public host only decides *where* the site believes it runs; it can
 *    never unlock indexing on its own (SITE_INDEXING must be "on" too) and
 *    the origin check additionally requires the host to be on an allowlist;
 *  - the client IP is only used for the per-sender rate limit.
 */

type HeaderBag = { get(name: string): string | null };

const TRUST_PROXY = process.env.TRUST_PROXY === "1";

/** "host" or "host:port", lowercase, letters/digits/dots/hyphens only. */
const HOST_RE = /^[a-z0-9.-]{1,253}(:\d{1,5})?$/;

function cleanHost(value: string | null | undefined): string | null {
  if (!value) return null;
  // a proxy chain may list several hosts; the first is the one the client asked for
  const h = value.split(",")[0].trim().toLowerCase();
  return HOST_RE.test(h) ? h : null;
}

/** The host the visitor actually requested (proxy-aware only with TRUST_PROXY=1). */
export function publicHost(headers: HeaderBag): string {
  const forwarded = TRUST_PROXY
    ? cleanHost(headers.get("x-forwarded-host"))
    : null;
  return forwarded ?? cleanHost(headers.get("host")) ?? "";
}

/** Host name without a port. */
export const bareHost = (host: string) => host.replace(/:\d+$/, "");

/** Extra hosts allowed to submit the forms, e.g. the temporary Hostinger address (comma-separated). */
function extraHosts(): string[] {
  return (process.env.ALLOWED_HOSTS ?? "")
    .split(",")
    .map((h) => cleanHost(h))
    .filter((h): h is string => !!h);
}

/**
 * Same-site check for form posts. The browser's Origin header must name a
 * host the site really runs on: the request's own Host,
 * luna-trading.de / www, or a host listed in ALLOWED_HOSTS (fixed allowlist).
 * Requests without an Origin header (non-browser clients) pass this check
 * and still face validation, the honeypot, the timing check and the rate limit.
 */
export function originAllowed(headers: HeaderBag): boolean {
  const origin = headers.get("origin");
  if (!origin) return true;
  let originHost: string;
  try {
    originHost = new URL(origin).host.toLowerCase();
  } catch {
    return false;
  }
  const allowed = new Set<string>([
    SITE_HOST,
    `www.${SITE_HOST}`,
    ...extraHosts(),
  ]);
  // the request's own Host (direct access, Vercel) is fine; a forwarded host
  // is NOT added here, so a forged X-Forwarded-Host can never widen the list
  const own = cleanHost(headers.get("host"));
  if (own) allowed.add(own);
  return allowed.has(originHost) || allowed.has(bareHost(originHost));
}

const IP_RE = /^[0-9a-f.:]{3,45}$/i;

/**
 * Client IP for the rate limit. Behind a trusted proxy the right-most
 * X-Forwarded-For entry is the address that proxy saw (entries further left
 * are client-supplied); X-Real-IP is the fallback. On Vercel X-Forwarded-For
 * holds exactly the client address. Unknown → one shared bucket.
 */
export function clientIp(headers: HeaderBag): string {
  const xff = (headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => IP_RE.test(s));
  const last = xff[xff.length - 1];
  if (last) return last;
  const real = (headers.get("x-real-ip") ?? "").trim();
  return IP_RE.test(real) ? real : "unknown";
}
