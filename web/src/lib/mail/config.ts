import "server-only";

/**
 * Mail configuration – read exclusively from server-side environment
 * variables. Nothing here is ever bundled for the browser.
 *
 * Production (one.com):
 *   SMTP_HOST=send.one.com  SMTP_PORT=465  SMTP_SECURE=true
 *   SMTP_USER / SMTP_PASSWORD = mailbox credentials (set in the hosting panel)
 */
const env = (k: string) => process.env[k]?.trim() || undefined;

export const mailConfig = {
  driver: () => env("MAIL_DRIVER"), // "log" = development preview only
  host: () => env("SMTP_HOST"),
  port: () => Number(env("SMTP_PORT") ?? 465),
  secure: () => (env("SMTP_SECURE") ?? "true") === "true",
  user: () => env("SMTP_USER"),
  password: () => env("SMTP_PASSWORD"),
  from: () => env("SMTP_FROM"),
};

/** Recipients. Careers has a confirmed default; business/general must be configured. */
export const recipients = {
  careers: () => env("CAREER_RECIPIENT") ?? "karriere@jarbou-logistik.com",
  business: () => env("BUSINESS_RECIPIENT") ?? null,
  general: () => env("GENERAL_RECIPIENT") ?? null,
};

/**
 * Applicant data retention in days. Intentionally WITHOUT default: the value
 * must match the final Datenschutzerklärung. When unset, emails contain a
 * neutral reminder instead of a date.
 */
export function applicantRetentionDays(): number | null {
  const v = Number(env("APPLICANT_RETENTION_DAYS"));
  return Number.isFinite(v) && v > 0 ? Math.round(v) : null;
}
