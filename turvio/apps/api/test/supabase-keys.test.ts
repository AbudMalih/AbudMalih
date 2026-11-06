import { createServer, type Server } from "node:http";
import { SignJWT, exportJWK, generateKeyPair } from "jose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SupabaseTokenVerifier } from "../src/auth/tokens";
import { SupabaseProofStore } from "../src/storage";
import { isLegacyJwtKey, supabaseHeaders } from "../src/supabase-keys";

const LEGACY = "eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.c2lnbmF0dXJl";

describe("Supabase API key formats", () => {
  it("new sb_ keys go only into the apikey header", () => {
    expect(isLegacyJwtKey("sb_secret_abc")).toBe(false);
    expect(supabaseHeaders("sb_secret_abc")).toEqual({ apikey: "sb_secret_abc" });
    expect(supabaseHeaders("sb_publishable_abc")).toEqual({ apikey: "sb_publishable_abc" });
  });

  it("a user token is sent as Bearer next to a new key", () => {
    expect(supabaseHeaders("sb_publishable_abc", "user.jwt.token")).toEqual({ apikey: "sb_publishable_abc", Authorization: "Bearer user.jwt.token" });
  });

  it("legacy JWT keys keep the old apikey + Bearer behaviour", () => {
    expect(isLegacyJwtKey(LEGACY)).toBe(true);
    expect(supabaseHeaders(LEGACY)).toEqual({ apikey: LEGACY, Authorization: `Bearer ${LEGACY}` });
  });

  it("the proof store sends a secret key only as apikey", async () => {
    const seen: Headers[] = [];
    const store = new SupabaseProofStore("https://p.supabase.test", "sb_secret_xyz", "proofs", (async (_u: string, init: RequestInit = {}) => {
      seen.push(new Headers(init.headers));
      return new Response("", { status: 200 });
    }) as typeof fetch);
    await store.put("00000000-0000-4000-8000-00000000a001/00000000-0000-4000-8000-0000000500a1/00000000-0000-4000-8000-0000000000f1.jpg", Buffer.from([0xff, 0xd8, 0xff]), "image/jpeg");
    expect(seen[0]!.get("apikey")).toBe("sb_secret_xyz");
    expect(seen[0]!.get("authorization")).toBeNull();
  });
});

/** ES256 tokens verified against a JWKS endpoint, like Supabase's new signing keys. */
describe("SupabaseTokenVerifier with ES256 JWKS", () => {
  let server: Server;
  let base = "";
  let priv: CryptoKey;
  beforeAll(async () => {
    const kp = await generateKeyPair("ES256", { extractable: true });
    priv = kp.privateKey;
    const jwk = { ...(await exportJWK(kp.publicKey)), alg: "ES256", kid: "k1", use: "sig" };
    server = createServer((req, res) => {
      if (req.url === "/auth/v1/.well-known/jwks.json") {
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ keys: [jwk] }));
      } else res.writeHead(404).end();
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  });
  afterAll(() => new Promise<void>((r) => server.close(() => r())));

  const token = (alg: "ES256" | "HS256", key: CryptoKey | Uint8Array, claims: { iss?: string; aud?: string } = {}) =>
    new SignJWT({ email: "a@x.test", aal: "aal2" })
      .setProtectedHeader({ alg, kid: "k1" })
      .setSubject("00000000-0000-4000-8000-000000000001")
      .setIssuer(claims.iss ?? `${base}/auth/v1`)
      .setAudience(claims.aud ?? "authenticated")
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(key);

  it("accepts a valid ES256 token and keeps the aal claim", async () => {
    const v = new SupabaseTokenVerifier({ supabaseUrl: base });
    await expect(v.verify(await token("ES256", priv))).resolves.toEqual({ userId: "00000000-0000-4000-8000-000000000001", email: "a@x.test", aal: "aal2" });
  });

  it("rejects HS256 tokens when verifying with JWKS (no algorithm confusion)", async () => {
    const v = new SupabaseTokenVerifier({ supabaseUrl: base });
    await expect(v.verify(await token("HS256", new TextEncoder().encode("x".repeat(40))))).rejects.toThrow();
  });

  it("rejects a token signed by another key, a wrong issuer or audience", async () => {
    const v = new SupabaseTokenVerifier({ supabaseUrl: base });
    const other = (await generateKeyPair("ES256")).privateKey;
    await expect(v.verify(await token("ES256", other))).rejects.toThrow();
    await expect(v.verify(await token("ES256", priv, { iss: "https://evil.example/auth/v1" }))).rejects.toThrow();
    await expect(v.verify(await token("ES256", priv, { aud: "anon" }))).rejects.toThrow();
  });

  it("legacy secret mode accepts HS256 only", async () => {
    const secret = "s".repeat(40);
    const v = new SupabaseTokenVerifier({ supabaseUrl: base, jwtSecret: secret });
    await expect(v.verify(await token("HS256", new TextEncoder().encode(secret)))).resolves.toMatchObject({ aal: "aal2" });
    await expect(v.verify(await token("ES256", priv))).rejects.toThrow();
  });
});
