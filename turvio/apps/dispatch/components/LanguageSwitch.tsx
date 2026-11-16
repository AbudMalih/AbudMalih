"use client";

import { Menu, MenuContent, MenuItem, MenuTrigger, cn } from "@turvio/web-ui/ds";
import { Check, Languages } from "lucide-react";
import { LOCALE_NAMES, LOCALES, type Locale } from "../lib/i18n";
import { useI18n } from "../lib/i18n/client";

/**
 * Compact language menu (sign-in pages). Changing it switches the page at once and remembers the
 * choice in a cookie; after sign-in it becomes the user's saved preference if they had none.
 */
export function LanguageSwitch({ className, onChange }: { className?: string; onChange?: (l: Locale) => void }) {
  const { locale, setLocale, t } = useI18n();
  return (
    <Menu>
      <MenuTrigger asChild>
        <button
          type="button"
          aria-label={t("shell.language")}
          data-testid="language-switch"
          className={cn("inline-flex h-[34px] items-center gap-1.5 rounded-full border border-line-strong bg-surface-2 px-3 text-[12.5px] font-semibold text-ink-2 hover:text-ink", className)}
        >
          <Languages className="size-4" aria-hidden="true" />
          <span lang={locale}>{LOCALE_NAMES[locale]}</span>
        </button>
      </MenuTrigger>
      <MenuContent align="start" className="w-44">
        {LOCALES.map((l) => (
          <MenuItem
            key={l}
            onSelect={() => {
              setLocale(l);
              onChange?.(l);
            }}
            icon={l === locale ? <Check className="!text-nx-violet-text" /> : <span className="size-4" />}
          >
            <span lang={l} dir={l === "ar" ? "rtl" : "ltr"}>
              {LOCALE_NAMES[l]}
            </span>
          </MenuItem>
        ))}
      </MenuContent>
    </Menu>
  );
}
