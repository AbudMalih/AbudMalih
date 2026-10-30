import type { Locale } from "../schemas";
import { ar } from "./ar";
import { de } from "./de";
import { en, type Messages, type MessageKey } from "./en";
import { ro } from "./ro";

export type { Messages, MessageKey };

export const MESSAGES: Record<Locale, Messages> = { de, en, ro, ar };
export const SUPPORTED_LOCALES: readonly Locale[] = ["de", "en", "ro", "ar"];
export const DEFAULT_LOCALE: Locale = "de";

export const LOCALE_LABELS: Record<Locale, string> = {
  de: "Deutsch",
  en: "English",
  ro: "Română",
  ar: "العربية",
};

export function isRtl(locale: Locale): boolean {
  return locale === "ar";
}

/** Pick the best supported locale from a list of BCP-47 tags (e.g. device preferences). */
export function resolveLocale(tags: readonly (string | null | undefined)[]): Locale {
  for (const tag of tags) {
    const lang = tag?.toLowerCase().split(/[-_]/)[0];
    if (lang && (SUPPORTED_LOCALES as readonly string[]).includes(lang)) {
      return lang as Locale;
    }
  }
  return DEFAULT_LOCALE;
}

/** Translate a key and interpolate `{name}` placeholders. Falls back to English. */
export function translate(
  locale: Locale,
  key: MessageKey,
  params?: Record<string, string | number>,
): string {
  const template = MESSAGES[locale][key] ?? en[key];
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) =>
    params[name] !== undefined ? String(params[name]) : `{${name}}`,
  );
}

export function formatMinuteOfDay(minute: number): string {
  const h = Math.floor(minute / 60);
  const m = minute % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Parse "HH:MM" into minutes since midnight; returns null when invalid. */
export function parseMinuteOfDay(value: string): number | null {
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}
