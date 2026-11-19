/**
 * Parcel barcode handling for continuous scanning. Pure logic – the camera
 * integration lives in the driver app; this module decides what a decoded
 * value means (new parcel, duplicate, camera repeat, invalid).
 */

/** Barcode types requested from the camera (expo-camera names). */
export const SCAN_BARCODE_TYPES = [
  "code128",
  "code39",
  "code93",
  "ean13",
  "ean8",
  "upc_a",
  "upc_e",
  "itf14",
  "codabar",
  "qr",
  "datamatrix",
  "pdf417",
  "aztec",
] as const;
export type ScanBarcodeType = (typeof SCAN_BARCODE_TYPES)[number];

/**
 * Default profile for parcel labels: the symbologies carriers print on labels
 * (1D tracking codes, GS1/SSCC, DataMatrix/QR/PDF417). Fewer types = faster detection;
 * the full list stays available as a setting.
 */
export const PARCEL_BARCODE_TYPES: ScanBarcodeType[] = ["code128", "code39", "itf14", "datamatrix", "qr", "pdf417"];

export interface ScanStats {
  scanned: number;
  matched: number;
  unknown: number;
  /** Repeated scans of codes already in the list. */
  duplicates: number;
  /** Time from the first to the last scan. */
  durationSeconds: number;
  /** New parcels per minute over that time (null below 2 scans). */
  perMinute: number | null;
  /** Median seconds between consecutive new scans (null below 2 scans). */
  medianIntervalSeconds: number | null;
}

/** Throughput figures for the hardware test matrix (50/100/200 parcels). */
export function scanStats(entries: ScanEntry[]): ScanStats {
  const times = entries.map((e) => Date.parse(e.at)).sort((a, b) => a - b);
  const gaps = times.slice(1).map((t, i) => (t - times[i]!) / 1000).sort((a, b) => a - b);
  const duration = times.length > 1 ? (times.at(-1)! - times[0]!) / 1000 : 0;
  return {
    scanned: entries.length,
    matched: entries.filter((e) => e.stopId).length,
    unknown: entries.filter((e) => !e.stopId).length,
    duplicates: entries.reduce((n, e) => n + e.repeats, 0),
    durationSeconds: Math.round(duration),
    perMinute: times.length > 1 && duration > 0 ? Math.round(((times.length - 1) / duration) * 60 * 10) / 10 : null,
    medianIntervalSeconds: gaps.length ? Math.round(gaps[Math.floor(gaps.length / 2)]! * 100) / 100 : null,
  };
}

const TRACKING_RE = /^[A-Z0-9][A-Z0-9\-/.]{4,63}$/;
const URL_PARAM_KEYS = ["tracking", "trackingnumber", "tracking_number", "piececode", "idc", "id", "sendungsnummer", "shipment"];

// ---------------------------------------------------------------------------------------------
// GS1 element strings (GS1-128, GS1 DataMatrix, GS1 QR): "(00)340434…(421)276…" or the raw form
// with FNC1/GS separators. Only the identifiers that occur on parcel labels are needed; a label's
// routing code (420/421) or product data must never be mistaken for the parcel number.
// ---------------------------------------------------------------------------------------------
const GS = "\u001d";
/** Fixed-length AIs: data length after the AI. */
const GS1_FIXED: Record<string, number> = { "00": 18, "01": 14, "02": 14, "11": 6, "12": 6, "13": 6, "15": 6, "16": 6, "17": 6, "20": 2, "402": 17, "410": 13, "411": 13, "412": 13, "413": 13, "414": 13, "415": 13, "416": 13, "417": 13 };
/** Variable-length AIs (up to the given length, ended by GS or the end of the data). */
const GS1_VARIABLE: Record<string, number> = { "10": 20, "21": 20, "22": 20, "240": 30, "241": 30, "400": 30, "401": 30, "403": 30, "420": 20, "421": 12, "422": 3, "423": 15, "424": 3, "425": 15, "426": 3, "427": 3 };

