import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { apiBaseUrl } from "./optimizer";

/**
 * TURVIO Driver authentication against the TURVIO API.
 * Tokens are kept in the device keychain/keystore (expo-secure-store); the
 * web build used for automated tests falls back to localStorage.
 */
const KEY_ACCESS = "turvio.access";
const KEY_REFRESH = "turvio.refresh";

export interface TokenStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export const defaultTokenStore: TokenStore =
  Platform.OS === "web"
    ? {
        get: async (k) => globalThis.localStorage?.getItem(k) ?? null,
        set: async (k, v) => globalThis.localStorage?.setItem(k, v),
        remove: async (k) => globalThis.localStorage?.removeItem(k),
      }
    : {
        get: (k) => SecureStore.getItemAsync(k),
        set: (k, v) => SecureStore.setItemAsync(k, v),
        remove: (k) => SecureStore.deleteItemAsync(k),
      };

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

/** True for failures worth retrying later (offline, server down). */
export const isTransient = (e: unknown) => !(e instanceof ApiError) || e.status === 0 || e.status >= 500 || e.status === 429;

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
}

export function createAuthClient(opts: { baseUrl?: string | null; store?: TokenStore; fetchImpl?: typeof fetch; onSignedOut?: () => void } = {}) {
  const store = opts.store ?? defaultTokenStore;
  const doFetch = opts.fetchImpl ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
  const base = () => opts.baseUrl ?? apiBaseUrl();

  async function raw(path: string, init: RequestInit = {}, token?: string | null): Promise<Response> {
    const b = base();
    if (!b) throw new ApiError(0, "not_configured", "No TURVIO server is configured in this build.");
    const headers: Record<string, string> = { "Content-Type": "application/json", ...(init.headers as Record<string, string>) };
    if (token) headers.Authorization = `Bearer ${token}`;
    try {
      return await doFetch(`${b}${path}`, { ...init, headers });
    } catch {
      throw new ApiError(0, "network", "No connection to TURVIO. Your changes are kept and sent when you are back online.");
    }
  }

  async function errorOf(res: Response): Promise<ApiError> {
    const data = (await res.json().catch(() => ({}))) as { error?: { code?: string; message?: string } };
    return new ApiError(res.status, data.error?.code ?? "error", data.error?.message ?? `Request failed (HTTP ${res.status})`);
  }

  async function saveSession(s: { accessToken: string; refreshToken: string }) {
    await store.set(KEY_ACCESS, s.accessToken);
    await store.set(KEY_REFRESH, s.refreshToken);
  }

  async function refresh(): Promise<string | null> {
    const rt = await store.get(KEY_REFRESH);
    if (!rt) return null;
    const res = await raw("/v1/auth/refresh", { method: "POST", body: JSON.stringify({ refreshToken: rt }) });
    if (!res.ok) {
      if (res.status === 401) {
        await clear();
        opts.onSignedOut?.();
      }
      return null;
    }
    const s = (await res.json()) as { accessToken: string; refreshToken: string };
    await saveSession(s);
    return s.accessToken;
  }

  async function clear() {
    await store.remove(KEY_ACCESS);
    await store.remove(KEY_REFRESH);
  }

  return {
    async login(email: string, password: string): Promise<SessionUser> {
      const res = await raw("/v1/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
      if (!res.ok) throw await errorOf(res);
      const s = (await res.json()) as { accessToken: string; refreshToken: string; user: SessionUser };
      await saveSession(s);
      return s.user;
    },
    async logout() {
      const rt = await store.get(KEY_REFRESH);
      if (rt) await raw("/v1/auth/logout", { method: "POST", body: JSON.stringify({ refreshToken: rt }) }).catch(() => undefined);
      await clear();
    },
    async forgotPassword(email: string) {
      const res = await raw("/v1/auth/password/forgot", { method: "POST", body: JSON.stringify({ email, app: "dispatch" }) });
      if (!res.ok) throw await errorOf(res);
    },
    async hasSession() {
      return !!(await store.get(KEY_REFRESH));
    },
    /** Authorized JSON request with one automatic token refresh. */
    async request<T>(method: string, path: string, body?: unknown): Promise<T> {
      let token = await store.get(KEY_ACCESS);
      const init: RequestInit = { method, body: body === undefined ? undefined : JSON.stringify(body) };
      let res = await raw(path, init, token);
      if (res.status === 401) {
        token = await refresh();
        if (!token) throw new ApiError(401, "unauthenticated", "Please sign in again.");
        res = await raw(path, init, token);
      }
      if (!res.ok) throw await errorOf(res);
      return (res.status === 204 ? undefined : await res.json()) as T;
    },
  };
}

export type AuthClient = ReturnType<typeof createAuthClient>;
