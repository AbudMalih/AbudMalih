"use client";

import { createContext, Fragment, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { createFormat, createT, dirOf, LANG_COOKIE, lookup, setActiveLocale, type Format, type Locale, type MessageKey, type Params, type TFunction } from "./index";

export interface I18n {
  locale: Locale;
  dir: "ltr" | "rtl";
  t: TFunction;
  /** Like `t`, but placeholders may be React nodes (e.g. `{ org: <strong>…</strong> }`). */
  tr: (key: MessageKey, params: Record<string, ReactNode>) => ReactNode;
  fmt: Format;
  /** Switch the language now (cookie + document); persisting it per user is the caller's job. */
  setLocale: (l: Locale) => void;
}

function build(locale: Locale, setLocale: (l: Locale) => void): I18n {
  const t = createT(locale);
  const tr: I18n["tr"] = (key, params) => {
    const count = typeof params.count === "number" ? params.count : undefined;
    const template = lookup(locale, key, count) ?? key;
    const parts = template.split(/(\{\w+\})/g);
    return parts.map((p, i) => {
      const m = /^\{(\w+)\}$/.exec(p);
      return <Fragment key={i}>{m && m[1]! in params ? params[m[1]!] : p}</Fragment>;
    });
  };
  return { locale, dir: dirOf(locale), t, tr, fmt: createFormat(locale), setLocale };
}

/** Without a provider (tests, isolated renders) everything is English. */
const Ctx = createContext<I18n>(build("en", () => {}));

export function writeLangCookie(l: Locale) {
  document.cookie = `${LANG_COOKIE}=${l}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
}

export function I18nProvider({ initial, children }: { initial: Locale; children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initial);
  // Before children render: API error texts created during this render use the same language.
  setActiveLocale(locale);
  const setLocale = useCallback((l: Locale) => {
    writeLangCookie(l);
    setLocaleState(l);
  }, []);
  useEffect(() => {
    const el = document.documentElement;
    el.lang = locale;
    el.dir = dirOf(locale);
  }, [locale]);
  const value = useMemo(() => build(locale, setLocale), [locale, setLocale]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useI18n = () => useContext(Ctx);
export const useT = () => useContext(Ctx).t;

export type { Params };
