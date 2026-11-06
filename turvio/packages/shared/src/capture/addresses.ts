import { addressKey } from "../tour";
import type { Stop } from "../schemas";
import { normalizeTrackingNumber } from "./barcode";
import { parseLabelText, type Confidence, type LabelField, type OcrLine } from "./label";

/**
 * Address extraction from photos and screenshots (OCR text + decoded barcodes):
 * parcel labels (DHL, Hermes, DPD, GLS, UPS), Packstation / parcel-shop addresses,
 * chat screenshots (WhatsApp …), one-line addresses ("Str. 1, 12345 Stadt") and
 * several addresses in one image. Nothing is invented: every field carries a
 * confidence, and the driver reviews before saving.
 */

export type Carrier = "dhl" | "hermes" | "dpd" | "gls" | "ups" | "unknown";
export type AddressKind = "address" | "packstation" | "parcel_shop";

export interface TrackingCandidate {
  code: string;
  carrier: Carrier;
  source: "barcode" | "text";
  confidence: Confidence;
}

export interface AddressCandidate {
  kind: AddressKind;
  recipientName: LabelField;
  street: LabelField;
  houseNumber: LabelField;
  postalCode: LabelField;
  city: LabelField;
  /** DHL Postnummer (Packstation / Postfiliale). */
  postNumber: string | null;
  /** Name of the parcel shop when the address is one. */
  shopName: string | null;
  trackingNumbers: TrackingCandidate[];
  warnings: string[];
}

export interface AddressExtraction {
  addresses: AddressCandidate[];
  /** Tracking numbers that could not be tied to one address (several addresses + codes). */
  unassignedTrackingNumbers: TrackingCandidate[];
  carrier: Carrier;
  mode: "label" | "text";
  warnings: string[];
}

const SENDER_OR_RECIPIENT = /^(absender|von|from|sender|empfänger|empfaenger|an|to|ship to|recipient|deliver to)\b[:\s]/i;
const POSTAL_CITY = /^(?:(?:D|DE)\s?-\s?)?(\d{5})\s+([A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß .\-()/]{1,60})$/;
/** "[Name, ]Street 12a, 12345 City[, Deutschland]" (also without the comma before the postcode). */
const ONE_LINE =
  /^(?:(.{2,60}?),\s*)?([A-Za-zÄÖÜäöüß][^,]{1,60}?\s\d{1,4}\s?[a-zA-Z]?(?:\s?[-/]\s?\d{1,4}[a-zA-Z]?)?)\s*,?\s+(?:D-)?(\d{5})\s+([A-Za-zÄÖÜäöüß][^,\d]{1,50}?)(?:\s*,\s*[A-Za-zÄÖÜäöüß .\-]{2,30})?\s*$/i; // trailing country / district / cut-off text
const ENUMERATION = /^\s*(?:\d{1,2}[.)]|[-•*–]|\(\d{1,2}\))\s+/;
/** A phone number: named as such, international German prefix, or a line that is only a phone number. */
const PHONE = /(\btel\b|telefon|mobil|handy|\bfon\b|\+49|^\s*0\d{2,5}[\s/-]?\d{3,}[\s\d/-]*$)/i;
/** Lead-in words before an address in messages ("Bitte an …", "Lieferadresse: …"). */
const LEAD_IN = /^(?:bitte\s+)?(?:an|nach|zu|lieferadresse|lieferung an|liefern an|adresse|addr\.?)\s*:?\s+/i;
/** Labels in front of a tracking number. */
const TRACKING_LABEL = /^(?:paket-?(?:nr|nummer)|sendungs-?(?:nr|nummer)|track(?:ing)?[- ]?(?:id|nr|nummer)?|parcel(?: no)?|nr)\.?\s*:?\s*/i;
const CHAT_NOISE = [
  /^\d{1,2}:\d{2}(\s*(✓|✔|✓)+)?$/, // "14:32 ✓✓"
  /^(✓|✔|✓)+$/,
  /^(heute|gestern|today|yesterday|montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag)\b.{0,12}$/i,
  /^(online|zuletzt online|tippt|typing|nachricht|message|weitergeleitet|forwarded)\b/i,
  /^(https?:\/\/|www\.)/i,
  /^[^A-Za-z0-9ÄÖÜäöüß]+$/, // only emoji / punctuation
  /^(hallo|hi|hey|moin|servus|guten (morgen|tag|abend)|danke|bitte|ok|okay|liebe grüße|lg|vg|mfg)\b.{0,80}$/i,
];
const CARRIER_WORDS: [Carrier, RegExp][] = [
  ["dhl", /\b(dhl|deutsche post|packstation|postfiliale|postnummer)\b/i],
  ["hermes", /\bhermes\b/i],
  ["dpd", /\bdpd\b/i],
  ["gls", /\bgls\b/i],
  ["ups", /\bups\b/i],
];
const PACKSTATION_LINE = /^(packstation|postfiliale|filiale)\s*(?:nr\.?\s*)?(\d{1,4})$/i;
const POST_NUMBER = /(?:postnummer|post-nr\.?|postnr\.?|kundennummer)\s*[:.]?\s*(\d{6,10})/i;
const SHOP_LINE = /\b(paketshop|paket-shop|pakets?hop|pickup|paketstation|annahmestelle|abholstelle)\b/i;

