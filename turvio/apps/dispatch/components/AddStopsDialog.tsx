"use client";

import { NewStopInput, parseMinuteOfDay } from "@turvio/shared";
import { Button, Dialog, cn, toast } from "@turvio/web-ui/ds";
import { Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { errorMessage } from "../lib/api";
import { parseStopLines } from "../lib/helpers";
import { useDispatch } from "../lib/store";
import { FileImport, type FileImportState } from "./FileImport";

const inputCls =
  "h-9 w-full rounded-md border border-line bg-surface px-2.5 text-sm text-ink shadow-xs focus:border-brand-500 focus:shadow-[var(--shadow-focus)] focus:outline-none aria-[invalid=true]:border-danger";

function F({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("flex flex-col gap-1 text-[13px] font-medium text-ink-2", className)}>
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
  const { addStops, scoped } = useDispatch();
  const [mode, setMode] = useState<"single" | "paste" | "file">("single");
  const [fileState, setFileState] = useState<FileImportState>({ stops: [], blocked: true, label: "Import" });
  // Tracking numbers already on a stop this day – a file that repeats them is flagged, not silently doubled.
  const existingTracking = useMemo(
    () => new Set([...scoped.stops, ...scoped.unassigned].flatMap((s) => (s.parcels ?? []).map((p) => p.trackingNumber))),
    [scoped],
  );
  const depotLocation = useMemo(() => {
    const depotId = target.depotId ?? scoped.tours.find((t) => t.id === target.tourId)?.depotId;
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
  const parsed = useMemo(() => parseStopLines(paste, { city: defaultCity }), [paste, defaultCity]);
  const good = parsed.filter((p) => p.stop);
  const bad = parsed.filter((p) => p.error);

  const submit = async () => {
    const stops = mode === "single" ? (single.success ? [single.data] : []) : mode === "file" ? fileState.stops : good.map((g) => g.stop!);
    if (!stops.length) return;
    setBusy(true);
    try {
      // The API takes at most 500 stops per request.
      const ids: string[] = [];
      for (let i = 0; i < stops.length; i += 500) ids.push(...(await addStops(target, stops.slice(i, i + 500))));
      toast.success(`${ids.length} stop${ids.length > 1 ? "s" : ""} added to ${targetLabel}`, { description: target.tourId ? "Optimize the tour to place them in the route." : "They are waiting in the unassigned list." });
      setF({ ...EMPTY, city: defaultCity ?? "" });
      setPaste("");
      onOpenChange(false);
    } catch (e) {
      toast.error("Stops could not be saved", { description: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  };

  const canSubmit = mode === "single" ? single.success && !windowInvalid && !coordsMissing : mode === "file" ? !fileState.blocked : good.length > 0 && bad.length === 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !busy && onOpenChange(o)}
      title={`Add stops · ${targetLabel}`}
      description={mode === "file" ? "Map the columns, check the stops, find their locations, then import." : "Single stops and pasted lists need coordinates; the file import finds locations by address."}
      className="max-w-2xl"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} disabled={busy || !canSubmit}>
            {busy && <Loader2 className="animate-spin" />}
            {mode === "single" ? "Add stop" : mode === "file" ? fileState.label : `Add ${good.length} stop${good.length === 1 ? "" : "s"}`}
          </Button>
        </>
      }
    >
      <div className="mb-4 inline-flex rounded-md border border-line bg-surface-2 p-0.5" role="tablist" aria-label="Entry mode">
        {(["single", "paste", "file"] as const).map((m) => (
          <button key={m} role="tab" aria-selected={mode === m} onClick={() => setMode(m)} className={cn("h-8 rounded px-3 text-[13px] font-medium", mode === m ? "bg-surface text-ink shadow-xs" : "text-muted")}>
            {m === "single" ? "Single stop" : m === "paste" ? "Paste list" : "CSV / Excel file"}
          </button>
        ))}
      </div>
      {mode === "file" ? (
        <FileImport near={depotLocation} existingTracking={existingTracking} onChange={setFileState} />
      ) : mode === "single" ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
          <F label="Type" className="col-span-2 sm:col-span-2">
            <select className={inputCls} value={f.type} onChange={(e) => set("type", e.target.value)}>
              <option value="delivery">Delivery</option>
              <option value="pickup">Pickup</option>
            </select>
          </F>
          <F label="Recipient / customer" className="col-span-2 sm:col-span-4">
            <input className={inputCls} value={f.recipient} onChange={(e) => set("recipient", e.target.value)} />
          </F>
          <F label="Street" className="col-span-2 sm:col-span-4">
            <input className={inputCls} value={f.street} onChange={(e) => set("street", e.target.value)} required />
          </F>
          <F label="No." className="sm:col-span-2">
            <input className={inputCls} value={f.no} onChange={(e) => set("no", e.target.value)} />
          </F>
          <F label="Postcode" className="sm:col-span-2">
            <input className={inputCls} value={f.postal} onChange={(e) => set("postal", e.target.value)} inputMode="numeric" />
          </F>
          <F label="City" className="col-span-2 sm:col-span-4">
            <input className={inputCls} value={f.city} onChange={(e) => set("city", e.target.value)} />
          </F>
          <F label="Latitude" className="sm:col-span-3">
            <input className={inputCls} value={f.lat} onChange={(e) => set("lat", e.target.value)} placeholder="52.3759" inputMode="decimal" />
          </F>
          <F label="Longitude" className="sm:col-span-3">
            <input className={inputCls} value={f.lng} onChange={(e) => set("lng", e.target.value)} placeholder="9.7320" inputMode="decimal" />
          </F>
          <F label="Window from" className="sm:col-span-2">
            <input type="time" className={inputCls} value={f.from} onChange={(e) => set("from", e.target.value)} aria-invalid={windowInvalid} />
          </F>
          <F label="Window to" className="sm:col-span-2">
            <input type="time" className={inputCls} value={f.to} onChange={(e) => set("to", e.target.value)} aria-invalid={windowInvalid} />
          </F>
          <label className="flex items-end gap-2 pb-2 text-[13px] font-medium text-ink-2 sm:col-span-2">
            <input type="checkbox" checked={f.priority} onChange={(e) => set("priority", e.target.checked)} className="size-4 accent-[#2563EB]" /> Priority
          </label>
          <F label="Tracking numbers (comma or space separated)" className="col-span-2 sm:col-span-6">
            <input className={inputCls} value={f.tracking} onChange={(e) => set("tracking", e.target.value)} />
          </F>
          <F label="Notes" className="col-span-2 sm:col-span-6">
            <input className={inputCls} value={f.notes} onChange={(e) => set("notes", e.target.value)} />
          </F>
          {windowInvalid && <p className="col-span-2 text-xs text-danger-ink sm:col-span-6">The time window must end after it starts.</p>}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted">
            One stop per line, separated by <code>;</code> or tab: <code>recipient; street; no.; postcode; city; lat; lng; type; window; tracking numbers</code> – e.g.
            <br />
            <code className="text-2xs">Praxis Lang; Lister Meile; 12; 30161; Hannover; 52.3801; 9.7420; delivery; 09:00-12:00; TVO1,TVO2</code>
          </p>
          <textarea
            className={cn(inputCls, "h-48 py-2 font-mono text-xs")}
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            aria-label="Stop list"
            spellCheck={false}
          />
          <p className="text-xs text-muted" role="status">
            {parsed.length === 0 ? "No lines yet." : `${good.length} valid · ${bad.length} with errors`}
          </p>
          {bad.length > 0 && (
            <ul className="max-h-28 overflow-y-auto rounded-md border border-red-200 bg-danger-soft px-3 py-2 text-xs text-danger-ink">
              {bad.slice(0, 20).map((b) => (
                <li key={b.line}>
                  Line {b.line}: {b.error}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Dialog>
  );
}
