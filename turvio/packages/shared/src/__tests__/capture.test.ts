import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import {
  ScanSession,
  detectColumns,
  mappingProblems,
  planImport,
  fieldsNeedingReview,
  groupImportRows,
  normalizeTrackingNumber,
  parcelIndex,
  parseAddressLine,
  parseDelimited,
  parseLabelText,
  parseXlsx,
  rowsFromPastedText,
  rowsFromTable,
  summarizeImport,
  validateImportRow,
  XlsxError,
} from "../capture";

describe("tracking numbers", () => {
  it("normalises camera and typed values", () => {
    expect(normalizeTrackingNumber(" tvo 1234 5678 90 ")).toBe("TVO1234567890");
    expect(normalizeTrackingNumber("]C1TVO1234567890")).toBe("TVO1234567890");
    expect(normalizeTrackingNumber("(00)340123450000000011")).toBe("340123450000000011");
    expect(normalizeTrackingNumber("https://track.example/parcel?piececode=TVO0099887766")).toBe("TVO0099887766");
    expect(normalizeTrackingNumber("https://track.example/p/TVO0099887766")).toBe("TVO0099887766");
    expect(normalizeTrackingNumber("abc")).toBeNull();
    expect(normalizeTrackingNumber("Hello world, this is text!")).toBeNull();
  });
});

describe("continuous scanning", () => {
  const known = parcelIndex([{ id: "s1", parcels: [{ trackingNumber: "TVO1000000001" }] }]);
  it("handles rapid consecutive scans, camera repeats and duplicates", () => {
    let t = 0;
    const session = new ScanSession({ known, now: () => t });
    expect(session.handle("TVO1000000001", "code128").kind).toBe("matched");
    t = 200;
    expect(session.handle("TVO1000000001", "code128").kind).toBe("repeat"); // same frame burst – silent
    t = 400;
    expect(session.handle("TVO2000000002", "code128").kind).toBe("unknown");
    t = 600;
    expect(session.handle("TVO3000000003", "qr").kind).toBe("unknown");
    t = 5000;
    const dup = session.handle("TVO1000000001", "code128");
    expect(dup.kind).toBe("duplicate");
    expect(session.count).toBe(3);
    expect(session.matchedCount).toBe(1);
    expect(session.unknownCount).toBe(2);
    expect(session.entries[0]!.code).toBe("TVO3000000003"); // newest first
    expect(session.handle("x").kind).toBe("invalid");
  });

  it("measures throughput for the device test matrix (200 parcels)", async () => {
    const { scanStats } = await import("../capture");
    let t = 0;
    const s = new ScanSession({ now: () => t });
    for (let i = 0; i < 200; i++) {
      t = i * 1200; // one parcel every 1.2 s
      s.handle(`TVO${String(1000000000 + i)}`);
    }
    t = 300_000;
    s.handle("TVO1000000005");
    expect(scanStats(s.entries)).toMatchObject({ scanned: 200, duplicates: 1, durationSeconds: 239, perMinute: 50, medianIntervalSeconds: 1.2 });
  });

  it("treats manual entry of an already scanned parcel as duplicate even immediately", () => {
    let t = 0;
    const s = new ScanSession({ now: () => t });
    s.handle("TVO5000000005");
    t = 10;
    expect(s.handle("tvo5000000005", "manual", "manual").kind).toBe("duplicate");
  });

  it("restores a persisted session (offline queue survives restart)", () => {
    const a = new ScanSession({ now: () => 0 });
    a.handle("TVO6000000006");
    const b = new ScanSession({ entries: a.entries, now: () => 99999 });
    expect(b.handle("TVO6000000006").kind).toBe("duplicate");
    expect(b.count).toBe(1);
  });
});

describe("label OCR parsing", () => {
  const label = `Absender: Muster Versand GmbH
Lagerweg 3
34117 Kassel
Empfänger:
Erika Beispiel
Lister Meile 42a
30161 Hannover
Sendungsnr. TVO 4455 6677 88`;

  it("extracts the recipient block, not the sender", () => {
    const x = parseLabelText(label);
    expect(x.recipientName.value).toBe("Erika Beispiel");
    expect(x.street.value).toBe("Lister Meile");
    expect(x.houseNumber.value).toBe("42a");
    expect(x.postalCode).toEqual({ value: "30161", confidence: "high" });
    expect(x.city.value).toBe("Hannover");
    expect(x.senderLines).toContain("34117 Kassel");
    expect(x.trackingNumber.confidence).toBe("medium"); // from text only
  });

  it("prefers a decoded barcode and lowers confidence for poor OCR lines", () => {
    const x = parseLabelText(
      [
        { text: "Jan Test", confidence: 0.95 },
        { text: "Bahnhofstr. 7", confidence: 0.6 },
        { text: "35708 Haiger", confidence: 0.9 },
      ],
      [{ data: "TVO1212121212", type: "code128" }],
    );
    expect(x.trackingNumber).toEqual({ value: "TVO1212121212", confidence: "high" });
    expect(x.street.confidence).toBe("medium");
    expect(fieldsNeedingReview(x)).toEqual(expect.arrayContaining(["street", "houseNumber", "recipientName"]));
  });

  it("reports when no address could be found instead of guessing", () => {
    const x = parseLabelText("FRAGILE\nTHIS SIDE UP");
    expect(x.postalCode.value).toBeNull();
    expect(x.warnings).toContain("address_not_found");
  });
});

