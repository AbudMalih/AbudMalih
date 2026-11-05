import { getLocales } from "expo-localization";
import { useCallback } from "react";
import { I18nManager, Platform } from "react-native";
import { isRtl, resolveLocale, translate, type Locale, type MessageKey } from "@turvio/shared";
import { useTourStore } from "../store/tourStore";

export function deviceLocale(): Locale {
  try {
    return resolveLocale(getLocales().map((l) => l.languageTag));
  } catch {
    return resolveLocale([]);
  }
}

export function useLocale(): Locale {
  return useTourStore((s) => s.locale) ?? deviceLocale();
}

/** Stable per locale, so it can be used in effect dependencies. */
export function useT() {
  const locale = useLocale();
  return useCallback((key: MessageKey, params?: Record<string, string | number>) => translate(locale, key, params), [locale]);
}

/**
 * React Native applies RTL layout direction at startup only. Returns true when
 * the stored direction differs from the requested one (an app restart is needed).
 */
export function applyLayoutDirection(locale: Locale): boolean {
  const rtl = isRtl(locale);
  if (Platform.OS === "web" && typeof document !== "undefined") {
    // react-native-web follows the document direction.
    document.documentElement.dir = rtl ? "rtl" : "ltr";
    document.documentElement.lang = locale;
    return false;
  }
  I18nManager.allowRTL(true);
  if (I18nManager.isRTL !== rtl) {
    I18nManager.forceRTL(rtl);
    return true;
  }
  return false;
}
