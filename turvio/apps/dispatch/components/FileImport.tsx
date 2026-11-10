"use client";

import {
  IMPORT_FIELDS,
  MAX_PARCELS_PER_STOP,
  detectColumns,
  mappingProblems,
  parseDelimited,
  parseXlsx,
  planImport,
  rowsFromTable,
  validateImportRow,
  type ImportField,
  type ImportGroup,
  type ImportRow,
  type NewStopInput,
} from "@turvio/shared";
import { Badge, Button, Checkbox, cn } from "@turvio/web-ui/ds";
import { FileSpreadsheet, Loader2, MapPin, Upload } from "lucide-react";
import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api, ApiCallError, errorMessage } from "../lib/api";
import { AddressSearch } from "./AddressSearch";

const FIELD_LABEL: Record<ImportField, string> = {
  recipientName: "Recipient (person)",
  company: "Company",
  address: "Full address (one column)",
  street: "Street (+ number)",
  houseNumber: "House number",
  postalCode: "Postcode",
  city: "City",
  countryCode: "Country code",
  tracking: "Tracking number(s)",
  lat: "Latitude",
  lng: "Longitude",
  type: "Type (delivery/pickup)",
  priority: "Priority",
  notes: "Notes",
  phone: "Phone",
  twStart: "Window from (HH:MM)",
  twEnd: "Window to (HH:MM)",
};

const ROW_ERROR: Record<string, string> = {
  street_missing: "street missing",
  city_missing: "city missing",
  postal_code_invalid: "postcode invalid",
  coordinates_invalid: "coordinates invalid",
  time_window_invalid: "time window invalid",
  address_unrecognized: "address not recognised",
  postal_code_4_digits: "postcode has only 4 digits",
  postcode_city_mismatch: "postcode does not belong to this city",
};

/** Result of the server postcode/city check (POST /v1/geocode/postcodes). */
type PostcodeCheck = { status: "ok" | "mismatch" | "unknown"; knownCities?: string[] };
const pcKey = (postalCode: string, city: string) => `${postalCode}|${city.trim().toLowerCase()}`;

/** A tracking number that is already in TURVIO (POST /parcels/lookup). */
export interface ExistingParcel {
  trackingNumber: string;
  stopStatus: string;
  blocking: boolean;
  tourName: string | null;
  tourDate: string | null;
}

/** Keeps a processing error inside the dialog (with a way out) instead of closing it. */
export class ImportErrorBoundary extends Component<{ children: ReactNode; onReset: () => void }, { error: string | null }> {
  state = { error: null as string | null };
  static getDerivedStateFromError(e: unknown) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="flex flex-col gap-2 rounded-md bg-danger-soft/70 px-3 py-2 text-sm text-danger">
        <strong>The file could not be processed. Nothing was imported.</strong>
        <span className="text-xs">{this.state.error}</span>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            this.setState({ error: null });
            this.props.onReset();
          }}
        >
          Start again
        </Button>
      </div>
    );
  }
}

const MAPPING_PROBLEM = (p: string) =>
  p === "no_address_columns"
    ? "Map either a full-address column, or street plus postcode or city."
    : p === "lat_lng_incomplete"
      ? "Map both latitude and longitude, or neither."
      : p.startsWith("mapped_twice:")
        ? `Each field can be mapped once (${p.slice(13).split(",").map((f) => FIELD_LABEL[f as ImportField]).join(", ")}).`
        : p;

type Geo = { status: "file" | "found" | "street" | "manual" | "missing"; label?: string };
interface GeocodeHit {
  label: string;
  location: { lat: number; lng: number };
  precision: "house" | "street" | "postal_code" | "city" | "other";
}

export interface FileImportState {
  stops: NewStopInput[];
  /** True while something blocks importing (mapping problem, invalid rows, conflicts, checks running). */
  blocked: boolean;
  label: string;
  /** Why the import button is disabled (shown next to it). */
  reason?: string;
}

