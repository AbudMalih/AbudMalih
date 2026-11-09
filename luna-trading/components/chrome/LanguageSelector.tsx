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
import { languageTarget } from "@/lib/language-switch";
import styles from "./LanguageSelector.module.css";

/**
 * DE · EN · AR. No flags. Each language has its own URL prefix (German
 * unprefixed, always the default). Switching is client-side on the content
 * pages (the layout re-renders lang/dir; on the same page in another language
 * the scroll position is kept, on a fallback page it starts at the top); on
 * the homepage, whose cinematic opening is built once per document, it loads
 * the page anew. Targets: lib/language-switch.ts.
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
  const target = (l: Locale) =>
    languageTarget(path, locale, l, insights, insightSlugs);
  return (
    <ul
      className={`${styles.list} ${size === "l" ? styles.large : ""}`}
      aria-label={dict.a11y.language}
    >
      {LOCALES.map((l) => {
        const { href, samePage } = target(l);
        return (
          <li key={l}>
            <Link
              href={href}
              // same page in another language: keep the reading position;
              // a fallback page (listing, home) opens at the top
              scroll={!samePage}
              prefetch={false}
              onClick={(e) => {
                // the homepage's cinematic opening (globe, stage, intro) is set up
                // once per document: there, a language change loads the page anew
                if (cinematic && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
                  e.preventDefault();
                  window.location.assign(href);
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
        );
      })}
    </ul>
  );
}