/** Tracking-number formats by carrier (after removing spaces). Strongest first. */
const TRACKING_PATTERNS: { re: RegExp; carrier: Carrier; strength: Confidence }[] = [
  { re: /^JJD\d{14,22}$/, carrier: "dhl", strength: "high" },
  { re: /^JV[A-Z]{2}\d{9,20}$/, carrier: "dhl", strength: "high" },
  { re: /^00340\d{15}$/, carrier: "dhl", strength: "high" },
  { re: /^[A-Z]{2}\d{9}DE$/, carrier: "dhl", strength: "high" },
  { re: /^1Z[0-9A-Z]{16}$/, carrier: "ups", strength: "high" },
  { re: /^H\d{19}$/, carrier: "hermes", strength: "high" },
  { re: /^0\d{13}$/, carrier: "dpd", strength: "medium" },
  { re: /^\d{20}$/, carrier: "unknown", strength: "medium" },
  { re: /^\d{14}$/, carrier: "unknown", strength: "medium" },
  { re: /^\d{12}$/, carrier: "unknown", strength: "low" },
  { re: /^\d{11}$/, carrier: "unknown", strength: "low" },
];

export function classifyTracking(code: string, context: Carrier = "unknown"): { carrier: Carrier; confidence: Confidence } | null {
  for (const p of TRACKING_PATTERNS) {
    if (!p.re.test(code)) continue;
    if (p.carrier !== "unknown") return { carrier: p.carrier, confidence: p.strength };
    // Bare digit strings are only trusted with a carrier named in the image.
    if (context === "unknown") return p.strength === "low" ? null : { carrier: "unknown", confidence: "low" };
    if (context === "gls" && (code.length === 11 || code.length === 12)) return { carrier: "gls", confidence: "medium" };
    if (context === "hermes" && (code.length === 14 || code.length === 20)) return { carrier: "hermes", confidence: "medium" };
    if (context === "dpd" && code.length === 14) return { carrier: "dpd", confidence: "medium" };
    if (context === "dhl" && (code.length === 12 || code.length === 20)) return { carrier: "dhl", confidence: "medium" };
    return { carrier: context, confidence: "low" };
  }
  return null;
}

function detectCarrier(text: string): Carrier {
  for (const [carrier, re] of CARRIER_WORDS) if (re.test(text)) return carrier;
  return "unknown";
}

function trackingInLine(text: string, context: Carrier): TrackingCandidate[] {
  if (PHONE.test(text) || POSTAL_CITY.test(text) || POST_NUMBER.test(text)) return [];
  const out: TrackingCandidate[] = [];
  // Codes are often printed in groups ("JJD 0003 9000 …", "1Z 999 AA1 01 …"): try the whole
  // line without its label and spaces, then the single tokens.
  const rest = text.replace(TRACKING_LABEL, "").trim();
  const whole = /^[A-Za-z0-9][A-Za-z0-9 ]+$/.test(rest) ? [rest.replace(/\s+/g, "")] : [];
  for (const token of [...whole, ...text.split(/[^A-Za-z0-9]+/)]) {
    const code = normalizeTrackingNumber(token);
    if (!code || code.length < 11) continue;
    const c = classifyTracking(code, context);
    if (c && !out.some((o) => o.code === code)) out.push({ code, carrier: c.carrier, source: "text", confidence: c.confidence });
  }
  return out;
}

