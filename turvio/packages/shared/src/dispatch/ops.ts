import type { Depot, Driver, Stop, Tour } from "../schemas";
import { isNotDelivered, isOpen, isSuccess } from "../stopStatus";
import { sortBySequence } from "../tour";
import type { DispatchDataset, UnassignedStop } from "./dataset";
import { projectTour, type DelayCertainty, type StopProjection, type TourProjection, type TourRoad } from "./projection";

/**
 * Operational calculations for TURVIO Dispatch. Every time and delay comes from the shared
 * projection model (projection.ts): road values when the dataset carries them, otherwise a
 * labelled straight-line estimate.
 */

export { AT_RISK_MARGIN_MINUTES, LIVE_GPS_MAX_AGE_SECONDS } from "./projection";
export type { StopProjection } from "./projection";

export interface TourTimeline {
  tourId: string;
  projections: Map<string, StopProjection>;
  /** Projected end of the tour: back at its end point, or at its last stop (minutes since midnight). */
  projectedEndMinute: number;
  /** Latest allowed end (start + driver's max shift). */
  shiftEndMinute: number;
  distanceMeters: number;
  /** From the projection's origin through the open stops to the end point. */
  remainingMeters: number;
  durationMinutes: number;
  delayed: boolean;
  delayReasons: string[];
  /** The full projection (source, origin, certainty, completeness, per-stop states). */
  projection: TourProjection;
}

export type DispatchTourStatus = Tour["status"] | "delayed";

const formatters = new Map<string, Intl.DateTimeFormat>();

/** Minutes since local midnight of an ISO timestamp in the given IANA time zone. */
export function minuteOfDay(iso: string | null | undefined, timeZone = "UTC"): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
    formatters.set(timeZone, f);
  }
  const parts = f.formatToParts(d);
  const h = Number(parts.find((p) => p.type === "hour")?.value);
  const m = Number(parts.find((p) => p.type === "minute")?.value);
  return h * 60 + m;
}

/** Current date (YYYY-MM-DD) and minute of day in a time zone. */
export function nowInZone(timeZone: string, now: Date = new Date()): { date: string; minute: number } {
  const date = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  return { date, minute: minuteOfDay(now.toISOString(), timeZone)! };
}

/**
 * Times of one tour, from the shared projection model (projection.ts): road legs from the API
 * when `opts.road` carries them, otherwise a straight-line estimate that is labelled as such.
 */
export function tourTimeline(
  tour: Tour,
  stops: Stop[],
  depot: Depot,
  driver: Driver | undefined,
  asOfMinute: number,
  timeZone = "UTC",
  opts: { road?: TourRoad; isToday?: boolean } = {},
): TourTimeline {
  const minuteOf = (iso: string | undefined) => minuteOfDay(iso, timeZone);
  const p = projectTour({
    tour,
    stops,
    depotLocation: depot.location,
    maxShiftMinutes: driver?.maxShiftMinutes ?? 480,
    nowMinute: asOfMinute,
    isToday: opts.isToday,
    road: opts.road,
    minuteOf,
  });
  const startMinute = minuteOf(tour.startedAt) ?? tour.plannedStartMinute;
  return {
    tourId: tour.id,
    projections: p.stops,
    projectedEndMinute: p.finishMinute,
    shiftEndMinute: p.shiftEndMinute,
    distanceMeters: p.totalMeters,
    remainingMeters: p.remainingMeters,
    durationMinutes: p.finishMinute - startMinute,
    delayed: p.delayed,
    delayReasons: p.delayReasons.map((r) => r.text),
    projection: p,
  };
}

export interface TourSummary {
  tour: Tour;
  depot: Depot;
  driver: Driver | undefined;
  vehicleLabel: string | null;
  vehiclePlate: string | null;
  stops: Stop[];
  total: number;
  completed: number;
  delivered: number;
  failed: number;
  remaining: number;
  pickups: number;
  pickupsRemaining: number;
  /** Earliest open pickup window end, if any. */
  nextPickupDeadline: number | null;
  timeline: TourTimeline;
  status: DispatchTourStatus;
  /** How sure a "delayed" status is: confirmed (a deadline already passed), projected (road), estimated (straight line). */
  delayCertainty: DelayCertainty | null;
}

