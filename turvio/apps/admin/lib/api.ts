import { currentT, type MessageKey } from "./i18n";

/**
 * Browser → TURVIO API through the Admin's proxy (app/api/turvio, which adds the session's access
 * token). Errors become an `ApiError` with a friendly text in the current language; a missing second
 * factor sends the browser to the two-step set-up and back (same as lib/load.ts on the server).
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Where the two-step set-up sends the browser back to once it is done. */
export function mfaRedirect(next: string = typeof window === "undefined" ? "/" : window.location.pathname + window.location.search) {
  window.location.assign(`/security?required=1&next=${encodeURIComponent(next)}`);
}

const CODE_TEXT: Record<string, MessageKey> = {
  forbidden: "common.error.forbidden",
  not_found: "common.error.notFound",
  validation_failed: "common.error.invalid",
  duplicate: "common.error.duplicate",
  rate_limited: "common.error.rateLimited",
  plan_required: "common.error.planRequired",
  invalid_operation: "common.error.notPossible",
  api_unavailable: "common.error.unavailable",
};

/** Friendly text for an API failure (never an HTTP code or a server message). */
export function friendlyError(status: number, code: string | undefined): string {
  const t = currentT();
  if (code && CODE_TEXT[code]) return t(CODE_TEXT[code]!);
  if (status === 401) return t("common.error.signedOut");
  if (status === 403) return t("common.error.forbidden");
  if (status === 404) return t("common.error.notFound");
  if (status === 409) return t("common.error.conflict");
  if (status === 400 || status === 422) return t("common.error.invalid");
  if (status === 429) return t("common.error.rateLimited");
  return t("common.error.unavailable");
}

export async function api<T = unknown>(method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE", path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api/turvio${path}`, {
      method,
      cache: "no-store",
      headers: body === undefined ? { accept: "application/json" } : { accept: "application/json", "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "network", currentT()("common.error.network"));
  }
  if (res.status === 204) return undefined as T;
  const data = (await res.json().catch(() => ({}))) as { error?: { code?: string } };
  if (!res.ok) {
    const code = data?.error?.code ?? "";
    if (res.status === 403 && code === "mfa_required") {
      mfaRedirect();
      throw new ApiError(403, code, currentT()("common.error.mfa"));
    }
    if (res.status === 401) window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname)}`);
    throw new ApiError(res.status, code, friendlyError(res.status, code));
  }
  return data as T;
}

export const errorText = (e: unknown) => (e instanceof ApiError ? e.message : currentT()("common.error.unexpected"));

/** Best effort: the user's language / appearance choice on their account (shared with Dispatch). */
export function savePreferences(p: { language?: "en" | "de" | "ar"; theme?: "system" | "dark" | "light" }) {
  return api("PUT", "/v1/me/preferences", p).catch(() => undefined);
}
