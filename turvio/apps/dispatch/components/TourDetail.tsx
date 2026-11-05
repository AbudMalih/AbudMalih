"use client";

import { formatAddress, formatClock, formatDuration, type Stop, type TourSummary } from "@turvio/shared";
import { Avatar, Badge, Button, Sheet, cn, toast } from "@turvio/web-ui/ds";
import { AlertTriangle, ArrowUpFromLine, Check, ChevronDown, Clock, Crosshair, Gauge, MapPin, Package, Route, Sparkles, Star, Truck, Warehouse, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState, type ReactNode } from "react";
import { tourColor } from "../lib/draft";
import { optimizeTour } from "../lib/optimize";
import { useDispatch } from "../lib/store";
import { STOP_STATUS, TourStatusBadge, deadlineLabel } from "./StatusBadge";

function Fact({ icon, label, value, sub }: { icon: ReactNode; label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="flex min-w-0 items-start gap-2.5 rounded-md border border-line bg-surface px-3 py-2.5">
      <span className="mt-0.5 text-subtle [&_svg]:size-4">{icon}</span>
      <div className="min-w-0">
        <div className="text-2xs font-medium uppercase tracking-[0.06em] text-subtle">{label}</div>
        <div className="truncate text-[13px] font-medium text-ink">{value}</div>
        {sub && <div className="truncate text-2xs text-muted">{sub}</div>}
      </div>
    </div>
  );
}

function StopMarker({ stop, color, index }: { stop: Stop; color: string; index: number }) {
  const done = stop.status !== "pending";
  const failed = stop.status === "failed";
  return (
    <span
      className={cn(
        "inline-flex size-6 shrink-0 items-center justify-center text-[11px] font-semibold tabular",
        stop.type === "pickup" ? "rounded-md" : "rounded-full",
        failed ? "border-2 border-danger bg-surface text-danger-ink" : done ? "border border-line-strong bg-surface-2 text-muted" : "text-white",
      )}
      style={!done && !failed ? { backgroundColor: color } : undefined}
      aria-hidden="true"
    >
      {done && !failed ? <Check className="size-3.5" /> : failed ? <X className="size-3.5" /> : index}
    </span>
  );
}

