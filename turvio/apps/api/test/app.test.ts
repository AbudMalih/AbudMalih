import { SignJWT } from "jose";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../src/app";
import { SupabaseTokenVerifier } from "../src/auth/tokens";
import { loadConfig } from "../src/config";
import { syntheticTenancy } from "../src/tenancy";

const SUPABASE_URL = "https://example.supabase.test";
const SECRET = "test-secret-test-secret-test-secret-0123";

async function token(sub: string, opts: { secret?: string; issuer?: string; expiresIn?: string } = {}) {
  return new SignJWT({ role: "authenticated", email: `${sub}@example.test` })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(sub)
    .setIssuer(opts.issuer ?? `${SUPABASE_URL}/auth/v1`)
    .setAudience("authenticated")
    .setIssuedAt()
    .setExpirationTime(opts.expiresIn ?? "5m")
    .sign(new TextEncoder().encode(opts.secret ?? SECRET));
}

const optimizeBody = {
  vehicles: [{ id: "v1", start: { lat: 51.0, lng: 11.04 }, shiftStart: 480, maxShiftMinutes: 480 }],
  stops: [{ id: "s1", location: { lat: 50.97, lng: 11.03 }, serviceSeconds: 60 }],
  timeLimitSeconds: 1,
};
const optimizerResult = {
  routes: [{ vehicleId: "v1", visits: [{ stopId: "s1", arrivalMinute: 490 }], distanceMeters: 4000, durationSeconds: 900 }],
  unassignedStopIds: [],
  matrixSource: "haversine_estimate",
  status: "feasible",
  engine: "or-tools",
};

function makeApp(fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify(optimizerResult), { status: 200 }))) {
  const app = buildApp({
    verifier: new SupabaseTokenVerifier({ supabaseUrl: SUPABASE_URL, jwtSecret: SECRET }),
    tenancy: syntheticTenancy(),
    optimizerUrl: "http://optimizer.test",
    fetchImpl: fetchImpl as unknown as typeof fetch,
  });
  return { app, fetchImpl };
}

afterEach(() => vi.restoreAllMocks());

describe("authentication", () => {
  it("rejects missing, forged, expired and foreign-issuer tokens", async () => {
    const { app } = makeApp();
    const cases = [
      undefined,
      await token("usr_drv_01", { secret: "another-secret-another-secret-012345" }),
      await token("usr_drv_01", { expiresIn: "-1m" }),
      await token("usr_drv_01", { issuer: "https://evil.test/auth/v1" }),
    ];
    for (const t of cases) {
      const res = await app.inject({ method: "GET", url: "/v1/me", headers: t ? { authorization: `Bearer ${t}` } : {} });
      expect(res.statusCode).toBe(401);
    }
  });

  it("returns the caller's memberships", async () => {
    const { app } = makeApp();
    const res = await app.inject({ method: "GET", url: "/v1/me", headers: { authorization: `Bearer ${await token("usr_owner_jarbou")}` } });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ userId: "usr_owner_jarbou", platformAdmin: false, memberships: [{ organizationId: "org_jarbou", role: "owner" }] });
  });
});

