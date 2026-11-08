"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LOCALES,
  LOCALE_META,
  canonicalPath,
  localePath,
  stripLocale,
  type Locale,
} from "@/content/i18n/config";
import { useI18n } from "@/content/i18n/I18nProvider";
import styles from "./LanguageSelector.module.css";

/**
 * DE · EN · AR. No flags. Each language has its own URL prefix (German
 * unprefixed, always the default). Switching is client-side on the content
 * pages (the layout re-renders lang/dir, the scroll position is kept); on the
 * homepage, whose cinematic opening is built once per document, it loads the
 * page anew.
 */
export default function LanguageSelector({
  size = "s",
  tabIndex,
}: {
  size?: "s" | "l";
  tabIndex?: number;
}) {
  const { locale, dict, insights, insightSlugs } = useI18n();
  // works for both the visible (localized) and the internal (canonical) pathname
  const path = canonicalPath(stripLocale(usePathname() || "/"));
  const cinematic = path === "/";
  // knowledge section: an article links to its translation; without one (or
  // without a section in that language) the switch leads to the listing or home
  const target = (l: Locale) => {
    if (path !== "/insights" && !path.startsWith("/insights/"))
      return localePath(l, path);
    if (!insights.includes(l)) return localePath(l, "/");
    const slug = path.slice("/insights/".length);
    if (!slug) return localePath(l, "/insights");
    const entry = Object.values(insightSlugs).find((m) => m[locale] === slug);
    return localePath(l, entry?.[l] ? `/insights/${entry[l]}` : "/insights");
  };
  return (
    <ul
      className={`${styles.list} ${size === "l" ? styles.large : ""}`}
      aria-label={dict.a11y.language}
    >
      {LOCALES.map((l) => (
        <li key={l}>
          <Link
            href={target(l)}
            scroll={false}
            prefetch={false}
            onClick={(e) => {
              // the homepage's cinematic opening (globe, stage, intro) is set up
              // once per document: there, a language change loads the page anew
              if (cinematic && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
                e.preventDefault();
                window.location.assign(target(l));
              }
            }}
            hrefLang={LOCALE_META[l].htmlLang}
            lang={LOCALE_META[l].htmlLang}
            aria-current={l === locale ? "true" : undefined}
            aria-label={LOCALE_META[l].name}
            className={`t-label ${styles.item}`}
            data-cursor="link"
            tabIndex={tabIndex}
          >
            {LOCALE_META[l].label}
          </Link>
        </li>
      ))}
    </ul>
  );
}
