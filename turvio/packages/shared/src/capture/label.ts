import { normalizeTrackingNumber } from "./barcode";

/**
 * Turns text recognised on a parcel label (OCR) plus decoded barcodes into
 * address fields with a confidence per field. OCR output is never trusted
 * blindly: the driver reviews and corrects every field before saving.
 */

export type Confidence = "high" | "medium" | "low" | "none";

export interface OcrLine {
  text: string;
  /** 0..1 if the OCR engine reports it. */
  confidence?: number;
}

export interface LabelField<T = string> {
  value: T | null;
  confidence: Confidence;
}

export interface LabelExtraction {
  recipientName: LabelField;
  street: LabelField;
  houseNumber: LabelField;
  postalCode: LabelField;
  city: LabelField;
  trackingNumber: LabelField;
  barcode: LabelField;
  /** Lines that were ignored as sender address. */
  senderLines: string[];
  warnings: string[];
}

const SENDER_MARKERS = /^(absender|von|from|sender|expéditeur|expeditor|retour|return)\b[:\s]*/i;
const RECIPIENT_MARKERS = /^(empfänger|empfaenger|an|to|ship to|recipient|destinatar|deliver to)\b[:\s]*/i;
const POSTAL_CITY = /^(?:(?:D|DE)\s?-\s?)?(\d{5})\s+([A-Za-zÄÖÜäöüßăâîșțĂÂÎȘȚ][A-Za-zÄÖÜäöüßăâîșțĂÂÎȘȚ .\-()/]{1,60})$/;
const STREET_NUMBER = /^(.{2,80}?)[\s,]+(\d{1,4}\s?[a-zA-Z]?(?:\s?[-/]\s?\d{1,4}\s?[a-zA-Z]?)?)$/;
const PACKSTATION = /^(packstation|postfiliale|paketshop)\s*(\d{1,4})$/i;
const TRACKING_IN_TEXT = /\b(JJD\d{14,22}|00\d{18}|1Z[0-9A-Z]{16}|[A-Z]{2}\d{9}[A-Z]{2}|[A-Z]{2,4}\d{8,20}|\d{12,22})\b/;
const NOISE = /(gmbh|ag|ug|kg|ltd|inc|sendung|paket|gewicht|weight|kg\b|datum|date|tel\.?|phone|www\.|@)/i;

function lineConfidence(base: Confidence, ocr?: number): Confidence {
  if (ocr === undefined) return base;
  if (ocr < 0.5) return "low";
  if (ocr < 0.8 && base === "high") return "medium";
  return base;
}

export function parseLabelText(input: string | OcrLine[], barcodes: { data: string; type?: string }[] = []): LabelExtraction {
  const lines: OcrLine[] = (typeof input === "string" ? input.split(/\r?\n/).map((text) => ({ text })) : input)
    .map((l) => ({ ...l, text: l.text.replace(/\s+/g, " ").trim() }))
    .filter((l) => l.text.length > 0);
  const out: LabelExtraction = {
    recipientName: { value: null, confidence: "none" },
    street: { value: null, confidence: "none" },
    houseNumber: { value: null, confidence: "none" },
    postalCode: { value: null, confidence: "none" },
    city: { value: null, confidence: "none" },
    trackingNumber: { value: null, confidence: "none" },
    barcode: { value: null, confidence: "none" },
    senderLines: [],
    warnings: [],
  };

  // Split into sender / recipient blocks when the label marks them.
  let section: "unknown" | "sender" | "recipient" = "unknown";
  const tagged = lines.map((l) => {
    if (SENDER_MARKERS.test(l.text)) {
      section = "sender";
      return { ...l, text: l.text.replace(SENDER_MARKERS, ""), section };
    }
    if (RECIPIENT_MARKERS.test(l.text)) {
      section = "recipient";
      return { ...l, text: l.text.replace(RECIPIENT_MARKERS, ""), section };
    }
    return { ...l, section };
  }).filter((l) => l.text.length > 0);

  const postalIdx = tagged
    .map((l, i) => (POSTAL_CITY.test(l.text) && l.section !== "sender" ? i : -1))
    .filter((i) => i >= 0);
  out.senderLines = tagged.filter((l) => l.section === "sender").map((l) => l.text);
  if (postalIdx.length > 1 && !tagged.some((l) => l.section === "recipient")) {
    out.warnings.push("multiple_addresses");
  }
  // Recipient is usually the last (lowest, largest) address block on a label.
  const pi = postalIdx.at(-1);
  if (pi !== undefined) {
    const pl = tagged[pi]!;
    const m = POSTAL_CITY.exec(pl.text)!;
    const multiple = out.warnings.includes("multiple_addresses");
    out.postalCode = { value: m[1]!, confidence: lineConfidence(multiple ? "medium" : "high", pl.confidence) };
    out.city = { value: m[2]!.trim(), confidence: lineConfidence(multiple ? "medium" : "high", pl.confidence) };

    const streetLine = tagged[pi - 1];
    if (streetLine) {
      const ps = PACKSTATION.exec(streetLine.text);
      const sm = ps ? [streetLine.text, ps[1]!, ps[2]!] : STREET_NUMBER.exec(streetLine.text);
      if (sm) {
        out.street = { value: sm[1]!.replace(/,$/, "").trim(), confidence: lineConfidence("high", streetLine.confidence) };
        out.houseNumber = { value: sm[2]!.replace(/\s+/g, ""), confidence: lineConfidence("high", streetLine.confidence) };
      } else {
        out.street = { value: streetLine.text, confidence: "low" };
        out.warnings.push("house_number_missing");
      }
      // Name: nearest line above the street that looks like a name, not company/noise/numbers.
      for (let i = pi - 2; i >= 0 && i >= pi - 4; i--) {
        const l = tagged[i]!;
        if (l.section === "sender") break;
        if (/\d{3,}/.test(l.text) || l.text.length > 60) continue;
        const looksCompany = NOISE.test(l.text);
        out.recipientName = { value: l.text, confidence: lineConfidence(looksCompany ? "low" : "medium", l.confidence) };
        if (!looksCompany) break;
      }
    }
  } else {
    out.warnings.push("address_not_found");
  }

  // Tracking number: a decoded barcode beats text.
  for (const b of barcodes) {
    const n = normalizeTrackingNumber(b.data);
    if (n) {
      out.barcode = { value: n, confidence: "high" };
      out.trackingNumber = { value: n, confidence: "high" };
      break;
    }
  }
  if (!out.trackingNumber.value) {
    for (const l of tagged) {
      const m = TRACKING_IN_TEXT.exec(l.text.replace(/\s(?=\d)/g, ""));
      if (m && !POSTAL_CITY.test(l.text)) {
        out.trackingNumber = { value: m[1]!, confidence: lineConfidence("medium", l.confidence) };
        break;
      }
    }
  }
  if (!out.trackingNumber.value) out.warnings.push("tracking_not_found");
  return out;
}

/** Fields the driver must look at before saving (missing or not high confidence). */
export function fieldsNeedingReview(x: LabelExtraction): (keyof Omit<LabelExtraction, "senderLines" | "warnings">)[] {
  const keys = ["recipientName", "street", "houseNumber", "postalCode", "city", "trackingNumber"] as const;
  return keys.filter((k) => x[k].confidence !== "high");
}
