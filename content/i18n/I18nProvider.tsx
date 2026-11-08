"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Dictionary } from "./types";
import { localePath, type Locale, LOCALE_META } from "./config";

type Ctx = {
  locale: Locale;
  dict: Dictionary;
  dir: "ltr" | "rtl";
  href: (path: string) => string;
  /** languages that have a published knowledge section */
  insights: Locale[];
  /** article id → slug per language (for the language switch on articles) */
  insightSlugs: Record<string, Partial<Record<Locale, string>>>;
};
const I18nCtx = createContext<Ctx | null>(null);

export function I18nProvider({
  locale,
  dict,
  insights = [],
  insightSlugs = {},
  children,
}: {
  locale: Locale;
  dict: Dictionary;
  insights?: Locale[];
  insightSlugs?: Record<string, Partial<Record<Locale, string>>>;
  children: ReactNode;
}) {
  return (
    <I18nCtx.Provider
      value={{
        locale,
        dict,
        dir: LOCALE_META[locale].dir,
        href: (p) => localePath(locale, p),
        insights,
        insightSlugs,
      }}
    >
      {children}
    </I18nCtx.Provider>
  );
}

export function useI18n() {
  const c = useContext(I18nCtx);
  if (!c) throw new Error("useI18n outside I18nProvider");
  return c;
}
