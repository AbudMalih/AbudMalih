import { estimateDrive } from "../geo";
import type { Depot, Driver, GeoPoint, Stop, Tour } from "../schemas";
import { sortBySequence } from "../tour";
import type { DispatchDataset, UnassignedStop } from "./dataset";

/**
 * Operational calculations for TURVIO Dispatch. Travel times use the same
 * straight-line estimate as the offline optimizer (see geo.ts) – every value
 * derived here is an ESTIMATE and is labelled as such in the UI.
 */

export const AT_RISK_MARGIN_MINUTES = 15;

export interface StopProjection {
  stopId: string;
  /** Planned/actual arrival in minutes since midnight. */
  etaMinute: number;
  /** Arrives after the time window closes. */
  late: boolean;
  /** Arrives within AT_RISK_MARGIN_MINUTES of the window end. */
  atRisk: boolean;
}

export interface TourTimeline {
  tourId: string;
  projections: Map<string, StopProjection>;
  /** Projected return to the depot (minutes since midnight). */
  projectedEndMinute: number;
  /** Latest allowed end (start + driver's max shift). */
  shiftEndMinute: number;
  distanceMeters: number;
  durationMinutes: number;
  delayed: boolean;
  delayReasons: string[];
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

export function tourTimeline(tour: Tour, stops: Stop[], depot: Depot, driver: Driver | undefined, asOfMinute: number, timeZone = "UTC"): TourTimeline {
  const minuteOf = (iso: string | undefined) => minuteOfDay(iso, timeZone);
  const ordered = sortBySequence(stops.filter((s) => s.type !== "break"));
  const startMinute = minuteOf(tour.startedAt) ?? tour.plannedStartMinute;
  const shiftEndMinute = tour.plannedStartMinute + (driver?.maxShiftMinutes ?? 480);
  const projections = new Map<string, StopProjection>();

  // Full-route distance estimate (depot -> all stops -> depot).
  let distanceMeters = 0;
  let prev: GeoPoint = depot.location;
  for (const s of ordered) {
    if (!s.location) continue;
    distanceMeters += estimateDrive(prev, s.location).meters;
    prev = s.location;
  }
  distanceMeters += estimateDrive(prev, depot.location).meters;

  // Project pending stops from the last completed stop (or the depot).
  const done = ordered.filter((s) => s.status !== "pending");
  const pending = ordered.filter((s) => s.status === "pending");
  for (const s of done) {
    const m = minuteOf(s.completedAt);
    if (m !== null) projections.set(s.id, { stopId: s.id, etaMinute: m, late: !!s.timeWindow && m > s.timeWindow.end, atRisk: false });
  }
  const lastDone = done.at(-1);
  let t = tour.status === "planned" ? tour.plannedStartMinute : Math.max(asOfMinute, minuteOf(lastDone?.completedAt) ?? startMinute);
  let pos: GeoPoint = lastDone?.location ?? depot.location;
  for (const s of pending) {
    if (!s.location) continue;
    let arrive = t + estimateDrive(pos, s.location).seconds / 60;
    if (s.timeWindow && arrive < s.timeWindow.start) arrive = s.timeWindow.start;
    const late = !!s.timeWindow && arrive > s.timeWindow.end;
    const atRisk = !!s.timeWindow && !late && arrive > s.timeWindow.end - AT_RISK_MARGIN_MINUTES;
    projections.set(s.id, { stopId: s.id, etaMinute: arrive, late, atRisk });
    t = arrive + s.serviceSeconds / 60;
    pos = s.location;
  }
  const projectedEndMinute = tour.status === "completed" ? (minuteOf(tour.finishedAt) ?? t) : t + estimateDrive(pos, depot.location).seconds / 60;

  const delayReasons: string[] = [];
  if (tour.status !== "completed") {
    if (projectedEndMinute > shiftEndMinute) delayReasons.push("Projected end exceeds the driver's shift");
    const lateStops = pending.filter((s) => projections.get(s.id)?.late).length;
    if (lateStops > 0) delayReasons.push(`${lateStops} time window${lateStops > 1 ? "s" : ""} will be missed`);
    if (tour.status === "planned" && !tour.driverId && tour.plannedStartMinute - asOfMinute < 60) delayReasons.push("Starts within the hour without a driver");
  }

  return {
    tourId: tour.id,
    projections,
    projectedEndMinute,
    shiftEndMinute,
    distanceMeters,
    durationMinutes: projectedEndMinute - startMinute,
    delayed: delayReasons.length > 0,
    delayReasons,
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
}

export function summarizeTour(data: DispatchDataset, tour: Tour): TourSummary {
  const depot = data.depots.find((d) => d.id === tour.depotId)!;
  const driver = data.drivers.find((d) => d.id === tour.driverId);
  const vehicle = data.vehicles.find((v) => v.id === tour.vehicleId);
  const stops = sortBySequence(data.stops.filter((s) => s.tourId === tour.id));
  const work = stops.filter((s) => s.type !== "break");
  const timeline = tourTimeline(tour, stops, depot, driver, data.asOfMinute, data.timeZone);
  const openPickups = work.filter((s) => s.type === "pickup" && s.status === "pending");
  return {
    tour,
    depot,
    driver,
    vehicleLabel: vehicle?.label ?? null,
    vehiclePlate: vehicle?.licensePlate ?? null,
    stops,
    total: work.length,
    completed: work.filter((s) => s.status !== "pending").length,
    delivered: work.filter((s) => s.status === "delivered" || s.status === "picked_up").length,
    failed: work.filter((s) => s.status === "failed").length,
    remaining: work.filter((s) => s.status === "pending").length,
    pickups: work.filter((s) => s.type === "pickup").length,
    pickupsRemaining: openPickups.length,
    nextPickupDeadline: openPickups.reduce<number | null>((min, s) => (s.timeWindow ? Math.min(min ?? Infinity, s.timeWindow.end) : min), null),
    timeline,
    status: timeline.delayed && (tour.status === "in_progress" || tour.status === "paused" || tour.status === "planned") ? "delayed" : tour.status,
  };
}

export function summarizeTours(data: DispatchDataset): TourSummary[] {
  return data.tours.map((t) => summarizeTour(data, t));
}

// ---------------------------------------------------------------------------
// Pickups
// ---------------------------------------------------------------------------

export type PickupState = "completed" | "failed" | "late" | "at_risk" | "scheduled" | "unassigned";

export interface PickupRow {
  stop: Stop | UnassignedStop;
  depotId: string;
  tourId: string | null;
  tourName: string | null;
  driverName: string | null;
  state: PickupState;
  etaMinute: number | null;
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
      else if (stop.status !== "pending") state = "failed";
      else if (p?.late) state = "late";
      else if (p?.atRisk) state = "at_risk";
      else state = "scheduled";
      rows.push({
        stop,
        depotId: s.depot.id,
        tourId: s.tour.id,
        tourName: s.tour.name,
        driverName: s.driver?.displayName ?? null,
        state,
        etaMinute: p?.etaMinute ?? null,
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
      minutesToDeadline: u.timeWindow ? u.timeWindow.end - data.asOfMinute : null,
    });
  }
  const rank: Record<PickupState, number> = { late: 0, unassigned: 1, at_risk: 2, scheduled: 3, failed: 4, completed: 5 };
  return rows.sort((a, b) => rank[a.state] - rank[b.state] || (a.minutesToDeadline ?? 1e9) - (b.minutesToDeadline ?? 1e9));
}

/** Pickups that need a dispatcher's attention: projected late/at risk, or not on any tour yet. */
export function isPickupConflict(row: PickupRow): boolean {
  return row.state === "late" || row.state === "at_risk" || row.state === "unassigned";
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
      summaries.reduce((n, s) => n + s.stops.filter((x) => x.type === "delivery" && x.status === "pending").length, 0) +
      data.unassigned.filter((u) => u.type === "delivery").length,
    unassignedDeliveries: data.unassigned.filter((u) => u.type === "delivery").length,
    scheduledPickups: pickups.filter((p) => p.state !== "completed" && p.state !== "failed").length,
    pickupConflicts: pickups.filter(isPickupConflict).length,
    delayedTours: summaries.filter((s) => s.status === "delayed").length,
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