/** Clean chat noise and split one-line addresses into street / postcode-city lines. */
export function prepareLines(input: string | OcrLine[]): OcrLine[] {
  const raw: OcrLine[] = typeof input === "string" ? input.split(/\r?\n/).map((text) => ({ text })) : input;
  const out: OcrLine[] = [];
  for (const l of raw) {
    const text = l.text.replace(/\s+/g, " ").replace(ENUMERATION, "").trim();
    if (!text) continue;
    // Address-like lines win over the chat-noise filter ("Bitte an Steinweg 20, 98527 Suhl").
    const m = ONE_LINE.exec(text.replace(LEAD_IN, ""));
    if (!m && CHAT_NOISE.some((re) => re.test(text))) continue;
    if (m && !SENDER_OR_RECIPIENT.test(text)) {
      if (m[1] && !/\d/.test(m[1])) out.push({ ...l, text: m[1].trim() });
      out.push({ ...l, text: m[2]!.trim() });
      out.push({ ...l, text: `${m[3]} ${m[4]!.trim()}` });
      continue;
    }
    out.push({ ...l, text });
  }
  return out;
}

/** A line that holds nothing but a tracking number (optionally with a carrier or "Sendungsnr." label). */
function trackingOnly(text: string, context: Carrier): TrackingCandidate | null {
  const rest = text.replace(/^(dhl|hermes|dpd|gls|ups)\b[\s:]*/i, "").replace(TRACKING_LABEL, "").trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9 ]+$/.test(rest)) return null;
  const code = normalizeTrackingNumber(rest.replace(/\s+/g, ""));
  const c = code ? classifyTracking(code, context) : null;
  return code && c ? { code, carrier: c.carrier, source: "text", confidence: c.confidence } : null;
}

function toCandidate(lines: OcrLine[], barcodes: { data: string; type?: string }[], context: Carrier, textTracking = true): AddressCandidate {
  const x = parseLabelText(lines, barcodes);
  const c: AddressCandidate = {
    kind: "address",
    recipientName: x.recipientName,
    street: x.street,
    houseNumber: x.houseNumber,
    postalCode: x.postalCode,
    city: x.city,
    postNumber: null,
    shopName: null,
    trackingNumbers: [],
    warnings: x.warnings.filter((w) => w !== "tracking_not_found" && w !== "multiple_addresses"),
  };
  const texts = lines.map((l) => l.text);
  // Packstation / Postfiliale: "Packstation 123" is the street line, the Postnummer is needed.
  if (c.street.value && /^(packstation|postfiliale|filiale)$/i.test(c.street.value)) {
    c.kind = "packstation";
    c.street = { value: c.street.value.replace(/^filiale$/i, "Postfiliale").replace(/^\w/, (s) => s.toUpperCase()), confidence: c.street.confidence };
    const pn = texts.map((t) => POST_NUMBER.exec(t)?.[1] ?? (/^\d{6,10}$/.test(t) ? t : null)).find(Boolean) ?? null;
    c.postNumber = pn;
    if (!pn) c.warnings.push("post_number_missing");
  } else if (texts.some((t) => SHOP_LINE.test(t))) {
    c.kind = "parcel_shop";
    c.shopName = texts.find((t) => SHOP_LINE.test(t)) ?? null;
    c.warnings.push("parcel_shop");
  }
  // Tracking: decoded barcode first, then numbers printed as text.
  if (x.trackingNumber.value && x.barcode.value) {
    const cls = classifyTracking(x.trackingNumber.value, context);
    c.trackingNumbers.push({ code: x.trackingNumber.value, carrier: cls?.carrier ?? context, source: "barcode", confidence: x.trackingNumber.confidence });
  }
  if (textTracking) for (const t of texts) for (const tc of trackingInLine(t, context)) if (!c.trackingNumbers.some((e) => e.code === tc.code)) c.trackingNumbers.push(tc);
  return c;
}

/**
 * Extract every recipient address in one image. Labels (barcode or sender/recipient
 * markers) yield one address – the recipient; screenshots and lists yield one per
 * postcode-city block.
 */