describe("imports", () => {
  it("parses address lines with and without names", () => {
    expect(parseAddressLine("Max Muster, Musterstraße 12a, 30159 Hannover")).toEqual({
      recipientName: "Max Muster",
      street: "Musterstraße",
      houseNumber: "12a",
      postalCode: "30159",
      city: "Hannover",
    });
    expect(parseAddressLine("Am Markt 1 28195 Bremen")).toMatchObject({ street: "Am Markt", houseNumber: "1", postalCode: "28195", city: "Bremen" });
    expect(parseAddressLine("just some words")).toBeNull();
  });

  it("parses CSV with quotes, detects ; delimiter and maps German headers", () => {
    const csv = '﻿Name;Straße;Hausnummer;PLZ;Ort;Sendungsnummer;Hinweis\n"Muster; Erika";Lister Meile;42;30161;Hannover;TVO1000000011;"Hof, links"\n';
    const table = parseDelimited(csv);
    expect(table[1]![0]).toBe("Muster; Erika");
    const { rows, headerDetected } = rowsFromTable(table);
    expect(headerDetected).toBe(true);
    expect(rows[0]).toMatchObject({ line: 2, recipientName: "Muster; Erika", street: "Lister Meile", houseNumber: "42", postalCode: "30161", trackingNumbers: ["TVO1000000011"], notes: "Hof, links", errors: [] });
    expect(rows[0]!.warnings).toContain("needs_location"); // no coordinates invented
  });

  it("recognises different tracking-number formats in pasted lines", () => {
    const rows = rowsFromPastedText(["Lister Meile 4, 30161 Hannover TVOIMP000001 52.3822, 9.7471", "Am Markt 1, 28195 Bremen JJD000390007788991122", "Hauptstr. 5, 30159 Hannover 340123450000000011, 1Z999AA10123456784"].join("\n"));
    expect(rows.map((r) => r.errors)).toEqual([[], [], []]);
    expect(rows.map((r) => r.trackingNumbers)).toEqual([["TVOIMP000001"], ["JJD000390007788991122"], ["340123450000000011", "1Z999AA10123456784"]]);
    expect(rows[0]!.location).toEqual({ lat: 52.3822, lng: 9.7471 });
    expect(rows[2]).toMatchObject({ street: "Hauptstr.", houseNumber: "5", postalCode: "30159" });
  });

  it("validates rows and lets corrected rows pass", () => {
    const { rows } = rowsFromTable([
      ["street", "zip", "city", "lat", "lng", "from", "to"],
      ["Hauptstr 5", "1067", "Dresden", "51.05", "13.74", "10:00", "09:00"],
    ]);
    // A 4-digit postcode is never padded silently: blocking, with the padded code as a suggestion.
    expect(rows[0]!).toMatchObject({ postalCode: "1067", postalCodeSuggestion: "01067" });
    expect(rows[0]!.errors).toEqual(expect.arrayContaining(["postal_code_4_digits", "time_window_invalid"]));
    const fixed = validateImportRow({ ...rows[0]!, postalCode: rows[0]!.postalCodeSuggestion!, timeWindow: { start: 540, end: 600 } });
    expect(fixed.errors).toEqual([]);
  });

  it("groups parcels for the same address without losing tracking numbers", () => {
    const rows = rowsFromPastedText(
      ["Musterstraße 12, 30159 Hannover TVO1000000021", "Musterstr. 12, 30159 Hannover TVO1000000022", "Am Markt 1, 28195 Bremen TVO1000000023 52.0751, 8.8066", "Am Markt 1, 28195 Bremen TVO1000000023", "nonsense line"].join("\n"),
    );
    expect(rows[4]!.errors).toContain("address_unrecognized");
    expect(rows[2]!.location).toEqual({ lat: 52.0751, lng: 8.8066 });
    const groups = groupImportRows(rows);
    expect(groups).toHaveLength(2);
    expect(groups[0]!.input.trackingNumbers).toEqual(["TVO1000000021", "TVO1000000022"]);
    expect(groups[1]!.duplicateTracking).toEqual(["TVO1000000023"]);
    expect(summarizeImport(rows, groups)).toMatchObject({ rows: 5, valid: 4, invalid: 1, stops: 2, parcels: 3, needsLocation: 1, duplicates: 1 });
  });

  it("reads the first worksheet of an .xlsx file", () => {
    const xml = (s: string) => strToU8(s);
    const bytes = zipSync({
      "xl/workbook.xml": xml('<workbook><sheets><sheet name="Stops" sheetId="1" r:id="rId1"/></sheets></workbook>'),
      "xl/_rels/workbook.xml.rels": xml('<Relationships><Relationship Id="rId1" Type="ws" Target="worksheets/sheet1.xml"/></Relationships>'),
      "xl/sharedStrings.xml": xml("<sst><si><t>Street</t></si><si><t>PLZ</t></si><si><t>City</t></si><si><r><t>Lister </t></r><r><t>Meile 4</t></r></si><si><t>Hannover &amp; Region</t></si></sst>"),
      "xl/worksheets/sheet1.xml": xml(
        '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c><c r="E1" t="inlineStr"><is><t>Tracking</t></is></c></row>' +
          '<row r="2"><c r="A2" t="s"><v>3</v></c><c r="B2"><v>30161</v></c><c r="C2" t="s"><v>4</v></c><c r="E2" t="str"><v>TVO1000000031</v></c></row></sheetData></worksheet>',
      ),
    });
    const table = parseXlsx(bytes);
    expect(table).toEqual([
      ["Street", "PLZ", "City", "", "Tracking"],
      ["Lister Meile 4", "30161", "Hannover & Region", "", "TVO1000000031"],
    ]);
    expect(rowsFromTable(table).rows[0]).toMatchObject({ street: "Lister Meile", houseNumber: "4", trackingNumbers: ["TVO1000000031"], errors: [] });
    expect(() => parseXlsx(new Uint8Array([0xd0, 0xcf, 0x11]))).toThrow(XlsxError);
  });
});

