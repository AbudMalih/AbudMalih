import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..");
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(f) ? [p] : [];
  });
}
const SOURCES = ["app", "components", "lib"].flatMap((d) => files(join(ROOT, d)));
// The one place that maps a language to its Intl locale tag.
const ENGINE = join("lib", "i18n", "index.ts");

describe("no hard-coded locales", () => {
  it("no de-DE / en-GB tags outside the i18n engine", () => {
    const tags = SOURCES.filter((f) => relative(ROOT, f) !== ENGINE && /de-DE|en-GB/.test(readFileSync(f, "utf8")));
    expect(tags.map((f) => relative(ROOT, f))).toEqual([]);
  });

  it("no toLocale…String or Intl formatter with a fixed language", () => {
    const re = /toLocale(Date|Time)?String\(\s*["'`]|new Intl\.\w+\(\s*["'`]/;
    const hits = SOURCES.filter((f) => re.test(readFileSync(f, "utf8")));
    expect(hits.map((f) => relative(ROOT, f))).toEqual([]);
  });

  it("the root layout takes lang/dir from the language, not fixed values", () => {
    const layout = readFileSync(join(ROOT, "app", "layout.tsx"), "utf8");
    expect(layout).not.toMatch(/lang="en"|dir="ltr"/);
    expect(layout).toMatch(/dir=\{dirOf\(locale\)\}/);
  });
});
