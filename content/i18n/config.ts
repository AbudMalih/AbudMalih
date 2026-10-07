/**
 * Locale configuration. German is the default and is served at "/".
 * English and Arabic live under "/en" and "/ar". "/de/*" redirects to "/*".
 */
export const LOCALES = ["de", "en", "ar"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "de";

export const LOCALE_META: Record<Locale, { label: string; name: string; dir: "ltr" | "rtl"; htmlLang: string; og: string }> = {
  de: { label: "DE", name: "Deutsch", dir: "ltr", htmlLang: "de", og: "de_DE" },
  en: { label: "EN", name: "English", dir: "ltr", htmlLang: "en", og: "en_GB" },
  ar: { label: "AR", name: "العربية", dir: "rtl", htmlLang: "ar", og: "ar_AR" },
};

export const isLocale = (v: string | undefined): v is Locale => !!v && (LOCALES as readonly string[]).includes(v);

/**
 * Localized URL slugs. Code always uses the canonical path (the app route,
 * e.g. "/what-we-do"); visitors see the localized one ("/leistungen",
 * "/en/services"). The middleware maps between the two.
 */
export const SLUGS: Record<string, Record<Locale, string>> = {
  "/what-we-do": { de: "/leistungen", en: "/services", ar: "/services" },
  "/brands": { de: "/marken", en: "/brands", ar: "/brands" },
  "/company": { de: "/unternehmen", en: "/company", ar: "/company" },
  "/contact": { de: "/kontakt", en: "/contact", ar: "/contact" },
};

/** Canonical path → the localized slug for a locale (keeps sub-paths, query, hash). */
export function localizeSlug(locale: Locale, path: string) {
  for (const [canon, map] of Object.entries(SLUGS)) {
    if (path === canon || path.startsWith(canon + "/") || path.startsWith(canon + "#") || path.startsWith(canon + "?")) {
      return map[locale] + path.slice(canon.length);
    }
  }
  return path;
}

/** A localized slug (any locale's) → the canonical path. */
export function canonicalPath(path: string) {
  for (const [canon, map] of Object.entries(SLUGS)) {
    for (const slug of [...new Set(Object.values(map)), canon]) {
      if (path === slug || path.startsWith(slug + "/")) return canon + path.slice(slug.length);
    }
  }
  return path;
}

/** Internal href for a locale. German paths carry no prefix. */
export function localePath(locale: Locale, path = "/") {
  const p = localizeSlug(locale, path.startsWith("/") ? path : `/${path}`);
  if (locale === DEFAULT_LOCALE) return p;
  return p === "/" ? `/${locale}` : `/${locale}${p}`;
}

/** Strip a locale prefix from a pathname ("/en/brands" → "/brands"). */
export function stripLocale(pathname: string) {
  const m = pathname.match(/^\/(de|en|ar)(?=\/|$)/);
  const rest = m ? pathname.slice(m[0].length) : pathname;
  return rest === "" ? "/" : rest;
}
