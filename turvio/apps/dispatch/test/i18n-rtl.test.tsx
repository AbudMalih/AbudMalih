import { render, screen } from "@testing-library/react";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { I18nRoot } from "../components/I18nRoot";
import { useI18n } from "../lib/i18n/client";

/**
 * Right-to-left layout: Arabic switches the document direction, and the Dispatch components (and
 * the shared design-system components they use) are written with logical CSS – start/end instead
 * of left/right – so the whole layout mirrors. Maps and charts deliberately stay LTR.
 */
const ROOT = join(__dirname, "..");
const DS = join(ROOT, "../../packages/web-ui/src/ds");
const files = [
  ...readdirSync(join(ROOT, "components")).map((f) => join(ROOT, "components", f)),
  ...readdirSync(DS).map((f) => join(DS, f)),
].filter((f) => f.endsWith(".tsx"));

/** Physical-direction Tailwind classes that do not mirror in RTL. */
const PHYSICAL = /(?<![\w-])(?:-?(?:ml|mr|pl|pr)-(?:\d|px|auto|\[)|(?:left|right)-(?:\d|px|full|auto|\[)|text-(?:left|right)\b|border-(?:l|r)(?:-|\b)|rounded-(?:l|r|tl|tr|bl|br)(?:-|\b)|space-x-\d|float-(?:left|right))/;
/** Allowed: horizontally centred overlays (left-1/2 + -translate-x-1/2 is symmetric) and lines marked `rtl-ok`. */
const allowed = (line: string) => /left-1\/2/.test(line) || /rtl-ok/.test(line);

describe("RTL: no physical left/right classes in Dispatch and design-system components", () => {
  it("uses logical classes (ms/me, ps/pe, start/end, text-start/end, border-s/e, rounded-s/e)", () => {
    const hits: string[] = [];
    for (const f of files) {
      readFileSync(f, "utf8")
        .split("\n")
        .forEach((line, i) => {
          for (const cls of line.match(/className=|cn\(|"[^"]*"|`[^`]*`/g) ? [line] : []) {
            const m = PHYSICAL.exec(cls);
            if (m && !allowed(line)) hits.push(`${f.replace(ROOT, "").replace(DS, "ds")}:${i + 1} ${m[0]}`);
          }
        });
    }
    expect(hits).toEqual([]);
  });

  it("no hard-coded display locales (formatting follows the chosen language)", () => {
    const hits: string[] = [];
    for (const f of [...files, ...readdirSync(join(ROOT, "lib")).filter((x) => x.endsWith(".ts") || x.endsWith(".tsx")).map((x) => join(ROOT, "lib", x))]) {
      readFileSync(f, "utf8")
        .split("\n")
        .forEach((line, i) => {
          if (/toLocale(?:Date|Time)?String\(\s*"(?:de-DE|en-GB|en-US)"|Intl\.\w+\(\s*"(?:de-DE|en-GB|en-US)"/.test(line) && !/rtl-ok|i18n-ok/.test(line)) hits.push(`${f.replace(ROOT, "")}:${i + 1}`);
        });
    }
    expect(hits).toEqual([]);
  });

  it("maps keep a left-to-right container (Leaflet controls and tiles assume LTR)", () => {
    for (const f of ["RouteMap.tsx", "LocationPickerMap.tsx"]) {
      expect(readFileSync(join(ROOT, "components", f), "utf8"), f).toMatch(/dir="ltr"/);
    }
  });
});

function Probe() {
  const { t, dir, locale, setLocale } = useI18n();
  return (
    <div>
      <span data-testid="dir">{dir}</span>
      <span data-testid="label">{t("shell.nav.tours")}</span>
      <button onClick={() => setLocale(locale === "ar" ? "de" : "ar")}>switch</button>
    </div>
  );
}

describe("RTL: document direction follows the language", () => {
  it("Arabic sets <html dir=rtl lang=ar>, switching back restores LTR, and the choice is remembered in a cookie", async () => {
    render(
      <I18nRoot locale="ar">
        <Probe />
      </I18nRoot>,
    );
    expect(document.documentElement.dir).toBe("rtl");
    expect(document.documentElement.lang).toBe("ar");
    expect(screen.getByTestId("label").textContent).toBe("الجولات");
    screen.getByText("switch").click();
    await screen.findByText("Touren");
    expect(document.documentElement.dir).toBe("ltr");
    expect(document.documentElement.lang).toBe("de");
    expect(document.cookie).toContain("tv_lang=de");
  });
});