/** Parses a GS1 element string into AI → value, or null when it is not one. */
export function parseGs1(input: string): Map<string, string> | null {
  const out = new Map<string, string>();
  let v = input.trim();
  if (v.startsWith("(")) {
    // Human-readable form "(00)…(421)…".
    const re = /\((\d{2,4})\)([^(]*)/g;
    let m: RegExpExecArray | null;
    let consumed = 0;
    while ((m = re.exec(v))) {
      out.set(m[1]!, m[2]!.replace(/\s+/g, ""));
      consumed += m[0].length;
    }
    return consumed === v.replace(/\s+$/, "").length && out.size ? out : null;
  }
  v = v.replace(/^\u001d+/, "");
  if (!/^\d{2}/.test(v)) return null;
  while (v.length) {
    v = v.replace(/^\u001d+/, "");
    if (!v) break;
    let ai = "";
    for (const len of [2, 3, 4]) {
      const c = v.slice(0, len);
      if (c in GS1_FIXED || c in GS1_VARIABLE || (len === 4 && /^3[1-6]\d\d$/.test(c))) {
        ai = c;
        break;
      }
    }
    if (!ai) return out.size ? out : null;
    v = v.slice(ai.length);
    const fixed = GS1_FIXED[ai] ?? (/^3[1-6]\d\d$/.test(ai) ? 6 : undefined);
    if (fixed !== undefined) {
      const data = v.slice(0, fixed);
      if (data.length !== fixed) return out.size ? out : null;
      out.set(ai, data);
      v = v.slice(fixed);
    } else {
      const end = v.indexOf(GS);
      const data = (end < 0 ? v : v.slice(0, end)).slice(0, GS1_VARIABLE[ai]);
      out.set(ai, data);
      v = v.slice(data.length);
    }
  }
  return out.size ? out : null;
}

/**
 * Parcel numbers that can be recognised inside structured 2D content (e.g. the DHL DataMatrix,
 * which carries the parcel number among routing and product data). Strongest first.
 */
const EMBEDDED_TRACKING: { re: RegExp; take: (m: RegExpExecArray) => string }[] = [
  { re: /JJD\d{14,22}/, take: (m) => m[0] },
  { re: /JV[A-Z]{2}\d{9,20}/, take: (m) => m[0] },
  { re: /(?:^|\D)00(340434\d{12})(?!\d)/, take: (m) => m[1]! },
  { re: /(?:^|[^A-Z])([A-Z]{2}\d{9}DE)(?![A-Z0-9])/, take: (m) => m[1]! },
  { re: /1Z[0-9A-Z]{16}/, take: (m) => m[0] },
];

/**
 * Normalise a decoded barcode / typed tracking number. Returns null when the
 * value cannot be a parcel identifier (too short, binary, free text).
 */
export function normalizeTrackingNumber(raw: string): string | null {
  const symbology = /^\]([A-Za-z]\d)/.exec(raw)?.[1] ?? "";
  let v = raw.replace(/^\][A-Za-z]\d/, ""); // AIM symbology identifier, e.g. "]C1"
  // GS1 data (GS1-128 "]C1", GS1 DataMatrix "]d2", GS1 QR "]Q3", or separators / "(AI)" present):
  // the parcel number is the SSCC (00) or the consignment number (401) – never the whole string.
  const gs1Like = /^(C1|d2|Q3|e0)$/.test(symbology) || v.includes(GS) || /^\(\d{2,4}\)/.test(v.trim());
  if (gs1Like) {
    const ai = parseGs1(v);
    if (ai?.get("00")) return ai.get("00")!;
    if (ai?.get("401")) return normalizeTrackingNumber(ai.get("401")!);
  }
  v = v.replace(/[\u0000-\u001f\u007f]/g, " ").trim();
  if (!v) return null;
  // QR codes that encode a tracking URL: take a known parameter or the last path segment.
  if (/^https?:\/\//i.test(v)) {
    // Parsed by hand: React Native's URL polyfill lacks searchParams.
    const [pathPart, query = ""] = v.replace(/#.*$/, "").split("?", 2) as [string, string?];
    for (const pair of query.split("&")) {
      const [k, val] = pair.split("=", 2);
      if (k && val && URL_PARAM_KEYS.includes(k.toLowerCase())) return normalizeTrackingNumber(safeDecode(val));
    }
    const last = pathPart.replace(/^https?:\/\/[^/]+/i, "").split("/").filter(Boolean).at(-1);
    return last ? normalizeTrackingNumber(safeDecode(last)) : null;
  }
  // GS1-128 with application identifier (00) = SSCC (18 digits).
  const sscc = /^\(?00\)?\s?(\d{18})$/.exec(v);
  if (sscc) return sscc[1]!;
  // Structured content (several fields, separators): a known parcel-number format inside it.
  if (/[\s|;,]/.test(v) || v.length > 40) {
    const up = v.toUpperCase();
    for (const p of EMBEDDED_TRACKING) {
      const m = p.re.exec(up);
      if (m) return p.take(m);
    }
    // Several fields but no known parcel number: not a parcel identifier (never glue fields together).
    if (/[|;,]/.test(v)) return null;
  }
  v = v.replace(/\s+/g, "").toUpperCase();
  return TRACKING_RE.test(v) ? v : null;
}

