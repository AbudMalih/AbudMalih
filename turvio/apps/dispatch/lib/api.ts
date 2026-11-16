/** Browser-side calls to the TURVIO API through the app's session proxy. */
import { currentLocale, currentT, type MessageKey } from "./i18n";

export class ApiCallError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    /** Server request id – quoted to support, it finds the matching log line. */
    readonly requestId?: string,
  ) {
    super(message);
  }
}

/**
 * Error codes with a text in the user's language (common.error.*). Other codes keep the server's
 * (English) message – those are rare, specific validation texts; the code is shown with it.
 */
const FRIENDLY = new Set([
  "api_unavailable",
  "version_conflict",
  "optimizer_unavailable",
  "active_tour_confirmation_required",
  "forbidden",
  "not_found",
  "rate_limited",
  "tour_closed",
  "tour_archived",
  "tour_protected",
  "stop_protected",
  "stop_cancelled",
  "mfa_required",
]);
/** Server texts that are better than a generic translation in English (kept as before). */
const ENGLISH_FIRST = new Set(["forbidden", "not_found", "rate_limited", "tour_closed", "tour_archived", "tour_protected", "stop_protected", "stop_cancelled", "mfa_required"]);

function friendly(code: string, serverMessage: string | undefined, status: number): string {
  const t = currentT();
  const known = FRIENDLY.has(code);
  // In English, specific server messages stay as they were; other languages get the translation.
  if (known && !(ENGLISH_FIRST.has(code) && serverMessage && currentLocale() === "en")) return t(`common.error.${code}` as MessageKey);
  return serverMessage ?? t("common.error.http", { status });
}

export async function api<T = unknown>(method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE", path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api/turvio${path}`, {
      method,
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    throw new ApiCallError(0, "network", currentT()("common.error.network"));
  }
  if (res.status === 401) {
    window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname)}`);
    throw new ApiCallError(401, "unauthenticated", currentT()("common.error.unauthenticated"));
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = (data as { error?: { code?: string; message?: string; requestId?: string } }).error ?? {};
    const code = err.code ?? "error";
    if (res.status === 403 && code === "mfa_required") {
      // Company administration needs two-step verification: go to the set-up page and come back.
      const here = window.location.pathname + window.location.search;
      window.location.assign(`/security?required=1&next=${encodeURIComponent(here)}`);
    }
    throw new ApiCallError(res.status, code, friendly(code, err.message, res.status), err.requestId);
  }
  return data as T;
}

export const errorMessage = (e: unknown) =>
  e instanceof ApiCallError && e.status >= 400 && e.requestId
    ? currentT()("common.errorRef", { message: e.message, status: e.status, code: e.code, ref: e.requestId })
    : e instanceof Error
      ? e.message
      : String(e);
