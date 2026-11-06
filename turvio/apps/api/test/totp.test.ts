import { describe, expect, it } from "vitest";
import { base32Decode, base32Encode, hotp, open, otpauthUrl, seal, totp, verifyTotp } from "../src/auth/totp";

// RFC 6238 Appendix B seeds (ASCII "12345678901234567890" repeated to the hash length).
const SEED_SHA1 = Buffer.from("12345678901234567890");
const SEED_SHA256 = Buffer.from("12345678901234567890123456789012");
const SEED_SHA512 = Buffer.from("1234567890123456789012345678901234567890123456789012345678901234");

const VECTORS: [number, string, string, string][] = [
  // time, SHA1, SHA256, SHA512 (8 digits)
  [59, "94287082", "46119246", "90693936"],
  [1111111109, "07081804", "68084774", "25091201"],
  [1111111111, "14050471", "67062674", "99943326"],
  [1234567890, "89005924", "91819424", "93441116"],
  [2000000000, "69279037", "90698825", "38618901"],
  [20000000000, "65353130", "77737706", "47863826"],
];

describe("RFC 6238 TOTP", () => {
  it.each(VECTORS)("t=%i matches the RFC test vectors", (t, sha1, sha256, sha512) => {
    expect(totp(SEED_SHA1, t, { digits: 8 })).toBe(sha1);
    expect(totp(SEED_SHA256, t, { digits: 8, algorithm: "sha256" })).toBe(sha256);
    expect(totp(SEED_SHA512, t, { digits: 8, algorithm: "sha512" })).toBe(sha512);
  });

  it("matches RFC 4226 HOTP vectors (6 digits)", () => {
    const expected = ["755224", "287082", "359152", "969429", "338314", "254676", "287922", "162583", "399871", "520489"];
    expected.forEach((code, i) => expect(hotp(SEED_SHA1, i)).toBe(code));
  });

  it("accepts ±1 step and rejects older/newer codes and malformed input", () => {
    const t = 1_700_000_000;
    const step = Math.floor(t / 30);
    expect(verifyTotp(SEED_SHA1, totp(SEED_SHA1, t), t)).toBe(step);
    expect(verifyTotp(SEED_SHA1, totp(SEED_SHA1, t - 30), t)).toBe(step - 1);
    expect(verifyTotp(SEED_SHA1, totp(SEED_SHA1, t + 30), t)).toBe(step + 1);
    expect(verifyTotp(SEED_SHA1, totp(SEED_SHA1, t - 60), t)).toBeNull();
    expect(verifyTotp(SEED_SHA1, totp(SEED_SHA1, t + 60), t)).toBeNull();
    expect(verifyTotp(SEED_SHA1, "12345", t)).toBeNull();
    expect(verifyTotp(SEED_SHA1, "abcdef", t)).toBeNull();
  });

  it("round-trips base32 and builds an otpauth URL", () => {
    expect(base32Encode(Buffer.from("12345678901234567890"))).toBe("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
    expect(base32Decode("gezd gnbv gy3t qojq gezd gnbv gy3t qojq").toString()).toBe("12345678901234567890");
    const url = otpauthUrl({ secret: SEED_SHA1, account: "admin@turvio.test", issuer: "TURVIO" });
    expect(url).toBe("otpauth://totp/TURVIO%3Aadmin%40turvio.test?secret=GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ&issuer=TURVIO&algorithm=SHA1&digits=6&period=30");
  });
});

describe("secret encryption at rest", () => {
  it("round-trips, never contains the plaintext and rejects tampering or a different key", () => {
    const boxed = seal("k".repeat(40), "totp", SEED_SHA1);
    expect(boxed).not.toContain(SEED_SHA1.toString("base64url"));
    expect(open("k".repeat(40), "totp", boxed).equals(SEED_SHA1)).toBe(true);
    expect(() => open("x".repeat(40), "totp", boxed)).toThrow();
    expect(() => open("k".repeat(40), "other", boxed)).toThrow();
    const parts = boxed.split(".");
    parts[3] = Buffer.from("tampered!!").toString("base64url");
    expect(() => open("k".repeat(40), "totp", parts.join("."))).toThrow();
  });
});
