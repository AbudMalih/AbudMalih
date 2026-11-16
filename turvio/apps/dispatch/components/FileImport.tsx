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
import { currentT, type TFunction } from "../lib/i18n";
import { useI18n, useT } from "../lib/i18n/client";
import { AddressSearch } from "./AddressSearch";
import { stopStatusLabel } from "./StatusBadge";
import { useDesignG } from "../lib/ui";

/** Label of an import field in the current language. */
const fieldLabel = (f: ImportField, t: TFunction) => t(`import.field.${f}`);

const ROW_ERRORS = new Set(["street_missing", "city_missing", "postal_code_invalid", "coordinates_invalid", "time_window_invalid", "address_unrecognized", "postal_code_4_digits", "postcode_city_mismatch"]);
/** A row check code in words (unknown codes as they are). */
const rowErrorLabel = (code: string, t: TFunction) => (ROW_ERRORS.has(code) ? t(`import.rowError.${code}` as "import.rowError.street_missing") : code);

const STOP_STATUSES = new Set(["pending", "in_progress", "delivered", "picked_up", "failed", "attempted", "rescheduled", "returned", "skipped", "cancelled"]);

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
      <ImportErrorNotice
        error={this.state.error}
        onReset={() => {
          this.setState({ error: null });
          this.props.onReset();
        }}
      />
    );
  }
}

function ImportErrorNotice({ error, onReset }: { error: string; onReset: () => void }) {
  const t = useT();
  return (
    <div role="alert" className="flex flex-col gap-2 rounded-md bg-danger-soft/70 px-3 py-2 text-sm text-danger g:items-start g:border g:border-line-2 g:bg-transparent g:text-[13px] g:text-danger-ink">
      <strong className="g:font-medium">{t("import.processingFailed")}</strong>
      <span className="text-xs g:text-[12px] g:text-ink-2">{error}</span>
      <Button variant="secondary" size="sm" onClick={onReset}>
        {t("import.startAgain")}
      </Button>
    </div>
  );
}

const MAPPING_PROBLEM = (p: string, t: TFunction) =>
  p === "no_address_columns"
    ? t("import.noAddressColumns")
    : p === "lat_lng_incomplete"
      ? t("import.latLngIncomplete")
      : p.startsWith("mapped_twice:")
        ? t("import.mappedTwice", { fields: p.slice(13).split(",").map((f) => fieldLabel(f as ImportField, t)).join(t("import.sep")) })
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
    r.onerror = () => reject(r.error ?? new Error(currentT()("import.readFailed")));
    r.readAsArrayBuffer(file);
  });
}

