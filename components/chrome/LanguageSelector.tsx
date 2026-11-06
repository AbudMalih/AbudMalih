"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LOCALES, LOCALE_META, canonicalPath, localePath, stripLocale } from "@/content/i18n/config";
import { useI18n } from "@/content/i18n/I18nProvider";
import styles from "./LanguageSelector.module.css";

/**
 * DE · EN · AR. No flags. Each language has its own URL prefix (German
 * unprefixed, always the default). Switching is client-side: the page stays,
 * the layout re-renders with the new language and direction (html lang/dir
 * are rendered by the [lang] layout), and the scroll position is kept.
 */
export default function LanguageSelector({ size = "s", tabIndex }: { size?: "s" | "l"; tabIndex?: number }) {
  const { locale, dict } = useI18n();
  // works for both the visible (localized) and the internal (canonical) pathname
  const path = canonicalPath(stripLocale(usePathname() || "/"));
  return (
    <ul className={`${styles.list} ${size === "l" ? styles.large : ""}`} aria-label={dict.a11y.language}>
      {LOCALES.map((l) => (
        <li key={l}>
          <Link
            href={localePath(l, path)}
            scroll={false}
            prefetch={false}
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
