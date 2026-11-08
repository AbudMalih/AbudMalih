import { MAX_PARCELS_PER_STOP, NewStopInput, type GeoPoint, type NewParcelInput, type NewStopInput as NewStopInputType, type StopType } from "../schemas";
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
  | "company"
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
  recipientName: ["name", "recipient", "empfänger", "empfaenger", "kunde", "customer", "destinatar", "nume", "recipientname", "empfängername"],
  company: ["company", "firma", "firmenname", "unternehmen", "companyname", "organisation", "organization", "societate", "firm"],
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
  company?: string;
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
  /** For "postal_code_4_digits": the code with the leading zero Excel drops (01067 Dresden). Applied only after verification. */
  postalCodeSuggestion?: string;
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
  const postalCode = row.postalCode.trim();
  let postalCodeSuggestion: string | undefined;
  if (!row.street.trim()) errors.push("street_missing");
  if (!row.city.trim()) errors.push("city_missing");
  if (row.countryCode === "DE" && /^\d{4}$/.test(postalCode)) {
    // Excel drops leading zeros (01067 Dresden -> 1067), but "3016 Hannover" is a typo: never pad
    // silently. The padded code is only a suggestion; it is applied after it was verified against
    // the city (server postcode check) or by the user.
    errors.push("postal_code_4_digits");
    postalCodeSuggestion = `0${postalCode}`;
  } else if (row.countryCode === "DE" ? !/^\d{5}$/.test(postalCode) : !/^[0-9A-Za-z -]{3,10}$/.test(postalCode)) errors.push("postal_code_invalid");
  if (row.location && (Math.abs(row.location.lat) > 90 || Math.abs(row.location.lng) > 180 || (row.location.lat === 0 && row.location.lng === 0))) {
    errors.push("coordinates_invalid");
  }
  if (!row.location) warnings.push("needs_location");
  if (row.timeWindow && row.timeWindow.end <= row.timeWindow.start) errors.push("time_window_invalid");
  if (row.trackingNumbers.length === 0) warnings.push("no_tracking_number");
  if (!row.houseNumber && !/^(packstation|postfiliale)/i.test(row.street)) warnings.push("house_number_missing");
  return { ...row, postalCode, postalCodeSuggestion, errors, warnings };
}

function emptyRow(line: number): ImportRow {
  return { line, street: "", postalCode: "", city: "", countryCode: "DE", location: null, trackingNumbers: [], type: "delivery", priority: false, errors: [], warnings: [] };
}

/** Every importable field, in the order a column-mapping UI offers them. */
export const IMPORT_FIELDS: readonly ImportField[] = ["recipientName", "company", "address", "street", "houseNumber", "postalCode", "city", "countryCode", "tracking", "lat", "lng", "type", "priority", "notes", "phone", "twStart", "twEnd"];

/** A column mapping is usable when it yields an address: a full-address column, or street + postcode/city. */
export function mappingProblems(columns: (ImportField | null)[]): string[] {
  const used = columns.filter((c): c is ImportField => !!c);
  const problems: string[] = [];
  const dup = used.filter((c, i) => used.indexOf(c) !== i);
  if (dup.length) problems.push(`mapped_twice:${[...new Set(dup)].join(",")}`);
  if (!used.includes("address") && !(used.includes("street") && (used.includes("postalCode") || used.includes("city")))) problems.push("no_address_columns");
  if (used.includes("lat") !== used.includes("lng")) problems.push("lat_lng_incomplete");
  return problems;
}

/**
 * Rows of a table (CSV/XLSX). Uses the header when recognised, otherwise treats column 1 as a full
 * address – unless `opts.columns` gives the mapping explicitly (column-mapping UI; `opts.header`
 * says whether the first row is a header to skip).
 */
export function rowsFromTable(
  table: string[][],
  opts: { columns?: (ImportField | null)[]; header?: boolean } = {},
): { rows: ImportRow[]; columns: (ImportField | null)[]; headerDetected: boolean } {
  if (table.length === 0) return { rows: [], columns: [], headerDetected: false };
  const detected = detectColumns(table[0]!);
  const columns: (ImportField | null)[] = opts.columns ?? detected ?? table[0]!.map((_, i) => (i === 0 ? "address" : null));
  const hasHeader = opts.header ?? !!detected;
  const body = hasHeader ? table.slice(1) : table;
  const offset = hasHeader ? 2 : 1;
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
    row.company = get("company") || undefined;
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
  /** The stop to create: one per address and stop type, with every parcel in `parcels`. */
  input: NewStopInputType;
  /** Tracking numbers listed more than once at THIS address (imported once – the same parcel). */
  duplicateTracking: string[];
  /** Why this stop cannot be imported as it is (e.g. more parcels than one stop may carry). */
  problems: string[];
}

/** One tracking number listed at two or more DIFFERENT addresses: a person must decide. */
export interface ImportConflict {
  trackingNumber: string;
  options: { line: number; key: string; address: string; recipientName?: string; company?: string }[];
  /** The chosen row (line) or "skip"; undefined = unresolved (blocks the import). */
  resolution?: number | "skip";
}

export interface ImportPlan {
  groups: ImportGroup[];
  /** Same tracking number repeated at the same address: imported once, listed here. */
  duplicates: { trackingNumber: string; lines: number[] }[];
  conflicts: ImportConflict[];
  /** Conflicts without a decision – the import must not start while > 0. */
  unresolved: number;
  /** Tracking numbers left out on purpose (conflict resolved with "skip"). */
  skipped: string[];
  /** Stops that cannot be imported as they are (see ImportGroup.problems). */
  blockingGroups: number;
}

const formatAddress = (r: ImportRow) => `${r.street}${r.houseNumber ? ` ${r.houseNumber}` : ""}, ${r.postalCode} ${r.city}`.trim();

