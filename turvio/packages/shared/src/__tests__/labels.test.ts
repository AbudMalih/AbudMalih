import { describe, expect, it } from "vitest";
import { fieldsNeedingReview, orderOcrLines, parseLabelText, type OcrLine } from "../capture";

/** Synthetic labels only – names and addresses are fictional. */
const box = (x: number, y: number, w = 300, h = 22) => ({ x, y, width: w, height: h });

describe("synthetic parcel labels", () => {
  it("orders side-by-side sender and recipient blocks (engine returned them interleaved)", () => {
    const lines: OcrLine[] = [
      { text: "Empfänger:", block: 1, frame: box(400, 40) },
      { text: "Absender:", block: 0, frame: box(20, 40) },
      { text: "Erika Beispiel", block: 1, frame: box(400, 70) },
      { text: "Muster Versand GmbH", block: 0, frame: box(20, 70) },
      { text: "Lister Meile 42a", block: 1, frame: box(400, 100) },
      { text: "Lagerweg 3", block: 0, frame: box(20, 100) },
      { text: "30161 Hannover", block: 1, frame: box(400, 130) },
      { text: "34117 Kassel", block: 0, frame: box(20, 130) },
    ];
    const ordered = orderOcrLines(lines);
    expect(ordered.map((l) => l.text).slice(0, 4)).toEqual(["Absender:", "Muster Versand GmbH", "Lagerweg 3", "34117 Kassel"]);
    const x = parseLabelText(ordered);
    expect(x).toMatchObject({ recipientName: { value: "Erika Beispiel" }, street: { value: "Lister Meile" }, houseNumber: { value: "42a" }, postalCode: { value: "30161" }, city: { value: "Hannover" } });
  });

  it("corrects typical OCR digit confusions in the postal code but asks for a check", () => {
    const x = parseLabelText("Jan Test\nGöttinger Chaussee 115\n3O449 Hannover");
    expect(x.postalCode).toEqual({ value: "30449", confidence: "medium" });
    expect(x.warnings).toContain("postal_code_corrected");
    expect(x.houseNumber.value).toBe("115");
  });

  it("handles 'Str.' without space, house-number ranges and D- prefixes", () => {
    expect(parseLabelText("A. Muster\nHauptstr.5\nD-35708 Haiger")).toMatchObject({ street: { value: "Hauptstr." }, houseNumber: { value: "5" }, postalCode: { value: "35708" } });
    expect(parseLabelText("B. Muster\nAm Markt 12-14\n28195 Bremen").houseNumber.value).toBe("12-14");
  });

  it("skips c/o lines instead of taking them as the recipient", () => {
    const x = parseLabelText("Lea Beispiel\nc/o Muster GmbH\nPodbielskistraße 11\n30163 Hannover");
    expect(x.recipientName.value).toBe("Lea Beispiel");
    expect(x.warnings).toContain("care_of");
  });

  it("reads Packstation addresses", () => {
    const x = parseLabelText("Max Muster\n12345678\nPackstation 117\n30159 Hannover");
    expect(x).toMatchObject({ street: { value: "Packstation" }, houseNumber: { value: "117" }, recipientName: { value: "Max Muster" } });
  });

  it("ranks several barcodes: carrier code over product EAN; ties need the driver", () => {
    const x = parseLabelText("Erika Beispiel\nLister Meile 4\n30161 Hannover", [
      { data: "4006381333931", type: "ean13" },
      { data: "JJD0001234567890123", type: "code128" },
    ]);
    expect(x.trackingNumber).toEqual({ value: "JJD0001234567890123", confidence: "high" });
    expect(x.barcodeAlternatives).toEqual(["4006381333931"]);
    const tie = parseLabelText("x", [
      { data: "TVO1111111111", type: "code128" },
      { data: "TVO2222222222", type: "qr" },
    ]);
    expect(tie.trackingNumber.confidence).toBe("medium");
    expect(tie.warnings).toContain("multiple_barcodes");
  });

  it("never marks a guessed recipient as certain; ambiguous labels give low confidence", () => {
    const x = parseLabelText("Firma Alpha\nWeg 1\n30159 Hannover\nBeta Person\nAllee 2\n30161 Hannover");
    expect(x.warnings).toContain("multiple_addresses");
    expect(x.recipientName.confidence).toBe("low");
    expect(fieldsNeedingReview(x)).toContain("recipientName");
  });

  it("reports missing fields instead of inventing them", () => {
    const x = parseLabelText("Lister Meile\n30161 Hannover");
    expect(x.houseNumber.value).toBeNull();
    expect(x.warnings).toEqual(expect.arrayContaining(["house_number_missing", "recipient_not_found", "tracking_not_found"]));
  });

  it("lowers confidence for blurry lines (poor lighting)", () => {
    const x = parseLabelText([
      { text: "Erika Beispiel", confidence: 0.4 },
      { text: "Lister Meile 42", confidence: 0.45 },
      { text: "30161 Hannover", confidence: 0.7 },
    ]);
    expect(x.recipientName.confidence).toBe("low");
    expect(x.street.confidence).toBe("low");
    expect(x.postalCode.confidence).toBe("medium");
  });
});
