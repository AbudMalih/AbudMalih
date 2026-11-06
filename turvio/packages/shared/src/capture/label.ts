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
  /** Position in the analysed image (pixels), when the engine reports it. */
  frame?: { x: number; y: number; width: number; height: number };
  /** Text block (paragraph) index from the engine. */
  block?: number;
}

/**
 * Put OCR lines into reading order. Engines return blocks (paragraphs); labels often
 * have sender and recipient side by side, so blocks are kept together and ordered
 * top-to-bottom, left-to-right; lines inside a block top-to-bottom.
 */
export function orderOcrLines<T extends OcrLine>(lines: T[]): T[] {
  if (!lines.some((l) => l.frame)) return lines;
  const blocks = new Map<number, T[]>();
  lines.forEach((l, i) => {
    const key = l.block ?? i;
    blocks.set(key, [...(blocks.get(key) ?? []), l]);
  });
  const top = (ls: T[]) => Math.min(...ls.map((l) => l.frame?.y ?? 0));
  const left = (ls: T[]) => Math.min(...ls.map((l) => l.frame?.x ?? 0));
  const rowHeight = Math.max(8, median(lines.map((l) => l.frame?.height ?? 0)));
  return [...blocks.values()]
    .sort((a, b) => (Math.abs(top(a) - top(b)) < rowHeight * 0.6 ? left(a) - left(b) : top(a) - top(b)))
    .flatMap((ls) => [...ls].sort((a, b) => (a.frame?.y ?? 0) - (b.frame?.y ?? 0)));
}

function median(xs: number[]) {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)]! : 0;
}

/** OCR confusions in a postal-code token (3O161 → 30161). */
const POSTAL_FIX: Record<string, string> = { O: "0", o: "0", D: "0", I: "1", l: "1", i: "1", S: "5", s: "5", B: "8", Z: "2" };
function fixPostal(text: string): { text: string; corrected: boolean } {
  const m = /^((?:D|DE)\s?-\s?)?([0-9OoDIliSsBZ]{5})(\s+[A-Za-zÄÖÜäöüß].*)$/.exec(text);
  if (!m || /^\d{5}$/.test(m[2]!) || (m[2]!.match(/\d/g) ?? []).length < 3) return { text, corrected: false };
  const fixed = [...m[2]!].map((ch) => POSTAL_FIX[ch] ?? ch).join("");
  return /^\d{5}$/.test(fixed) ? { text: `${m[1] ?? ""}${fixed}${m[3]}`, corrected: true } : { text, corrected: false };
}

/** How likely a decoded barcode is the parcel's tracking number (product EANs score lowest). */
function barcodeScore(code: string, type?: string): number {
  if (/^(JJD\d{14,22}|00\d{18}|1Z[0-9A-Z]{16}|[A-Z]{2}\d{9}[A-Z]{2})$/.test(code)) return 4;
  if (/[A-Z]/.test(code) && /\d{6}/.test(code) && code.length >= 10) return 3;
  if (/^\d{12,22}$/.test(code) && !(type === "ean13" || type === "upc_a" || type === "ean8")) return 2;
  if (type === "ean13" || type === "ean8" || type === "upc_a" || type === "upc_e") return 0;
  return 1;
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
  /** Other decoded parcel codes on the label (driver can pick a different one). */
  barcodeAlternatives: string[];
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
  let postalCorrected = false;
  const lines: OcrLine[] = (typeof input === "string" ? input.split(/\r?\n/).map((text) => ({ text })) : input)
    .map((l) => {
      const text = l.text
        .replace(/\s+/g, " ")
        .trim()
        .replace(/(str\.)(\d)/i, "$1 $2"); // "Hauptstr.5"
      const f = fixPostal(text);
      if (f.corrected) postalCorrected = true;
      return { ...l, text: f.text };
    })
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
    barcodeAlternatives: [],
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
    out.postalCode = { value: m[1]!, confidence: lineConfidence(multiple || postalCorrected ? "medium" : "high", pl.confidence) };
    if (postalCorrected) out.warnings.push("postal_code_corrected");
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
      // Never "high": the driver confirms the recipient; "low" when the label is ambiguous.
      const marked = tagged.some((l) => l.section === "recipient");
      for (let i = pi - 2; i >= 0 && i >= pi - 4; i--) {
        const l = tagged[i]!;
        if (l.section === "sender") break;
        if (/^c\s?\/\s?o\b/i.test(l.text)) {
          out.warnings.push("care_of");
          continue;
        }
        if (/\d{3,}/.test(l.text) || l.text.length > 60) continue;
        const looksCompany = NOISE.test(l.text);
        const base: Confidence = looksCompany || (multiple && !marked) ? "low" : "medium";
        out.recipientName = { value: l.text, confidence: lineConfidence(base, l.confidence) };
        if (!looksCompany) break;
      }
      if (!out.recipientName.value) out.warnings.push("recipient_not_found");
    }
  } else {
    out.warnings.push("address_not_found");
  }

  // Tracking number: a decoded barcode beats text. Several codes (routing, product EAN,
  // carrier code) are ranked; a tie means the driver has to choose.
  const ranked = [...new Map(barcodes.map((b) => [normalizeTrackingNumber(b.data), b.type] as const).filter(([n]) => !!n)).entries()]
    .map(([code, type]) => ({ code: code!, score: barcodeScore(code!, type) }))
    .sort((a, b) => b.score - a.score);
  if (ranked.length) {
    const tie = ranked.length > 1 && ranked[1]!.score === ranked[0]!.score;
    const conf: Confidence = tie ? "medium" : ranked[0]!.score === 0 ? "low" : "high";
    out.barcode = { value: ranked[0]!.code, confidence: conf };
    out.trackingNumber = { value: ranked[0]!.code, confidence: conf };
    out.barcodeAlternatives = ranked.slice(1).map((r) => r.code);
    if (tie) out.warnings.push("multiple_barcodes");
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