/**
 * Plan an import: valid rows -> one stop per address + stop type, every tracking number kept as
 * its own parcel (own recipient and company). Never throws and never drops a parcel silently:
 *  - the same tracking number twice at the same address = one parcel, listed in `duplicates`;
 *  - the same tracking number at different addresses = a conflict; it is left out until
 *    `resolutions` names the row to keep (or "skip"), and `unresolved` counts the open ones;
 *  - a stop with more parcels than MAX_PARCELS_PER_STOP is reported in `problems`.
 */
export function planImport(rows: ImportRow[], resolutions: Record<string, number | "skip"> = {}): ImportPlan {
  const valid = rows.filter((r) => !r.errors.length);
  const keyOf = (r: ImportRow) =>
    `${r.type}|${addressKey({ street: r.street, houseNumber: r.houseNumber || undefined, postalCode: r.postalCode, countryCode: r.countryCode })}`;

  // Where does each tracking number occur?
  const seen = new Map<string, { row: ImportRow; key: string }[]>();
  for (const r of valid) for (const t of r.trackingNumbers) seen.set(t, [...(seen.get(t) ?? []), { row: r, key: keyOf(r) }]);
  const conflicts: ImportConflict[] = [];
  const duplicates: ImportPlan["duplicates"] = [];
  const keep = new Map<string, number>(); // tracking -> the one row (line) that carries it
  const skipped: string[] = [];
  for (const [t, occ] of seen) {
    const keys = new Set(occ.map((o) => o.key));
    if (keys.size > 1) {
      const res = resolutions[t];
      conflicts.push({
        trackingNumber: t,
        options: occ.map((o) => ({ line: o.row.line, key: o.key, address: formatAddress(o.row), recipientName: o.row.recipientName, company: o.row.company })),
        resolution: res === "skip" || occ.some((o) => o.row.line === res) ? res : undefined,
      });
      if (res === "skip") skipped.push(t);
      else if (typeof res === "number" && occ.some((o) => o.row.line === res)) keep.set(t, res);
      continue;
    }
    if (occ.length > 1) duplicates.push({ trackingNumber: t, lines: occ.map((o) => o.row.line) });
    keep.set(t, occ[0]!.row.line);
  }

  const groups = new Map<string, ImportGroup>();
  for (const row of valid) {
    const address = { street: row.street, houseNumber: row.houseNumber || undefined, postalCode: row.postalCode, city: row.city, countryCode: row.countryCode };
    const key = keyOf(row);
    let g = groups.get(key);
    if (!g) {
      g = {
        key,
        rows: [],
        duplicateTracking: [],
        problems: [],
        input: {
          type: row.type,
          recipientName: row.recipientName ?? row.company,
          address,
          location: row.location,
          locationSource: row.location ? "import" : null,
          timeWindow: row.timeWindow,
          priority: row.priority,
          notes: row.notes,
          recipientPhone: row.phone,
          trackingNumbers: [],
          parcels: [],
        },
      };
      groups.set(key, g);
    }
    g.rows.push(row);
    g.input.priority = g.input.priority || row.priority;
    g.input.location ??= row.location;
    if (row.location && !g.input.locationSource) g.input.locationSource = "import";
    g.input.recipientName ??= row.recipientName ?? row.company;
    if (row.notes && g.input.notes !== row.notes) g.input.notes = [g.input.notes, row.notes].filter(Boolean).join(" · ").slice(0, 1000);
    for (const t of row.trackingNumbers) {
      if (keep.get(t) !== row.line) {
        // Another row carries it: a repeat at this address (listed in `duplicates`) or a conflict.
        if (seen.get(t)!.every((o) => o.key === key) && !g.duplicateTracking.includes(t)) g.duplicateTracking.push(t);
        continue;
      }
      const parcel: NewParcelInput = { trackingNumber: t, recipientName: row.recipientName, company: row.company };
      g.input.parcels!.push(parcel);
      g.input.trackingNumbers!.push(t);
    }
  }
  for (const g of groups.values()) {
    if ((g.input.parcels?.length ?? 0) > MAX_PARCELS_PER_STOP) g.problems.push(`too_many_parcels:${g.input.parcels!.length}`);
    const check = NewStopInput.safeParse(g.input);
    if (!check.success && !g.problems.length) g.problems.push(`invalid:${check.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`);
  }
  const list = [...groups.values()];
  return {
    groups: list,
    duplicates,
    conflicts,
    unresolved: conflicts.filter((c) => c.resolution === undefined).length,
    skipped,
    blockingGroups: list.filter((g) => g.problems.length).length,
  };
}

/** Groups of an import (see planImport). Unresolved address conflicts are left out – check planImport().unresolved. */
export function groupImportRows(rows: ImportRow[]): ImportGroup[] {
  return planImport(rows).groups;
}

export interface ImportSummary {
  rows: number;
  valid: number;
  invalid: number;
  stops: number;
  parcels: number;
  needsLocation: number;
  duplicates: number;
  /** Tracking numbers listed at two different addresses (need a decision). */
  conflicts: number;
}

export function summarizeImport(rows: ImportRow[], groups = groupImportRows(rows), plan?: ImportPlan): ImportSummary {
  const conflicts = (plan ?? planImport(rows)).conflicts.length;
  return {
    conflicts,
    rows: rows.length,
    valid: rows.filter((r) => !r.errors.length).length,
    invalid: rows.filter((r) => r.errors.length).length,
    stops: groups.length,
    parcels: groups.reduce((n, g) => n + (g.input.trackingNumbers?.length ?? 0), 0),
    needsLocation: groups.filter((g) => !g.input.location).length,
    duplicates: groups.reduce((n, g) => n + g.duplicateTracking.length, 0),
  };
}
