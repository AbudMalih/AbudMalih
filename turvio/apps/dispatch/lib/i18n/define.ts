/**
 * Dispatch Web translations (English, German, Arabic). English is the source: every German and
 * Arabic namespace must have exactly its keys (checked by the type below and by the completeness
 * test). Plural forms are separate keys `name#one`, `name#other` (and for Arabic optionally
 * `#zero`, `#two`, `#few`, `#many`); `t("ns.name", { count })` picks the right one.
 */
export type Locale = "en" | "de" | "ar";
export const LOCALES: readonly Locale[] = ["en", "de", "ar"];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_NAMES: Record<Locale, string> = { en: "English", de: "Deutsch", ar: "العربية" };

export type PluralCategory = "zero" | "one" | "two" | "few" | "many" | "other";
type Extra = { [k: `${string}#${PluralCategory}`]: string };
export type Translation<E> = { [K in keyof E]: string } & Extra;

export function defineMessages<const E extends Record<string, string>>(m: { en: E; de: Translation<E>; ar: Translation<E> }) {
  return m;
}
