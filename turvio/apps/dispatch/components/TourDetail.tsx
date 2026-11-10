"use client";

import { formatAddress, formatClock, formatDuration, isNotDelivered, isOpen, minuteOfDay, type Stop, type TourSummary } from "@turvio/shared";
import { Avatar, Badge, Button, Sheet, cn, toast } from "@turvio/web-ui/ds";
import {
  AlertTriangle,
  ArrowUpFromLine,
  Check,
  ChevronDown,
  Clock,
  Crosshair,
  EyeOff,
  Flag,
  Gauge,
  History,
  Loader2,
  MapPin,
  Package,
  Plus,
  Route,
  Send,
  Sparkles,
  Star,
  Trash2,
  Truck,
  Warehouse,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState, type ReactNode } from "react";
import { api, errorMessage } from "../lib/api";
import { basisLabel, conditionLabel, finishTitle, finishValue, minutes, projectionNote, stopStateLabel } from "../lib/eta";
import { tourColor } from "../lib/helpers";
import { routeKey, useRoadRoute } from "../lib/road";
import { optimizeNotes, optimizeProblems } from "../lib/optimize";
import { useDispatch, type OptimizeMeta } from "../lib/store";
import { AddStopsDialog } from "./AddStopsDialog";
import { ConfirmDialog } from "./ConfirmDialog";
import { ProofList } from "./ProofViewer";
import { StopEditActions } from "./StopEditActions";
import { FAILURE_REASON, STOP_STATUS, TourStatusBadge, deadlineLabel } from "./StatusBadge";

function Fact({ icon, label, value, sub }: { icon: ReactNode; label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="flex min-w-0 items-start gap-2.5 rounded-md border border-line bg-surface px-3 py-2.5">
      <span className="mt-0.5 text-subtle [&_svg]:size-4">{icon}</span>
      <div className="min-w-0">
        <div className="text-2xs font-medium uppercase tracking-[0.06em] text-subtle">{label}</div>
        <div className="truncate text-[13px] font-medium text-ink">{value}</div>
        {sub && <div className="line-clamp-3 text-2xs text-muted">{sub}</div>}
      </div>
    </div>
  );
}

