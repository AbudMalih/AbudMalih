import { NewStopInput, type GeoPoint, type NewStopInput as NewStopInputType, type StopType } from "../schemas";
import { addressKey } from "../tour";
import { normalizeTrackingNumber } from "./barcode";

/**
 * Stop import: paste lists, CSV and Excel rows -> validated, editable rows ->
 * grouped stops (several parcels for one address become one stop, every
 * tracking number is kept). Coordinates are only taken from the file; rows
 * without them are marked "needs location" – nothing is invented.
 */

export type ImportField =
  | "recipientName"
  | "street"
  | "houseNumber"
  | "address"
  | "postalCode"
  | "city"
  | "countryCode"
  | "tracking"
  | "lat"
  | "lng"
  | "type"
  | "priority"
  | "notes"
  | "phone"
  | "twStart"
  | "twEnd";

const SYNONYMS: Record<ImportField, string[]> = {
  recipientName: ["name", "recipient", "empfänger", "empfaenger", "kunde", "customer", "destinatar", "nume", "firma", "company"],
  street: ["street", "straße", "strasse", "str", "stradă", "strada", "address1", "addressline1"],
  houseNumber: ["housenumber", "hausnummer", "hausnr", "nr", "no", "number", "număr", "numar"],
  address: ["address", "adresse", "anschrift", "adresă", "adresa", "fulladdress"],
  postalCode: ["postalcode", "postcode", "zip", "zipcode", "plz", "postleitzahl", "codpostal"],
  city: ["city", "ort", "stadt", "town", "oraș", "oras", "localitate"],
  countryCode: ["country", "land", "countrycode", "țară", "tara"],
  tracking: ["tracking", "trackingnumber", "trackingnumbers", "sendungsnummer", "sendung", "barcode", "parcel", "paket", "awb", "colet", "trackingno"],
  lat: ["lat", "latitude", "breite", "breitengrad"],
  lng: ["lng", "lon", "long", "longitude", "länge", "laenge", "längengrad"],
  type: ["type", "typ", "art", "tip", "stoptype"],
  priority: ["priority", "priorität", "prioritaet", "prio", "urgent", "eilig", "prioritate"],
  notes: ["notes", "note", "hinweis", "bemerkung", "notiz", "comment", "instructions", "lieferhinweis", "observații", "observatii"],
  phone: ["phone", "telefon", "tel", "mobile", "handy"],
  twStart: ["from", "von", "windowstart", "start", "twstart", "ab"],
  twEnd: ["to", "bis", "windowend", "end", "twend"],
};

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]/g, "");

const SYN_NORM = Object.fromEntries(
  (Object.keys(SYNONYMS) as ImportField[]).map((f) => [f, new Set(SYNONYMS[f].map(norm))]),
) as Record<ImportField, Set<string>>;

/** Map header cells to fields. Returns null when the first row does not look like a header. */
export function detectColumns(header: string[]): (ImportField | null)[] | null {
  const used = new Set<ImportField>();
  const map = header.map((h) => {
    const n = norm(h);
    for (const f of Object.keys(SYN_NORM) as ImportField[]) {
      if (!used.has(f) && SYN_NORM[f].has(n)) {
        used.add(f);
        return f;
      }
    }
    return null;
  });
  const hasAddress = used.has("address") || (used.has("street") && (used.has("postalCode") || used.has("city")));
  return hasAddress ? map : null;
}

/** RFC-4180 style parser with delimiter detection (; , tab |). Strips a UTF-8 BOM. */
export function parseDelimited(text: string, delimiter?: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const firstLine = src.split(/\r?\n/, 1)[0] ?? "";
  const delim =
    delimiter ??
    ([";", "\t", ",", "|"] as const)
      .map((d) => ({ d, n: firstLine.split(d).length }))
      .sort((a, b) => b.n - a.n)[0]!.d;
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i]!;
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += c;
      continue;
    }
    if (c === '"' && cell === "") quoted = true;
    else if (c === delim) {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.map((r) => r.map((c) => c.trim())).filter((r) => r.some((c) => c !== ""));
}

