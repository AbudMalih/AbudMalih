import { getLocales } from "expo-localization";
import { I18nManager } from "react-native";
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

export function useT() {
  const locale = useLocale();
  return (key: MessageKey, params?: Record<string, string | number>) => translate(locale, key, params);
}

/**
 * React Native applies RTL layout direction at startup only. Returns true when
 * the stored direction differs from the requested one (an app restart is needed).
 */
export function applyLayoutDirection(locale: Locale): boolean {
  const rtl = isRtl(locale);
  I18nManager.allowRTL(true);
  if (I18nManager.isRTL !== rtl) {
    I18nManager.forceRTL(rtl);
    return true;
  }
  return false;
}
