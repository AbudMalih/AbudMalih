"use client";

import { formatAddress, formatClock, isNotDelivered, isOpen, minuteOfDay, type Stop, type TourSummary } from "@turvio/shared";
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
  MoreHorizontal,
  Truck,
  Warehouse,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState, type ReactNode } from "react";
import { api, errorMessage } from "../lib/api";
import { basisLabel, conditionLabel, delayReasonText, finishTitle, finishValue, minutes, projectionNote, stopStateLabel } from "../lib/eta";
import { tourColor } from "../lib/helpers";
import { durationText } from "../lib/i18n";
import { useI18n } from "../lib/i18n/client";
import { routeKey, useRoadRoute } from "../lib/road";
import { optimizeNotes, optimizeProblems } from "../lib/optimize";
import { useDispatch, type OptimizeMeta } from "../lib/store";
import { AddStopsDialog } from "./AddStopsDialog";
import { ConfirmDialog } from "./ConfirmDialog";
import { TourActionsMenu } from "./TourActions";
import { ProofList } from "./ProofViewer";
import { StopEditActions } from "./StopEditActions";
import { LocationReview } from "./LocationReview";
import { locationBadge, needsReview } from "../lib/locations";
import { STOP_STATUS, TourStatusBadge, deadlineLabel, failureReasonLabel, stopStatusLabel } from "./StatusBadge";

