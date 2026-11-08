"use client";

import {
  IMPORT_FIELDS,
  detectColumns,
  groupImportRows,
  mappingProblems,
  parseDelimited,
  parseXlsx,
  rowsFromTable,
  type ImportField,
  type ImportGroup,
  type NewStopInput,
} from "@turvio/shared";
import { Badge, Button, Checkbox, cn } from "@turvio/web-ui/ds";
import { FileSpreadsheet, Loader2, MapPin, Upload } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { api, ApiCallError, errorMessage } from "../lib/api";
import { AddressSearch } from "./AddressSearch";

const FIELD_LABEL: Record<ImportField, string> = {
  recipientName: "Recipient / company",
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
};

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
  /** True while something blocks importing (mapping problem, invalid rows, geocoding running). */
  blocked: boolean;
  label: string;
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
export function FileImport({ near, existingTracking, onChange }: { near?: { lat: number; lng: number }; existingTracking: Set<string>; onChange: (s: FileImportState) => void }) {
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
  const input = useRef<HTMLInputElement>(null);

  const load = async (file: File) => {
    setReadError(null);
    setGeo({});
    setGeocoding("idle");
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
  const rows = useMemo(() => (table && !problems.length ? rowsFromTable(table, { columns, header }).rows : []), [table, columns, header, problems]);
  const groups = useMemo(() => groupImportRows(rows), [rows]);
  const invalid = rows.filter((r) => r.errors.length);
  const alreadyPlanned = useMemo(() => groups.flatMap((g) => (g.input.trackingNumbers ?? []).filter((t) => existingTracking.has(t))), [groups, existingTracking]);
  const duplicates = groups.flatMap((g) => g.duplicateTracking);

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
          return { ...g.input, location: loc, locationSource: g.input.location ? "import" : loc ? (geo[g.key]?.status === "manual" ? "dispatch" : "geocoder") : null };
        })
        .filter((s): s is NewStopInput => !!s),
    [groups, geo, includeUnlocated],
  );
  const parcels = stops.reduce((n, s) => n + (s.trackingNumbers?.length ?? 0), 0);
  const blocked = !table || problems.length > 0 || invalid.length > 0 || geocoding === "busy" || stops.length === 0;

  useEffect(() => {
    onChange({ stops, blocked, label: stops.length ? `Import ${stops.length} stop${stops.length === 1 ? "" : "s"} (${parcels} parcel${parcels === 1 ? "" : "s"})` : "Import" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stops, blocked, parcels]);

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
              {groups.length} stops · {groups.reduce((n, g) => n + (g.input.trackingNumbers?.length ?? 0), 0)} parcels
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
                    Row {r.line}: {r.errors.map((e) => ROW_ERROR[e] ?? e).join(", ")}
                  </li>
                ))}
                {invalid.length > 8 && <li>… and {invalid.length - 8} more</li>}
              </ul>
            </div>
          )}
          {(duplicates.length > 0 || alreadyPlanned.length > 0) && (
            <p className="rounded-md bg-warning-soft/70 px-2.5 py-1.5 text-xs text-warning-ink">
              {duplicates.length > 0 && <>{duplicates.length} tracking number(s) appear twice in the file and are imported once. </>}
              {alreadyPlanned.length > 0 && <>{alreadyPlanned.length} tracking number(s) are already on a stop for this day: {alreadyPlanned.slice(0, 3).join(", ")}{alreadyPlanned.length > 3 ? " …" : ""}</>}
            </p>
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
                        {g.input.recipientName ?? "–"} · {g.input.trackingNumbers?.length ?? 0} parcel(s){g.rows.length > 1 ? ` · ${g.rows.length} rows merged` : ""}
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