describe("import column mapping (Dispatch file import)", () => {
  // A carrier manifest with headers TURVIO does not know.
  const table = [
    ["Sdg-Nr", "Empf.", "Anschrift Zeile", "PLZ/Ort", "Zielort", "Hinweis"],
    ["00340434161094000001", "Kiosk am Platz", "Lister Meile 44a", "30161", "Hannover", "Hintereingang"],
    ["00340434161094000002", "Kiosk am Platz", "Lister Meile 44a", "30161", "Hannover", ""],
    ["00340434161094000003", "Praxis Dr. Ay", "Podbielskistr. 7", "30163", "Hannover", ""],
  ];
  const mapping = ["tracking", "recipientName", "street", "postalCode", "city", "notes"] as const;

  it("unknown headers are not guessed; an explicit mapping reads every row", () => {
    expect(detectColumns(table[0]!)).toBeNull();
    const { rows } = rowsFromTable(table, { columns: [...mapping], header: true });
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ line: 2, street: "Lister Meile", houseNumber: "44a", postalCode: "30161", city: "Hannover", recipientName: "Kiosk am Platz", notes: "Hintereingang", errors: [] });
    expect(rows[0]!.trackingNumbers).toEqual(["340434161094000001"]);
  });

  it("same address becomes one stop with all parcels", () => {
    const groups = groupImportRows(rowsFromTable(table, { columns: [...mapping], header: true }).rows);
    expect(groups).toHaveLength(2);
    expect(groups[0]!.input.trackingNumbers).toEqual(["340434161094000001", "340434161094000002"]);
  });

  it("a file without a header row keeps its first line", () => {
    const { rows } = rowsFromTable(table.slice(1), { columns: [...mapping], header: false });
    expect(rows).toHaveLength(3);
    expect(rows[0]!.line).toBe(1);
  });

  it("reports mappings that cannot produce an address", () => {
    expect(mappingProblems([...mapping])).toEqual([]);
    expect(mappingProblems(["tracking", "recipientName", null, null, "city", null])).toContain("no_address_columns");
    expect(mappingProblems(["street", "street", "postalCode"])).toContain("mapped_twice:street");
    expect(mappingProblems(["address", "lat", null])).toContain("lat_lng_incomplete");
  });
});

