import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * RFC 6238 time-based one-time passwords (HMAC-SHA1, 30-second steps, 6 digits),
 * the variant every common authenticator app supports.
 */
export const TOTP_PERIOD = 30;
export const TOTP_DIGITS = 6;

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buf: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(s: string): Buffer {
  const clean = s.toUpperCase().replace(/[\s=-]/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const i = B32.indexOf(ch);
    if (i < 0) throw new Error("invalid base32");
    value = (value << 5) | i;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** RFC 4226 HOTP value for a counter. */
export function hotp(secret: Uint8Array, counter: number, digits = TOTP_DIGITS, algorithm: "sha1" | "sha256" | "sha512" = "sha1"): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const mac = createHmac(algorithm, secret).update(msg).digest();
  const offset = mac[mac.length - 1]! & 0x0f;
  const bin = ((mac[offset]! & 0x7f) << 24) | (mac[offset + 1]! << 16) | (mac[offset + 2]! << 8) | mac[offset + 3]!;
  return String(bin % 10 ** digits).padStart(digits, "0");
}

export const timeStep = (unixSeconds: number, period = TOTP_PERIOD) => Math.floor(unixSeconds / period);

export function totp(secret: Uint8Array, unixSeconds: number, opts: { digits?: number; algorithm?: "sha1" | "sha256" | "sha512" } = {}): string {
  return hotp(secret, timeStep(unixSeconds), opts.digits ?? TOTP_DIGITS, opts.algorithm);
}

/**
 * Checks a code against the current step and ±`window` steps (clock drift).
 * Returns the matched step, or null. Callers must reject steps that were already
 * used (replay protection) by comparing with the last accepted step.
 */
export function verifyTotp(secret: Uint8Array, code: string, unixSeconds: number, window = 1): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  const now = timeStep(unixSeconds);
  const given = Buffer.from(code);
  let match: number | null = null;
  for (let d = -window; d <= window; d++) {
    // Compare every candidate in constant time; do not stop early.
    const ok = timingSafeEqual(Buffer.from(hotp(secret, now + d)), given);
    if (ok && match === null) match = now + d;
  }
  return match;
}

/** New random 160-bit secret (RFC 4226 recommendation). */
export const newTotpSecret = (): Buffer => randomBytes(20);

export function otpauthUrl(opts: { secret: Uint8Array; account: string; issuer: string }): string {
  const label = encodeURIComponent(`${opts.issuer}:${opts.account}`);
  const q = new URLSearchParams({ secret: base32Encode(opts.secret), issuer: opts.issuer, algorithm: "SHA1", digits: String(TOTP_DIGITS), period: String(TOTP_PERIOD) });
  return `otpauth://totp/${label}?${q.toString()}`;
}

// ---------------------------------------------------------------------------
// Authenticated encryption for secrets at rest (AES-256-GCM, key via HKDF)
// ---------------------------------------------------------------------------

function deriveKey(material: string, purpose: string): Buffer {
  return Buffer.from(hkdfSync("sha256", Buffer.from(material, "utf8"), Buffer.from("turvio-secretbox-v1"), Buffer.from(purpose), 32));
}

/** Encrypts `plain` with a key derived from `material` (e.g. JWT_SECRET) for one purpose. Output: v1.<iv>.<tag>.<ciphertext> (base64url). */
export function seal(material: string, purpose: string, plain: Uint8Array): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", deriveKey(material, purpose), iv);
  const ct = Buffer.concat([c.update(plain), c.final()]);
  return ["v1", iv.toString("base64url"), c.getAuthTag().toString("base64url"), ct.toString("base64url")].join(".");
}

/** Decrypts a value from `seal`; throws when it was tampered with or the key differs. */
export function open(material: string, purpose: string, boxed: string): Buffer {
  const [v, iv, tag, ct] = boxed.split(".");
  if (v !== "v1" || !iv || !tag || ct === undefined) throw new Error("unsupported sealed value");
  const d = createDecipheriv("aes-256-gcm", deriveKey(material, purpose), Buffer.from(iv, "base64url"));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([d.update(Buffer.from(ct, "base64url")), d.final()]);
}
