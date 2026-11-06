"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LOCALES, LOCALE_META, canonicalPath, localePath, stripLocale } from "@/content/i18n/config";
import { useI18n } from "@/content/i18n/I18nProvider";
import styles from "./LanguageSelector.module.css";

/**
 * DE · EN · AR. No flags. Each language has its own URL prefix (German
 * unprefixed, always the default). Switching is client-side on the content
 * pages (the layout re-renders lang/dir, the scroll position is kept); on the
 * homepage, whose cinematic opening is built once per document, it loads the
 * page anew.
 */
export default function LanguageSelector({ size = "s", tabIndex }: { size?: "s" | "l"; tabIndex?: number }) {
  const { locale, dict } = useI18n();
  // works for both the visible (localized) and the internal (canonical) pathname
  const path = canonicalPath(stripLocale(usePathname() || "/"));
  const cinematic = path === "/";
  return (
    <ul className={`${styles.list} ${size === "l" ? styles.large : ""}`} aria-label={dict.a11y.language}>
      {LOCALES.map((l) => (
        <li key={l}>
          <Link
            href={localePath(l, path)}
            scroll={false}
            prefetch={false}
            onClick={(e) => {
              // the homepage's cinematic opening (globe, stage, intro) is set up
              // once per document: there, a language change loads the page anew
              if (cinematic && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
                e.preventDefault();
                window.location.assign(localePath(l, path));
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