function StopMarker({ stop, color, index }: { stop: Stop; color: string; index: number }) {
  const done = !isOpen(stop.status);
  const failed = isNotDelivered(stop.status);
  return (
    <span
      className={cn(
        "inline-flex size-6 shrink-0 items-center justify-center text-[11px] font-semibold tabular",
        stop.type === "pickup" ? "rounded-md" : "rounded-full",
        failed ? "border-2 border-danger bg-surface text-danger-ink" : done ? "border border-line-strong bg-surface-2 text-muted" : "text-white",
        stop.status === "in_progress" && "ring-2 ring-brand-300 ring-offset-1",
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
  const [busy, setBusy] = useState(false);
  const color = tourColor(scoped, summary.tour.id);
  // ETA, colour and warning all come from the one projection of this tour.
  const proj = summary.timeline.projection;
  const p = summary.timeline.projections.get(stop.id);
  const warn = p ? stopStateLabel(p.state, proj.source) : null;
  const hasEta = p !== undefined && Number.isFinite(p.etaMinute);
  const st = STOP_STATUS[stop.status];
  return (
    <li className={cn("rounded-md transition-colors", expanded ? "bg-surface-2/70" : "hover:bg-surface-2/50")}>
      <button type="button" onClick={onToggle} aria-expanded={expanded} className="flex w-full items-center gap-3 px-2 py-2 text-start outline-none focus-visible:shadow-[var(--shadow-focus)]">
        <StopMarker stop={stop} color={color} index={index} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className={cn("truncate text-[13px] font-medium", isOpen(stop.status) ? "text-ink" : "text-muted")}>{stop.recipientName ?? formatAddress(stop)}</span>
            {stop.type === "pickup" && <ArrowUpFromLine className="size-3.5 shrink-0 text-violet-600" aria-label="Pickup" />}
            {stop.priority && <Star className="size-3.5 shrink-0 fill-amber-400 text-amber-500" aria-label="Priority" />}
          </span>
          <span className="block truncate text-xs text-muted">{formatAddress(stop)}</span>
        </span>
        <span className="shrink-0 text-end">
          <span className={cn("block text-xs font-medium tabular", warn?.tone === "danger" ? "text-danger-ink" : warn?.tone === "warning" ? "text-warning-ink" : "text-ink-2")} data-testid="stop-eta">
            {hasEta ? formatClock(p!.etaMinute) : "–"}
          </span>
          <span className={cn("block text-2xs", isNotDelivered(stop.status) ? "text-danger-ink" : "text-subtle")}>
            {isOpen(stop.status) ? (proj.source === "estimate" ? "ETA (est.)" : "ETA") : st.label}
          </span>
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
                {warn && (
                  <Badge tone={warn.tone} data-testid="stop-deadline-state">
                    {warn.label}
                    {p && p.lateMinutes > 0 && p.state !== "unknown" ? ` · ${Math.round(p.lateMinutes)} min` : ""}
                  </Badge>
                )}
                {!stop.location && <Badge tone="danger">No map position</Badge>}
              </div>
              {stop.failureReason && (
                <div className="font-medium text-danger-ink" data-testid="failure-reason">
                  Reason: {FAILURE_REASON[stop.failureReason] ?? stop.failureReason}
                </div>
              )}
              {stop.timeWindow && (
                <div className="flex items-center gap-1.5">
                  <Clock className="size-3.5" /> Window {formatClock(stop.timeWindow.start)}–{formatClock(stop.timeWindow.end)}
                  {isOpen(stop.status) && <span className="text-subtle">· closes {deadlineLabel(stop.timeWindow.end - scoped.asOfMinute)}</span>}
                </div>
              )}
              {stop.parcels.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <Package className="size-3.5" /> {stop.parcels.length} {stop.parcels.length === 1 ? "parcel" : "parcels"}
                  {stop.parcels.some((x) => x.loadedAt) && (
                    <Badge tone="success">
                      {stop.parcels.filter((x) => x.loadedAt).length}/{stop.parcels.length} scanned in
                    </Badge>
                  )}
                  · <span className="font-mono text-2xs">{stop.parcels.map((x) => x.trackingNumber).join(", ")}</span>
                </div>
              )}
              {stop.notes && <div>{stop.notes}</div>}
              {stop.driverNotes && (
                <div className="rounded-md border border-line bg-surface px-2.5 py-1.5 text-ink-2" data-testid="driver-note">
                  <span className="text-2xs font-semibold uppercase tracking-[0.06em] text-subtle">Driver note</span>
                  <div>{stop.driverNotes}</div>
                </div>
              )}
              {(stop.proofs?.length ?? 0) > 0 && <ProofList stop={stop} />}
              {summary.tour.status !== "completed" && <StopEditActions summary={summary} stop={stop} />}
              {stop.status === "pending" && summary.tour.status !== "completed" && (
                <div>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        await setPriority(stop.id, !stop.priority);
                        toast.success(stop.priority ? "Priority removed" : "Marked as priority", { description: "Re-optimize to apply it to the route." });
                      } catch (e) {
                        toast.error("Could not change priority", { description: errorMessage(e) });
                      } finally {
                        setBusy(false);
                      }
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

interface TourEvent {
  source: "tour" | "stop";
  kind: string;
  detail: { notes?: string | null; failureReason?: string | null; applied?: boolean; recipientName?: string | null } | null;
  at: string;
}

const EVENT_LABEL: Record<string, string> = {
  created: "Tour created",
  assigned: "Driver/vehicle assigned",
  optimized: "Route optimized",
  published: "Published to driver",
  unpublished: "Withdrawn from driver",
  started: "Driver started the tour",
  paused: "Tour paused",
  resumed: "Tour resumed",
  completed: "Tour completed",
  delivered: "Stop delivered",
  picked_up: "Pickup collected",
  failed: "Stop failed",
  attempted: "Delivery attempted",
  rescheduled: "Stop rescheduled",
  returned: "Parcel returned",
  skipped: "Stop skipped",
  in_progress: "Driver arrived",
  pending: "Stop reopened",
  note: "Driver note",
  proof_photo: "Delivery photo captured",
  proof_signature: "Signature captured",
};

function Activity({ tourId, version, stopsDone }: { tourId: string; version?: number; stopsDone: number }) {
  const { session } = useDispatch();
  const [events, setEvents] = useState<TourEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    api<TourEvent[]>("GET", `/v1/orgs/${session.organizationId}/tours/${tourId}/events`)
      .then((e) => !cancelled && (setEvents(e), setError(null)))
      .catch((e) => !cancelled && setError(errorMessage(e)));
    return () => {
      cancelled = true;
    };
  }, [session.organizationId, tourId, version, stopsDone]);
  return (
    <section aria-label="Activity">
      <h3 className="mb-2 flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-[0.1em] text-subtle">
        <History className="size-3.5" /> Activity
      </h3>
      {error ? (
        <p className="text-xs text-danger-ink">{error}</p>
      ) : !events ? (
        <p className="flex items-center gap-2 text-xs text-muted">
          <Loader2 className="size-3.5 animate-spin" /> Loading…
        </p>
      ) : (
        <ol className="flex flex-col gap-1.5">
          {events.slice(0, 12).map((e, i) => (
            <li key={i} className="flex items-baseline justify-between gap-3 text-xs">
              <span className={cn("text-ink-2", ["failed", "attempted", "returned"].includes(e.kind) && "text-danger-ink", e.detail?.applied === false && "line-through opacity-60")}>
                {EVENT_LABEL[e.kind] ?? e.kind}
                {e.detail?.failureReason ? <span className="text-muted"> ({FAILURE_REASON[e.detail.failureReason] ?? e.detail.failureReason})</span> : null}
                {e.detail?.recipientName ? <span className="text-muted"> – {e.detail.recipientName}</span> : null}
                {e.detail?.notes ? <span className="text-muted"> – {e.detail.notes}</span> : null}
                {e.detail?.applied === false ? <span className="text-subtle"> (late offline update, not applied)</span> : null}
              </span>
              <time className="shrink-0 text-2xs text-subtle tabular" dateTime={e.at}>
                {new Date(e.at).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
              </time>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function TourDetail({ summary, onFit }: { summary: TourSummary; onFit?: () => void }) {
  const { selectedStopId, selectStop, scoped, optimizeTour, publishTour, unpublishTour, deleteTour, selectTour, session } = useDispatch();
  const [busy, setBusy] = useState<null | "optimize">(null);
  const [confirm, setConfirm] = useState<null | "publish" | "withdraw" | "delete">(null);
  const [adding, setAdding] = useState(false);
  const s = summary;
  const t = s.timeline;
  const tz = scoped.timeZone;
  const started = minuteOfDay(s.tour.startedAt, tz);
  const startLabel = started !== null ? `${formatClock(started)} (actual)` : `${formatClock(s.tour.plannedStartMinute)} (planned)`;
  const open = s.tour.status !== "completed";
  const canManage = session.role !== "driver";
  // The map line still comes from the route endpoint; every figure comes from the projection.
  const road = useRoadRoute(session.organizationId, s.tour.id, routeKey(s.stops));
  const proj = t.projection;

  const active = s.tour.status === "in_progress" || s.tour.status === "paused";
  const [preview, setPreview] = useState<OptimizeMeta | null>(null);

  const optimize = async () => {
    setBusy("optimize");
    try {
      if (active) {
        // A tour on the road is never re-sequenced without the dispatcher seeing the new plan.
        setPreview((await optimizeTour(s.tour, { apply: false })).result);
        return;
      }
      const r = (await optimizeTour(s.tour)).result;
      const problems = optimizeProblems(r);
      (problems.length ? toast.warning : toast.success)(problems.length ? "Route optimized – not every constraint can be met" : "Route optimized and saved", {
        description: [...problems, ...optimizeNotes(r)].join(" · "),
      });
    } catch (e) {
      toast.error("Optimization failed", { description: errorMessage(e) });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="size-2.5 rounded-full" style={{ backgroundColor: tourColor(scoped, s.tour.id) }} aria-hidden="true" />
        <TourStatusBadge status={s.status} certainty={s.delayCertainty} />
        {s.tour.origin === "driver" && <Badge tone="outline">Driver's own route</Badge>}
        {s.tour.publishedAt ? (
          <Badge tone="success">
            <Send className="size-3" /> Published
          </Badge>
        ) : (
          <Badge tone="outline">
            <EyeOff className="size-3" /> Not published
          </Badge>
        )}
      </div>

      {!s.tour.publishedAt && open && (
        <div className="rounded-md border border-dashed border-line-strong bg-surface-2/60 px-3 py-2.5 text-[13px] text-ink-2">
          The driver cannot see this tour yet. {s.tour.driverId ? "Publish it when the plan is ready." : "Assign a driver, then publish."}
        </div>
      )}

      {proj.delayReasons.length > 0 && open && (
        <div
          className={cn(
            "flex gap-2.5 rounded-md border px-3 py-2.5 text-[13px]",
            s.delayCertainty === "estimated" ? "border-amber-200 bg-warning-soft text-warning-ink" : "border-red-200 bg-danger-soft text-danger-ink",
          )}
          role="alert"
          data-testid="delay-reasons"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <ul className="flex flex-col gap-0.5">
            {proj.delayReasons.map((r) => (
              <li key={r.kind}>{r.text}</li>
            ))}
          </ul>
        </div>
      )}
      {open && (conditionLabel(proj) || !proj.complete || proj.source === "estimate") && (
        <div className="rounded-md border border-line bg-surface-2/60 px-3 py-2 text-xs text-ink-2" data-testid="projection-notice">
          {conditionLabel(proj) && <p>{conditionLabel(proj)}.</p>}
          {!proj.complete && (
            <p>
              Times are incomplete: {proj.unlocatedStopIds.length} stop{proj.unlocatedStopIds.length > 1 ? "s have" : " has"} no map position (
              {proj.unlocatedStopIds
                .map((id) => s.stops.find((x) => x.id === id))
                .map((x) => (x ? (x.recipientName ?? formatAddress(x)) : ""))
                .slice(0, 3)
                .join(", ")}
              {proj.unlocatedStopIds.length > 3 ? " …" : ""}) – the finish shown is the earliest possible.
            </p>
          )}
          {proj.source === "estimate" && <p>{basisLabel(proj)} – figures are not road values.</p>}
        </div>
      )}

      <div>
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="font-medium text-ink-2" data-testid="tour-progress">
            {s.completed} of {s.total} stops done
          </span>
          <span className="text-muted tabular">{s.total ? Math.round((s.completed / s.total) * 100) : 0}%</span>
        </div>
        <div className="flex h-2 overflow-hidden rounded-full bg-surface-3">
          <motion.div className="h-full bg-success" initial={false} animate={{ width: `${s.total ? (s.delivered / s.total) * 100 : 0}%` }} transition={{ duration: 0.5 }} />
          <motion.div className="h-full bg-danger" initial={false} animate={{ width: `${s.total ? (s.failed / s.total) * 100 : 0}%` }} transition={{ duration: 0.5 }} />
        </div>
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-2xs text-muted">
          <span>
            <span className="me-1 inline-block size-2 rounded-full bg-success" />
            {s.delivered} delivered/picked up
          </span>
          <span>
            <span className="me-1 inline-block size-2 rounded-full bg-danger" />
            {s.failed} not delivered
          </span>
          <span>
            <span className="me-1 inline-block size-2 rounded-full bg-surface-3" />
            {s.remaining} remaining
          </span>
        </div>
      </div>

      {road?.routingError ? (
        <div role="alert" data-testid="routing-warning" className="rounded-md bg-warning-soft px-3 py-2 text-xs text-warning-ink">
          <p className="font-semibold">
            {road.routingError.code === "routing_out_of_coverage" ? "Road routing does not cover this tour" : "Road routing is unavailable"}
          </p>
          <p>
            {road.routingError.code === "routing_out_of_coverage"
              ? `${road.routingError.depotAffected ? "The depot and " : ""}${road.routingError.stopIds?.length ?? 0} stop(s) lie outside the road map data. `
              : ""}
            The map shows straight lines; distances and times below are estimates, not road values.
          </p>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        <Fact
          icon={<Avatar name={s.driver?.displayName ?? "?"} size="sm" className="size-4 text-[8px]" />}
          label="Driver"
          value={s.driver?.displayName ?? <span className="text-warning-ink">Not assigned</span>}
          sub={s.driver ? `${Math.round(s.driver.maxShiftMinutes / 60)} h shift · until ${formatClock(t.shiftEndMinute)}` : undefined}
        />
        <Fact icon={<Truck />} label="Vehicle" value={s.vehicleLabel ?? <span className="text-warning-ink">Not assigned</span>} sub={s.vehiclePlate ?? undefined} />
        <Fact icon={<Warehouse />} label="Start depot" value={s.depot.name} sub={formatAddress(s.depot)} />
        <Fact icon={<Clock />} label="Start" value={startLabel} />
        <Fact
          icon={<Flag />}
          label={open ? finishTitle(s.tour, proj) : "Finished"}
          value={<span data-testid="tour-finish">{open ? finishValue(proj) : formatClock(t.projectedEndMinute)}</span>}
          sub={open ? <span data-testid="projection-basis">{projectionNote(proj)}</span> : undefined}
        />
        <Fact
          icon={<Gauge />}
          label={proj.source === "road" ? "Driving time (road)" : "Driving time (estimate)"}
          value={minutes(proj.totalDriveSeconds)}
          sub={open ? `${minutes(proj.remainingDriveSeconds)} remaining · service ${minutes(proj.remainingServiceSeconds)}${proj.remainingWaitSeconds > 60 ? ` · waiting ${minutes(proj.remainingWaitSeconds)}` : ""}` : undefined}
        />
        <Fact
          icon={<Route />}
          label={proj.source === "road" ? "Distance (road)" : "Distance (estimate)"}
          value={`${(proj.totalMeters / 1000).toFixed(1)} km total`}
          sub={open ? `${(proj.remainingMeters / 1000).toFixed(1)} km remaining` : undefined}
        />
        <Fact icon={<MapPin />} label="Stops" value={`${s.total} total`} sub={`${s.delivered} done · ${s.failed} not delivered`} />
        <Fact
          icon={<ArrowUpFromLine />}
          label="Pickups"
          value={`${s.pickups} scheduled`}
          sub={s.nextPickupDeadline !== null ? `next closes ${formatClock(s.nextPickupDeadline)}` : s.pickups ? "all done" : "none"}
        />
      </div>

      {s.tour.optimization && (
        <p className="text-2xs text-muted">
          {road?.source === "none" && road.note ? <span className="block">{road.note}</span> : null}
          Last optimized {s.tour.optimizedAt ? new Date(s.tour.optimizedAt).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) : ""} ·{" "}
          {s.tour.optimization.matrixSource === "osrm" ? "road network" : "straight-line estimate"}
        </p>
      )}

      {canManage && open && (
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={optimize} disabled={busy !== null || s.remaining < 2}>
            {busy === "optimize" ? <Loader2 className="animate-spin" /> : <Sparkles />}
            {busy === "optimize" ? "Optimizing…" : active ? "Re-optimize…" : "Optimize & save"}
          </Button>
          <ConfirmDialog
            open={preview !== null}
            onOpenChange={(o) => !o && setPreview(null)}
            title="Apply the new stop order?"
            description={
              preview && (
                <div className="flex flex-col gap-2">
                  <p>
                    {s.tour.name} is being driven. The driver&apos;s remaining stops will be re-sequenced; completed stops and proofs are not touched,
                    locked stops keep their place. The driver sees the new order with the next sync.
                  </p>
                  <p className="font-medium text-ink-1">
                    {preview.driveSeconds != null ? `Driving ${formatDuration(preview.driveSeconds)}` : null}
                    {preview.distanceMeters ? ` · ${(preview.distanceMeters / 1000).toFixed(1)} km` : null}
                    {preview.endMinute != null ? ` · ${proj.endsAtLastStop ? "finish at last stop" : "back by"} ${formatClock(Math.round(preview.endMinute))}` : null}
                  </p>
                  {optimizeProblems(preview).map((p) => (
                    <p key={p} className="text-warning-ink">
                      {p}
                    </p>
                  ))}
                  <p className="text-ink-3">{optimizeNotes(preview).join(" · ")}</p>
                </div>
              )
            }
            confirmLabel="Apply new order"
            onConfirm={async () => {
              try {
                const r = (await optimizeTour(s.tour, { confirmActive: true })).result;
                toast.success("New stop order applied", { description: [...optimizeProblems(r), ...optimizeNotes(r)].join(" · ") });
              } catch (e) {
                toast.error("Optimization failed", { description: errorMessage(e) });
                throw e;
              }
            }}
          />
          {s.tour.origin === "driver" && <Badge tone="outline">Driver's own route</Badge>}
        {s.tour.publishedAt ? (
            s.tour.status === "planned" && (
              <Button variant="secondary" onClick={() => setConfirm("withdraw")}>
                <EyeOff /> Withdraw
              </Button>
            )
          ) : (
            <Button variant="dark" onClick={() => setConfirm("publish")} disabled={!s.tour.driverId || s.total === 0} title={!s.tour.driverId ? "Assign a driver first" : s.total === 0 ? "Add stops first" : undefined}>
              <Send /> Publish to driver
            </Button>
          )}
          <Button variant="secondary" onClick={() => setAdding(true)}>
            <Plus /> Add stops
          </Button>
          {onFit && (
            <Button variant="ghost" onClick={onFit}>
              <Crosshair /> Fit on map
            </Button>
          )}
          {s.tour.status === "planned" && !s.tour.publishedAt && (
            <Button variant="ghost" className="text-danger-ink" onClick={() => setConfirm("delete")}>
              <Trash2 /> Delete
            </Button>
          )}
        </div>
      )}

      <section aria-label="Stops in order">
        <div className="mb-1 flex items-baseline justify-between">
          <h3 className="text-2xs font-semibold uppercase tracking-[0.1em] text-subtle">Stops in order</h3>
          <span className="text-2xs text-subtle">{proj.source === "road" ? "ETA = road times" : "ETA = straight-line estimate"}</span>
        </div>
        {s.stops.length === 0 ? (
          <p className="rounded-md border border-dashed border-line px-3 py-4 text-center text-[13px] text-muted">No stops yet. Add stops or assign unassigned ones in Planning.</p>
        ) : (
          <ol className="flex flex-col">
            {s.stops.map((stop, i) => (
              <StopRow key={stop.id} summary={s} stop={stop} index={i + 1} expanded={selectedStopId === stop.id} onToggle={() => selectStop(selectedStopId === stop.id ? null : stop.id)} />
            ))}
          </ol>
        )}
      </section>

      <Activity tourId={s.tour.id} version={s.tour.version} stopsDone={s.completed} />

      <AddStopsDialog open={adding} onOpenChange={setAdding} target={{ tourId: s.tour.id }} targetLabel={s.tour.name} defaultCity={s.depot.address.city} />
      <ConfirmDialog
        open={confirm === "publish"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Publish ${s.tour.name}?`}
        description={
          <>
            {s.driver?.displayName ?? "The driver"} will see this tour with {s.total} stops in TURVIO Driver. You can withdraw it again until the tour starts.
          </>
        }
        confirmLabel="Publish"
        onConfirm={() =>
          publishTour(s.tour).then(
            () => toast.success(`${s.tour.name} published to ${s.driver?.displayName ?? "the driver"}`),
            (e) => {
              toast.error("Could not publish", { description: errorMessage(e) });
              throw e;
            },
          )
        }
      />
      <ConfirmDialog
        open={confirm === "withdraw"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Withdraw ${s.tour.name}?`}
        description="The tour disappears from the driver's app until you publish it again."
        confirmLabel="Withdraw"
        onConfirm={() =>
          unpublishTour(s.tour).then(
            () => toast.success(`${s.tour.name} withdrawn`),
            (e) => {
              toast.error("Could not withdraw", { description: errorMessage(e) });
              throw e;
            },
          )
        }
      />
      <ConfirmDialog
        open={confirm === "delete"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Delete ${s.tour.name}?`}
        description={`The tour is deleted. Its ${s.total} stop(s) go back to the unassigned list of ${s.depot.name}.`}
        confirmLabel="Delete tour"
        tone="danger"
        onConfirm={() =>
          deleteTour(s.tour).then(
            () => {
              selectTour(null);
              toast.success(`${s.tour.name} deleted`);
            },
            (e) => {
              toast.error("Could not delete", { description: errorMessage(e) });
              throw e;
            },
          )
        }
      />
    </div>
  );
}

/** Tour detail in a side drawer (List, Planning and Pickups views). */
export function TourDetailSheet() {
  const { summaries, selectedTourId, selectTour } = useDispatch();
  const s = summaries.find((x) => x.tour.id === selectedTourId);
  return (
    <Sheet open={!!s} onOpenChange={(o) => !o && selectTour(null)} title={s ? `Tour ${s.tour.name}` : ""} description={s ? `${s.depot.name} · ${s.tour.date}` : undefined} className="max-w-lg">
      {s && <TourDetail summary={s} />}
    </Sheet>
  );
}

