import { describe, expect, it } from "vitest";
import { createFormat, createT, dirOf, lookup, resolveLocale } from "../lib/i18n";
import { LOCALES } from "../lib/i18n/define";
import { NAMESPACES } from "../lib/i18n/messages";

type Dict = Record<string, string>;
const PLURAL_EXTRA = /#(zero|one|two|few|many|other)$/;
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!).sort();
/** Latin words that are names (brand, products, standards) – they stay Latin in Arabic and German. */
const LATIN_OK = new Set("TURVIO Dispatch Driver Admin Google Microsoft Authenticator 1Password Aegis Smart Routes Simple Deliveries API ID Ctrl".split(" "));
/** Example values that are the same in every language. */
const SAME_EVERYWHERE = new Set(["admins.emailPlaceholder"]);

describe("translation completeness (English is the source)", () => {
  for (const [ns, m] of Object.entries(NAMESPACES) as [string, Record<string, Dict>][]) {
    const en = m.en!;
    const enKeys = Object.keys(en);
    const bases = new Set(enKeys.map((k) => k.replace(PLURAL_EXTRA, "")));

    for (const lang of ["de", "ar"] as const) {
      it(`${ns}: ${lang} has every English key, nothing empty, same placeholders`, () => {
        const d = m[lang]!;
        expect(enKeys.filter((k) => !(k in d)), `missing ${lang} keys in ${ns}`).toEqual([]);
        const extra = Object.keys(d).filter((k) => !(k in en));
        expect(extra.filter((k) => !PLURAL_EXTRA.test(k) || !bases.has(k.replace(PLURAL_EXTRA, ""))), `unexpected ${lang} keys in ${ns}`).toEqual([]);
        for (const [k, v] of Object.entries(d)) {
          expect(v.trim(), `${ns}.${k} (${lang}) is empty`).not.toBe("");
          const base = k.replace(PLURAL_EXTRA, "");
          const ref = en[k] ?? en[`${base}#other`] ?? en[base]!;
          if (PLURAL_EXTRA.test(k)) {
            // A plural form may spell the number out ("مقعد واحد") but must not invent placeholders.
            const allowed = new Set(placeholders(ref));
            expect(placeholders(v).filter((p) => !allowed.has(p)), `${ns}.${k} (${lang}) placeholders`).toEqual([]);
          } else {
            expect(placeholders(v), `${ns}.${k} (${lang}) placeholders`).toEqual(placeholders(ref));
          }
        }
      });
    }

    it(`${ns}: Arabic texts are Arabic (not English copies)`, () => {
      const ar = m.ar!;
      const untranslated = Object.entries(en).filter(([k, v]) => {
        if (SAME_EVERYWHERE.has(`${ns}.${k}`)) return false;
        const words = v.replace(/\{\w+\}/g, "").match(/[A-Za-z][A-Za-z-]{2,}/g) ?? [];
        return words.some((w) => !LATIN_OK.has(w)) && !/[؀-ۿ]/.test(ar[k] ?? "");
      });
      expect(untranslated.map(([k]) => `${ns}.${k}`)).toEqual([]);
    });

    it(`${ns}: German texts are not English copies`, () => {
      const de = m.de!;
      const brandOnly = (v: string) => (v.match(/[A-Za-z][A-Za-z-]{2,}/g) ?? []).every((w) => LATIN_OK.has(w));
      const same = Object.entries(en).filter(([k, v]) => !SAME_EVERYWHERE.has(`${ns}.${k}`) && de[k] === v && !brandOnly(v) && (v.replace(/\{\w+\}/g, "").match(/[a-z]{3,}/g) ?? []).length >= 2);
      expect(same.map(([k]) => `${ns}.${k}`)).toEqual([]);
    });
  }
});

describe("runtime behaviour", () => {
  it("plural forms follow each language's rules", () => {
    expect(createT("en")("companies.seats", { count: 1 })).toBe("1 seat");
    expect(createT("en")("companies.seats", { count: 3 })).toBe("3 seats");
    expect(createT("de")("companies.seats", { count: 3 })).toBe("3 Plätze");
    expect(createT("ar")("companies.seats", { count: 1 })).toBe("مقعد واحد");
    expect(createT("ar")("companies.seats", { count: 2 })).toBe("مقعدان");
    expect(createT("ar")("companies.seats", { count: 5 })).toBe("5 مقاعد");
    expect(createT("ar")("companies.seats", { count: 11 })).toBe("11 مقعدًا");
  });

  it("falls back to English, never to an empty string", () => {
    expect(lookup("de", "common.save")).toBe("Speichern");
    expect(lookup("ar", "no.such.key")).toBeUndefined();
    expect(createT("ar")("no.such.key" as never)).toBe("no.such.key");
  });

  it("language and direction: unknown values fall back to English / LTR; Arabic is RTL", () => {
    expect(resolveLocale("ar")).toBe("ar");
    expect(resolveLocale("fr")).toBe("en");
    expect(dirOf("ar")).toBe("rtl");
    expect(dirOf("de")).toBe("ltr");
    expect(LOCALES).toEqual(["en", "de", "ar"]);
  });

  it("formats with each language's conventions, Arabic with Western digits", () => {
    expect(createFormat("de").number(1234.5, 1)).toBe("1.234,5");
    expect(createFormat("en").number(1234.5, 1)).toBe("1,234.5");
    expect(createFormat("ar").number(1234.5, 1)).not.toMatch(/[٠-٩]/);
    expect(createFormat("de").relative(Date.now() - 2 * 86_400_000)).toBe("vorgestern");
    expect(createFormat("en").relative(Date.now() - 3 * 86_400_000)).toBe("3 days ago");
  });
});