/** Text of a CSV file: UTF-8, or Windows-1252 (Excel "CSV" on German Windows) when UTF-8 is broken. */
export function decodeText(bytes: Uint8Array): string {
  const utf8 = new TextDecoder("utf-8").decode(bytes);
  return utf8.includes("�") ? new TextDecoder("windows-1252").decode(bytes) : utf8;
}

/** CSV/TXT/XLSX file -> table of cells (first worksheet for Excel). */
async function bytesOf(file: File): Promise<Uint8Array> {
  if (typeof file.arrayBuffer === "function") return new Uint8Array(await file.arrayBuffer());
  // Older browsers (and jsdom): FileReader.
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(new Uint8Array(r.result as ArrayBuffer));
    r.onerror = () => reject(r.error ?? new Error("The file could not be read."));
    r.readAsArrayBuffer(file);
  });
}

export async function readTable(file: File): Promise<string[][]> {
  const bytes = await bytesOf(file);
  if (/\.xlsx$/i.test(file.name) || file.type.includes("spreadsheetml")) return parseXlsx(bytes);
  if (/\.xls$/i.test(file.name)) throw new Error("Old .xls files are not supported – save the file as .xlsx or CSV.");
  return parseDelimited(decodeText(bytes));
}

const MAX_ROWS = 2000;
const GEOCODE_CHUNK = 200;

/**
 * Dispatch file import: CSV/XLSX -> column mapping -> validated rows -> stops grouped by address
 * (several parcels for one address = one stop, every tracking number kept) -> server-side
 * geocoding (exact matches only) -> review. Nothing is invented: unmatched addresses stay
 * "needs location" until someone picks the address.
 */
