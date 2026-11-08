import { NextResponse, type NextRequest } from "next/server";

/**
 * Session handling for TURVIO Dispatch and Admin (server side only).
 *
 * The browser never sees API tokens: they live in httpOnly cookies set by the
 * Next.js app, and browser code talks to the API through `/api/turvio/*`,
 * which forwards with the access token and transparently refreshes it.
 */

export const API_URL = () => (process.env.TURVIO_API_URL ?? "http://localhost:4000").replace(/\/$/, "");

export const COOKIES = { access: "tv_at", refresh: "tv_rt", org: "tv_org", mfa: "tv_mfa" } as const;
const REFRESH_MAX_AGE = 60 * 60 * 24 * 30;
/** The second login step must finish within the API's challenge lifetime (5 minutes). */
const MFA_MAX_AGE = 5 * 60;

interface ApiSession {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: { id: string; email: string; name: string | null };
  aal?: "aal1" | "aal2";
}

interface ApiMfaChallenge {
  mfaRequired: true;
  mfaToken: string;
  factorType: "totp";
}

/** Where the apps send users whose action needs two-step verification. */
export const MFA_SETUP_PATH = "/security";

const secure = () => process.env.NODE_ENV === "production" && process.env.TURVIO_INSECURE_COOKIES !== "true";

function setSessionCookies(res: NextResponse, s: ApiSession) {
  const base = { httpOnly: true, sameSite: "lax" as const, secure: secure(), path: "/" };
  res.cookies.set(COOKIES.access, s.accessToken, { ...base, maxAge: Math.max(60, s.expiresIn - 30) });
  res.cookies.set(COOKIES.refresh, s.refreshToken, { ...base, maxAge: REFRESH_MAX_AGE });
}

export function clearSessionCookies(res: NextResponse) {
  for (const name of Object.values(COOKIES)) res.cookies.set(name, "", { path: "/", maxAge: 0 });
}

async function api(path: string, init: RequestInit & { token?: string } = {}) {
  const headers = new Headers(init.headers);
  if (init.token) headers.set("authorization", `Bearer ${init.token}`);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  return fetch(`${API_URL()}${path}`, { ...init, headers, cache: "no-store" });
}

const PASS_HEADERS = ["cache-control", "content-security-policy", "content-disposition", "x-content-type-options"];

async function forwardJson(res: Response): Promise<NextResponse> {
  const type = res.headers.get("content-type") ?? "application/json";
  if (type.startsWith("image/")) {
    // Proof-of-delivery files: bytes unchanged, private caching and CSP from the API.
    const headers: Record<string, string> = { "content-type": type };
    for (const h of PASS_HEADERS) {
      const v = res.headers.get(h);
      if (v) headers[h] = v;
    }
    return new NextResponse(await res.arrayBuffer(), { status: res.status, headers });
  }
  const text = await res.text();
  return new NextResponse(text || null, { status: res.status, headers: { "content-type": type } });
}

const unavailable = () => NextResponse.json({ error: { code: "api_unavailable", message: "The TURVIO service is not reachable. Please try again." } }, { status: 503 });

// ---------------------------------------------------------------------------
// Auth route handlers (mount at app/api/auth/<action>/route.ts)
// ---------------------------------------------------------------------------

export async function loginHandler(req: NextRequest): Promise<NextResponse> {
  const body = await req.text();
  const res = await api("/v1/auth/login", { method: "POST", body, headers: { "user-agent": req.headers.get("user-agent") ?? "" } }).catch(() => null);
  if (!res) return unavailable();
  if (!res.ok) return forwardJson(res);
  const s = (await res.json()) as ApiSession | ApiMfaChallenge;
  if ("mfaRequired" in s && s.mfaRequired) {
    // Second step: the challenge token stays in an httpOnly cookie, never in browser JavaScript.
    const out = NextResponse.json({ mfaRequired: true, factorType: s.factorType });
    out.cookies.set(COOKIES.mfa, s.mfaToken, { httpOnly: true, sameSite: "strict", secure: secure(), path: "/api/auth", maxAge: MFA_MAX_AGE });
    return out;
  }
  const session = s as ApiSession;
  const out = NextResponse.json({ user: session.user });
  setSessionCookies(out, session);
  return out;
}

const signInAgain = () => NextResponse.json({ error: { code: "invalid_token", message: "This sign-in step expired. Please sign in again." } }, { status: 401 });

