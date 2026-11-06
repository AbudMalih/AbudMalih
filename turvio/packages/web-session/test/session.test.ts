import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { COOKIES, loginHandler, logoutHandler, mfaActivateHandler, mfaVerifyHandler, proxyHandler, serverApi, sessionProxy } from "../src/index";

const session = (n: number) => ({ accessToken: `access-${n}`, refreshToken: `refresh-${n}`, expiresIn: 900, user: { id: "u", email: "a@b.test", name: null } });
let calls: { url: string; method: string; auth: string | null; body?: string }[];
let accessOk: string;
let mfaUser: boolean;

beforeEach(() => {
  calls = [];
  accessOk = "access-1";
  mfaUser = false;
  process.env.TURVIO_API_URL = "http://api.test";
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const auth = new Headers(init.headers).get("authorization");
      calls.push({ url, method: init.method ?? "GET", auth, body: init.body as string | undefined });
      if (url.endsWith("/v1/auth/login")) return mfaUser ? Response.json({ mfaRequired: true, mfaToken: "challenge-secret", factorType: "totp" }) : Response.json(session(1));
      if (url.endsWith("/v1/auth/mfa/verify")) {
        const b = JSON.parse(String(init.body));
        if (b.mfaToken !== "challenge-secret") return Response.json({ error: { code: "invalid_token" } }, { status: 401 });
        if (b.code !== "123456") return Response.json({ error: { code: "invalid_code", message: "wrong" } }, { status: 422 });
        return Response.json({ ...session(3), aal: "aal2" });
      }
      if (url.endsWith("/v1/auth/mfa/activate")) {
        if (auth !== `Bearer ${accessOk}`) return Response.json({ error: { code: "unauthenticated" } }, { status: 401 });
        return JSON.parse(String(init.body)).code === "123456" ? Response.json({ ...session(4), aal: "aal2" }) : Response.json({ error: { code: "invalid_code" } }, { status: 422 });
      }
      if (url.endsWith("/v1/orgs/o/members")) return Response.json({ error: { code: "mfa_required", message: "needs 2fa" } }, { status: 403 });
      if (url.endsWith("/v1/auth/refresh")) {
        const rt = JSON.parse(String(init.body)).refreshToken;
        if (rt !== "refresh-1") return Response.json({ error: { code: "invalid_token" } }, { status: 401 });
        accessOk = "access-2";
        return Response.json(session(2));
      }
      if (url.endsWith("/v1/auth/logout")) return new Response(null, { status: 204 });
      if (auth !== `Bearer ${accessOk}`) return Response.json({ error: { code: "unauthenticated" } }, { status: 401 });
      if (url.includes("/file")) return new Response(new Uint8Array([0xff, 0xd8, 0xff, 0x00, 0x80]), { headers: { "content-type": "image/jpeg", "cache-control": "private, no-store", "x-content-type-options": "nosniff" } });
      return Response.json({ ok: true, url });
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

const req = (url: string, init: { method?: string; body?: string; cookies?: Record<string, string> } = {}) =>
  new NextRequest(url, {
    method: init.method ?? "GET",
    body: init.body,
    headers: init.cookies ? { cookie: Object.entries(init.cookies).map(([k, v]) => `${k}=${v}`).join("; ") } : undefined,
  });

describe("login/logout", () => {
  it("stores tokens only in httpOnly cookies, never in the response body", async () => {
    const res = await loginHandler(req("http://app.test/api/auth/login", { method: "POST", body: JSON.stringify({ email: "a@b.test", password: "x" }) }));
    const body = await res.json();
    expect(body).toEqual({ user: { id: "u", email: "a@b.test", name: null } });
    const access = res.cookies.get(COOKIES.access)!;
    expect(access.value).toBe("access-1");
    expect(access.httpOnly).toBe(true);
    expect(res.cookies.get(COOKIES.refresh)!.httpOnly).toBe(true);
  });

  it("revokes the refresh token at the API and clears cookies", async () => {
    const res = await logoutHandler(req("http://app.test/api/auth/logout", { method: "POST", cookies: { [COOKIES.refresh]: "refresh-1" } }));
    expect(calls.find((c) => c.url.endsWith("/v1/auth/logout"))!.body).toBe(JSON.stringify({ refreshToken: "refresh-1" }));
    expect(res.cookies.get(COOKIES.access)!.value).toBe("");
  });
});

describe("API proxy", () => {
  it("forwards with the access token from the cookie", async () => {
    const res = await proxyHandler(req("http://app.test/api/turvio/v1/me?x=1", { cookies: { [COOKIES.access]: "access-1" } }), ["v1", "me"]);
    expect(res.status).toBe(200);
    expect(calls[0]).toMatchObject({ url: "http://api.test/v1/me?x=1", auth: "Bearer access-1" });
  });

  it("refreshes an expired access token once, retries and sets new cookies", async () => {
    accessOk = "never";
    const res = (await proxyHandler(req("http://app.test/api/turvio/v1/me", { cookies: { [COOKIES.access]: "stale", [COOKIES.refresh]: "refresh-1" } }), ["v1", "me"])) as Response & {
      cookies?: { get(n: string): { value: string } | undefined };
    };
    expect(res.status).toBe(200);
    expect(calls.map((c) => c.url)).toEqual(["http://api.test/v1/me", "http://api.test/v1/auth/refresh", "http://api.test/v1/me"]);
    expect(res.headers.get("set-cookie")).toContain(`${COOKIES.access}=access-2`);
  });

  it("passes proof images through byte-for-byte with private caching headers", async () => {
    const res = await proxyHandler(req("http://app.test/api/turvio/v1/orgs/o/proofs/p/file", { cookies: { [COOKIES.access]: "access-1" } }), ["v1", "orgs", "o", "proofs", "p", "file"]);
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(new Uint8Array([0xff, 0xd8, 0xff, 0x00, 0x80]));
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("refuses paths outside /v1 and clears cookies when the session is gone", async () => {
    expect((await proxyHandler(req("http://app.test/api/turvio/admin"), ["admin"])).status).toBe(404);
    const res = await proxyHandler(req("http://app.test/api/turvio/v1/me", { cookies: { [COOKIES.access]: "stale" } }), ["v1", "me"]);
    expect(res.status).toBe(401);
    expect(res.headers.get("set-cookie")).toContain(`${COOKIES.access}=;`);
  });
});

describe("page guard", () => {
  it("lets public pages through and redirects signed-out visitors to /login with next", async () => {
    expect((await sessionProxy(req("http://app.test/login"))).headers.get("location")).toBeNull();
    const res = await sessionProxy(req("http://app.test/planning?date=2026-11-05"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://app.test/login?next=%2Fplanning%3Fdate%3D2026-11-05");
  });

  it("renews the session from the refresh cookie before rendering", async () => {
    const res = await sessionProxy(req("http://app.test/map", { cookies: { [COOKIES.refresh]: "refresh-1" } }));
    expect(res.headers.get("location")).toBeNull();
    expect(res.cookies.get(COOKIES.access)!.value).toBe("access-2");
  });
});

describe("two-step verification", () => {
  const post = (url: string, body: unknown, cookies?: Record<string, string>) => req(url, { method: "POST", body: JSON.stringify(body), cookies });

  it("login with a second factor keeps the challenge in an httpOnly cookie and sets no session", async () => {
    mfaUser = true;
    const res = await loginHandler(post("http://app.test/api/auth/login", { email: "a@b.test", password: "x" }));
    expect(await res.json()).toEqual({ mfaRequired: true, factorType: "totp" });
    const c = res.cookies.get(COOKIES.mfa)!;
    expect(c.value).toBe("challenge-secret");
    expect(c.httpOnly).toBe(true);
    expect(c.maxAge).toBe(300);
    expect(res.cookies.get(COOKIES.access)).toBeUndefined();
  });

  it("verify sends cookie + code, sets session cookies and clears the challenge", async () => {
    const res = await mfaVerifyHandler(post("http://app.test/api/auth/mfa/verify", { code: "123456" }, { [COOKIES.mfa]: "challenge-secret" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ user: { id: "u", email: "a@b.test", name: null } });
    expect(calls[0]!.body).toBe(JSON.stringify({ mfaToken: "challenge-secret", code: "123456" }));
    expect(res.cookies.get(COOKIES.access)!.value).toBe("access-3");
    expect(res.cookies.get(COOKIES.mfa)!.value).toBe("");
  });

  it("a wrong code keeps the challenge; a missing or dead challenge asks to sign in again", async () => {
    const wrong = await mfaVerifyHandler(post("http://app.test/api/auth/mfa/verify", { code: "000000" }, { [COOKIES.mfa]: "challenge-secret" }));
    expect(wrong.status).toBe(422);
    expect(wrong.cookies.get(COOKIES.mfa)).toBeUndefined();
    expect((await mfaVerifyHandler(post("http://app.test/api/auth/mfa/verify", { code: "123456" }))).status).toBe(401);
    expect(calls).toHaveLength(1);
    const dead = await mfaVerifyHandler(post("http://app.test/api/auth/mfa/verify", { code: "123456" }, { [COOKIES.mfa]: "other" }));
    expect(dead.status).toBe(401);
    expect(dead.cookies.get(COOKIES.mfa)!.value).toBe("");
  });

  it("activation replaces the session cookies with the aal2 session (tokens never in the body)", async () => {
    const res = await mfaActivateHandler(post("http://app.test/api/auth/mfa/activate", { code: "123456" }, { [COOKIES.access]: "access-1" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ user: { id: "u", email: "a@b.test", name: null }, aal: "aal2" });
    expect(res.cookies.get(COOKIES.access)!.value).toBe("access-4");
    expect(res.cookies.get(COOKIES.refresh)!.value).toBe("refresh-4");
    expect((await mfaActivateHandler(post("http://app.test/api/auth/mfa/activate", { code: "123456" }))).status).toBe(401);
  });

  it("the proxy refuses token-issuing auth endpoints but allows MFA status and enrolment", async () => {
    for (const p of [["v1", "auth", "login"], ["v1", "auth", "refresh"], ["v1", "auth", "mfa", "verify"], ["v1", "auth", "mfa", "activate"]]) {
      expect((await proxyHandler(req(`http://app.test/api/turvio/${p.join("/")}`, { method: "POST", body: "{}", cookies: { [COOKIES.access]: "access-1" } }), p)).status).toBe(404);
    }
    expect(calls).toHaveLength(0);
    const ok = await proxyHandler(req("http://app.test/api/turvio/v1/auth/mfa", { cookies: { [COOKIES.access]: "access-1" } }), ["v1", "auth", "mfa"]);
    expect(ok.status).toBe(200);
  });

  it("serverApi reports the error code (mfa_required) so pages can redirect to set-up", async () => {
    const r = await serverApi({ get: (n) => (n === COOKIES.access ? { value: "access-1" } : undefined) }, "/v1/orgs/o/members");
    expect(r).toEqual({ ok: false, status: 403, code: "mfa_required" });
  });
});
