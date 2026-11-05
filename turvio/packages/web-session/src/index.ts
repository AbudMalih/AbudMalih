import { NextResponse, type NextRequest } from "next/server";

/**
 * Session handling for TURVIO Dispatch and Admin (server side only).
 *
 * The browser never sees API tokens: they live in httpOnly cookies set by the
 * Next.js app, and browser code talks to the API through `/api/turvio/*`,
 * which forwards with the access token and transparently refreshes it.
 */

export const API_URL = () => (process.env.TURVIO_API_URL ?? "http://localhost:4000").replace(/\/$/, "");

export const COOKIES = { access: "tv_at", refresh: "tv_rt", org: "tv_org" } as const;
const REFRESH_MAX_AGE = 60 * 60 * 24 * 30;

interface ApiSession {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: { id: string; email: string; name: string | null };
}

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

async function forwardJson(res: Response): Promise<NextResponse> {
  const text = await res.text();
  return new NextResponse(text || null, { status: res.status, headers: { "content-type": res.headers.get("content-type") ?? "application/json" } });
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
  const s = (await res.json()) as ApiSession;
  const out = NextResponse.json({ user: s.user });
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

export async function proxyHandler(req: NextRequest, path: string[]): Promise<Response> {
  const target = `/${path.map(encodeURIComponent).join("/")}${req.nextUrl.search}`;
  if (!target.startsWith("/v1/")) return NextResponse.json({ error: { code: "not_found", message: "Unknown endpoint" } }, { status: 404 });
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
  memberships: { organizationId: string; organizationName: string | null; role: "owner" | "admin" | "dispatcher" | "driver"; depotIds: string[] | null }[];
}

/** Fetch with the request's access token from a server component. */
export async function serverApi<T>(cookieStore: { get(name: string): { value: string } | undefined }, path: string): Promise<{ ok: true; data: T } | { ok: false; status: number }> {
  const token = cookieStore.get(COOKIES.access)?.value;
  if (!token) return { ok: false, status: 401 };
  const res = await api(path, { token }).catch(() => null);
  if (!res) return { ok: false, status: 503 };
  if (!res.ok) return { ok: false, status: res.status };
  return { ok: true, data: (await res.json()) as T };
}
