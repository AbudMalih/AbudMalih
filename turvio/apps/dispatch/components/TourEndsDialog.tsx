"use client";

import type { Depot, Tour, TourEndMode } from "@turvio/shared";
import { Button, Dialog, cn, toast } from "@turvio/web-ui/ds";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { errorMessage } from "../lib/api";
import { useDispatch } from "../lib/store";
import { AddressSearch, type PickedPlace } from "./AddressSearch";

export type TourEndsPatch = {
  start?: { lat: number; lng: number; label?: string | null } | null;
  end?: { mode: "depot" } | { mode: "last_stop" } | { mode: "address"; lat: number; lng: number; label?: string | null };
};

const placeOf = (loc: { lat: number; lng: number } | undefined, label: string | null | undefined): PickedPlace | null =>
  loc ? { ...loc, label: label ?? `${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}` } : null;

/** Effective end mode (older tours without endMode: an end point means "address"). */
export const endModeOf = (t: Tour): TourEndMode => t.endMode ?? (t.endLocation ? "address" : "depot");

/** One-line summary for cards: "Depot → last stop". */
export function tourEndsSummary(t: Tour, depot: Depot): string {
  const start = t.startLocation ? (t.startLabel ?? "own start address") : depot.name;
  const mode = endModeOf(t);
  const end = mode === "last_stop" ? "last stop" : mode === "address" ? (t.endLabel ?? "own end address") : depot.name;
  return `${start} → ${end}`;
}

function Choice<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: string; hint: string }[]; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="grid gap-1.5 sm:grid-cols-3">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn("rounded-md border px-2.5 py-2 text-start text-sm", value === o.value ? "border-brand-500 bg-brand-50 text-ink" : "border-line text-ink-2 hover:bg-surface-2")}
        >
          <div className="font-medium">{o.label}</div>
          <div className="text-2xs text-muted">{o.hint}</div>
        </button>
      ))}
    </div>
  );
}

function PlaceField({ place, onChange, near }: { place: PickedPlace | null; onChange: (p: PickedPlace | null) => void; near: { lat: number; lng: number } }) {
  if (place)
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border border-line bg-surface-2/60 px-2.5 py-2 text-sm">
        <span className="min-w-0 truncate text-ink" title={place.label}>
          {place.label}
        </span>
        <Button variant="ghost" size="sm" onClick={() => onChange(null)}>
          Change
        </Button>
      </div>
    );
  return <AddressSearch near={near} onPick={onChange} autoFocus />;
}

/**
 * Where a tour starts and ends. Used by optimization, the road route and the live ETA.
 * "Last stop" = no return trip (the driver ends the day at the last delivery).
 */
export function TourEndsDialog({ tour, depot, open, onOpenChange }: { tour: Tour; depot: Depot; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { updateTour } = useDispatch();
  const [startMode, setStartMode] = useState<"depot" | "address">(tour.startLocation ? "address" : "depot");
  const [start, setStart] = useState<PickedPlace | null>(placeOf(tour.startLocation, tour.startLabel));
  const [endMode, setEndMode] = useState<TourEndMode>(endModeOf(tour));
  const [end, setEnd] = useState<PickedPlace | null>(placeOf(tour.endLocation, tour.endLabel));
  const [busy, setBusy] = useState(false);
  const invalid = (startMode === "address" && !start) || (endMode === "address" && !end);

  const save = async () => {
    const patch: TourEndsPatch = {
      start: startMode === "address" && start ? { lat: start.lat, lng: start.lng, label: start.label } : null,
      end: endMode === "address" && end ? { mode: "address", lat: end.lat, lng: end.lng, label: end.label } : endMode === "last_stop" ? { mode: "last_stop" } : { mode: "depot" },
    };
    setBusy(true);
    try {
      await updateTour(tour, patch);
      toast.success(`Start and end saved for ${tour.name}`, { description: "Optimize the tour again to plan with the new start and end." });
      onOpenChange(false);
    } catch (e) {
      toast.error("Start and end not saved", { description: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !busy && onOpenChange(o)}
      title={`Start and end · ${tour.name}`}
      description="Used for optimization, the road route and the live ETA."
      className="max-w-2xl"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void save()} disabled={busy || invalid}>
            {busy && <Loader2 className="animate-spin" />}
            Save
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <section className="flex flex-col gap-2">
          <h3 className="text-[13px] font-semibold text-ink">Start</h3>
          <Choice
            label="Start"
            value={startMode}
            onChange={setStartMode}
            options={[
              { value: "depot", label: "Depot", hint: depot.name },
              { value: "address", label: "Other address", hint: "e.g. a hub or the driver's home" },
            ]}
          />
          {startMode === "address" && <PlaceField place={start} onChange={setStart} near={depot.location} />}
          <p className="text-2xs text-muted">While the tour is driven, the vehicle's live position (if fresh) or the last completed stop is used instead.</p>
        </section>
        <section className="flex flex-col gap-2">
          <h3 className="text-[13px] font-semibold text-ink">End</h3>
          <Choice
            label="End"
            value={endMode}
            onChange={setEndMode}
            options={[
              { value: "depot", label: "Back to depot", hint: depot.name },
              { value: "address", label: "Other address", hint: "e.g. a second depot" },
              { value: "last_stop", label: "At the last stop", hint: "No return trip" },
            ]}
          />
          {endMode === "address" && <PlaceField place={end} onChange={setEnd} near={depot.location} />}
        </section>
      </div>
    </Dialog>
  );
}
