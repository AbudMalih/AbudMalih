import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { KNOWN_HEADINGS, heading, localizeHeadings } from "../src/export-i18n";

/** Every heading row literal of the report exports (analytics + tours) – read from the route sources. */
function exportHeadings(): string[] {
  const out = new Set<string>();
  for (const file of ["analytics.ts", "lifecycle.ts"]) {
    const src = readFileSync(join(__dirname, "../src/routes", file), "utf8");
    // Arrays that are heading rows: `xxxHead = [...]`, `return [["…", …]` and `["Date", "Tour", …]` table starts.
    const arrays = [...src.matchAll(/(?:Head = |return \[|const table: Cell\[\]\[\] = \[\s*)\[([^\]]*)\]/g)].map((m) => m[1]!);
    for (const a of arrays) for (const s of a.matchAll(/"([^"]+)"/g)) out.add(s[1]!);
  }
  out.add("Period (day)").add("Period (week)").add("Period (month)").add("(no driver)");
  return [...out];
}

describe("report export headings in the user's language", () => {
  it("every heading of every export has a German and an Arabic translation", () => {
    const all = exportHeadings();
    expect(all.length).toBeGreaterThan(40);
    const missing = all.filter((h) => !KNOWN_HEADINGS.includes(h));
    expect(missing).toEqual([]);
    for (const h of all) {
      expect(heading(h, "de")).not.toBe("");
      expect(heading(h, "ar")).not.toBe(h);
    }
  });

  it("only the heading row changes – values (dates, numbers, status codes) stay exact", () => {
    const rows = [["Date", "Tour", "Status", "Stops"], ["2026-11-16", "HAN-01", "completed", 12], ["2026-11-17", "Stops", "in_progress", 0.5]];
    const de = localizeHeadings(rows, "de");
    expect(de[0]).toEqual(["Datum", "Tour", "Status", "Stopps"]);
    expect(de.slice(1)).toEqual(rows.slice(1));
    expect(localizeHeadings(rows, "ar")[0]).toEqual(["التاريخ", "الجولة", "الحالة", "المحطات"]);
    expect(localizeHeadings(rows, "en")).toBe(rows);
  });
});