export function summarizeTour(data: DispatchDataset, tour: Tour): TourSummary {
  const depot = data.depots.find((d) => d.id === tour.depotId)!;
  const driver = data.drivers.find((d) => d.id === tour.driverId);
  const vehicle = data.vehicles.find((v) => v.id === tour.vehicleId);
  const stops = sortBySequence(data.stops.filter((s) => s.tourId === tour.id));
  const work = stops.filter((s) => s.type !== "break");
  const timeline = tourTimeline(tour, stops, depot, driver, data.asOfMinute, data.timeZone, { road: data.roads?.[tour.id], isToday: data.isToday });
  const openPickups = work.filter((s) => s.type === "pickup" && isOpen(s.status));
  return {
    tour,
    depot,
    driver,
    vehicleLabel: vehicle?.label ?? null,
    vehiclePlate: vehicle?.licensePlate ?? null,
    stops,
    total: work.length,
    completed: work.filter((s) => !isOpen(s.status)).length,
    delivered: work.filter((s) => isSuccess(s.status)).length,
    failed: work.filter((s) => isNotDelivered(s.status)).length,
    remaining: work.filter((s) => isOpen(s.status)).length,
    pickups: work.filter((s) => s.type === "pickup").length,
    pickupsRemaining: openPickups.length,
    nextPickupDeadline: openPickups.reduce<number | null>((min, s) => (s.timeWindow ? Math.min(min ?? Infinity, s.timeWindow.end) : min), null),
    timeline,
    status: timeline.delayed && (tour.status === "in_progress" || tour.status === "paused" || tour.status === "planned") ? "delayed" : tour.status,
    delayCertainty: timeline.delayed && tour.status !== "completed" ? timeline.projection.delayCertainty : null,
  };
}

export function summarizeTours(data: DispatchDataset): TourSummary[] {
  return data.tours.map((t) => summarizeTour(data, t));
}

// ---------------------------------------------------------------------------
// Pickups
// ---------------------------------------------------------------------------

/** missed: the window already closed (a fact); late: projected after the window (a prediction). */
export type PickupState = "completed" | "failed" | "missed" | "late" | "at_risk" | "scheduled" | "unassigned";

export interface PickupRow {
  stop: Stop | UnassignedStop;
  depotId: string;
  tourId: string | null;
  tourName: string | null;
  driverName: string | null;
  state: PickupState;
  etaMinute: number | null;
  /** The ETA/state is a straight-line estimate (road values unavailable for this tour). */
  estimated: boolean;
  /** Minutes until the window closes, relative to the synthetic clock. */
  minutesToDeadline: number | null;
}

export function pickupRows(data: DispatchDataset, summaries: TourSummary[] = summarizeTours(data)): PickupRow[] {
  const rows: PickupRow[] = [];
  for (const s of summaries) {
    for (const stop of s.stops.filter((x) => x.type === "pickup")) {
      const p = s.timeline.projections.get(stop.id);
      let state: PickupState;
      if (stop.status === "picked_up") state = "completed";
      else if (!isOpen(stop.status)) state = "failed";
      else if (p?.state === "deadline_missed") state = "missed";
      else if (p?.state === "projected_late") state = "late";
      else if (p?.state === "at_risk") state = "at_risk";
      else state = "scheduled";
      rows.push({
        stop,
        depotId: s.depot.id,
        tourId: s.tour.id,
        tourName: s.tour.name,
        driverName: s.driver?.displayName ?? null,
        state,
        etaMinute: p && Number.isFinite(p.etaMinute) ? p.etaMinute : null,
        estimated: s.timeline.projection.source === "estimate",
        minutesToDeadline: stop.timeWindow ? stop.timeWindow.end - data.asOfMinute : null,
      });
    }
  }
  for (const u of data.unassigned.filter((x) => x.type === "pickup")) {
    rows.push({
      stop: u,
      depotId: u.depotId,
      tourId: null,
      tourName: null,
      driverName: null,
      state: "unassigned",
      etaMinute: null,
      estimated: false,
      minutesToDeadline: u.timeWindow ? u.timeWindow.end - data.asOfMinute : null,
    });
  }
  const rank: Record<PickupState, number> = { missed: 0, late: 1, unassigned: 2, at_risk: 3, scheduled: 4, failed: 5, completed: 6 };
  return rows.sort((a, b) => rank[a.state] - rank[b.state] || (a.minutesToDeadline ?? 1e9) - (b.minutesToDeadline ?? 1e9));
}