function Fact({ icon, label, value, sub }: { icon: ReactNode; label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="flex min-w-0 items-start gap-2.5 rounded-md border border-line bg-surface px-3 py-2.5 g:gap-2 g:rounded-none g:border-0 g:bg-transparent g:px-0 g:py-2">
      <span className="mt-0.5 text-subtle [&_svg]:size-4 g:hidden">{icon}</span>
      <div className="min-w-0">
        <div className="text-2xs font-medium uppercase tracking-[0.06em] text-subtle g:text-[12px] g:font-normal g:normal-case g:tracking-normal g:text-muted">{label}</div>
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
  const { scoped, setPriority, locationChecks, session } = useDispatch();
  const { t } = useI18n();
  const locReport = locationChecks.get(stop.id);
  const locBadge = locationBadge(locReport, t);
  const [busy, setBusy] = useState(false);
  const color = tourColor(scoped, summary.tour.id);
  // ETA, colour and warning all come from the one projection of this tour.
  const proj = summary.timeline.projection;
  const p = summary.timeline.projections.get(stop.id);
  const warn = p ? stopStateLabel(p.state, proj.source, t) : null;
  const hasEta = p !== undefined && Number.isFinite(p.etaMinute);
  const st = { tone: STOP_STATUS[stop.status].tone, label: stopStatusLabel(stop.status, t) };
  return (
    <li className={cn("rounded-md transition-colors", expanded ? "bg-surface-2/70" : "hover:bg-surface-2/50")}>
      <button type="button" onClick={onToggle} aria-expanded={expanded} className="flex w-full items-center gap-3 px-2 py-2 text-start outline-none focus-visible:shadow-[var(--shadow-focus)]">
        <StopMarker stop={stop} color={color} index={index} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className={cn("truncate text-[13px] font-medium", isOpen(stop.status) ? "text-ink" : "text-muted")}>{stop.recipientName ?? formatAddress(stop)}</span>
            {stop.type === "pickup" && <ArrowUpFromLine className="size-3.5 shrink-0 text-nx-violet-text" aria-label={t("common.stopType.pickup")} />}
            {stop.priority && <Star className="size-3.5 shrink-0 fill-nx-amber text-nx-amber" aria-label={t("planning.priority")} />}
            {locBadge && isOpen(stop.status) && (
              <span className="shrink-0" data-testid="stop-location-badge">
                <Badge tone={locBadge.tone} className="px-1.5 py-0 text-2xs">
                  {locBadge.label}
                </Badge>
              </span>
            )}
          </span>
          <span className="block truncate text-xs text-muted">{formatAddress(stop)}</span>
        </span>
        <span className="shrink-0 text-end">
          <span className={cn("block text-xs font-medium tabular", warn?.tone === "danger" ? "text-danger-ink" : warn?.tone === "warning" ? "text-warning-ink" : "text-ink-2")} data-testid="stop-eta">
            {hasEta ? formatClock(p!.etaMinute) : "–"}
          </span>
          <span className={cn("block text-2xs", isNotDelivered(stop.status) ? "text-danger-ink" : "text-subtle")}>
            {isOpen(stop.status) ? (proj.source === "estimate" ? t("planning.etaEst") : t("planning.eta")) : st.label}
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
                <Badge tone={stop.type === "pickup" ? "brand" : "outline"}>{t(stop.type === "pickup" ? "common.stopType.pickup" : "common.stopType.delivery")}</Badge>
                {warn && (
                  <Badge tone={warn.tone} data-testid="stop-deadline-state">
                    {warn.label}
                    {p && p.lateMinutes > 0 && p.state !== "unknown" ? ` · ${t("common.min", { n: Math.round(p.lateMinutes) })}` : ""}
                  </Badge>
                )}
                {!stop.location && <Badge tone="danger">{t("planning.noMapPosition")}</Badge>}
              </div>
              {stop.failureReason && (
                <div className="font-medium text-danger-ink" data-testid="failure-reason">
                  {t("planning.reason", { reason: failureReasonLabel(stop.failureReason, t) })}
                </div>
              )}
              {stop.timeWindow && (
                <div className="flex items-center gap-1.5">
                  <Clock className="size-3.5" /> {t("planning.windowRange", { range: `${formatClock(stop.timeWindow.start)}–${formatClock(stop.timeWindow.end)}` })}
                  {isOpen(stop.status) && <span className="text-subtle">{t("planning.closes", { when: deadlineLabel(stop.timeWindow.end - scoped.asOfMinute, t) })}</span>}
                </div>
              )}
              {stop.parcels.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <Package className="size-3.5" /> {t("common.parcels", { count: stop.parcels.length })}
                  {stop.parcels.some((x) => x.loadedAt) && (
                    <Badge tone="success">
                      {t("planning.scannedIn", { done: stop.parcels.filter((x) => x.loadedAt).length, total: stop.parcels.length })}
                    </Badge>
                  )}
                  · <span dir="ltr" className="font-mono text-2xs">{stop.parcels.map((x) => x.trackingNumber).join(", ")}</span>
                </div>
              )}
              {stop.notes && <div>{stop.notes}</div>}
              {stop.driverNotes && (
                <div className="rounded-md border border-line bg-surface px-2.5 py-1.5 text-ink-2" data-testid="driver-note">
                  <span className="text-2xs font-semibold uppercase tracking-[0.06em] text-subtle g:text-[12px] g:font-medium g:normal-case g:tracking-normal g:text-ink-2">{t("planning.driverNote")}</span>
                  <div>{stop.driverNotes}</div>
                </div>
              )}
              {(stop.proofs?.length ?? 0) > 0 && <ProofList stop={stop} />}
              {session.role !== "driver" && (isOpen(stop.status) || locReport) && <LocationReview summary={summary} stop={stop} report={locReport} />}
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
                        toast.success(stop.priority ? t("planning.priorityRemoved") : t("planning.markedPriority"), { description: t("planning.reoptimizeHint") });
                      } catch (e) {
                        toast.error(t("planning.priorityFailed"), { description: errorMessage(e) });
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    <Star className={cn(stop.priority && "fill-nx-amber text-nx-amber")} />
                    {stop.priority ? t("planning.removePriority") : t("planning.markAsPriority")}
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

const EVENT_KINDS = new Set([
  "created",
  "assigned",
  "optimized",
  "published",
  "unpublished",
  "started",
  "paused",
  "resumed",
  "completed",
  "delivered",
  "picked_up",
  "failed",
  "attempted",
  "rescheduled",
  "returned",
  "skipped",
  "in_progress",
  "pending",
  "note",
  "proof_photo",
  "proof_signature",
]);

function Activity({ tourId, version, stopsDone }: { tourId: string; version?: number; stopsDone: number }) {
  const { session } = useDispatch();
  const { t, fmt } = useI18n();
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
    <section aria-label={t("planning.activity")}>
      <h3 className="mb-2 flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-[0.1em] text-subtle g:text-[12px] g:font-medium g:normal-case g:tracking-normal g:text-ink-2">
        <History className="size-3.5" /> {t("planning.activity")}
      </h3>
      {error ? (
        <p className="text-xs text-danger-ink">{error}</p>
      ) : !events ? (
        <p className="flex items-center gap-2 text-xs text-muted">
          <Loader2 className="size-3.5 animate-spin" /> {t("common.loading")}
        </p>
      ) : (
        <ol className="flex flex-col gap-1.5">
          {events.slice(0, 12).map((e, i) => (
            <li key={i} className="flex items-baseline justify-between gap-3 text-xs">
              <span className={cn("text-ink-2", ["failed", "attempted", "returned"].includes(e.kind) && "text-danger-ink", e.detail?.applied === false && "line-through opacity-60")}>
                {EVENT_KINDS.has(e.kind) ? t(`planning.event.${e.kind}` as "planning.event.created") : e.kind}
                {e.detail?.failureReason ? <span className="text-muted"> ({failureReasonLabel(e.detail.failureReason, t)})</span> : null}
                {e.detail?.recipientName ? <span className="text-muted"> – {e.detail.recipientName}</span> : null}
                {e.detail?.notes ? <span className="text-muted"> – {e.detail.notes}</span> : null}
                {e.detail?.applied === false ? <span className="text-subtle"> {t("planning.notApplied")}</span> : null}
              </span>
              <time className="shrink-0 text-2xs text-subtle tabular" dateTime={e.at}>
                {fmt.time(e.at)}
              </time>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function TourDetail({ summary, onFit }: { summary: TourSummary; onFit?: () => void }) {
  const { selectedStopId, selectStop, scoped, optimizeTour, publishTour, unpublishTour, selectTour, session, locationChecks } = useDispatch();
  const [busy, setBusy] = useState<null | "optimize">(null);
  const [confirm, setConfirm] = useState<null | "publish" | "withdraw">(null);
  const [adding, setAdding] = useState(false);
  const { t, fmt } = useI18n();
  const s = summary;
  const tl = s.timeline;
  const tz = scoped.timeZone;
  const started = minuteOfDay(s.tour.startedAt, tz);
  const startLabel = started !== null ? t("planning.startActual", { time: formatClock(started) }) : t("planning.startPlanned", { time: formatClock(s.tour.plannedStartMinute) });
  const open = s.tour.status !== "completed";
  const canManage = session.role !== "driver";
  // The map line still comes from the route endpoint; every figure comes from the projection.
  const road = useRoadRoute(session.organizationId, s.tour.id, routeKey(s.stops));
  const proj = tl.projection;
  // Stops a dispatcher should look at: location errors and unconfirmed warnings (P0-3.4).
  const locationReview = s.stops.filter((x) => isOpen(x.status) && needsReview(locationChecks.get(x.id)));

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
      const problems = optimizeProblems(r, t);
      (problems.length ? toast.warning : toast.success)(problems.length ? t("planning.optimizedWithProblems") : t("planning.routeOptimizedSaved"), {
        description: [...problems, ...optimizeNotes(r, t)].join(" · "),
      });
    } catch (e) {
      toast.error(t("planning.optimizeFailed"), { description: errorMessage(e) });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="size-2.5 rounded-full" style={{ backgroundColor: tourColor(scoped, s.tour.id) }} aria-hidden="true" />
        <TourStatusBadge status={s.status} certainty={s.delayCertainty} />
        {s.tour.origin === "driver" && <Badge tone="outline">{t("planning.driversOwnRoute")}</Badge>}
        {s.tour.publishedAt ? (
          <Badge tone="success">
            <Send className="size-3" /> {t("planning.published")}
          </Badge>
        ) : (
          <Badge tone="outline">
            <EyeOff className="size-3" /> {t("common.notPublished")}
          </Badge>
        )}
      </div>

      {!s.tour.publishedAt && open && (
        <div className="rounded-md border border-dashed border-line-strong bg-surface-2/60 px-3 py-2.5 text-[13px] text-ink-2">
          {s.tour.driverId ? t("planning.notVisibleWithDriver") : t("planning.notVisibleNoDriver")}
        </div>
      )}

      {proj.delayReasons.length > 0 && open && (
        <div
          className={cn(
            "flex gap-2.5 rounded-md border px-3 py-2.5 text-[13px] g:border-line-2 g:bg-transparent g:text-ink-2 g:[&>svg]:mt-0.5",
            s.delayCertainty === "estimated" ? "border-nx-amber/30 bg-warning-soft text-warning-ink g:[&>svg]:text-warning" : "border-nx-coral/30 bg-danger-soft text-danger-ink g:[&>svg]:text-danger",
          )}
          role="alert"
          data-testid="delay-reasons"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <ul className="flex flex-col gap-0.5">
            {proj.delayReasons.map((r) => (
              <li key={r.kind}>{delayReasonText(r, t)}</li>
            ))}
          </ul>
        </div>
      )}
      {open && canManage && locationReview.length > 0 && (
        <button
          type="button"
          onClick={() => selectStop(locationReview[0]!.id, s.tour.id)}
          className="rounded-md border border-nx-amber/30 bg-warning-soft px-3 py-2 text-start text-xs text-warning-ink"
          data-testid="location-review-banner"
        >
          {t(locationReview.some((x) => locationChecks.get(x.id)?.severity === "error") ? "planning.locationReviewErrors" : "planning.locationReview", { count: locationReview.length })}
        </button>
      )}
      {open && (conditionLabel(proj, t) || !proj.complete || proj.source === "estimate") && (
        <div className="rounded-md border border-line bg-surface-2/60 px-3 py-2 text-xs text-ink-2" data-testid="projection-notice">
          {conditionLabel(proj, t) && <p>{t("planning.sentence", { text: conditionLabel(proj, t) })}</p>}
          {proj.scheduledFinishMinute !== null && (
            <p data-testid="scheduled-vs-revised">
              {t("planning.scheduledRevised", {
                start: formatClock(s.tour.plannedStartMinute),
                scheduled: `${proj.complete ? "" : "≥ "}${formatClock(proj.scheduledFinishMinute)}`,
                finish: finishValue(proj),
              })}
            </p>
          )}
          {!proj.complete && (
            <p>
              {t("planning.incompleteTimes", {
                count: proj.unlocatedStopIds.length,
                names: proj.unlocatedStopIds
                  .map((id) => s.stops.find((x) => x.id === id))
                  .map((x) => (x ? (x.recipientName ?? formatAddress(x)) : ""))
                  .slice(0, 3)
                  .join(", "),
                more: proj.unlocatedStopIds.length > 3 ? " …" : "",
              })}
            </p>
          )}
          {proj.source === "estimate" && <p>{t("planning.estimateNote", { basis: basisLabel(proj, t) })}</p>}
        </div>
      )}

      <div>
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="font-medium text-ink-2" data-testid="tour-progress">
            {t("planning.progress", { done: s.completed, total: s.total })}
          </span>
          <span className="text-muted tabular">{fmt.percent(s.total ? s.completed / s.total : 0)}</span>
        </div>
        <div className="flex h-2 overflow-hidden rounded-full bg-surface-3">
          <motion.div className="h-full bg-success" initial={false} animate={{ width: `${s.total ? (s.delivered / s.total) * 100 : 0}%` }} transition={{ duration: 0.5 }} />
          <motion.div className="h-full bg-danger" initial={false} animate={{ width: `${s.total ? (s.failed / s.total) * 100 : 0}%` }} transition={{ duration: 0.5 }} />
        </div>
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-2xs text-muted">
          <span>
            <span className="me-1 inline-block size-2 rounded-full bg-success" />
            {t("planning.deliveredPickedUp", { n: s.delivered })}
          </span>
          <span>
            <span className="me-1 inline-block size-2 rounded-full bg-danger" />
            {t("planning.notDelivered", { n: s.failed })}
          </span>
          <span>
            <span className="me-1 inline-block size-2 rounded-full bg-surface-3" />
            {t("planning.remaining", { n: s.remaining })}
          </span>
        </div>
      </div>

      {road?.routingError ? (
        <div role="alert" data-testid="routing-warning" className="rounded-md bg-warning-soft px-3 py-2 text-xs text-warning-ink">
          <p className="font-semibold">
            {road.routingError.code === "routing_out_of_coverage" ? t("planning.routingNoCoverage") : t("planning.routingUnavailable")}
          </p>
          <p>
            {road.routingError.code === "routing_out_of_coverage"
              ? `${t(road.routingError.depotAffected ? "planning.outsideWithDepot" : "planning.outside", { n: road.routingError.stopIds?.length ?? 0 })} `
              : ""}
            {t("planning.straightLines")}
          </p>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2 g:gap-x-4 g:gap-y-0 g:border-y g:border-line">
        <Fact
          icon={<Avatar name={s.driver?.displayName ?? "?"} size="sm" className="size-4 text-[8px]" />}
          label={t("planning.driver")}
          value={s.driver?.displayName ?? <span className="text-warning-ink">{t("planning.notAssigned")}</span>}
          sub={s.driver ? t("planning.shiftSub", { h: Math.round(s.driver.maxShiftMinutes / 60), time: formatClock(tl.shiftEndMinute) }) : undefined}
        />
        <Fact icon={<Truck />} label={t("planning.vehicle")} value={s.vehicleLabel ?? <span className="text-warning-ink">{t("planning.notAssigned")}</span>} sub={s.vehiclePlate ?? undefined} />
        <Fact icon={<Warehouse />} label={t("planning.startDepot")} value={s.depot.name} sub={formatAddress(s.depot)} />
        <Fact icon={<Clock />} label={t("planning.start")} value={startLabel} />
        <Fact
          icon={<Flag />}
          label={open ? finishTitle(s.tour, proj, t) : t("planning.finished")}
          value={<span data-testid="tour-finish">{open ? finishValue(proj) : formatClock(tl.projectedEndMinute)}</span>}
          sub={open ? <span data-testid="projection-basis">{projectionNote(proj, t)}</span> : undefined}
        />
        <Fact
          icon={<Gauge />}
          label={proj.source === "road" ? t("planning.driveRoad") : t("planning.driveEstimate")}
          value={minutes(proj.totalDriveSeconds, t)}
          sub={
            open
              ? `${t("planning.driveSub", { remaining: minutes(proj.remainingDriveSeconds, t), service: minutes(proj.remainingServiceSeconds, t) })}${proj.remainingWaitSeconds > 60 ? ` · ${t("planning.waiting", { time: minutes(proj.remainingWaitSeconds, t) })}` : ""}`
              : undefined
          }
        />
        <Fact
          icon={<Route />}
          label={proj.source === "road" ? t("planning.distanceRoad") : t("planning.distanceEstimate")}
          value={t("planning.kmTotal", { km: fmt.number(proj.totalMeters / 1000, 1) })}
          sub={open ? t("planning.kmRemaining", { km: fmt.number(proj.remainingMeters / 1000, 1) }) : undefined}
        />
        <Fact icon={<MapPin />} label={t("planning.stops")} value={t("planning.totalN", { n: s.total })} sub={t("planning.doneSub", { done: s.delivered, failed: s.failed })} />
        <Fact
          icon={<ArrowUpFromLine />}
          label={t("planning.pickups")}
          value={t("planning.scheduledN", { n: s.pickups })}
          sub={s.nextPickupDeadline !== null ? t("planning.nextCloses", { time: formatClock(s.nextPickupDeadline) }) : s.pickups ? t("planning.allDone") : t("planning.noneLower")}
        />
      </div>

      {s.tour.optimization && (
        <p className="text-2xs text-muted">
          {road?.source === "none" && road.note ? <span className="block">{road.note}</span> : null}
          {t("planning.lastOptimized", {
            time: s.tour.optimizedAt ? fmt.time(s.tour.optimizedAt) : "",
            basis: s.tour.optimization.matrixSource === "osrm" ? t("planning.roadNetwork") : t("planning.straightLineEstimate"),
          })}
        </p>
      )}

      {canManage && open && (
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={optimize} disabled={busy !== null || s.remaining < 2}>
            {busy === "optimize" ? <Loader2 className="animate-spin" /> : <Sparkles />}
            {busy === "optimize" ? t("planning.optimizing") : active ? t("planning.reoptimize") : t("planning.optimizeSave")}
          </Button>
          <ConfirmDialog
            open={preview !== null}
            onOpenChange={(o) => !o && setPreview(null)}
            title={t("planning.applyTitle")}
            description={
              preview && (
                <div className="flex flex-col gap-2">
                  <p>{t("planning.applyBody", { name: s.tour.name })}</p>
                  <p className="font-medium text-ink-1">
                    {[
                      preview.driveSeconds != null ? t("planning.driving", { time: durationText(preview.driveSeconds / 60, t) }) : null,
                      preview.distanceMeters ? t("common.km", { n: fmt.number(preview.distanceMeters / 1000, 1) }) : null,
                      preview.endMinute != null ? t(proj.endsAtLastStop ? "planning.finishAtLastStop" : "planning.backBy", { time: formatClock(Math.round(preview.endMinute)) }) : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {optimizeProblems(preview, t).map((p) => (
                    <p key={p} className="text-warning-ink">
                      {p}
                    </p>
                  ))}
                  <p className="text-ink-3">{optimizeNotes(preview, t).join(" · ")}</p>
                </div>
              )
            }
            confirmLabel={t("planning.applyOrder")}
            onConfirm={async () => {
              try {
                const r = (await optimizeTour(s.tour, { confirmActive: true })).result;
                toast.success(t("planning.orderApplied"), { description: [...optimizeProblems(r, t), ...optimizeNotes(r, t)].join(" · ") });
              } catch (e) {
                toast.error(t("planning.optimizeFailed"), { description: errorMessage(e) });
                throw e;
              }
            }}
          />
          {s.tour.origin === "driver" && <Badge tone="outline">{t("planning.driversOwnRoute")}</Badge>}
        {s.tour.publishedAt ? (
            s.tour.status === "planned" && (
              <Button variant="secondary" onClick={() => setConfirm("withdraw")}>
                <EyeOff /> {t("planning.withdraw")}
              </Button>
            )
          ) : (
            <Button variant="dark" onClick={() => setConfirm("publish")} disabled={!s.tour.driverId || s.total === 0} title={!s.tour.driverId ? t("planning.assignDriverFirst") : s.total === 0 ? t("planning.addStopsFirst") : undefined}>
              <Send /> {t("planning.publishToDriver")}
            </Button>
          )}
          <Button variant="secondary" onClick={() => setAdding(true)}>
            <Plus /> {t("planning.addStops")}
          </Button>
          {onFit && (
            <Button variant="ghost" onClick={onFit}>
              <Crosshair /> {t("planning.fitOnMap")}
            </Button>
          )}
        </div>
      )}

      {canManage && (
        <div className="flex items-center justify-between rounded-xl border border-line bg-surface-2 px-3 py-2 text-[13px] g:rounded-md g:bg-transparent">
          <span className="text-ink-2">{t("planning.moreActionsHint")}</span>
          <TourActionsMenu
            item={{ tour: s.tour, depotName: s.depot.name, driverName: s.driver?.displayName ?? null, stopCount: s.total, openStops: s.remaining }}
            onDeleted={() => selectTour(null)}
            trigger={
              <Button variant="secondary" size="sm">
                <MoreHorizontal /> {t("planning.moreActions")}
              </Button>
            }
          />
        </div>
      )}

      <section aria-label={t("planning.stopsInOrder")}>
        <div className="mb-1 flex items-baseline justify-between">
          <h3 className="text-2xs font-semibold uppercase tracking-[0.1em] text-subtle g:text-[12px] g:font-medium g:normal-case g:tracking-normal g:text-ink-2">{t("planning.stopsInOrder")}</h3>
          <span className="text-2xs text-subtle">{proj.source === "road" ? t("planning.etaRoad") : t("planning.etaStraight")}</span>
        </div>
        {s.stops.length === 0 ? (
          <p className="rounded-md border border-dashed border-line px-3 py-4 text-center text-[13px] text-muted">{t("planning.noStopsYet")}</p>
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
        title={t("planning.publishTitle", { name: s.tour.name })}
        description={t("planning.publishDetail", { driver: s.driver?.displayName ?? t("planning.theDriver"), count: s.total })}
        confirmLabel={t("planning.publish")}
        onConfirm={() =>
          publishTour(s.tour).then(
            () => toast.success(t("planning.publishedTo", { name: s.tour.name, driver: s.driver?.displayName ?? t("planning.theDriverLower") })),
            (e) => {
              toast.error(t("planning.publishFailed"), { description: errorMessage(e) });
              throw e;
            },
          )
        }
      />
      <ConfirmDialog
        open={confirm === "withdraw"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={t("planning.withdrawTitle", { name: s.tour.name })}
        description={t("planning.withdrawDesc")}
        confirmLabel={t("planning.withdraw")}
        onConfirm={() =>
          unpublishTour(s.tour).then(
            () => toast.success(t("planning.withdrawn", { name: s.tour.name })),
            (e) => {
              toast.error(t("planning.withdrawFailed"), { description: errorMessage(e) });
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
  const t = useI18n().t;
  const s = summaries.find((x) => x.tour.id === selectedTourId);
  return (
    <Sheet open={!!s} onOpenChange={(o) => !o && selectTour(null)} title={s ? t("planning.tourName", { name: s.tour.name }) : ""} description={s ? `${s.depot.name} · ${s.tour.date}` : undefined} className="max-w-lg">
      {s && <TourDetail summary={s} />}
    </Sheet>
  );
}

