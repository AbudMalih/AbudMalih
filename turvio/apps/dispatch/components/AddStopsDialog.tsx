"use client";

import { NewStopInput, parseMinuteOfDay } from "@turvio/shared";
import { Button, Dialog, cn, toast } from "@turvio/web-ui/ds";
import { Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { ApiCallError, errorMessage } from "../lib/api";
import { parseStopLines } from "../lib/helpers";
import { useI18n } from "../lib/i18n/client";
import { useDispatch } from "../lib/store";
import { FileImport, ImportErrorBoundary, type FileImportState } from "./FileImport";

const inputCls =
  "h-9 w-full rounded-md border border-line bg-surface px-2.5 text-sm text-ink shadow-xs focus:border-brand-500 focus:shadow-[var(--shadow-focus)] focus:outline-none aria-[invalid=true]:border-danger g:h-8 g:border-line-2 g:bg-surface-2 g:text-[13px] g:shadow-none g:focus:border-brand-600";

function F({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("flex flex-col gap-1 text-[13px] font-medium text-ink-2 g:text-[12px] g:font-normal g:text-muted", className)}>
      {label}
      {children}
    </label>
  );
}

const EMPTY = { type: "delivery", recipient: "", street: "", no: "", postal: "", city: "", lat: "", lng: "", from: "", to: "", tracking: "", priority: false, notes: "" };

/**
 * Add stops to a tour or to a depot's unassigned list. Coordinates are entered
 * directly (or pasted) until an address-search provider is connected.
 */
