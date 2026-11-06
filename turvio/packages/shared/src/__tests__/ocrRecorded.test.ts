import { describe, expect, it } from "vitest";
import { extractAddresses } from "../capture/addresses";
import { orderOcrLines, type OcrLine } from "../capture/label";
import expected from "./fixtures/capture-expected.json";
import recorded from "./fixtures/ocr-recorded.json";

/**
 * REAL OCR output (Tesseract 5, deu+eng) and real barcode decoding (zbar) of the synthetic
 * sample images in docs/testing/capture-samples – recorded with tools/ocr_eval_record.py.
 * It contains genuine OCR errors (e.g. "JJDO…" for "JJD0…", "✓✓" read as "vv").
 */
type Exp = { addresses: { name?: string; street?: string; no?: string; plz?: string; city?: string; kind?: string; postNumber?: string }[]; tracking: string[] };
const samples = recorded.samples as Record<string, { lines: OcrLine[]; barcodes: { data: string; type?: string }[] }>;

describe("recorded real OCR of the synthetic samples", () => {
  for (const [name, exp] of Object.entries(expected as Record<string, Exp>)) {
    it(name, () => {
      const s = samples[name]!;
      const x = extractAddresses(orderOcrLines(s.lines), s.barcodes);
      expect(x.addresses).toHaveLength(exp.addresses.length);
      exp.addresses.forEach((e, i) => {
        const a = x.addresses[i]!;
        const got = { name: a.recipientName.value, street: a.street.value, no: a.houseNumber.value, plz: a.postalCode.value, city: a.city.value, kind: a.kind, postNumber: a.postNumber };
        expect(got).toMatchObject(Object.fromEntries(Object.entries({ ...e }).filter(([, v]) => v !== undefined)));
      });
      expect(x.addresses.flatMap((a) => a.trackingNumbers.map((t) => t.code))).toEqual(exp.tracking);
    });
  }
});