/** Second login step: POST { code } with the challenge cookie from loginHandler. */
export async function mfaVerifyHandler(req: NextRequest): Promise<NextResponse> {
  const mfaToken = req.cookies.get(COOKIES.mfa)?.value;
  if (!mfaToken) return signInAgain();
  const { code } = (await req.json().catch(() => ({}))) as { code?: unknown };
  const res = await api("/v1/auth/mfa/verify", {
    method: "POST",
    body: JSON.stringify({ mfaToken, code: typeof code === "string" ? code : "" }),
    headers: { "user-agent": req.headers.get("user-agent") ?? "" },
  }).catch(() => null);
  if (!res) return unavailable();
  if (!res.ok) {
    const out = await forwardJson(res);
    // A used-up or expired challenge cannot be retried: start over at the password.
    if (res.status === 401 || res.status === 429) out.cookies.set(COOKIES.mfa, "", { path: "/api/auth", maxAge: 0 });
    return out;
  }
  const s = (await res.json()) as ApiSession;
  const out = NextResponse.json({ user: s.user });
  setSessionCookies(out, s);
  out.cookies.set(COOKIES.mfa, "", { path: "/api/auth", maxAge: 0 });
  return out;
}

/** Finishes TOTP set-up: POST { code }; the API returns a new two-step session that replaces the cookies. */
export async function mfaActivateHandler(req: NextRequest): Promise<NextResponse> {
  let token = req.cookies.get(COOKIES.access)?.value;
  let renewed: ApiSession | null = null;
  const refreshToken = req.cookies.get(COOKIES.refresh)?.value;
  if (!token && refreshToken) {
    renewed = await refresh(refreshToken);
    token = renewed?.accessToken;
  }
  if (!token) return NextResponse.json({ error: { code: "unauthenticated", message: "Your session ended. Please sign in again." } }, { status: 401 });
  const res = await api("/v1/auth/mfa/activate", { method: "POST", body: await req.text(), token, headers: { "user-agent": req.headers.get("user-agent") ?? "" } }).catch(() => null);
  if (!res) return unavailable();
  if (!res.ok) {
    const out = await forwardJson(res);
    if (renewed) setSessionCookies(out, renewed);
    return out;
  }
  const s = (await res.json()) as ApiSession;
  const out = NextResponse.json({ user: s.user, aal: s.aal ?? "aal2" });
  setSessionCookies(out, s);
  return out;
}

export async function logoutHandler(req: NextRequest): Promise<NextResponse> {
  const refresh = req.cookies.get(COOKIES.refresh)?.value;
  if (refresh) await api("/v1/auth/logout", { method: "POST", body: JSON.stringify({ refreshToken: refresh }) }).catch(() => null);
  const out = NextResponse.json({ ok: true });
  clearSessionCookies(out);
  return out;
}

export async function forgotHandler(req: NextRequest, app: "dispatch" | "admin"): Promise<NextResponse> {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const res = await api("/v1/auth/password/forgot", { method: "POST", body: JSON.stringify({ ...body, app }) }).catch(() => null);
  return res ? forwardJson(res) : unavailable();
}

export async function resetHandler(req: NextRequest): Promise<NextResponse> {
  const res = await api("/v1/auth/password/reset", { method: "POST", body: await req.text() }).catch(() => null);
  return res ? forwardJson(res) : unavailable();
}

export async function inviteInfoHandler(token: string): Promise<NextResponse> {
  const res = await api(`/v1/invitations/${encodeURIComponent(token)}`).catch(() => null);
  return res ? forwardJson(res) : unavailable();
}

export async function inviteAcceptHandler(req: NextRequest): Promise<NextResponse> {
  const res = await api("/v1/invitations/accept", { method: "POST", body: await req.text() }).catch(() => null);
  if (!res) return unavailable();
  if (!res.ok) return forwardJson(res);
  const s = (await res.json()) as ApiSession;
  const out = NextResponse.json({ user: s.user });
  setSessionCookies(out, s);
  return out;
}

// ---------------------------------------------------------------------------
// API proxy (mount at app/api/turvio/[...path]/route.ts)
// ---------------------------------------------------------------------------

async function refresh(refreshToken: string): Promise<ApiSession | null> {
  const res = await api("/v1/auth/refresh", { method: "POST", body: JSON.stringify({ refreshToken }) }).catch(() => null);
  return res && res.ok ? ((await res.json()) as ApiSession) : null;
}

/** Auth endpoints the browser may reach through the proxy; all others return tokens and have dedicated handlers. */
const PROXY_AUTH_ALLOWED = new Set(["/v1/auth/mfa", "/v1/auth/mfa/enroll"]);