const POSTAL_CITY_TAIL = /(?:^|[,;\s])(?:(?:D|DE)-)?(\d{4,5})\s+([^\d,;]{2,60}?)\s*$/;
const STREET_NO = /^(.*?[^\d\s,])\s*,?\s+(\d{1,4}\s?[a-zA-Z]?(?:\s?[-/]\s?\d{1,4}[a-zA-Z]?)?)$/;
/** Upper-case codes of 8–35 characters with at least 4 digits (street names, postal codes and house numbers never match). */
const TRACKING_TOKEN = /\b((?=[A-Z0-9-]*\d[A-Z0-9-]*\d[A-Z0-9-]*\d[A-Z0-9-]*\d)[A-Z0-9][A-Z0-9-]{7,34})\b/g;

export interface ParsedAddressLine {
  recipientName?: string;
  street: string;
  houseNumber?: string;
  postalCode: string;
  city: string;
}

/** "Max Muster, Musterstraße 12a, 30159 Hannover" (name optional; comma optional). */
export function parseAddressLine(line: string): ParsedAddressLine | null {
  const text = line.replace(/\s+/g, " ").trim();
  const m = POSTAL_CITY_TAIL.exec(text);
  if (!m) return null;
  const before = text.slice(0, m.index + (m[0].startsWith(",") || m[0].startsWith(";") || m[0].startsWith(" ") ? 0 : 0)).replace(/[,;\s]+$/, "");
  const parts = before.split(/\s*[,;]\s*/).filter(Boolean);
  if (parts.length === 0) return null;
  const streetPart = parts.at(-1)!;
  const sm = STREET_NO.exec(streetPart);
  return {
    recipientName: parts.length > 1 ? parts.slice(0, -1).join(", ") : undefined,
    street: sm ? sm[1]!.trim() : streetPart,
    houseNumber: sm ? sm[2]!.replace(/\s+/g, "") : undefined,
    postalCode: m[1]!,
    city: m[2]!.trim(),
  };
}

export interface ImportRow {
  /** 1-based line/row number in the source, for messages. */
  line: number;
  recipientName?: string;
  street: string;
  houseNumber?: string;
  postalCode: string;
  city: string;
  countryCode: string;
  location: GeoPoint | null;
  trackingNumbers: string[];
  type: Exclude<StopType, "break">;
  priority: boolean;
  notes?: string;
  phone?: string;
  timeWindow?: { start: number; end: number };
  /** Blocking problems – the row is skipped until fixed. */
  errors: string[];
  /** Non-blocking hints, e.g. "needs_location". */
  warnings: string[];
}

