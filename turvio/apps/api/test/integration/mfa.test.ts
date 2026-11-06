import { decodeJwt } from "jose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { base32Decode, totp } from "../../src/auth/totp";
import { SEED_USERS as U } from "../../src/seed";
import { PASSWORD, createTestEnv, postgresAvailable, type TestEnv } from "./helpers";

const available = await postgresAvailable();

let env: TestEnv;
const now = () => Date.now() / 1000;

describe.runIf(available)("two-step verification (TOTP) with REQUIRE_ADMIN_MFA", () => {
  beforeAll(async () => {
    env = await createTestEnv("mfa", { requireAdminMfa: true });
  }, 120_000);
  afterAll(async () => {
    await env?.close();
  });

  const post = (url: string, payload: unknown, token?: string) =>
    env.app.inject({ method: "POST", url, payload: payload as never, headers: token ? { authorization: `Bearer ${token}` } : {} });
  const get = (url: string, token: string) => env.app.inject({ method: "GET", url, headers: { authorization: `Bearer ${token}` } });
  const login = async (email: string) => (await post("/v1/auth/login", { email, password: PASSWORD })).json();
  const members = () => `/v1/orgs/${env.data.orgs.jarbou}/members`;

  let ownerSecret: Buffer;
  let ownerAal2: { accessToken: string; refreshToken: string };
  const t0 = now();

  it("without a second factor: login gives aal1, admin endpoints answer mfa_required, everyday endpoints work", async () => {
    const s = await login(U.jarbouOwner);
    expect(s.aal).toBe("aal1");
    expect(decodeJwt(s.accessToken).aal).toBe("aal1");
    const r = await get(members(), s.accessToken);
    expect(r.statusCode).toBe(403);
    expect(r.json().error.code).toBe("mfa_required");
    expect((await get(`/v1/orgs/${env.data.orgs.jarbou}/subscription`, s.accessToken)).json().error.code).toBe("mfa_required");
    expect((await get(`/v1/orgs/${env.data.orgs.jarbou}/dispatch`, s.accessToken)).statusCode).toBe(200);
    expect((await get("/v1/me", s.accessToken)).json().aal).toBe("aal1");
    // Non-members still get the plain "forbidden" (the MFA gate never replaces the tenant checks).
    const muster = await login(U.musterOwner);
    expect((await get(members(), muster.accessToken)).json().error.code).toBe("forbidden");
    const dispatcher = await login(U.dispatcherHannover);
    expect((await get(members(), dispatcher.accessToken)).json().error.code).toBe("forbidden");
  });

  it("enrols, stores the secret encrypted, activates with a code and ends password-only sessions", async () => {
    const old = await login(U.jarbouOwner);
    expect((await get("/v1/auth/mfa", old.accessToken)).json()).toMatchObject({ enabled: false, aal: "aal1" });
    expect((await post("/v1/auth/mfa/activate", { code: "123456" }, old.accessToken)).json().error.code).toBe("no_pending_factor");

    const e = (await post("/v1/auth/mfa/enroll", {}, old.accessToken)).json();
    expect(e.secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(e.otpauthUrl).toContain("otpauth://totp/TURVIO%3Aowner%40jarbou.test?secret=");
    ownerSecret = base32Decode(e.secret);

    const { rows } = await env.superuser.query(`select f.secret_encrypted from app_auth.mfa_factors f join auth.users u on u.id = f.user_id where u.email = $1`, [U.jarbouOwner]);
    expect(rows[0].secret_encrypted).toMatch(/^v1\./);
    expect(rows[0].secret_encrypted).not.toContain(e.secret);
    expect(rows[0].secret_encrypted).not.toContain(ownerSecret.toString("hex"));

    const wrong = await post("/v1/auth/mfa/activate", { code: totp(ownerSecret, t0 - 300) }, old.accessToken);
    expect(wrong.statusCode).toBe(422);
    expect(wrong.json().error.code).toBe("invalid_code");

    const ok = await post("/v1/auth/mfa/activate", { code: totp(ownerSecret, t0) }, old.accessToken);
    expect(ok.statusCode).toBe(200);
    const s = ok.json();
    expect(s.aal).toBe("aal2");
    expect(decodeJwt(s.accessToken).aal).toBe("aal2");
    expect((await get(members(), s.accessToken)).statusCode).toBe(200);
    // The password-only session was revoked.
    expect((await post("/v1/auth/refresh", { refreshToken: old.refreshToken })).statusCode).toBe(401);
    // Enrolling again does not replace the active factor.
    expect((await post("/v1/auth/mfa/enroll", {}, s.accessToken)).json().error.code).toBe("mfa_already_enabled");
    expect((await get("/v1/auth/mfa", s.accessToken)).json()).toMatchObject({ enabled: true, aal: "aal2" });
  });

  it("login then requires the code; a code works once; the mfaToken is single-use", async () => {
    const step1 = await login(U.jarbouOwner);
    expect(step1).toEqual({ mfaRequired: true, mfaToken: expect.any(String), factorType: "totp" });
    expect(step1.accessToken).toBeUndefined();

    // The code already used for activation is refused (replay protection).
    const replay = await post("/v1/auth/mfa/verify", { mfaToken: step1.mfaToken, code: totp(ownerSecret, t0) });
    expect(replay.json().error.code).toBe("invalid_code");
    expect((await post("/v1/auth/mfa/verify", { mfaToken: step1.mfaToken, code: "12345" })).statusCode).toBe(400);

    const ok = await post("/v1/auth/mfa/verify", { mfaToken: step1.mfaToken, code: totp(ownerSecret, t0 + 30) });
    expect(ok.statusCode).toBe(200);
    ownerAal2 = ok.json();
    expect(ok.json().aal).toBe("aal2");
    // Same challenge again – even with a fresh code – is refused.
    const again = await post("/v1/auth/mfa/verify", { mfaToken: step1.mfaToken, code: totp(ownerSecret, t0 - 30) });
    expect(again.statusCode).toBe(401);
    expect(again.json().error.code).toBe("invalid_token");
  });

  it("refresh keeps aal2", async () => {
    const r = await post("/v1/auth/refresh", { refreshToken: ownerAal2.refreshToken });
    expect(r.statusCode).toBe(200);
    expect(r.json().aal).toBe("aal2");
    expect(decodeJwt(r.json().accessToken).aal).toBe("aal2");
    expect((await get(members(), r.json().accessToken)).statusCode).toBe(200);
  });

  it("expired challenges are refused", async () => {
    const step1 = await login(U.jarbouOwner);
    await env.superuser.query(`update app_auth.mfa_challenges set expires_at = now() - interval '1 second' where consumed_at is null`);
    expect((await post("/v1/auth/mfa/verify", { mfaToken: step1.mfaToken, code: "000000" })).json().error.code).toBe("invalid_token");
  });

  it("throttles wrong codes per challenge (5) and per account (10 in 15 minutes)", async () => {
    await env.superuser.query(`delete from app_auth.mfa_failures`);
    const a = await login(U.jarbouOwner);
    for (let i = 0; i < 5; i++) expect((await post("/v1/auth/mfa/verify", { mfaToken: a.mfaToken, code: "000000" })).json().error.code).toBe("invalid_code");
    // The challenge is used up, even for a correct code.
    expect((await post("/v1/auth/mfa/verify", { mfaToken: a.mfaToken, code: totp(ownerSecret, now()) })).statusCode).not.toBe(200);

    const b = await login(U.jarbouOwner);
    for (let i = 0; i < 5; i++) expect((await post("/v1/auth/mfa/verify", { mfaToken: b.mfaToken, code: "000000" })).json().error.code).toBe("invalid_code");
    const c = await login(U.jarbouOwner);
    const blocked = await post("/v1/auth/mfa/verify", { mfaToken: c.mfaToken, code: totp(ownerSecret, now()) });
    expect(blocked.statusCode).toBe(429);
    expect(blocked.json().error.code).toBe("too_many_attempts");
    await env.superuser.query(`delete from app_auth.mfa_failures`);
  });

  it("platform endpoints need aal2 as well", async () => {
    const s = await login(U.platformAdmin);
    const r = await get("/v1/platform/overview", s.accessToken);
    expect(r.statusCode).toBe(403);
    expect(r.json().error.code).toBe("mfa_required");
    // Not a platform admin: still "forbidden".
    const owner = await post("/v1/auth/refresh", { refreshToken: ownerAal2.refreshToken });
    expect(owner.statusCode).toBe(401); // rotated in the refresh test
    const driver = await login(U.driverHannover1);
    expect((await get("/v1/platform/overview", driver.accessToken)).json().error.code).toBe("forbidden");

    const e = (await post("/v1/auth/mfa/enroll", {}, s.accessToken)).json();
    const a = await post("/v1/auth/mfa/activate", { code: totp(base32Decode(e.secret), now()) }, s.accessToken);
    expect(a.statusCode).toBe(200);
    expect((await get("/v1/platform/overview", a.json().accessToken)).statusCode).toBe(200);
  });

  it("drivers are not affected", async () => {
    const d = await login(U.driverHannover1);
    expect(d.aal).toBe("aal1");
    expect((await get("/v1/me", d.accessToken)).statusCode).toBe(200);
  });
});
