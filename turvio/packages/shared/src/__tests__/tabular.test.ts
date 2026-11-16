import { describe, expect, it } from "vitest";
import { parseXlsx } from "../capture/xlsx";
import { safeCellText, toCsv, toXlsx } from "../tabular";

describe("report export", () => {
  it("CSV: semicolons, quoting, BOM, CRLF and formula neutralisation", () => {
    const csv = toCsv([["Fahrer", "Zustellquote"], ["Jürgen; Müller", 0.95], ['say "hi"', null], ["=HYPERLINK(1)", -3]]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toBe('﻿Fahrer;Zustellquote\r\n"Jürgen; Müller";0.95\r\n"say ""hi""";\r\n\'=HYPERLINK(1);-3\r\n');
  });
  it("formula-like text is kept as text, numbers stay numbers", () => {
    expect(safeCellText("+49 511")).toBe("'+49 511");
    expect(safeCellText("@x")).toBe("'@x");
    expect(safeCellText("Hannover")).toBe("Hannover");
  });
  it("XLSX round-trips through the import reader (umlauts, Arabic, numbers, empty cells)", () => {
    const bytes = toXlsx([["Fahrer", "Stopps", "Quote"], ["Jürgen Müller", 84, 0.952], ["سائق", 0, null], ["<b>&", 1, 1]], "Fahrer / Juli");
    const rows = parseXlsx(bytes);
    expect(rows[0]).toEqual(["Fahrer", "Stopps", "Quote"]);
    expect(rows[1]).toEqual(["Jürgen Müller", "84", "0.952"]);
    expect(rows[2]![0]).toBe("سائق");
    expect(rows[3]![0]).toBe("<b>&");
  });
});