describe("import plan: large customers, umlauts, per-parcel recipients, conflicts", () => {
  const row = (line: number, tracking: string, street: string, extra: Partial<Record<string, string>> = {}) =>
    rowsFromTable([
      ["tracking", "recipient", "company", "street", "housenumber", "zip", "city"],
      [tracking, extra.recipient ?? `Person ${line}`, extra.company ?? "", street, extra.no ?? "1", extra.zip ?? "30165", "Hannover"],
    ]).rows.map((r) => ({ ...r, line }))[0]!;

  it("1,000 parcels at one address: one stop, no crash, every parcel with its own recipient and company", () => {
    const rows = Array.from({ length: 1000 }, (_, i) => row(i + 2, `TVO${100000 + i}`, "Lister Meile", { recipient: `Empfänger ${i}`, company: i % 2 ? "Leinetal GmbH" : "" }));
    const plan = planImport(rows);
    expect(plan.groups).toHaveLength(1);
    expect(plan.blockingGroups).toBe(0);
    const parcels = plan.groups[0]!.input.parcels!;
    expect(parcels).toHaveLength(1000);
    expect(parcels[7]).toEqual({ trackingNumber: "TVO100007", recipientName: "Empfänger 7", company: "Leinetal GmbH" });
    expect(parcels[8]!.company).toBeUndefined();
  });

  it("more than 1,000 parcels at one address is reported as a problem, never thrown", () => {
    const rows = Array.from({ length: 1001 }, (_, i) => row(i + 2, `TVO${200000 + i}`, "Lister Meile"));
    const plan = planImport(rows);
    expect(plan.blockingGroups).toBe(1);
    expect(plan.groups[0]!.problems[0]).toBe("too_many_parcels:1001");
  });

  it("German spelling variants are one address: Straße/Strasse/Str., ä/ae ö/oe ü/ue, case, '12 a', spaces, hyphens", () => {
    const variants = [
      ["Elfriede-Döler-Weg", "12a"], ["Elfriede-Doeler-Weg", "12 a"], ["elfriede döler weg", "12A"], ["ELFRIEDE-DOELER-WEG", " 12a "],
    ];
    const plan = planImport(variants.map(([s, no], i) => row(i + 2, `T${i}`, s!, { no })));
    expect(plan.groups).toHaveLength(1);
    const streets = ["Göbelstraße", "Goebelstrasse", "göbelstr.", "GOEBELSTR", "Göbel-Str."];
    expect(planImport(streets.map((s, i) => row(i + 2, `G${i}`, s))).groups).toHaveLength(1);
    // A different house number or postcode stays a different stop.
    expect(planImport([row(2, "A", "Göbelstraße"), row(3, "B", "Göbelstraße", { no: "2" }), row(4, "C", "Göbelstraße", { zip: "30163" })]).groups).toHaveLength(3);
  });

  it("same tracking number twice at the same address: one parcel, listed as a duplicate", () => {
    const plan = planImport([row(2, "TVODUP000001", "Göbelstraße"), row(3, "TVODUP000001", "Goebelstrasse"), row(4, "TVOX00000001", "Göbelstraße")]);
    expect(plan.groups[0]!.input.parcels!.map((p) => p.trackingNumber)).toEqual(["TVODUP000001", "TVOX00000001"]);
    expect(plan.duplicates).toEqual([{ trackingNumber: "TVODUP000001", lines: [2, 3] }]);
    expect(plan.conflicts).toEqual([]);
  });

  it("same tracking number at two addresses: a conflict that blocks until resolved; nothing dropped silently", () => {
    const rows = [row(2, "TVOC00000001", "Göbelstraße"), row(3, "TVOC00000001", "Nordring", { recipient: "Wrong" }), row(4, "TVOOK0000001", "Nordring")];
    const open = planImport(rows);
    expect(open.unresolved).toBe(1);
    expect(open.conflicts[0]).toMatchObject({ trackingNumber: "TVOC00000001", options: [{ line: 2, address: "Göbelstraße 1, 30165 Hannover" }, { line: 3, address: "Nordring 1, 30165 Hannover", recipientName: "Wrong" }] });
    expect(open.groups.flatMap((g) => g.input.parcels!.map((p) => p.trackingNumber))).toEqual(["TVOOK0000001"]); // C1 waits for a decision
    const chosen = planImport(rows, { TVOC00000001: 2 });
    expect(chosen.unresolved).toBe(0);
    expect(chosen.groups.find((g) => g.input.address.street === "Göbelstraße")!.input.parcels!.map((p) => p.trackingNumber)).toEqual(["TVOC00000001"]);
    const skipped = planImport(rows, { TVOC00000001: "skip" });
    expect(skipped).toMatchObject({ unresolved: 0, skipped: ["TVOC00000001"] });
  });

  it("a 'Firma' column is the company, not the recipient", () => {
    expect(detectColumns(["Sendungsnummer", "Empfänger", "Firma", "Straße", "PLZ", "Ort"])).toEqual(["tracking", "recipientName", "company", "street", "postalCode", "city"]);
  });
});