export function extractAddresses(input: string | OcrLine[], barcodes: { data: string; type?: string }[] = []): AddressExtraction {
  const lines = prepareLines(input);
  const carrier = detectCarrier(lines.map((l) => l.text).join("\n"));
  const isLabel = barcodes.length > 0 || lines.some((l) => SENDER_OR_RECIPIENT.test(l.text));
  const anchors = lines.map((l, i) => (POSTAL_CITY.test(l.text) ? i : -1)).filter((i) => i >= 0);
  const result: AddressExtraction = { addresses: [], unassignedTrackingNumbers: [], carrier, mode: isLabel ? "label" : "text", warnings: [] };

  if (isLabel || anchors.length <= 1) {
    const c = toCandidate(lines, barcodes, carrier);
    if (isLabel && anchors.length > 1 && !lines.some((l) => /^(empfänger|empfaenger|an|to|ship to|recipient)\b/i.test(l.text))) c.warnings.push("multiple_addresses");
    if (c.postalCode.value || c.street.value) result.addresses.push(c);
    else {
      result.warnings.push("address_not_found");
      result.unassignedTrackingNumbers = c.trackingNumbers;
    }
    return result;
  }

  // Several addresses: each block ends at its postcode-city line. A tracking number belongs to
  // an address only when it is printed on the line(s) directly after it; any other number is
  // left unassigned for the driver – never guessed.
  let from = 0;
  for (const a of anchors) {
    const block = lines.slice(from, a + 1);
    const c = toCandidate(block, [], carrier, false);
    let j = a + 1;
    for (; j < lines.length && !anchors.includes(j); j++) {
      const tc = trackingOnly(lines[j]!.text, carrier);
      if (!tc) break;
      if (!c.trackingNumbers.some((e) => e.code === tc.code)) c.trackingNumbers.push(tc);
    }
    from = j;
    // Numbers inside the block (above the address) are ambiguous.
    for (const l of block) for (const tc of trackingInLine(l.text, carrier)) result.unassignedTrackingNumbers.push(tc);
    if (c.postalCode.value) result.addresses.push(c);
  }
  for (const l of lines.slice(from)) for (const tc of trackingInLine(l.text, carrier)) result.unassignedTrackingNumbers.push(tc);
  // Barcodes cannot be tied to one of several addresses: the driver assigns them.
  for (const b of barcodes) {
    const code = normalizeTrackingNumber(b.data);
    const cls = code ? classifyTracking(code, carrier) : null;
    if (code && cls) result.unassignedTrackingNumbers.push({ code, carrier: cls.carrier, source: "barcode", confidence: cls.confidence });
  }
  result.warnings.push("multiple_addresses");
  return result;
}

// ---------------------------------------------------------------------------
// Duplicates
// ---------------------------------------------------------------------------

export type DuplicateKind =
  | "open_stop_same_address" // will be merged into that stop (parcels added)
  | "completed_stop_same_address"
  | "tracking_on_other_stop"
  | "same_in_this_import";

export interface DuplicateFinding {
  kind: DuplicateKind;
  stopId?: string;
  trackingNumber?: string;
}

/** Address key that also treats ASCII umlaut spellings as equal (Mueller = Müller). */
export function looseAddressKey(a: Pick<Stop["address"], "street" | "houseNumber" | "postalCode" | "city"> & { countryCode?: string }): string {
  return addressKey({ ...a, countryCode: a.countryCode ?? "DE", street: a.street.replace(/([aou])e/gi, "$1"), city: a.city.replace(/([aou])e/gi, "$1") } as Stop["address"]);
}

export function findDuplicates(
  candidate: { type: "delivery" | "pickup"; address: Pick<Stop["address"], "street" | "houseNumber" | "postalCode" | "city">; trackingNumbers: string[] },
  stops: Stop[],
  others: { address: Pick<Stop["address"], "street" | "houseNumber" | "postalCode" | "city">; trackingNumbers: string[] }[] = [],
): DuplicateFinding[] {
  const out: DuplicateFinding[] = [];
  const key = looseAddressKey(candidate.address);
  for (const s of stops) {
    if (s.type === "break" || looseAddressKey(s.address) !== key) continue;
    const open = s.status === "pending" || s.status === "in_progress";
    if (open && s.type === candidate.type) out.push({ kind: "open_stop_same_address", stopId: s.id });
    else if (!open) out.push({ kind: "completed_stop_same_address", stopId: s.id });
  }
  const codes = new Set(candidate.trackingNumbers.map((c) => normalizeTrackingNumber(c)).filter(Boolean));
  for (const s of stops) {
    for (const p of s.parcels) {
      const c = normalizeTrackingNumber(p.trackingNumber);
      if (c && codes.has(c) && looseAddressKey(s.address) !== key) out.push({ kind: "tracking_on_other_stop", stopId: s.id, trackingNumber: c });
    }
  }
  if (others.some((o) => looseAddressKey(o.address) === key || o.trackingNumbers.some((t) => codes.has(normalizeTrackingNumber(t) ?? "")))) {
    out.push({ kind: "same_in_this_import" });
  }
  return out;
}
