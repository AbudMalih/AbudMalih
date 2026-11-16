import { describe, expect, it } from "vitest";
import { createFormat, createT, dirOf, intlTag, lookup, resolveLocale } from "../lib/i18n";
import { LOCALES } from "../lib/i18n/define";
import { NAMESPACES } from "../lib/i18n/messages";

type Dict = Record<string, string>;
const PLURAL_EXTRA = /#(zero|one|two|few|many|other)$/;
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!).sort();
/** Latin words that are names (brand, product, file formats, standards) – they stay Latin in Arabic. */
const LATIN_OK = new Set(
  "TURVIO Dispatch Driver Admin OSRM CSV Excel xlsx GPS HTTP Ref Ctrl Google Microsoft Authenticator 1Password Aegis Smart Routes Simple Deliveries KPI ETA OR-Tools VROOM PDF API ID URL Live".split(" "),
);

describe("translation completeness (English is the source)", () => {
  for (const [ns, m] of Object.entries(NAMESPACES) as [string, Record<string, Dict>][]) {
    const en = m.en!;
    const enKeys = Object.keys(en);
    const bases = new Set(enKeys.map((k) => k.replace(PLURAL_EXTRA, "")));

    for (const lang of ["de", "ar"] as const) {
      it(`${ns}: ${lang} has every English key, nothing empty, same placeholders`, () => {
        const d = m[lang]!;
        const missing = enKeys.filter((k) => !(k in d));
        expect(missing, `missing ${lang} keys in ${ns}`).toEqual([]);
        // Extra keys only as plural forms of a key that exists.
        const extra = Object.keys(d).filter((k) => !(k in en));
        const badExtra = extra.filter((k) => !PLURAL_EXTRA.test(k) || !bases.has(k.replace(PLURAL_EXTRA, "")));
        expect(badExtra, `unexpected ${lang} keys in ${ns}`).toEqual([]);
        for (const [k, v] of Object.entries(d)) {
          expect(v.trim(), `${ns}.${k} (${lang}) is empty`).not.toBe("");
          const base = k.replace(PLURAL_EXTRA, "");
          const ref = en[k] ?? en[`${base}#other`] ?? en[base]!;
          if (PLURAL_EXTRA.test(k)) {
            // A plural form may spell the number out ("محطة واحدة") but must not invent placeholders.
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
        const words = v.replace(/\{\w+\}/g, "").match(/[A-Za-z][A-Za-z-]{2,}/g) ?? [];
        const needs = words.some((w) => !LATIN_OK.has(w));
        return needs && !/[؀-ۿ]/.test(ar[k] ?? "");
      });
      expect(untranslated.map(([k]) => `${ns}.${k}`)).toEqual([]);
    });

    it(`${ns}: German texts differ from English where they contain sentences`, () => {
      const de = m.de!;
      // A text of several English words left unchanged in German is almost certainly untranslated.
      const brandOnly = (v: string) => (v.match(/[A-Za-z][A-Za-z-]{2,}/g) ?? []).every((w) => LATIN_OK.has(w));
      const same = Object.entries(en).filter(([k, v]) => de[k] === v && !brandOnly(v) && (v.replace(/\{\w+\}/g, "").match(/[a-z]{3,}/g) ?? []).length >= 3);
      expect(same.map(([k]) => `${ns}.${k}`)).toEqual([]);
    });
  }
});

describe("runtime behaviour", () => {
  it("plural forms follow each language's rules (Arabic has zero/one/two/few/many)", () => {
    const en = createT("en");
    const ar = createT("ar");
    const de = createT("de");
    expect(en("common.stops", { count: 1 })).toBe("1 stop");
    expect(en("common.stops", { count: 3 })).toBe("3 stops");
    expect(de("common.stops", { count: 3 })).toBe("3 Stopps");
    expect(ar("common.stops", { count: 0 })).toBe("لا توجد محطات");
    expect(ar("common.stops", { count: 1 })).toBe("محطة واحدة");
    expect(ar("common.stops", { count: 2 })).toBe("محطتان");
    expect(ar("common.stops", { count: 5 })).toBe("5 محطات");
    expect(ar("common.stops", { count: 11 })).toBe("11 محطة");
  });

  it("missing translations fall back to English, never to an empty string", () => {
    expect(lookup("de", "common.save")).toBe("Speichern");
    expect(lookup("ar", "no.such.key")).toBeUndefined();
    expect(createT("ar")("no.such.key" as never)).toBe("no.such.key");
  });

  it("language and direction: unknown values fall back to English / LTR; Arabic is RTL", () => {
    expect(resolveLocale("ar")).toBe("ar");
    expect(resolveLocale("fr")).toBe("en");
    expect(resolveLocale(undefined)).toBe("en");
    expect(dirOf("ar")).toBe("rtl");
    expect(dirOf("de")).toBe("ltr");
    expect(LOCALES).toEqual(["en", "de", "ar"]);
  });

  it("dates and numbers: German conventions, Arabic with Western digits and the Gregorian calendar", () => {
    const d = new Date("2026-11-16T09:05:00Z");
    const de = createFormat("de");
    const ar = createFormat("ar");
    const en = createFormat("en");
    expect(de.number(1234.5, 1)).toBe("1.234,5");
    expect(en.number(1234.5, 1)).toBe("1,234.5");
    expect(de.day("2026-11-16", { day: "2-digit", month: "2-digit", year: "numeric" })).toBe("16.11.2026");
    const arDay = ar.day("2026-11-16", { day: "numeric", month: "long", year: "numeric" });
    expect(arDay).toMatch(/16/);
    expect(arDay).toMatch(/2026/);
    expect(arDay).toMatch(/نوفمبر/);
    expect(arDay).not.toMatch(/[٠-٩]/);
    expect(ar.number(1234.5, 1)).not.toMatch(/[٠-٩]/);
    expect(ar.percent(0.875, 1)).toMatch(/87[.,٫]5/);
    // 24-hour clock everywhere, same instant.
    expect(de.time(d)).toMatch(/^\d{2}:\d{2}$/);
    expect(ar.time(d)).toMatch(/\d{2}:\d{2}/);
    expect(intlTag("ar")).toContain("nu-latn");
  });
});