function safeDecode(s: string) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

export type ScanSource = "camera" | "manual";

export interface ScanEntry {
  code: string;
  format: string;
  source: ScanSource;
  /** ISO timestamp of the first scan. */
  at: string;
  /** Matched stop (parcel already part of the tour), or null = unknown parcel. */
  stopId: string | null;
  /** How often the same parcel was scanned again later. */
  repeats: number;
}

export type ScanOutcome =
  | { kind: "matched"; entry: ScanEntry }
  | { kind: "unknown"; entry: ScanEntry }
  | { kind: "duplicate"; entry: ScanEntry }
  /** Same code still in front of the camera – no feedback. */
  | { kind: "repeat"; code: string }
  | { kind: "invalid"; raw: string };

export interface ScanSessionOptions {
  /** tracking number -> stop id, for parcels that already belong to the route. */
  known?: Map<string, string>;
  /** Camera reports the same code many times per second; repeats inside this window are ignored. */
  repeatWindowMs?: number;
  now?: () => number;
  entries?: ScanEntry[];
}

export class ScanSession {
  private readonly known: Map<string, string>;
  private readonly repeatWindowMs: number;
  private readonly now: () => number;
  private readonly lastSeen = new Map<string, number>();
  private readonly byCode = new Map<string, ScanEntry>();
  private order: string[] = [];

  constructor(opts: ScanSessionOptions = {}) {
    this.known = opts.known ?? new Map();
    this.repeatWindowMs = opts.repeatWindowMs ?? 1500;
    this.now = opts.now ?? Date.now;
    for (const e of opts.entries ?? []) {
      this.byCode.set(e.code, { ...e });
      this.order.push(e.code);
    }
  }

  handle(raw: string, format = "unknown", source: ScanSource = "camera"): ScanOutcome {
    const code = normalizeTrackingNumber(raw);
    if (!code) return { kind: "invalid", raw };
    const t = this.now();
    const last = this.lastSeen.get(code);
    this.lastSeen.set(code, t);
    if (source === "camera" && last !== undefined && t - last < this.repeatWindowMs) return { kind: "repeat", code };
    const existing = this.byCode.get(code);
    if (existing) {
      existing.repeats += 1;
      return { kind: "duplicate", entry: existing };
    }
    const entry: ScanEntry = { code, format, source, at: new Date(t).toISOString(), stopId: this.known.get(code) ?? null, repeats: 0 };
    this.byCode.set(code, entry);
    this.order.push(code);
    return entry.stopId ? { kind: "matched", entry } : { kind: "unknown", entry };
  }

  remove(code: string) {
    this.byCode.delete(code);
    this.order = this.order.filter((c) => c !== code);
  }

  /** Newest first. */
  get entries(): ScanEntry[] {
    return [...this.order].reverse().map((c) => this.byCode.get(c)!);
  }
  get count() {
    return this.order.length;
  }
  get matchedCount() {
    return this.entries.filter((e) => e.stopId).length;
  }
  get unknownCount() {
    return this.count - this.matchedCount;
  }
}

/** Build the tracking-number index used to match scans to existing stops. */
export function parcelIndex(stops: { id: string; parcels: { trackingNumber: string; barcode?: string }[] }[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const s of stops) {
    for (const p of s.parcels) {
      for (const v of [p.trackingNumber, p.barcode]) {
        const n = v ? normalizeTrackingNumber(v) : null;
        if (n) m.set(n, s.id);
      }
    }
  }
  return m;
}
