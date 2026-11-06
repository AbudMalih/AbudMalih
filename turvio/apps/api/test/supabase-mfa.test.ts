import { describe, expect, it } from "vitest";
import { isMfaChallenge } from "../src/auth/provider";
import { SupabaseAuthProvider } from "../src/auth/supabase";

/**
 * GoTrue MFA mapping with a mocked HTTP layer. NOT verified against a live
 * Supabase project – the request/response shapes follow the GoTrue API docs.
 */
const BASE = "https://proj.supabase.test";
const jwt = (aal: string) => `h.${Buffer.from(JSON.stringify({ sub: "u1", aal })).toString("base64url")}.s`;
const session = (aal: string, factors: unknown[] = []) => ({
  access_token: jwt(aal),
  refresh_token: `rt-${aal}`,
  expires_in: 3600,
  user: { id: "u1", email: "admin@x.test", user_metadata: { display_name: "Admin" }, factors },
});

function mock(routes: Record<string, (body: Record<string, unknown>, auth: string) => [number, unknown]>) {
  const calls: { method: string; path: string; auth: string; apikey: string; body: Record<string, unknown> }[] = [];
  const fetchImpl = (async (url: string, init: RequestInit = {}) => {
    const path = url.replace(`${BASE}/auth/v1`, "");
    const method = init.method ?? "GET";
    const auth = new Headers(init.headers).get("authorization") ?? "";
    const apikey = new Headers(init.headers).get("apikey") ?? "";
    const body = init.body ? JSON.parse(String(init.body)) : {};
    calls.push({ method, path, auth, apikey, body });
    const h = routes[`${method} ${path}`];
    const [status, data] = h ? h(body, auth) : [404, {}];
    return Response.json(data, { status });
  }) as typeof fetch;
  const p = new SupabaseAuthProvider({ url: BASE, anonKey: "anon", serviceRoleKey: "service-role-key-service-role-key" }, fetchImpl);
  return { p, calls };
}

describe("SupabaseAuthProvider MFA (mocked GoTrue)", () => {
  const verified = [{ id: "f1", factor_type: "totp", status: "verified" }];

  it("login without factors returns the session with aal1", async () => {
    const { p } = mock({ "POST /token?grant_type=password": () => [200, session("aal1")] });
    const r = await p.login("admin@x.test", "pw");
    expect(isMfaChallenge(r)).toBe(false);
    expect(r).toMatchObject({ aal: "aal1", refreshToken: "rt-aal1" });
  });

  it("login with a verified factor hides the aal1 tokens and verify upgrades to aal2", async () => {
    const { p, calls } = mock({
      "POST /token?grant_type=password": () => [200, session("aal1", verified)],
      "POST /factors/f1/challenge": () => [200, { id: "ch1", expires_at: 0 }],
      "POST /factors/f1/verify": (b) => (b.code === "123456" && b.challenge_id === "ch1" ? [200, session("aal2", verified)] : [422, { msg: "invalid" }]),
    });
    const r = await p.login("admin@x.test", "pw");
    if (!isMfaChallenge(r)) throw new Error("expected challenge");
    expect(r.mfaToken).not.toContain(jwt("aal1"));
    expect(JSON.stringify(r)).not.toContain("rt-aal1");
    await expect(p.mfaVerify(r.mfaToken, "000000")).rejects.toMatchObject({ code: "invalid_code" });
    const s = await p.mfaVerify(r.mfaToken, "123456");
    expect(s.aal).toBe("aal2");
    expect(calls.filter((c) => c.path === "/factors/f1/verify").every((c) => c.auth === `Bearer ${jwt("aal1")}`)).toBe(true);
    await expect(p.mfaVerify("v1.bad.token.x", "123456")).rejects.toMatchObject({ code: "invalid_token" });
  });

  it("enrols (removing unfinished factors), refuses when already enabled, activates the pending factor", async () => {
    let factors: unknown[] = [{ id: "old", factor_type: "totp", status: "unverified" }];
    const { p, calls } = mock({
      "GET /user": () => [200, { id: "u1", factors }],
      "DELETE /factors/old": () => [200, {}],
      "POST /factors": () => {
        factors = [{ id: "f2", factor_type: "totp", status: "unverified" }];
        return [200, { id: "f2", type: "totp", totp: { secret: "JBSWY3DPEHPK3PXP", uri: "otpauth://totp/TURVIO:admin?secret=JBSWY3DPEHPK3PXP" } }];
      },
      "POST /factors/f2/challenge": () => [200, { id: "ch2" }],
      "POST /factors/f2/verify": () => [200, session("aal2")],
    });
    const caller = { userId: "u1", accessToken: "user-at" };
    const e = await p.mfaEnroll(caller);
    expect(e).toEqual({ factorId: "f2", secret: "JBSWY3DPEHPK3PXP", otpauthUrl: expect.stringContaining("otpauth://") });
    expect(calls.some((c) => c.method === "DELETE" && c.path === "/factors/old")).toBe(true);
    expect((await p.mfaActivate(caller, "123456")).aal).toBe("aal2");
    factors = verified;
    expect(await p.mfaStatus(caller)).toEqual({ enabled: true });
    await expect(p.mfaEnroll(caller)).rejects.toMatchObject({ code: "mfa_already_enabled" });
  });
});

describe("SupabaseAuthProvider password policy (mocked GoTrue)", () => {
  it("does not create an account with a password shorter than 12 characters", async () => {
    const { p, calls } = mock({ "POST /token?grant_type=password": () => [400, {}] });
    await expect(p.ensureUser("new@x.test", "Short-pw-1", null)).rejects.toMatchObject({ code: "weak_password" });
    expect(calls.some((c) => c.path === "/admin/users")).toBe(false);
  });

  it("creates an account with a policy-compliant password via the admin API (works with sign-up disabled)", async () => {
    const { p, calls } = mock({ "POST /admin/users": () => [200, { id: "u-new" }] });
    await expect(p.ensureUser("new@x.test", "Long-enough-pw-2026", "New")).resolves.toEqual({ userId: "u-new", created: true });
    expect(calls[0]).toMatchObject({ path: "/admin/users", apikey: "service-role-key-service-role-key" });
  });

  it("an existing account may still accept with its current (older) password", async () => {
    const { p } = mock({ "POST /token?grant_type=password": () => [200, session("aal1")] });
    await expect(p.ensureUser("admin@x.test", "old-pw-1", null)).resolves.toEqual({ userId: "u1", created: false });
  });

  it("rejects a weak reset password before calling Supabase", async () => {
    const { p, calls } = mock({});
    await expect(p.resetPassword("recovery-token", "abc123")).rejects.toMatchObject({ code: "weak_password" });
    expect(calls).toEqual([]);
  });
});