describe("tenant isolation and roles", () => {
  it("forbids access to another tenant (same response for unknown orgs)", async () => {
    const { app, fetchImpl } = makeApp();
    const auth = { authorization: `Bearer ${await token("usr_owner_muster")}` };
    const other = await app.inject({ method: "POST", url: "/v1/orgs/org_jarbou/optimize", headers: auth, payload: optimizeBody });
    const unknown = await app.inject({ method: "POST", url: "/v1/orgs/org_nope/optimize", headers: auth, payload: optimizeBody });
    expect(other.statusCode).toBe(403);
    expect(unknown.statusCode).toBe(403);
    expect(other.json()).toEqual(unknown.json());
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("drivers can optimize but cannot see billing", async () => {
    const { app } = makeApp();
    const auth = { authorization: `Bearer ${await token("usr_drv_01")}` };
    expect((await app.inject({ method: "GET", url: "/v1/orgs/org_jarbou/subscription", headers: auth })).statusCode).toBe(403);
    expect((await app.inject({ method: "POST", url: "/v1/orgs/org_jarbou/optimize", headers: auth, payload: optimizeBody })).statusCode).toBe(200);
  });

  it("owners see their subscription; payments are reported as disabled", async () => {
    const { app } = makeApp();
    const res = await app.inject({
      method: "GET",
      url: "/v1/orgs/org_jarbou/subscription",
      headers: { authorization: `Bearer ${await token("usr_owner_jarbou")}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ subscription: { planCode: "business", status: "active" }, paymentsEnabled: false, usable: true });
  });
});

describe("optimize gateway", () => {
  it("validates input before calling the optimizer", async () => {
    const { app, fetchImpl } = makeApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/orgs/org_jarbou/optimize",
      headers: { authorization: `Bearer ${await token("usr_dispatch_jarbou")}` },
      payload: { ...optimizeBody, stops: [{ id: "s1", location: { lat: 123, lng: 0 }, serviceSeconds: 1 }] },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("validation_failed");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("forwards valid requests and returns the validated result", async () => {
    const { app, fetchImpl } = makeApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/orgs/org_jarbou/optimize",
      headers: { authorization: `Bearer ${await token("usr_dispatch_jarbou")}` },
      payload: optimizeBody,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual(optimizerResult);
    expect(fetchImpl).toHaveBeenCalledWith("http://optimizer.test/optimize", expect.objectContaining({ method: "POST" }));
  });

  it("maps optimizer failures to 502 without leaking details", async () => {
    const { app } = makeApp(vi.fn().mockRejectedValue(new Error("ECONNREFUSED 10.0.0.5")));
    const res = await app.inject({
      method: "POST",
      url: "/v1/orgs/org_jarbou/optimize",
      headers: { authorization: `Bearer ${await token("usr_dispatch_jarbou")}` },
      payload: optimizeBody,
    });
    expect(res.statusCode).toBe(502);
    expect(res.body).not.toContain("10.0.0.5");
  });
});

describe("config", () => {
  it("refuses unsafe production settings and requires what each provider needs", () => {
    expect(() => loadConfig({ NODE_ENV: "production", AUTH_PROVIDER: "dev" })).toThrow(/not allowed in production/);
    expect(() => loadConfig({ NODE_ENV: "production", AUTH_PROVIDER: "local", DATABASE_URL: "postgres://x", JWT_SECRET: "x".repeat(40), DEV_MAILBOX: "true" })).toThrow(/DEV_MAILBOX/);
    expect(() => loadConfig({ AUTH_PROVIDER: "local" })).toThrow(/DATABASE_URL/);
    expect(() => loadConfig({ AUTH_PROVIDER: "local", DATABASE_URL: "postgres://x" })).toThrow(/JWT_SECRET/);
    expect(() => loadConfig({ AUTH_PROVIDER: "supabase", DATABASE_URL: "postgres://x" })).toThrow(/SUPABASE_URL/);
    expect(loadConfig({ AUTH_PROVIDER: "dev" }).AUTH_PROVIDER).toBe("dev");
  });

  it("requires admin MFA by default only in production; REQUIRE_ADMIN_MFA overrides", () => {
    const local = { AUTH_PROVIDER: "local", DATABASE_URL: "postgres://x", JWT_SECRET: "x".repeat(40) };
    expect(loadConfig({ ...local, NODE_ENV: "production" }).requireAdminMfa).toBe(true);
    expect(loadConfig({ ...local, NODE_ENV: "development" }).requireAdminMfa).toBe(false);
    expect(loadConfig({ ...local, NODE_ENV: "production", REQUIRE_ADMIN_MFA: "false" }).requireAdminMfa).toBe(false);
    expect(loadConfig({ ...local, NODE_ENV: "test", REQUIRE_ADMIN_MFA: "true" }).requireAdminMfa).toBe(true);
  });
});

describe("IP rate limit", () => {
  it("answers 429 after the per-minute budget and spares /health", async () => {
    const { buildApp } = await import("../src/app");
    const { syntheticTenancy } = await import("../src/tenancy");
    const { DevTokenVerifier } = await import("../src/auth/tokens");
    const app = buildApp({ verifier: new DevTokenVerifier(), tenancy: syntheticTenancy(), optimizerUrl: "http://x", rateLimitPerMinute: 60 });
    const codes: number[] = [];
    for (let i = 0; i < 20; i++) codes.push((await app.inject({ method: "GET", url: "/v1/me" })).statusCode);
    expect(codes.filter((c) => c === 429).length).toBeGreaterThan(0);
    expect((await app.inject({ method: "GET", url: "/health" })).statusCode).toBe(200);
  });
});
