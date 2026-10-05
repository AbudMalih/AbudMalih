"use client";

import { usePathname } from "next/navigation";
import { LOCALES, LOCALE_META, canonicalPath, localePath, stripLocale } from "@/content/i18n/config";
import { useI18n } from "@/content/i18n/I18nProvider";
import styles from "./LanguageSelector.module.css";

/**
 * DE · EN · AR. No flags. Each language has its own URL prefix (German
 * unprefixed, always the default). Full navigation (not client routing)
 * because language and direction change the document root.
 */
export default function LanguageSelector({ size = "s", tabIndex }: { size?: "s" | "l"; tabIndex?: number }) {
  const { locale, dict } = useI18n();
  // works for both the visible (localized) and the internal (canonical) pathname
  const path = canonicalPath(stripLocale(usePathname() || "/"));
  return (
    <ul className={`${styles.list} ${size === "l" ? styles.large : ""}`} aria-label={dict.a11y.language}>
      {LOCALES.map((l) => (
        <li key={l}>
          <a
            href={localePath(l, path)}
            hrefLang={LOCALE_META[l].htmlLang}
            lang={LOCALE_META[l].htmlLang}
            aria-current={l === locale ? "true" : undefined}
            aria-label={LOCALE_META[l].name}
            className={`t-label ${styles.item}`}
            data-cursor="link"
            tabIndex={tabIndex}
          >
            {LOCALE_META[l].label}
          </a>
        </li>
      ))}
    </ul>
  );
}
