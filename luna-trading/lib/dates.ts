import type { Locale } from "@/content/i18n/config";

/** "8. November 2026" / "8 November 2026" / Arabic month with Latin digits (as on the rest of the site). Server-side only. */
export function formatDate(locale: Locale, iso: string) {
  const tag =
    locale === "ar" ? "ar-u-nu-latn" : locale === "en" ? "en-GB" : "de-DE";
  return new Intl.DateTimeFormat(tag, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${iso}T12:00:00Z`));
}
