import { DEFAULT_LOCALE, LOCALES, type Locale } from "./define";
import { DICTIONARIES, type MessageKey } from "./messages";

export { DEFAULT_LOCALE, LOCALES, LOCALE_NAMES, type Locale } from "./define";
export type { MessageKey } from "./messages";

/** Cookie with the chosen language: lets the server render `<html lang dir>` and sign-in pages correctly. */
export const LANG_COOKIE = "tv_lang";

export const isLocale = (v: unknown): v is Locale => typeof v === "string" && (LOCALES as readonly string[]).includes(v);
export const resolveLocale = (v: unknown): Locale => (isLocale(v) ? v : DEFAULT_LOCALE);
export const dirOf = (locale: Locale): "rtl" | "ltr" => (locale === "ar" ? "rtl" : "ltr");

/**
 * Locale tag for Intl formatting. English uses the British conventions (day-month order, 24-hour
 * clock) the product already showed; Arabic keeps Western digits and the Gregorian calendar, so
 * parcel numbers, times and amounts read the same as on the delivery documents.
 */
export function intlTag(locale: Locale): string {
  return locale === "de" ? "de-DE" : locale === "ar" ? "ar-u-nu-latn-ca-gregory" : "en-GB";
}

export type Params = Record<string, string | number | null | undefined>;
export type TFunction = (key: MessageKey, params?: Params) => string;

const pluralRules = new Map<Locale, Intl.PluralRules>();
function pluralOf(locale: Locale, n: number) {
  let r = pluralRules.get(locale);
  if (!r) pluralRules.set(locale, (r = new Intl.PluralRules(intlTag(locale))));
  return r.select(n);
}

/** Raw lookup with plural selection and English fallback (never shows an empty string). */
export function lookup(locale: Locale, key: string, count?: number): string | undefined {
  const dict = DICTIONARIES[locale];
  const en = DICTIONARIES.en;
  if (typeof count === "number") {
    const cat = pluralOf(locale, count);
    const v = dict[`${key}#${cat}`] ?? dict[`${key}#other`];
    if (v) return v;
    const ecat = pluralOf("en", count);
    const ev = en[`${key}#${ecat}`] ?? en[`${key}#other`];
    if (ev) return ev;
  }
  return dict[key] || en[key] || dict[`${key}#other`] || en[`${key}#other`];
}

export function interpolate(template: string, params?: Params, num?: (n: number) => string): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (m, name: string) => {
    const v = params[name];
    if (v === undefined || v === null) return m;
    return typeof v === "number" && num ? num(v) : String(v);
  });
}

export function createT(locale: Locale): TFunction {
  const nf = new Intl.NumberFormat(intlTag(locale));
  return (key, params) => {
    const count = typeof params?.count === "number" ? params.count : undefined;
    const template = lookup(locale, key, count);
    if (template === undefined) return key;
    return interpolate(template, params, (n) => (Number.isInteger(n) && Math.abs(n) < 10000 ? String(n) : nf.format(n)));
  };
}

/** Locale-aware formatting of dates, times and numbers. Time zone handling is unchanged (browser / explicit). */
export function createFormat(locale: Locale) {
  const tag = intlTag(locale);
  const cache = new Map<string, Intl.DateTimeFormat | Intl.NumberFormat>();
  const dtf = (o: Intl.DateTimeFormatOptions) => {
    const k = `d${JSON.stringify(o)}`;
    let f = cache.get(k) as Intl.DateTimeFormat | undefined;
    if (!f) cache.set(k, (f = new Intl.DateTimeFormat(tag, o)));
    return f;
  };
  const nf = (o: Intl.NumberFormatOptions) => {
    const k = `n${JSON.stringify(o)}`;
    let f = cache.get(k) as Intl.NumberFormat | undefined;
    if (!f) cache.set(k, (f = new Intl.NumberFormat(tag, o)));
    return f;
  };
  const toDate = (d: Date | string | number) => (d instanceof Date ? d : new Date(d));
  return {
    tag,
    /** Any Intl date/time options (e.g. `{ weekday: "long", timeZone: "UTC" }`). */
    date: (d: Date | string | number, o: Intl.DateTimeFormatOptions = { dateStyle: "medium" }) => dtf(o).format(toDate(d)),
    /** HH:MM (24-hour). */
    time: (d: Date | string | number, seconds = false) =>
      dtf({ hour: "2-digit", minute: "2-digit", ...(seconds ? { second: "2-digit" } : {}), hourCycle: "h23" }).format(toDate(d)),
    dateTime: (d: Date | string | number) => dtf({ dateStyle: "short", timeStyle: "short", hourCycle: "h23" }).format(toDate(d)),
    /** A calendar day `YYYY-MM-DD` (no time zone shift). */
    day: (iso: string, o: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) => dtf({ ...o, timeZone: "UTC" }).format(new Date(`${iso.slice(0, 10)}T12:00:00Z`)),
    number: (v: number, digits?: number) => nf(digits === undefined ? {} : { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(v),
    percent: (ratio: number, digits = 0) => nf({ style: "percent", minimumFractionDigits: digits, maximumFractionDigits: digits }).format(ratio),
    list: (items: string[]) => new Intl.ListFormat(tag, { style: "long", type: "conjunction" }).format(items),
  };
}
export type Format = ReturnType<typeof createFormat>;

/** English translator: default for helpers called without a language (tests, logs). */
export const EN_T: TFunction = createT("en");

/** "1 h 05 min" / "45 min" in the current language (same rounding as the shared formatDuration). */
export function durationText(minutes: number, t: TFunction = EN_T): string {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  return h ? t("common.hMin", { h, m: String(m % 60).padStart(2, "0") }) : t("common.min", { n: m });
}

/**
 * The browser's current language for code outside React (API error messages). Set by the
 * I18nProvider; English until then (and on the server, where it is never changed).
 */
let active: Locale = DEFAULT_LOCALE;
let activeT: TFunction = EN_T;
export function setActiveLocale(l: Locale) {
  if (l === active) return;
  active = l;
  activeT = createT(l);
}
export const currentT = (): TFunction => activeT;
export const currentLocale = (): Locale => active;