export function FileImport({
  near,
  organizationId,
  onChange,
  recheck = 0,
}: {
  near?: { lat: number; lng: number };
  organizationId: string;
  onChange: (s: FileImportState) => void;
  /** Increase to check the tracking numbers against TURVIO again (e.g. after a refused save). */
  recheck?: number;
}) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [table, setTable] = useState<string[][] | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const [columns, setColumns] = useState<(ImportField | null)[]>([]);
  const [header, setHeader] = useState(true);
  const [geo, setGeo] = useState<Record<string, Geo & { location?: { lat: number; lng: number } }>>({});
  const [geocoding, setGeocoding] = useState<"idle" | "busy" | "unavailable" | "error">("idle");
  const [geocodeError, setGeocodeError] = useState<string | null>(null);
  const [includeUnlocated, setIncludeUnlocated] = useState(true);
  const [fixing, setFixing] = useState<string | null>(null);
  const [resolutions, setResolutions] = useState<Record<string, number | "skip">>({});
  const [postcodes, setPostcodes] = useState<{ available: boolean; checks: Map<string, PostcodeCheck> } | null>(null);
  const [postcodeFixes, setPostcodeFixes] = useState<Record<number, string>>({});
  const [existing, setExisting] = useState<{ state: "idle" | "busy" | "done" | "error"; found: ExistingParcel[]; error?: string }>({ state: "idle", found: [] });
  const [leaveOutExisting, setLeaveOutExisting] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const load = async (file: File) => {
    setReadError(null);
    setGeo({});
    setGeocoding("idle");
    setResolutions({});
    setPostcodeFixes({});
    setPostcodes(null);
    setExisting({ state: "idle", found: [] });
    setLeaveOutExisting(false);
    try {
      const t = (await readTable(file)).filter((r) => r.some((c) => c.trim()));
      if (!t.length) throw new Error("The file is empty.");
      if (t.length > MAX_ROWS + 1) throw new Error(`The file has ${t.length} rows – import at most ${MAX_ROWS} at a time.`);
      const detected = detectColumns(t[0]!);
      setTable(t);
      setHeader(!!detected);
      setColumns(detected ?? t[0]!.map((_, i) => (i === 0 ? "address" : null)));
      setFileName(file.name);
    } catch (e) {
      setTable(null);
      setReadError(errorMessage(e));
    }
  };

  const problems = useMemo(() => mappingProblems(columns), [columns]);
  const parsed = useMemo(() => (table && !problems.length ? rowsFromTable(table, { columns, header }).rows : []), [table, columns, header, problems]);

  // Postcode/city check on the server (address data): once per file and mapping.
  useEffect(() => {
    setPostcodes(null);
    const pairs = new Map<string, { postalCode: string; city: string }>();
    for (const r of parsed) {
      if (r.countryCode !== "DE" || !r.city.trim()) continue;
      for (const pc of [r.postalCode, r.postalCodeSuggestion]) if (pc && /^\d{5}$/.test(pc)) pairs.set(pcKey(pc, r.city), { postalCode: pc, city: r.city.trim() });
    }
    if (!pairs.size) return;
    let alive = true;
    (async () => {
      const checks = new Map<string, PostcodeCheck>();
      let available = true;
      try {
        const all = [...pairs.values()];
        for (let i = 0; i < all.length; i += 2000) {
          const r = await api<{ available: boolean; results: ({ postalCode: string; city: string } & PostcodeCheck)[] }>("POST", "/v1/geocode/postcodes", { pairs: all.slice(i, i + 2000) });
          available &&= r.available;
          for (const x of r.results) checks.set(pcKey(x.postalCode, x.city), { status: x.status, knownCities: x.knownCities });
        }
      } catch {
        available = false;
      }
      if (alive) setPostcodes({ available, checks });
    })();
    return () => {
      alive = false;
    };
  }, [parsed]);

  // Rows after the user's postcode corrections and the server's postcode/city check.
  const rows: ImportRow[] = useMemo(
    () =>
      parsed.map((r) => {
        const fixed = postcodeFixes[r.line] ? validateImportRow({ ...r, postalCode: postcodeFixes[r.line]!, errors: [] }) : r;
        const check = postcodes?.checks.get(pcKey(fixed.postalCode, fixed.city));
        return check?.status === "mismatch" && !fixed.errors.includes("postcode_city_mismatch") ? { ...fixed, errors: [...fixed.errors, "postcode_city_mismatch"] } : fixed;
      }),
    [parsed, postcodeFixes, postcodes],
  );
  const verifiedFixes = useMemo(
    () => rows.filter((r) => r.errors.includes("postal_code_4_digits") && r.postalCodeSuggestion && postcodes?.checks.get(pcKey(r.postalCodeSuggestion, r.city))?.status === "ok"),
    [rows, postcodes],
  );
  const plan = useMemo(() => planImport(rows, resolutions), [rows, resolutions]);
  const groups = plan.groups;
  const invalid = rows.filter((r) => r.errors.length);

  // Already in TURVIO? Company-wide check of every tracking number before anything is saved.
  const trackingList = useMemo(() => [...new Set(groups.flatMap((g) => g.input.parcels?.map((p) => p.trackingNumber) ?? []))], [groups]);
  useEffect(() => {
    if (!trackingList.length) {
      setExisting({ state: "done", found: [] });
      return;
    }
    let alive = true;
    setExisting((x) => ({ ...x, state: "busy" }));
    const t = setTimeout(async () => {
      try {
        const found: ExistingParcel[] = [];
        for (let i = 0; i < trackingList.length; i += 5000) {
          const r = await api<{ found: ExistingParcel[] }>("POST", `/v1/orgs/${organizationId}/parcels/lookup`, { trackingNumbers: trackingList.slice(i, i + 5000) });
          found.push(...r.found);
        }
        if (alive) setExisting({ state: "done", found });
      } catch (e) {
        if (alive) setExisting({ state: "error", found: [], error: errorMessage(e) });
      }
    }, 300);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [trackingList, organizationId, recheck]);
  const blockingExisting = useMemo(() => existing.found.filter((f) => f.blocking), [existing.found]);
  const reDeliveries = useMemo(() => existing.found.filter((f) => !f.blocking), [existing.found]);
  const leftOut = useMemo(() => new Set(leaveOutExisting ? blockingExisting.map((f) => f.trackingNumber.toUpperCase()) : []), [leaveOutExisting, blockingExisting]);

  // A changed mapping produces different addresses: earlier geocoding results no longer apply.
  useEffect(() => setGeo({}), [columns, header]);

  const located = (g: ImportGroup) => (g.input.location ? { status: "file" as const } : geo[g.key]);
  const pending = groups.filter((g) => !g.input.location && !geo[g.key]?.location && geo[g.key]?.status !== "missing");

  const geocode = async () => {
    setGeocoding("busy");
    setGeocodeError(null);
    const todo = groups.filter((g) => !g.input.location && !geo[g.key]?.location);
    const next = { ...geo };
    try {
      for (let i = 0; i < todo.length; i += GEOCODE_CHUNK) {
        const chunk = todo.slice(i, i + GEOCODE_CHUNK);
        const r = await api<{ results: (GeocodeHit | null)[] }>("POST", "/v1/geocode/batch", {
          addresses: chunk.map((g) => ({ street: g.input.address.street, houseNumber: g.input.address.houseNumber ?? undefined, postalCode: g.input.address.postalCode, city: g.input.address.city })),
        });
        chunk.forEach((g, k) => {
          const hit = r.results?.[k];
          next[g.key] = hit ? { status: hit.precision === "house" ? "found" : "street", location: hit.location, label: hit.label } : { status: "missing" };
        });
        setGeo({ ...next });
      }
      setGeocoding("idle");
    } catch (e) {
      setGeocoding(e instanceof ApiCallError && e.code === "geocoder_unavailable" ? "unavailable" : "error");
      setGeocodeError(errorMessage(e));
    }
  };

  const stops: NewStopInput[] = useMemo(
    () =>
      groups
        .map((g): NewStopInput | null => {
          const loc = g.input.location ?? geo[g.key]?.location ?? null;
          if (!loc && !includeUnlocated) return null;
          const parcels = (g.input.parcels ?? []).filter((p) => !leftOut.has(p.trackingNumber.toUpperCase()));
          // Every parcel of this address is already planned and left out: no empty stop.
          if (g.input.parcels?.length && !parcels.length) return null;
          return {
            ...g.input,
            parcels,
            trackingNumbers: parcels.map((p) => p.trackingNumber),
            location: loc,
            locationSource: g.input.location ? "import" : loc ? (geo[g.key]?.status === "manual" ? "dispatch" : "geocoder") : null,
            // Precision as known here: coordinates from the file are unverified (server default);
            // a street-level match is stored as approximate, never as a house position.
            ...(!g.input.location && loc
              ? { locationPrecision: geo[g.key]?.status === "found" ? ("house" as const) : geo[g.key]?.status === "street" ? ("street" as const) : ("manual_pin" as const) }
              : {}),
          };
        })
        .filter((s): s is NewStopInput => !!s),
    [groups, geo, includeUnlocated, leftOut],
  );
  const parcels = stops.reduce((n, s) => n + (s.parcels?.length ?? s.trackingNumbers?.length ?? 0), 0);
  const reason = !table
    ? undefined
    : problems.length
      ? "Fix the column mapping."
      : invalid.length
        ? `${invalid.length} row(s) cannot be imported – fix the file.`
        : plan.unresolved
          ? `Decide where ${plan.unresolved} conflicting parcel(s) belong.`
          : plan.blockingGroups
            ? `${plan.blockingGroups} stop(s) have more than ${MAX_PARCELS_PER_STOP} parcels.`
            : existing.state === "busy" || existing.state === "idle"
              ? "Checking tracking numbers…"
              : existing.state === "error"
                ? "Tracking numbers could not be checked – try again."
                : blockingExisting.length && !leaveOutExisting
                  ? `${blockingExisting.length} parcel(s) are already in TURVIO.`
                  : geocoding === "busy"
                    ? "Finding locations…"
                    : stops.length === 0
                      ? "Nothing to import."
                      : undefined;
  const blocked = !table || !!reason;

  useEffect(() => {
    onChange({ stops, blocked, reason, label: stops.length ? `Import ${stops.length} stop${stops.length === 1 ? "" : "s"} (${parcels} parcel${parcels === 1 ? "" : "s"})` : "Import" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stops, blocked, parcels, reason]);

  const counts = {
    file: groups.filter((g) => g.input.location).length,
    found: groups.filter((g) => geo[g.key]?.status === "found").length,
    street: groups.filter((g) => geo[g.key]?.status === "street").length,
    manual: groups.filter((g) => geo[g.key]?.status === "manual").length,
    missing: groups.filter((g) => !g.input.location && !geo[g.key]?.location).length,
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={input}
          type="file"
          accept=".csv,.txt,.tsv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="sr-only"
          aria-label="Choose a CSV or Excel file"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void load(f);
            e.target.value = "";
          }}
        />
        <Button variant="secondary" onClick={() => input.current?.click()}>
          <Upload /> {fileName ? "Choose another file" : "Choose CSV or Excel file"}
        </Button>
        {fileName && (
          <span className="inline-flex items-center gap-1.5 text-sm text-ink-2">
            <FileSpreadsheet className="size-4" /> {fileName} · {table!.length - (header ? 1 : 0)} rows
          </span>
        )}
      </div>
      {readError && <p className="rounded-md bg-danger-soft px-2.5 py-1.5 text-xs text-danger">{readError}</p>}

      {table && (
        <section aria-label="Column mapping" className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-[13px] font-semibold text-ink">Columns</h3>
            <Checkbox label="First row is a header" checked={header} onCheckedChange={(v) => setHeader(!!v)} />
          </div>
          <div className="overflow-x-auto rounded-md border border-line">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-surface-2">
                  {table[0]!.map((cell, i) => (
                    <th key={i} className="min-w-36 p-1.5 text-start align-top font-normal">
                      <select
                        aria-label={`Column ${i + 1}${header ? ` (${cell})` : ""}`}
                        value={columns[i] ?? ""}
                        onChange={(e) => setColumns((cs) => cs.map((c, k) => (k === i ? ((e.target.value || null) as ImportField | null) : c)))}
                        className={cn("h-8 w-full rounded border bg-surface px-1.5 text-xs", columns[i] ? "border-brand-500 text-ink" : "border-line text-muted")}
                      >
                        <option value="">Ignore</option>
                        {IMPORT_FIELDS.map((f) => (
                          <option key={f} value={f}>
                            {FIELD_LABEL[f]}
                          </option>
                        ))}
                      </select>
                      {header && <div className="mt-1 truncate font-medium text-ink-2" title={cell}>{cell || "–"}</div>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.slice(header ? 1 : 0, (header ? 1 : 0) + 3).map((r, k) => (
                  <tr key={k} className="border-t border-line">
                    {table[0]!.map((_, i) => (
                      <td key={i} className="max-w-48 truncate p-1.5 text-muted" title={r[i]}>
                        {r[i] ?? ""}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {problems.map((p) => (
            <p key={p} className="text-xs text-danger" role="alert">
              {MAPPING_PROBLEM(p)}
            </p>
          ))}
        </section>
      )}

      {rows.length > 0 && (
        <section aria-label="Import review" className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <Badge tone="outline">{rows.length} rows</Badge>
            <Badge tone="outline">
              {groups.length} stops · {groups.reduce((n, g) => n + (g.input.parcels?.length ?? 0), 0)} parcels
            </Badge>
            {rows.length > groups.length + invalid.length && <Badge tone="brand">{rows.length - invalid.length - groups.length} rows merged into stops at the same address</Badge>}
            {counts.file > 0 && <Badge tone="success">{counts.file} with coordinates from the file</Badge>}
            {counts.found > 0 && <Badge tone="success">{counts.found} found (house number)</Badge>}
            {counts.street > 0 && <Badge tone="warning">{counts.street} street level only</Badge>}
            {counts.manual > 0 && <Badge tone="success">{counts.manual} picked by hand</Badge>}
            {counts.missing > 0 && <Badge tone="warning">{counts.missing} without location</Badge>}
          </div>
          {invalid.length > 0 && (
            <div className="rounded-md bg-danger-soft/70 px-2.5 py-1.5 text-xs text-danger" role="alert">
              {invalid.length} row{invalid.length === 1 ? "" : "s"} cannot be imported – fix the file or the column mapping:
              <ul className="mt-1 list-disc ps-4">
                {invalid.slice(0, 8).map((r) => (
                  <li key={r.line}>
                    Row {r.line}: {r.errors.map((e) => (e === "postcode_city_mismatch" ? `${ROW_ERROR[e]} (${r.postalCode} is ${postcodes?.checks.get(pcKey(r.postalCode, r.city))?.knownCities?.join(", ") ?? "elsewhere"}, not ${r.city})` : e === "postal_code_4_digits" ? `${ROW_ERROR[e]} (${r.postalCode})` : (ROW_ERROR[e] ?? e))).join(", ")}
                  </li>
                ))}
                {invalid.length > 8 && <li>… and {invalid.length - 8} more</li>}
              </ul>
            </div>
          )}
          {verifiedFixes.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-md bg-warning-soft/70 px-2.5 py-1.5 text-xs text-warning-ink">
              {verifiedFixes.length} postcode(s) lost their leading zero (e.g. {verifiedFixes[0]!.postalCode} → {verifiedFixes[0]!.postalCodeSuggestion} {verifiedFixes[0]!.city}); the corrected code belongs to the city.
              <Button variant="secondary" size="sm" onClick={() => setPostcodeFixes((x) => ({ ...x, ...Object.fromEntries(verifiedFixes.map((r) => [r.line, r.postalCodeSuggestion!])) }))}>
                Use the corrected postcodes
              </Button>
            </div>
          )}
          {postcodes && !postcodes.available && <p className="text-xs text-muted">Postcodes could not be checked against the cities on this server (no address data).</p>}
          {plan.duplicates.length > 0 && (
            <p className="rounded-md bg-surface-2 px-2.5 py-1.5 text-xs text-ink-2">
              {plan.duplicates.length} tracking number(s) are listed twice at the same address – each is imported once: {plan.duplicates.slice(0, 3).map((d) => `${d.trackingNumber} (rows ${d.lines.join(", ")})`).join("; ")}
              {plan.duplicates.length > 3 ? " …" : ""}
            </p>
          )}
          {plan.conflicts.length > 0 && (
            <section aria-label="Address conflicts" className="flex flex-col gap-1.5 rounded-md border border-danger/40 bg-danger-soft/40 px-2.5 py-2 text-xs">
              <strong className="text-danger">
                {plan.conflicts.length} tracking number(s) appear at different addresses – choose the right one for each{plan.unresolved ? ` (${plan.unresolved} open)` : ""}:
              </strong>
              {plan.conflicts.map((c) => (
                <fieldset key={c.trackingNumber} className="flex flex-col gap-1 rounded border border-line bg-surface px-2 py-1.5">
                  <legend className="px-1 font-mono text-ink">{c.trackingNumber}</legend>
                  {c.options.map((o) => (
                    <label key={o.line} className="flex items-center gap-2">
                      <input type="radio" name={`conflict-${c.trackingNumber}`} checked={c.resolution === o.line} onChange={() => setResolutions((x) => ({ ...x, [c.trackingNumber]: o.line }))} />
                      Row {o.line}: {o.address}
                      {o.recipientName ? ` · ${o.recipientName}` : ""}
                    </label>
                  ))}
                  <label className="flex items-center gap-2 text-muted">
                    <input type="radio" name={`conflict-${c.trackingNumber}`} checked={c.resolution === "skip"} onChange={() => setResolutions((x) => ({ ...x, [c.trackingNumber]: "skip" }))} />
                    Leave this parcel out of the import
                  </label>
                </fieldset>
              ))}
            </section>
          )}
          {plan.blockingGroups > 0 && (
            <p className="rounded-md bg-danger-soft/70 px-2.5 py-1.5 text-xs text-danger" role="alert">
              {plan.blockingGroups} address(es) have more than {MAX_PARCELS_PER_STOP} parcels – split the file for these addresses.
            </p>
          )}
          {existing.state === "error" && <p className="text-xs text-danger" role="alert">Tracking numbers could not be checked against TURVIO: {existing.error}</p>}
          {blockingExisting.length > 0 && (
            <section aria-label="Already in TURVIO" className="flex flex-col gap-1.5 rounded-md border border-warning/50 bg-warning-soft/60 px-2.5 py-2 text-xs text-warning-ink">
              <strong>{blockingExisting.length} parcel(s) are already planned or delivered in TURVIO – importing them again would create duplicates:</strong>
              <ul className="max-h-28 list-disc overflow-auto ps-4">
                {blockingExisting.slice(0, 50).map((f) => (
                  <li key={f.trackingNumber}>
                    {f.trackingNumber} · {f.tourName ? `${f.tourName}${f.tourDate ? ` (${f.tourDate})` : ""}` : "another depot"} · {f.stopStatus}
                  </li>
                ))}
                {blockingExisting.length > 50 && <li>… and {blockingExisting.length - 50} more</li>}
              </ul>
              <Checkbox label={`Leave these ${blockingExisting.length} parcel(s) out and import the rest`} checked={leaveOutExisting} onCheckedChange={(v) => setLeaveOutExisting(!!v)} />
            </section>
          )}
          {reDeliveries.length > 0 && (
            <p className="text-xs text-ink-2">{reDeliveries.length} parcel(s) had an earlier attempt that ended (e.g. not at home) – they are imported again as a re-delivery.</p>
          )}
          {counts.missing > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => void geocode()} disabled={geocoding === "busy" || invalid.length > 0}>
                {geocoding === "busy" ? <Loader2 className="animate-spin" /> : <MapPin />}
                Find locations ({pending.length})
              </Button>
              <Checkbox label="Also import stops without location (they stay unplanned until a location is set)" checked={includeUnlocated} onCheckedChange={(v) => setIncludeUnlocated(!!v)} />
            </div>
          )}
          {geocoding === "unavailable" && <p className="text-xs text-warning-ink">Address search is not available on this server. Add coordinate columns to the file, or set locations later.</p>}
          {geocoding === "error" && <p className="text-xs text-danger">Finding locations failed: {geocodeError}</p>}
          <ul className="max-h-64 divide-y divide-line overflow-auto rounded-md border border-line" aria-label="Stops to import">
            {groups.map((g) => {
              const st = located(g);
              const a = g.input.address;
              return (
                <li key={g.key} className="flex flex-col gap-1.5 px-2.5 py-2 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-medium text-ink">
                        {a.street} {a.houseNumber ?? ""}, {a.postalCode} {a.city}
                      </div>
                      <div className="truncate text-muted">
                        {g.input.recipientName ?? "–"} · {g.input.parcels?.length ?? 0} parcel(s){g.rows.length > 1 ? ` · ${g.rows.length} rows merged` : ""}
                        {g.input.type === "pickup" ? " · pickup" : ""}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {st?.status === "file" && <Badge tone="success">from file</Badge>}
                      {st?.status === "found" && <Badge tone="success">found</Badge>}
                      {st?.status === "street" && <Badge tone="warning">street only</Badge>}
                      {st?.status === "manual" && <Badge tone="success">picked</Badge>}
                      {!g.input.location && !geo[g.key]?.location && <Badge tone="warning">{geo[g.key]?.status === "missing" ? "not found" : "no location"}</Badge>}
                      {!g.input.location && (
                        <Button variant="ghost" size="sm" onClick={() => setFixing(fixing === g.key ? null : g.key)} aria-label={`Set location for ${a.street} ${a.houseNumber ?? ""}`}>
                          {geo[g.key]?.location ? "Change" : "Set"}
                        </Button>
                      )}
                    </div>
                  </div>
                  {fixing === g.key && (
                    <AddressSearch
                      near={near}
                      autoFocus
                      placeholder={`${a.street} ${a.houseNumber ?? ""}, ${a.postalCode} ${a.city}`}
                      onPick={(p) => {
                        setGeo((x) => ({ ...x, [g.key]: { status: "manual", location: { lat: p.lat, lng: p.lng }, label: p.label } }));
                        setFixing(null);
                      }}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
