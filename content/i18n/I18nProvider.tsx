"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Dictionary } from "./types";
import { localePath, type Locale, LOCALE_META } from "./config";

type Ctx = { locale: Locale; dict: Dictionary; dir: "ltr" | "rtl"; href: (path: string) => string };
const I18nCtx = createContext<Ctx | null>(null);

export function I18nProvider({ locale, dict, children }: { locale: Locale; dict: Dictionary; children: ReactNode }) {
  return (
    <I18nCtx.Provider value={{ locale, dict, dir: LOCALE_META[locale].dir, href: (p) => localePath(locale, p) }}>
      {children}
    </I18nCtx.Provider>
  );
}

export function useI18n() {
  const c = useContext(I18nCtx);
  if (!c) throw new Error("useI18n outside I18nProvider");
  return c;
}