export function AddStopsDialog({ open, onOpenChange, target, targetLabel, defaultCity }: { open: boolean; onOpenChange: (o: boolean) => void; target: { tourId?: string; depotId?: string }; targetLabel: string; defaultCity?: string }) {
  const { addStops, scoped, session } = useDispatch();
  const { t, tr } = useI18n();
  const [mode, setMode] = useState<"single" | "paste" | "file">("single");
  const [fileState, setFileState] = useState<FileImportState>(() => ({ stops: [], blocked: true, label: t("planning.import") }));
  // Bumped after a refused save: the import checks its tracking numbers against TURVIO again.
  const [recheck, setRecheck] = useState(0);
  const [importKey, setImportKey] = useState(0);
  const depotLocation = useMemo(() => {
    const depotId = target.depotId ?? scoped.tours.find((x) => x.id === target.tourId)?.depotId;
    return scoped.depots.find((d) => d.id === depotId)?.location;
  }, [scoped, target]);
  const [f, setF] = useState({ ...EMPTY, city: defaultCity ?? "" });
  const [paste, setPaste] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof EMPTY, v: string | boolean) => setF((x) => ({ ...x, [k]: v }));

  const single = useMemo(() => {
    const from = f.from ? parseMinuteOfDay(f.from) : null;
    const to = f.to ? parseMinuteOfDay(f.to) : null;
    const coords = f.lat && f.lng ? { lat: Number(f.lat.replace(",", ".")), lng: Number(f.lng.replace(",", ".")) } : null;
    return NewStopInput.safeParse({
      type: f.type,
      recipientName: f.recipient || undefined,
      address: { street: f.street, houseNumber: f.no || undefined, postalCode: f.postal, city: f.city },
      location: coords,
      timeWindow: from != null && to != null ? { start: from, end: to } : undefined,
      priority: f.priority,
      notes: f.notes || undefined,
      trackingNumbers: f.tracking.split(/[\s,;]+/).filter(Boolean),
    });
  }, [f]);
  const windowInvalid = (!!f.from || !!f.to) && (parseMinuteOfDay(f.from) == null || parseMinuteOfDay(f.to) == null || parseMinuteOfDay(f.to)! <= parseMinuteOfDay(f.from)!);
  const coordsMissing = !f.lat || !f.lng || !single.success || !single.data.location;
  const parsed = useMemo(() => parseStopLines(paste, { city: defaultCity }, t), [paste, defaultCity, t]);
  const good = parsed.filter((p) => p.stop);
  const bad = parsed.filter((p) => p.error);

  const submit = async () => {
    const stops = mode === "single" ? (single.success ? [single.data] : []) : mode === "file" ? fileState.stops : good.map((g) => g.stop!);
    if (!stops.length) return;
    setBusy(true);
    try {
      // The API takes at most 500 stops per request. File imports are checked for parcels that are
      // already planned (company-wide); the server refuses the whole request if any are.
      const ids: string[] = [];
      // The channel is recorded with each stop's original location (P0-3.2).
      const provenance = mode === "single" ? "dispatch_manual" : mode === "file" ? "import_file" : "import_paste";
      for (let i = 0; i < stops.length; i += 500) ids.push(...(await addStops(target, stops.slice(i, i + 500), { rejectPlannedTracking: mode === "file", provenance })));
      toast.success(t("planning.addedToast", { count: ids.length, target: targetLabel }), { description: target.tourId ? t("planning.addedTourDesc") : t("planning.addedUnassignedDesc") });
      setF({ ...EMPTY, city: defaultCity ?? "" });
      setPaste("");
      onOpenChange(false);
    } catch (e) {
      if (mode === "file" && e instanceof ApiCallError && (e.code === "tracking_already_planned" || e.code === "tracking_duplicated_in_request")) {
        // Someone imported some of these parcels meanwhile: show them in the import, keep the dialog open.
        setRecheck((n) => n + 1);
        toast.error(t("planning.nothingSaved"), { description: t("planning.nothingSavedDesc", { message: e.message }) });
      } else toast.error(t("planning.stopsNotSaved"), { description: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  };

  const canSubmit = mode === "single" ? single.success && !windowInvalid && !coordsMissing : mode === "file" ? !fileState.blocked : good.length > 0 && bad.length === 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !busy && onOpenChange(o)}
      title={t("planning.addStopsTitle", { target: targetLabel })}
      description={mode === "file" ? t("planning.fileDesc") : t("planning.manualDesc")}
      className="max-w-2xl"
      footer={
        <>
          {mode === "file" && fileState.reason && (
            <span className="me-auto self-center text-xs text-muted" role="status">
              {fileState.reason}
            </span>
          )}
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={busy}>
            {t("common.cancel")}
          </Button>
          <Button variant="primary" onClick={submit} disabled={busy || !canSubmit}>
            {busy && <Loader2 className="animate-spin" />}
            {mode === "single" ? t("planning.addStop") : mode === "file" ? fileState.label : t("planning.addN", { count: good.length })}
          </Button>
        </>
      }
    >
      <div className="mb-4 inline-flex rounded-md border border-line bg-surface-2 p-0.5 g:border-line-2 g:bg-transparent" role="tablist" aria-label={t("planning.entryMode")}>
        {(["single", "paste", "file"] as const).map((m) => (
          <button key={m} role="tab" aria-selected={mode === m} onClick={() => setMode(m)} className={cn("h-8 rounded px-3 text-[13px] font-medium g:h-7 g:px-2.5 g:font-normal", mode === m ? "bg-surface text-ink shadow-xs g:bg-[var(--selected)] g:shadow-none" : "text-muted g:hover:bg-[var(--hover)] g:hover:text-ink")}>
            {t(`planning.mode.${m}`)}
          </button>
        ))}
      </div>
      {mode === "file" ? (
        <ImportErrorBoundary
          onReset={() => {
            setImportKey((k) => k + 1);
            setFileState({ stops: [], blocked: true, label: t("planning.import") });
          }}
        >
          <FileImport key={importKey} near={depotLocation} organizationId={session.organizationId} recheck={recheck} onChange={setFileState} />
        </ImportErrorBoundary>
      ) : mode === "single" ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
          <F label={t("planning.type")} className="col-span-2 sm:col-span-2">
            <select className={inputCls} value={f.type} onChange={(e) => set("type", e.target.value)}>
              <option value="delivery">{t("common.stopType.delivery")}</option>
              <option value="pickup">{t("common.stopType.pickup")}</option>
            </select>
          </F>
          <F label={t("planning.recipient")} className="col-span-2 sm:col-span-4">
            <input className={inputCls} value={f.recipient} onChange={(e) => set("recipient", e.target.value)} />
          </F>
          <F label={t("planning.street")} className="col-span-2 sm:col-span-4">
            <input className={inputCls} value={f.street} onChange={(e) => set("street", e.target.value)} required />
          </F>
          <F label={t("planning.houseNo")} className="sm:col-span-2">
            <input className={inputCls} value={f.no} onChange={(e) => set("no", e.target.value)} />
          </F>
          <F label={t("planning.postcode")} className="sm:col-span-2">
            <input dir="ltr" className={inputCls} value={f.postal} onChange={(e) => set("postal", e.target.value)} inputMode="numeric" />
          </F>
          <F label={t("planning.city")} className="col-span-2 sm:col-span-4">
            <input className={inputCls} value={f.city} onChange={(e) => set("city", e.target.value)} />
          </F>
          <F label={t("planning.latitude")} className="sm:col-span-3">
            <input dir="ltr" className={inputCls} value={f.lat} onChange={(e) => set("lat", e.target.value)} placeholder="52.3759" inputMode="decimal" />
          </F>
          <F label={t("planning.longitude")} className="sm:col-span-3">
            <input dir="ltr" className={inputCls} value={f.lng} onChange={(e) => set("lng", e.target.value)} placeholder="9.7320" inputMode="decimal" />
          </F>
          <F label={t("planning.windowFrom")} className="sm:col-span-2">
            <input dir="ltr" type="time" className={inputCls} value={f.from} onChange={(e) => set("from", e.target.value)} aria-invalid={windowInvalid} />
          </F>
          <F label={t("planning.windowTo")} className="sm:col-span-2">
            <input dir="ltr" type="time" className={inputCls} value={f.to} onChange={(e) => set("to", e.target.value)} aria-invalid={windowInvalid} />
          </F>
          <label className="flex items-end gap-2 pb-2 text-[13px] font-medium text-ink-2 sm:col-span-2 g:font-normal">
            <input type="checkbox" checked={f.priority} onChange={(e) => set("priority", e.target.checked)} className="size-4 accent-[var(--violet)]" /> {t("planning.priority")}
          </label>
          <F label={t("planning.trackingNumbers")} className="col-span-2 sm:col-span-6">
            <input dir="ltr" className={inputCls} value={f.tracking} onChange={(e) => set("tracking", e.target.value)} />
          </F>
          <F label={t("planning.notes")} className="col-span-2 sm:col-span-6">
            <input className={inputCls} value={f.notes} onChange={(e) => set("notes", e.target.value)} />
          </F>
          {windowInvalid && <p className="col-span-2 text-xs text-danger-ink sm:col-span-6">{t("planning.windowInvalid")}</p>}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted">
            {tr("planning.pasteHelp", { semi: <code>;</code>, format: <code>{t("planning.pasteFormat")}</code> })}
            <br />
            <code dir="ltr" className="text-2xs">Praxis Lang; Lister Meile; 12; 30161; Hannover; 52.3801; 9.7420; delivery; 09:00-12:00; TVO1,TVO2</code>
          </p>
          <textarea
            className={cn(inputCls, "h-48 py-2 font-mono text-xs g:h-48 g:text-xs")}
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            aria-label={t("planning.stopList")}
            dir="ltr"
            spellCheck={false}
          />
          <p className="text-xs text-muted" role="status">
            {parsed.length === 0 ? t("planning.noLines") : t("planning.validErrors", { good: good.length, bad: bad.length })}
          </p>
          {bad.length > 0 && (
            <ul className="max-h-28 overflow-y-auto rounded-md border border-nx-coral/30 bg-danger-soft px-3 py-2 text-xs text-danger-ink g:border-line-2 g:bg-transparent">
              {bad.slice(0, 20).map((b) => (
                <li key={b.line}>
                  {t("planning.lineError", { line: b.line, error: b.error })}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Dialog>
  );
}