export async function readTable(file: File): Promise<string[][]> {
  const bytes = await bytesOf(file);
  if (/\.xlsx$/i.test(file.name) || file.type.includes("spreadsheetml")) return parseXlsx(bytes);
  if (/\.xls$/i.test(file.name)) throw new Error(currentT()("import.xlsUnsupported"));
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
  const { t } = useI18n();
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
  const isG = useDesignG();
  // G: the summary figures read as plain facts, not pills.
  const gFact = "g:h-auto g:border-0 g:px-0 g:text-[12px] g:font-normal g:text-ink-2";

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
      const cells = (await readTable(file)).filter((r) => r.some((c) => c.trim()));
      if (!cells.length) throw new Error(t("import.fileEmpty"));
      if (cells.length > MAX_ROWS + 1) throw new Error(t("import.tooManyRows", { count: String(cells.length), max: String(MAX_ROWS) }));
      const detected = detectColumns(cells[0]!);
      setTable(cells);
      setHeader(!!detected);
      setColumns(detected ?? cells[0]!.map((_, i) => (i === 0 ? "address" : null)));
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
    const timer = setTimeout(async () => {
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
      clearTimeout(timer);
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
      ? t("import.fixMapping")
      : invalid.length
        ? t("import.invalidRows", { count: invalid.length })
        : plan.unresolved
          ? t("import.unresolved", { count: plan.unresolved })
          : plan.blockingGroups
            ? t("import.tooManyParcels", { count: plan.blockingGroups, max: MAX_PARCELS_PER_STOP })
            : existing.state === "busy" || existing.state === "idle"
              ? t("import.checkingTracking")
              : existing.state === "error"
                ? t("import.trackingCheckFailed")
                : blockingExisting.length && !leaveOutExisting
                  ? t("import.alreadyInTurvio", { count: blockingExisting.length })
                  : geocoding === "busy"
                    ? t("import.findingLocations")
                    : stops.length === 0
                      ? t("import.nothingToImport")
                      : undefined;
  const blocked = !table || !!reason;

  useEffect(() => {
    onChange({
      stops,
      blocked,
      reason,
      label: stops.length ? t("import.importLabel", { count: stops.length, parcels: t("import.parcelsCount", { count: parcels }) }) : t("import.import"),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stops, blocked, parcels, reason, t]);

  const counts = {
    file: groups.filter((g) => g.input.location).length,
    found: groups.filter((g) => geo[g.key]?.status === "found").length,
    street: groups.filter((g) => geo[g.key]?.status === "street").length,
    manual: groups.filter((g) => geo[g.key]?.status === "manual").length,
    missing: groups.filter((g) => !g.input.location && !geo[g.key]?.location).length,
  };

  return (
    <div className="flex flex-col gap-4 g:gap-0 g:divide-y g:divide-line [&>*]:g:py-3 [&>*:first-child]:g:pt-0 [&>*:last-child]:g:pb-0">
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={input}
          type="file"
          accept=".csv,.txt,.tsv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="sr-only"
          aria-label={t("import.chooseFileLabel")}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void load(f);
            e.target.value = "";
          }}
        />
        <Button variant="secondary" onClick={() => input.current?.click()}>
          <Upload /> {fileName ? t("import.chooseAnother") : t("import.chooseFile")}
        </Button>
        {fileName && (
          <span className="inline-flex items-center gap-1.5 text-sm text-ink-2 g:text-[13px]">
            <FileSpreadsheet className="size-4 g:size-[15px] g:text-muted" /> {fileName} · {t("import.fileRows", { count: table!.length - (header ? 1 : 0) })}
          </span>
        )}
      </div>
      {readError && <p className="rounded-md bg-danger-soft px-2.5 py-1.5 text-xs text-danger g:bg-transparent g:px-0 g:text-[12px] g:text-danger-ink">{readError}</p>}

      {table && (
        <section aria-label={t("import.mappingLabel")} className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-[13px] font-semibold text-ink g:text-[13.5px]">{t("import.columns")}</h3>
            <Checkbox label={t("import.headerRow")} checked={header} onCheckedChange={(v) => setHeader(!!v)} />
          </div>
          <div className="overflow-x-auto rounded-md border border-line g:border-line-2">
            <table className="w-full text-xs g:text-[12px]">
              <thead>
                <tr className="bg-surface-2 g:border-b g:border-line g:bg-transparent">
                  {table[0]!.map((cell, i) => (
                    <th key={i} className="min-w-36 p-1.5 text-start align-top font-normal g:px-2 g:py-1.5">
                      <select
                        aria-label={header ? t("import.columnWithHeader", { n: i + 1, header: cell }) : t("import.column", { n: i + 1 })}
                        value={columns[i] ?? ""}
                        onChange={(e) => setColumns((cs) => cs.map((c, k) => (k === i ? ((e.target.value || null) as ImportField | null) : c)))}
                        className={cn("h-8 w-full rounded border bg-surface px-1.5 text-xs g:h-7 g:rounded-md g:bg-surface-2 g:text-[12px] g:focus:border-brand-600 g:focus:outline-none", columns[i] ? "border-brand-500 text-ink g:border-line-3" : "border-line text-muted g:border-line-2")}
                      >
                        <option value="">{t("import.ignore")}</option>
                        {IMPORT_FIELDS.map((f) => (
                          <option key={f} value={f}>
                            {fieldLabel(f, t)}
                          </option>
                        ))}
                      </select>
                      {header && <div className="mt-1 truncate font-medium text-ink-2 g:font-normal g:text-muted" title={cell}>{cell || "–"}</div>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.slice(header ? 1 : 0, (header ? 1 : 0) + 3).map((r, k) => (
                  <tr key={k} className="border-t border-line g:first:border-t-0">
                    {table[0]!.map((_, i) => (
                      <td key={i} className="max-w-48 truncate p-1.5 text-muted g:px-2 g:text-ink-2" title={r[i]}>
                        {r[i] ?? ""}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {problems.map((p) => (
            <p key={p} className="text-xs text-danger g:text-[12px] g:text-danger-ink" role="alert">
              {MAPPING_PROBLEM(p, t)}
            </p>
          ))}
        </section>
      )}

      {rows.length > 0 && (
        <section aria-label={t("import.reviewLabel")} className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-1.5 text-xs g:gap-x-3 g:gap-y-1">
            <Badge tone="outline" className={gFact}>{t("import.rows", { count: rows.length })}</Badge>
            <Badge tone="outline" className={gFact}>
              {t("import.stopsBadge", { count: groups.length, parcels: t("import.allParcels", { count: groups.reduce((n, g) => n + (g.input.parcels?.length ?? 0), 0) }) })}
            </Badge>
            {rows.length > groups.length + invalid.length && <Badge tone="brand">{t("import.merged", { count: rows.length - invalid.length - groups.length })}</Badge>}
            {counts.file > 0 && <Badge tone="success">{t("import.withCoordinates", { count: counts.file })}</Badge>}
            {counts.found > 0 && <Badge tone="success">{t("import.foundHouse", { count: counts.found })}</Badge>}
            {counts.street > 0 && <Badge tone="warning" dot={isG}>{t("import.streetLevel", { count: counts.street })}</Badge>}
            {counts.manual > 0 && <Badge tone="success">{t("import.pickedByHand", { count: counts.manual })}</Badge>}
            {counts.missing > 0 && <Badge tone="warning" dot={isG}>{t("import.withoutLocation", { count: counts.missing })}</Badge>}
          </div>
          {invalid.length > 0 && (
            <div className="rounded-md bg-danger-soft/70 px-2.5 py-1.5 text-xs text-danger g:border g:border-line-2 g:bg-transparent g:px-3 g:py-2 g:text-[12px] g:text-danger-ink" role="alert">
              {t("import.invalidHead", { count: invalid.length })}
              <ul className="mt-1 list-disc ps-4 g:text-ink-2">
                {invalid.slice(0, 8).map((r) => (
                  <li key={r.line}>
                    {t("import.rowLine", {
                      line: String(r.line),
                      errors: r.errors
                        .map((e) =>
                          e === "postcode_city_mismatch"
                            ? t("import.mismatchDetail", {
                                error: rowErrorLabel(e, t),
                                postcode: r.postalCode,
                                cities: postcodes?.checks.get(pcKey(r.postalCode, r.city))?.knownCities?.join(t("import.sep")) ?? t("import.elsewhere"),
                                city: r.city,
                              })
                            : e === "postal_code_4_digits"
                              ? t("import.fourDigitDetail", { error: rowErrorLabel(e, t), postcode: r.postalCode })
                              : rowErrorLabel(e, t),
                        )
                        .join(t("import.sep")),
                    })}
                  </li>
                ))}
                {invalid.length > 8 && <li>{t("import.andMore", { count: invalid.length - 8 })}</li>}
              </ul>
            </div>
          )}
          {verifiedFixes.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-md bg-warning-soft/70 px-2.5 py-1.5 text-xs text-warning-ink g:border g:border-line-2 g:bg-transparent g:px-3 g:py-2 g:text-[12px]">
              {t("import.leadingZero", {
                count: verifiedFixes.length,
                from: verifiedFixes[0]!.postalCode,
                to: verifiedFixes[0]!.postalCodeSuggestion ?? "",
                city: verifiedFixes[0]!.city,
              })}
              <Button variant="secondary" size="sm" onClick={() => setPostcodeFixes((x) => ({ ...x, ...Object.fromEntries(verifiedFixes.map((r) => [r.line, r.postalCodeSuggestion!])) }))}>
                {t("import.useCorrected")}
              </Button>
            </div>
          )}
          {postcodes && !postcodes.available && <p className="text-xs text-muted g:text-[12px]">{t("import.noPostcodeData")}</p>}
          {plan.duplicates.length > 0 && (
            <p className="rounded-md bg-surface-2 px-2.5 py-1.5 text-xs text-ink-2 g:border g:border-line-2 g:bg-transparent g:px-3 g:py-2 g:text-[12px]">
              {t("import.duplicates", {
                count: plan.duplicates.length,
                list: plan.duplicates
                  .slice(0, 3)
                  .map((d) => t("import.duplicateItem", { tracking: d.trackingNumber, lines: d.lines.join(t("import.sep")) }))
                  .join("; "),
              })}
              {plan.duplicates.length > 3 ? " …" : ""}
            </p>
          )}
          {plan.conflicts.length > 0 && (
            <section aria-label={t("import.conflictsLabel")} className="flex flex-col gap-1.5 rounded-md border border-danger/40 bg-danger-soft/40 px-2.5 py-2 text-xs g:gap-0 g:divide-y g:divide-line g:overflow-hidden g:border-line-2 g:bg-transparent g:p-0 g:text-[12px]">
              <strong className="text-danger g:flex g:items-center g:gap-1.5 g:px-3 g:py-2 g:font-medium g:text-danger-ink">
                <span className="hidden size-1.5 shrink-0 rounded-full bg-danger g:inline-block" aria-hidden="true" />
                {plan.unresolved ? t("import.conflictsOpen", { count: plan.conflicts.length, open: plan.unresolved }) : t("import.conflicts", { count: plan.conflicts.length })}
              </strong>
              {plan.conflicts.map((c) => (
                <fieldset key={c.trackingNumber} className="flex flex-col gap-1 rounded border border-line bg-surface px-2 py-1.5 g:grid g:grid-cols-[minmax(7rem,10rem)_minmax(0,1fr)] g:gap-x-3 g:gap-y-0.5 g:rounded-none g:border-0 g:bg-transparent g:px-3 g:py-1.5 g:hover:bg-[var(--hover)]">
                  <legend className="px-1 font-mono text-ink g:float-start g:row-span-6 g:truncate g:px-0 g:py-0.5 g:text-[12px]">{c.trackingNumber}</legend>
                  {c.options.map((o) => (
                    <label key={o.line} className="flex items-center gap-2 g:col-start-2 g:min-h-6 g:text-ink-2">
                      <input type="radio" name={`conflict-${c.trackingNumber}`} checked={c.resolution === o.line} onChange={() => setResolutions((x) => ({ ...x, [c.trackingNumber]: o.line }))} />
                      {t("import.rowAddress", { line: String(o.line), address: o.address })}
                      {o.recipientName ? ` · ${o.recipientName}` : ""}
                    </label>
                  ))}
                  <label className="flex items-center gap-2 text-muted g:col-start-2 g:min-h-6">
                    <input type="radio" name={`conflict-${c.trackingNumber}`} checked={c.resolution === "skip"} onChange={() => setResolutions((x) => ({ ...x, [c.trackingNumber]: "skip" }))} />
                    {t("import.leaveOutParcel")}
                  </label>
                </fieldset>
              ))}
            </section>
          )}
          {plan.blockingGroups > 0 && (
            <p className="rounded-md bg-danger-soft/70 px-2.5 py-1.5 text-xs text-danger g:border g:border-line-2 g:bg-transparent g:px-3 g:py-2 g:text-[12px] g:text-danger-ink" role="alert">
              {t("import.tooManyAddresses", { count: plan.blockingGroups, max: MAX_PARCELS_PER_STOP })}
            </p>
          )}
          {existing.state === "error" && (
            <p className="text-xs text-danger g:text-[12px] g:text-danger-ink" role="alert">
              {t("import.trackingCheckError", { error: existing.error ?? "" })}
            </p>
          )}
          {blockingExisting.length > 0 && (
            <section aria-label={t("import.alreadyLabel")} className="flex flex-col gap-1.5 rounded-md border border-warning/50 bg-warning-soft/60 px-2.5 py-2 text-xs text-warning-ink g:gap-0 g:overflow-hidden g:border-line-2 g:bg-transparent g:p-0 g:text-[12px] g:[&>button]:mx-3 g:[&>button]:my-2">
              <strong className="g:flex g:items-center g:gap-1.5 g:border-b g:border-line g:px-3 g:py-2 g:font-medium">
                <span className="hidden size-1.5 shrink-0 rounded-full bg-warning g:inline-block" aria-hidden="true" />{t("import.alreadyHead", { count: blockingExisting.length })}</strong>
              <ul className="max-h-28 list-disc overflow-auto ps-4 g:max-h-36 g:list-none g:divide-y g:divide-line g:ps-0 g:text-ink-2">
                {blockingExisting.slice(0, 50).map((f) => (
                  <li key={f.trackingNumber} className="g:px-3 g:py-1 g:tabular">
                    {f.trackingNumber} · {f.tourName ? `${f.tourName}${f.tourDate ? ` (${f.tourDate})` : ""}` : t("import.anotherDepot")} ·{" "}
                    {STOP_STATUSES.has(f.stopStatus) ? stopStatusLabel(f.stopStatus as Parameters<typeof stopStatusLabel>[0], t) : f.stopStatus}
                  </li>
                ))}
                {blockingExisting.length > 50 && <li className="g:px-3 g:py-1 g:text-muted">{t("import.andMore", { count: blockingExisting.length - 50 })}</li>}
              </ul>
              <Checkbox label={t("import.leaveOutExisting", { count: blockingExisting.length })} checked={leaveOutExisting} onCheckedChange={(v) => setLeaveOutExisting(!!v)} />
            </section>
          )}
          {reDeliveries.length > 0 && (
            <p className="text-xs text-ink-2 g:text-[12px]">{t("import.reDeliveries", { count: reDeliveries.length })}</p>
          )}
          {counts.missing > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => void geocode()} disabled={geocoding === "busy" || invalid.length > 0}>
                {geocoding === "busy" ? <Loader2 className="animate-spin" /> : <MapPin />}
                {t("import.findLocations", { n: pending.length })}
              </Button>
              <Checkbox label={t("import.includeUnlocated")} checked={includeUnlocated} onCheckedChange={(v) => setIncludeUnlocated(!!v)} />
            </div>
          )}
          {geocoding === "unavailable" && <p className="text-xs text-warning-ink g:text-[12px]">{t("import.geocoderUnavailable")}</p>}
          {geocoding === "error" && <p className="text-xs text-danger g:text-[12px] g:text-danger-ink">{t("import.geocodeFailed", { error: geocodeError ?? "" })}</p>}
          <ul className="max-h-64 divide-y divide-line overflow-auto rounded-md border border-line g:max-h-72 g:border-line-2" aria-label={t("import.stopsLabel")}>
            {groups.map((g) => {
              const st = located(g);
              const a = g.input.address;
              return (
                <li key={g.key} className="flex flex-col gap-1.5 px-2.5 py-2 text-xs g:gap-1 g:px-3 g:py-1.5 g:hover:bg-[var(--hover)]">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-medium text-ink g:text-[13px] g:font-normal">
                        {a.street} {a.houseNumber ?? ""}, {a.postalCode} {a.city}
                      </div>
                      <div className="truncate text-muted g:text-[12px]">
                        {g.input.recipientName ?? "–"} · {t("import.groupParcels", { count: g.input.parcels?.length ?? 0 })}
                        {g.rows.length > 1 ? ` · ${t("import.groupMerged", { count: g.rows.length })}` : ""}
                        {g.input.type === "pickup" ? ` · ${t("import.groupPickup")}` : ""}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {st?.status === "file" && <Badge tone="success">{t("import.badge.file")}</Badge>}
                      {st?.status === "found" && <Badge tone="success">{t("import.badge.found")}</Badge>}
                      {st?.status === "street" && <Badge tone="warning" dot={isG}>{t("import.badge.street")}</Badge>}
                      {st?.status === "manual" && <Badge tone="success">{t("import.badge.manual")}</Badge>}
                      {!g.input.location && !geo[g.key]?.location && <Badge tone="warning" dot={isG}>{geo[g.key]?.status === "missing" ? t("import.badge.notFound") : t("import.badge.noLocation")}</Badge>}
                      {!g.input.location && (
                        <Button variant="ghost" size="sm" onClick={() => setFixing(fixing === g.key ? null : g.key)} aria-label={t("import.setLocationFor", { address: `${a.street} ${a.houseNumber ?? ""}` })}>
                          {geo[g.key]?.location ? t("import.change") : t("import.set")}
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
