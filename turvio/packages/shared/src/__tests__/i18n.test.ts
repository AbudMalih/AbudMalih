import { describe, expect, it } from "vitest";
import { MESSAGES, isRtl, parseMinuteOfDay, formatMinuteOfDay, resolveLocale, translate } from "../i18n";

describe("i18n", () => {
  it("has identical keys and placeholders in every locale", () => {
    const keys = Object.keys(MESSAGES.en).sort();
    const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(",");
    for (const [locale, messages] of Object.entries(MESSAGES)) {
      expect(Object.keys(messages).sort(), locale).toEqual(keys);
      for (const key of keys) {
        const k = key as keyof typeof MESSAGES.en;
        expect(placeholders(messages[k]), `${locale}:${key}`).toBe(placeholders(MESSAGES.en[k]));
      }
    }
  });

  it("interpolates parameters", () => {
    expect(translate("de", "home.progress", { done: 3, total: 8 })).toBe("3 von 8 Stopps erledigt");
  });

  it("resolves device locales and RTL", () => {
    expect(resolveLocale(["fr-FR", "ro-RO"])).toBe("ro");
    expect(resolveLocale(["ar_EG"])).toBe("ar");
    expect(resolveLocale([undefined, "ja"])).toBe("de");
    expect(isRtl("ar")).toBe(true);
    expect(isRtl("de")).toBe(false);
  });

  it("parses and formats times of day", () => {
    expect(parseMinuteOfDay("09:30")).toBe(570);
    expect(parseMinuteOfDay("24:00")).toBeNull();
    expect(formatMinuteOfDay(570)).toBe("09:30");
  });
});