function parseMinute(v: string | undefined): number | null {
  const m = /^(\d{1,2})[:.h](\d{2})$/.exec((v ?? "").trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h < 24 && min < 60 ? h * 60 + min : null;
}

function parseNumber(v: string | undefined): number | null {
  if (v === undefined || v.trim() === "") return null;
  const n = Number(v.trim().replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function truthy(v: string | undefined) {
  return /^(1|true|yes|ja|x|da|wahr|high|hoch)$/i.test((v ?? "").trim());
}

function splitTracking(v: string | undefined): string[] {
  return (v ?? "")
    .split(/[\s,;|/]+/)
    .map((t) => normalizeTrackingNumber(t))
    .filter((t): t is string => !!t);
}

/** Re-validate a (possibly edited) row: fills `errors` and `warnings`. */
export function validateImportRow(row: ImportRow): ImportRow {
  const errors: string[] = [];
  const warnings: string[] = [];
  let postalCode = row.postalCode.trim();
  if (!row.street.trim()) errors.push("street_missing");
  if (!row.city.trim()) errors.push("city_missing");
  if (row.countryCode === "DE" && /^\d{4}$/.test(postalCode)) {
    // Excel drops leading zeros of German postal codes (e.g. 01067 Dresden).
    postalCode = `0${postalCode}`;
    warnings.push("postal_code_padded");
  }
  if (row.countryCode === "DE" ? !/^\d{5}$/.test(postalCode) : !/^[0-9A-Za-z -]{3,10}$/.test(postalCode)) errors.push("postal_code_invalid");
  if (row.location && (Math.abs(row.location.lat) > 90 || Math.abs(row.location.lng) > 180 || (row.location.lat === 0 && row.location.lng === 0))) {
    errors.push("coordinates_invalid");
  }
  if (!row.location) warnings.push("needs_location");
  if (row.timeWindow && row.timeWindow.end <= row.timeWindow.start) errors.push("time_window_invalid");
  if (row.trackingNumbers.length === 0) warnings.push("no_tracking_number");
  if (!row.houseNumber && !/^(packstation|postfiliale)/i.test(row.street)) warnings.push("house_number_missing");
  return { ...row, postalCode, errors, warnings };
}

function emptyRow(line: number): ImportRow {
  return { line, street: "", postalCode: "", city: "", countryCode: "DE", location: null, trackingNumbers: [], type: "delivery", priority: false, errors: [], warnings: [] };
}

/** Rows of a table (CSV/XLSX). Uses the header when recognised, otherwise treats column 1 as a full address. */
export function rowsFromTable(table: string[][]): { rows: ImportRow[]; columns: (ImportField | null)[]; headerDetected: boolean } {
  if (table.length === 0) return { rows: [], columns: [], headerDetected: false };
  const detected = detectColumns(table[0]!);
  const columns: (ImportField | null)[] = detected ?? table[0]!.map((_, i) => (i === 0 ? "address" : null));
  const body = detected ? table.slice(1) : table;
  const offset = detected ? 2 : 1;
  const rows = body.map((cells, i) => {
    const get = (f: ImportField) => {
      const idx = columns.indexOf(f);
      return idx >= 0 ? cells[idx]?.trim() : undefined;
    };
    const row = emptyRow(i + offset);
    const full = get("address");
    if (full) {
      const p = parseAddressLine(full);
      if (p) Object.assign(row, { street: p.street, houseNumber: p.houseNumber, postalCode: p.postalCode, city: p.city, recipientName: p.recipientName });
      else row.street = full;
    }
    if (get("street")) {
      const s = get("street")!;
      const sm = !get("houseNumber") ? STREET_NO.exec(s) : null;
      row.street = sm ? sm[1]!.trim() : s;
      row.houseNumber = sm ? sm[2]!.replace(/\s+/g, "") : row.houseNumber;
    }
    row.houseNumber = get("houseNumber") || row.houseNumber;
    row.postalCode = get("postalCode") || row.postalCode;
    row.city = get("city") || row.city;
    row.recipientName = get("recipientName") || row.recipientName;
    const cc = get("countryCode");
    if (cc && /^[a-z]{2}$/i.test(cc)) row.countryCode = cc.toUpperCase();
    const lat = parseNumber(get("lat"));
    const lng = parseNumber(get("lng"));
    row.location = lat !== null && lng !== null ? { lat, lng } : null;
    row.trackingNumbers = splitTracking(get("tracking"));
    row.type = /^(pickup|abholung|pick-up|ridicare|p)$/i.test(get("type") ?? "") ? "pickup" : "delivery";
    row.priority = truthy(get("priority"));
    row.notes = get("notes") || undefined;
    row.phone = get("phone") || undefined;
    const ws = parseMinute(get("twStart"));
    const we = parseMinute(get("twEnd"));
    if (ws !== null && we !== null) row.timeWindow = { start: ws, end: we };
    else if (get("twStart") || get("twEnd")) row.errors.push("time_window_invalid");
    const v = validateImportRow(row);
    return { ...v, errors: [...new Set([...row.errors, ...v.errors])] };
  });
  return { rows, columns, headerDetected: !!detected };
}

/** Pasted text: one stop per line. Delimited lines with a header are treated as a table. */
export function rowsFromPastedText(text: string): ImportRow[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];
  const table = parseDelimited(lines.join("\n"));
  if (table.length > 1 && detectColumns(table[0]!)) return rowsFromTable(table).rows;
  return lines.map((raw, i) => {
    const row = emptyRow(i + 1);
    const tracking = [...raw.matchAll(TRACKING_TOKEN)].map((m) => normalizeTrackingNumber(m[1]!)).filter((t): t is string => !!t);
    let text = raw;
    for (const t of tracking) text = text.replace(new RegExp(`[,;\\s]*${t}`, "i"), "");
    // Optional ";lat;lng" or "(lat, lng)" at the end.
    const coord = /[;,(\s]\s*(-?\d{1,2}\.\d{3,})\s*[;,\s]\s*(-?\d{1,3}\.\d{3,})\)?\s*$/.exec(text);
    if (coord) {
      row.location = { lat: Number(coord[1]), lng: Number(coord[2]) };
      text = text.slice(0, coord.index);
    }
    const p = parseAddressLine(text);
    if (p) Object.assign(row, p);
    else {
      row.street = text;
      row.errors.push("address_unrecognized");
    }
    row.trackingNumbers = tracking;
    const v = validateImportRow(row);
    return { ...v, errors: [...new Set([...row.errors, ...v.errors])] };
  });
}

export interface ImportGroup {
  key: string;
  rows: ImportRow[];
  input: NewStopInputType;
  /** Tracking numbers that appeared more than once in the import. */
  duplicateTracking: string[];
}

/**
 * Group valid rows by address + stop type. All tracking numbers are kept;
 * a tracking number listed twice is reported, not silently dropped.
 */
export function groupImportRows(rows: ImportRow[]): ImportGroup[] {
  const groups = new Map<string, ImportGroup>();
  const seen = new Set<string>();
  for (const row of rows) {
    if (row.errors.length) continue;
    const address = { street: row.street, houseNumber: row.houseNumber || undefined, postalCode: row.postalCode, city: row.city, countryCode: row.countryCode };
    const key = `${row.type}|${addressKey(address)}`;
    let g = groups.get(key);
    if (!g) {
      g = {
        key,
        rows: [],
        duplicateTracking: [],
        input: {
          type: row.type,
          recipientName: row.recipientName,
          address,
          location: row.location,
          locationSource: row.location ? "import" : null,
          timeWindow: row.timeWindow,
          priority: row.priority,
          notes: row.notes,
          recipientPhone: row.phone,
          trackingNumbers: [],
        },
      };
      groups.set(key, g);
    }
    g.rows.push(row);
    g.input.priority = g.input.priority || row.priority;
    g.input.location ??= row.location;
    if (row.location && !g.input.locationSource) g.input.locationSource = "import";
    if (row.notes && g.input.notes !== row.notes) g.input.notes = [g.input.notes, row.notes].filter(Boolean).join(" · ").slice(0, 1000);
    for (const t of row.trackingNumbers) {
      if (seen.has(t)) g.duplicateTracking.push(t);
      else {
        seen.add(t);
        g.input.trackingNumbers!.push(t);
      }
    }
  }
  // Final schema validation (throws only on programming errors – rows were validated).
  for (const g of groups.values()) NewStopInput.parse(g.input);
  return [...groups.values()];
}

export interface ImportSummary {
  rows: number;
  valid: number;
  invalid: number;
  stops: number;
  parcels: number;
  needsLocation: number;
  duplicates: number;
}

export function summarizeImport(rows: ImportRow[], groups = groupImportRows(rows)): ImportSummary {
  return {
    rows: rows.length,
    valid: rows.filter((r) => !r.errors.length).length,
    invalid: rows.filter((r) => r.errors.length).length,
    stops: groups.length,
    parcels: groups.reduce((n, g) => n + (g.input.trackingNumbers?.length ?? 0), 0),
    needsLocation: groups.filter((g) => !g.input.location).length,
    duplicates: groups.reduce((n, g) => n + g.duplicateTracking.length, 0),
  };
}
