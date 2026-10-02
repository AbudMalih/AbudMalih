/**
 * Locale configuration. German is the default and is served at "/".
 * English and Arabic live under "/en" and "/ar". "/de/*" redirects to "/*".
 */
export const LOCALES = ["de", "en", "ar"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "de";
/** Cookie written only when the visitor picks a language explicitly. */
export const LOCALE_COOKIE = "luna-lang";

export const LOCALE_META: Record<Locale, { label: string; name: string; dir: "ltr" | "rtl"; htmlLang: string; og: string }> = {
  de: { label: "DE", name: "Deutsch", dir: "ltr", htmlLang: "de", og: "de_DE" },
  en: { label: "EN", name: "English", dir: "ltr", htmlLang: "en", og: "en_GB" },
  ar: { label: "AR", name: "العربية", dir: "rtl", htmlLang: "ar", og: "ar_AR" },
};

export const isLocale = (v: string | undefined): v is Locale => !!v && (LOCALES as readonly string[]).includes(v);

/** Internal href for a locale. German paths carry no prefix. */
export function localePath(locale: Locale, path = "/") {
  const p = path.startsWith("/") ? path : `/${path}`;
  if (locale === DEFAULT_LOCALE) return p;
  return p === "/" ? `/${locale}` : `/${locale}${p}`;
}

/** Strip a locale prefix from a pathname ("/en/brands" → "/brands"). */
export function stripLocale(pathname: string) {
  const m = pathname.match(/^\/(de|en|ar)(?=\/|$)/);
  const rest = m ? pathname.slice(m[0].length) : pathname;
  return rest === "" ? "/" : rest;
}