export async function proxyHandler(req: NextRequest, path: string[]): Promise<Response> {
  const target = `/${path.map(encodeURIComponent).join("/")}${req.nextUrl.search}`;
  const pathOnly = `/${path.map(encodeURIComponent).join("/")}`;
  if (!target.startsWith("/v1/") || (pathOnly.startsWith("/v1/auth/") && !PROXY_AUTH_ALLOWED.has(pathOnly)) || pathOnly === "/v1/auth") {
    return NextResponse.json({ error: { code: "not_found", message: "Unknown endpoint" } }, { status: 404 });
  }
  const method = req.method;
  const body = method === "GET" || method === "HEAD" ? undefined : await req.text();
  let token = req.cookies.get(COOKIES.access)?.value;
  let renewed: ApiSession | null = null;
  const refreshToken = req.cookies.get(COOKIES.refresh)?.value;
  if (!token && refreshToken) {
    renewed = await refresh(refreshToken);
    token = renewed?.accessToken;
  }
  const accept = req.headers.get("accept") ?? "application/json";
  let res = await api(target, { method, body, token, headers: { accept }, signal: req.signal }).catch(() => null);
  if (res && res.status === 401 && refreshToken && !renewed) {
    renewed = await refresh(refreshToken);
    if (renewed) res = await api(target, { method, body, token: renewed.accessToken, headers: { accept }, signal: req.signal }).catch(() => null);
  }
  if (!res) return unavailable();
  if (accept.includes("text/event-stream") && res.ok && res.body) {
    // Stream server-sent events straight through.
    return new Response(res.body, { status: 200, headers: { "content-type": "text/event-stream", "cache-control": "no-cache, no-transform", connection: "keep-alive" } });
  }
  const out = res.status === 204 ? new NextResponse(null, { status: 204 }) : await forwardJson(res);
  if (renewed) setSessionCookies(out, renewed);
  if (res.status === 401 && !renewed) clearSessionCookies(out);
  return out;
}

// ---------------------------------------------------------------------------
// Request proxy (Next 16 `proxy.ts`): refresh sessions, guard pages
// ---------------------------------------------------------------------------

const PUBLIC = [/^\/login/, /^\/forgot-password/, /^\/reset-password/, /^\/invite/, /^\/api\//, /^\/_next\//, /^\/brand\//, /^\/favicon/, /^\/icon/, /^\/apple-icon/];

export async function sessionProxy(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((r) => r.test(pathname))) return NextResponse.next();
  const access = req.cookies.get(COOKIES.access)?.value;
  const refreshToken = req.cookies.get(COOKIES.refresh)?.value;
  if (access) return NextResponse.next();
  if (refreshToken) {
    const s = await refresh(refreshToken);
    if (s) {
      // Make the new token visible to this request's server components too.
      const headers = new Headers(req.headers);
      const cookies = req.cookies.getAll().filter((c) => c.name !== COOKIES.access && c.name !== COOKIES.refresh);
      headers.set("cookie", [...cookies.map((c) => `${c.name}=${c.value}`), `${COOKIES.access}=${s.accessToken}`, `${COOKIES.refresh}=${s.refreshToken}`].join("; "));
      const res = NextResponse.next({ request: { headers } });
      setSessionCookies(res, s);
      return res;
    }
  }
  const login = new URL("/login", req.url);
  if (pathname !== "/") login.searchParams.set("next", pathname + req.nextUrl.search);
  const res = NextResponse.redirect(login);
  clearSessionCookies(res);
  return res;
}

// ---------------------------------------------------------------------------
// Server components
// ---------------------------------------------------------------------------

export interface Me {
  userId: string;
  email: string | null;
  name: string | null;
  platformAdmin: boolean;
  /** aal2 = signed in with password and authenticator code. */
  aal?: "aal1" | "aal2";
  memberships: { organizationId: string; organizationName: string | null; role: "owner" | "admin" | "dispatcher" | "driver"; depotIds: string[] | null; allLocations?: boolean }[];
}

/** Fetch with the request's access token from a server component. */
export async function serverApi<T>(
  cookieStore: { get(name: string): { value: string } | undefined },
  path: string,
): Promise<{ ok: true; data: T } | { ok: false; status: number; code?: string }> {
  const token = cookieStore.get(COOKIES.access)?.value;
  if (!token) return { ok: false, status: 401 };
  const res = await api(path, { token }).catch(() => null);
  if (!res) return { ok: false, status: 503 };
  if (!res.ok) {
    const code = ((await res.json().catch(() => ({}))) as { error?: { code?: string } }).error?.code;
    return { ok: false, status: res.status, code };
  }
  return { ok: true, data: (await res.json()) as T };
}