/** Pickups that need a dispatcher's attention: projected late/at risk, or not on any tour yet. */
export function isPickupConflict(row: PickupRow): boolean {
  return row.state === "missed" || row.state === "late" || row.state === "at_risk" || row.state === "unassigned";
}

// ---------------------------------------------------------------------------
// KPIs
// ---------------------------------------------------------------------------

export interface DispatchKpis {
  activeDrivers: number;
  activeTours: number;
  plannedTours: number;
  completedStops: number;
  totalStops: number;
  remainingDeliveries: number;
  unassignedDeliveries: number;
  scheduledPickups: number;
  pickupConflicts: number;
  delayedTours: number;
  /** delayedTours split by certainty: a deadline already passed / road projection / straight-line estimate. */
  delayedConfirmed: number;
  delayedProjected: number;
  delayedEstimated: number;
  availableVehicles: number;
  totalVehicles: number;
  completion: number;
}

export function dispatchKpis(data: DispatchDataset, summaries: TourSummary[] = summarizeTours(data)): DispatchKpis {
  const active = summaries.filter((s) => s.tour.status === "in_progress" || s.tour.status === "paused");
  const busyVehicles = new Set(summaries.filter((s) => s.tour.status !== "completed").map((s) => s.tour.vehicleId).filter(Boolean));
  const totalStops = summaries.reduce((n, s) => n + s.total, 0);
  const completedStops = summaries.reduce((n, s) => n + s.completed, 0);
  const pickups = pickupRows(data, summaries);
  return {
    activeDrivers: new Set(active.map((s) => s.tour.driverId).filter(Boolean)).size,
    activeTours: active.length,
    plannedTours: summaries.filter((s) => s.tour.status === "planned").length,
    completedStops,
    totalStops,
    remainingDeliveries:
      summaries.reduce((n, s) => n + s.stops.filter((x) => x.type === "delivery" && isOpen(x.status)).length, 0) +
      data.unassigned.filter((u) => u.type === "delivery").length,
    unassignedDeliveries: data.unassigned.filter((u) => u.type === "delivery").length,
    scheduledPickups: pickups.filter((p) => p.state !== "completed" && p.state !== "failed").length,
    pickupConflicts: pickups.filter(isPickupConflict).length,
    delayedTours: summaries.filter((s) => s.status === "delayed").length,
    delayedConfirmed: summaries.filter((s) => s.status === "delayed" && s.delayCertainty === "confirmed").length,
    delayedProjected: summaries.filter((s) => s.status === "delayed" && s.delayCertainty === "projected").length,
    delayedEstimated: summaries.filter((s) => s.status === "delayed" && s.delayCertainty === "estimated").length,
    availableVehicles: data.vehicles.filter((v) => !busyVehicles.has(v.id)).length,
    totalVehicles: data.vehicles.length,
    completion: totalStops ? completedStops / totalStops : 0,
  };
}

export function formatClock(minute: number): string {
  const m = Math.round(minute);
  const h = Math.floor(m / 60) % 24;
  return `${String(h).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

export function formatDuration(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  return h ? `${h} h ${String(m % 60).padStart(2, "0")} min` : `${m} min`;
}