export function StopRow({ summary, stop, index, expanded, onToggle }: { summary: TourSummary; stop: Stop; index: number; expanded: boolean; onToggle: () => void }) {
  const { scoped, setPriority } = useDispatch();
  const color = tourColor(scoped, summary.tour.id);
  const p = summary.timeline.projections.get(stop.id);
  const st = STOP_STATUS[stop.status];
  return (
    <li className={cn("rounded-md transition-colors", expanded ? "bg-surface-2/70" : "hover:bg-surface-2/50")}>
      <button type="button" onClick={onToggle} aria-expanded={expanded} className="flex w-full items-center gap-3 px-2 py-2 text-start outline-none focus-visible:shadow-[var(--shadow-focus)]">
        <StopMarker stop={stop} color={color} index={index} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className={cn("truncate text-[13px] font-medium", stop.status === "pending" ? "text-ink" : "text-muted")}>{stop.recipientName ?? formatAddress(stop)}</span>
            {stop.type === "pickup" && <ArrowUpFromLine className="size-3.5 shrink-0 text-violet-600" aria-label="Pickup" />}
            {stop.priority && <Star className="size-3.5 shrink-0 fill-amber-400 text-amber-500" aria-label="Priority" />}
          </span>
          <span className="block truncate text-xs text-muted">{formatAddress(stop)}</span>
        </span>
        <span className="shrink-0 text-end">
          <span className={cn("block text-xs font-medium tabular", p?.late ? "text-danger-ink" : p?.atRisk ? "text-warning-ink" : "text-ink-2")}>
            {p ? formatClock(p.etaMinute) : "–"}
          </span>
          <span className="block text-2xs text-subtle">{stop.status === "pending" ? "ETA" : st.label}</span>
        </span>
        <ChevronDown className={cn("size-4 shrink-0 text-subtle transition-transform", expanded && "rotate-180")} />
      </button>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }} className="overflow-hidden">
            <div className="flex flex-col gap-2 px-2 pb-3 ps-11 text-xs text-muted">
              <div className="flex flex-wrap gap-1.5">
                <Badge tone={st.tone} dot>
                  {st.label}
                </Badge>
                <Badge tone={stop.type === "pickup" ? "brand" : "outline"}>{stop.type === "pickup" ? "Pickup" : "Delivery"}</Badge>
                {p?.late && <Badge tone="danger">Window will be missed</Badge>}
                {p?.atRisk && <Badge tone="warning">Close to deadline</Badge>}
              </div>
              {stop.timeWindow && (
                <div className="flex items-center gap-1.5">
                  <Clock className="size-3.5" /> Window {formatClock(stop.timeWindow.start)}–{formatClock(stop.timeWindow.end)}
                  <span className="text-subtle">· closes {deadlineLabel(stop.timeWindow.end - scoped.asOfMinute)}</span>
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <Package className="size-3.5" /> {stop.parcels.length} {stop.parcels.length === 1 ? "parcel" : "parcels"} ·{" "}
                <span className="font-mono text-2xs">{stop.parcels.map((x) => x.trackingNumber).join(", ")}</span>
              </div>
              {stop.notes && <div>{stop.notes}</div>}
              {stop.status === "pending" && (
                <div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setPriority(stop.id, !stop.priority);
                      toast(stop.priority ? "Priority removed (draft)" : "Marked as priority (draft)");
                    }}
                  >
                    <Star className={cn(stop.priority && "fill-amber-400 text-amber-500")} />
                    {stop.priority ? "Remove priority" : "Mark as priority"}
                  </Button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}

export function TourDetail({ summary, onFit }: { summary: TourSummary; onFit?: () => void }) {
  const { selectedStopId, selectStop, setOrder, scoped } = useDispatch();
  const [busy, setBusy] = useState(false);
  const s = summary;
  const t = s.timeline;
  const startLabel = s.tour.startedAt ? `${formatClock(Number(s.tour.startedAt.slice(11, 13)) * 60 + Number(s.tour.startedAt.slice(14, 16)))} (actual)` : `${formatClock(s.tour.plannedStartMinute)} (planned)`;

  const optimize = async () => {
    setBusy(true);
    try {
      const r = await optimizeTour(s);
      setOrder(s.tour.id, r.stopIds);
      toast.success("Remaining stops re-ordered (draft)", { description: r.note });
    } catch (e) {
      toast.error("Optimization failed", { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="size-2.5 rounded-full" style={{ backgroundColor: tourColor(scoped, s.tour.id) }} aria-hidden="true" />
        <TourStatusBadge status={s.status} />
        <span className="font-mono text-2xs text-subtle">{s.tour.id}</span>
      </div>

      {t.delayReasons.length > 0 && s.tour.status !== "completed" && (
        <div className="flex gap-2.5 rounded-md border border-red-200 bg-danger-soft px-3 py-2.5 text-[13px] text-danger-ink" role="alert">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <ul className="flex flex-col gap-0.5">
            {t.delayReasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="font-medium text-ink-2">
            {s.completed} of {s.total} stops done
          </span>
          <span className="text-muted tabular">{s.total ? Math.round((s.completed / s.total) * 100) : 0}%</span>
        </div>
        <div className="flex h-2 overflow-hidden rounded-full bg-surface-3">
          <motion.div className="h-full bg-success" initial={{ width: 0 }} animate={{ width: `${s.total ? ((s.delivered) / s.total) * 100 : 0}%` }} transition={{ duration: 0.5 }} />
          <motion.div className="h-full bg-danger" initial={{ width: 0 }} animate={{ width: `${s.total ? (s.failed / s.total) * 100 : 0}%` }} transition={{ duration: 0.5 }} />
        </div>
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-2xs text-muted">
          <span>
            <span className="me-1 inline-block size-2 rounded-full bg-success" />
            {s.delivered} delivered/picked up
          </span>
          <span>
            <span className="me-1 inline-block size-2 rounded-full bg-danger" />
            {s.failed} failed
          </span>
          <span>
            <span className="me-1 inline-block size-2 rounded-full bg-surface-3" />
            {s.remaining} remaining
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Fact
          icon={<Avatar name={s.driver?.displayName ?? "?"} size="sm" className="size-4 text-[8px]" />}
          label="Driver"
          value={s.driver?.displayName ?? <span className="text-warning-ink">Not assigned</span>}
          sub={s.driver ? `${Math.round(s.driver.maxShiftMinutes / 60)} h shift · until ${formatClock(t.shiftEndMinute)}` : undefined}
        />
        <Fact icon={<Truck />} label="Vehicle" value={s.vehicleLabel ?? <span className="text-warning-ink">Not assigned</span>} sub={s.vehiclePlate ?? undefined} />
        <Fact icon={<Warehouse />} label="Start depot" value={s.depot.name} sub={formatAddress(s.depot)} />
        <Fact icon={<Clock />} label="Start" value={startLabel} sub={`Est. return ${formatClock(t.projectedEndMinute)}`} />
        <Fact icon={<Gauge />} label="Est. duration" value={formatDuration(t.durationMinutes)} sub="estimate" />
        <Fact icon={<Route />} label="Est. distance" value={`${(t.distanceMeters / 1000).toFixed(1)} km`} sub="straight-line × 1.35" />
        <Fact icon={<MapPin />} label="Stops" value={`${s.total} total`} sub={`${s.delivered} done · ${s.failed} failed`} />
        <Fact
          icon={<ArrowUpFromLine />}
          label="Pickups"
          value={`${s.pickups} scheduled`}
          sub={s.nextPickupDeadline !== null ? `next closes ${formatClock(s.nextPickupDeadline)}` : s.pickups ? "all done" : "none"}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="primary" onClick={optimize} disabled={busy || s.remaining < 2 || s.tour.status === "completed"}>
          <Sparkles />
          {busy ? "Optimizing…" : "Optimize remaining stops"}
        </Button>
        {onFit && (
          <Button variant="secondary" onClick={onFit}>
            <Crosshair /> Fit on map
          </Button>
        )}
      </div>

      <section aria-label="Stops in order">
        <div className="mb-1 flex items-baseline justify-between">
          <h3 className="text-2xs font-semibold uppercase tracking-[0.1em] text-subtle">Stops in order</h3>
          <span className="text-2xs text-subtle">ETA = estimate</span>
        </div>
        <ol className="flex flex-col">
          {s.stops.map((stop, i) => (
            <StopRow key={stop.id} summary={s} stop={stop} index={i + 1} expanded={selectedStopId === stop.id} onToggle={() => selectStop(selectedStopId === stop.id ? null : stop.id)} />
          ))}
        </ol>
      </section>
    </div>
  );
}

/** Tour detail in a side drawer (List, Planning and Pickups views). */
export function TourDetailSheet() {
  const { summaries, selectedTourId, selectTour } = useDispatch();
  const s = summaries.find((x) => x.tour.id === selectedTourId);
  return (
    <Sheet
      open={!!s}
      onOpenChange={(o) => !o && selectTour(null)}
      title={s ? `Tour ${s.tour.name}` : ""}
      description={s ? `${s.depot.name} · ${s.tour.date}` : undefined}
      className="max-w-lg"
    >
      {s && <TourDetail summary={s} />}
    </Sheet>
  );
}
