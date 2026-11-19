import type { MessageKey } from "@turvio/shared";
import { ApiError } from "./auth";

type T = (key: MessageKey, params?: Record<string, string | number>) => string;

/** Server and connection errors in the driver's language (never raw English server texts or codes). */
const BY_CODE: Record<string, MessageKey> = {
  network: "errors.network",
  not_configured: "errors.notConfigured",
  unauthenticated: "errors.unauthenticated",
  invalid_credentials: "errors.invalidCredentials",
  too_many_attempts: "errors.tooManyAttempts",
  rate_limited: "errors.rateLimited",
  file_missing: "errors.photoMissing",
  tour_closed: "sync.tourClosed",
  stop_cancelled: "sync.stopCancelled",
  support_unavailable: "errors.supportUnavailable",
};

export function errorText(e: unknown, t: T): string {
  if (e instanceof ApiError) {
    const key = BY_CODE[e.code];
    if (key) return t(key);
    if (e.status >= 500 || e.status === 0) return t("errors.server");
  }
  return t("errors.generic");
}

export function errorCodeText(code: string | undefined, t: T): string {
  const key = code ? BY_CODE[code] : undefined;
  return key ? t(key) : t("errors.generic");
}
