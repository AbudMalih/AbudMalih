import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { COOKIES, loginHandler, logoutHandler, proxyHandler, sessionProxy } from "../src/index";

const session = (n: number) => ({ accessToken: `access-${n}`, refreshToken: `refresh-${n}`, expiresIn: 900, user: { id: "u", email: "a@b.test", name: null } });
let calls: { url: string; method: string; auth: string | null; body?: string }[];
let accessOk: string;

beforeEach(() => {
  calls = [];
  accessOk = "access-1";
  process.env.TURVIO_API_URL = "http://api.test";
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const auth = new Headers(init.headers).get("authorization");
      calls.push({ url, method: init.method ?? "GET", auth, body: init.body as string | undefined });
      if (url.endsWith("/v1/auth/login")) return Response.json(session(1));
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
