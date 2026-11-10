import { estimateDrive } from "../geo";
import type { GeoPoint, Stop, Tour } from "../schemas";
import { isOpen } from "../stopStatus";
import { sortBySequence, tourEndPoint, tourStartPoint } from "../tour";

/**
 * One projection model for every time, ETA, warning and delay status Dispatch shows (tour list,
 * detail, map, KPIs, pickups, live panel). Road values come from OSRM legs that the API attaches to
 * the dispatch dataset (`DispatchDataset.roads`); without them the whole tour is a labelled
 * straight-line estimate – road and straight-line values are never mixed within a tour.
 */

export const AT_RISK_MARGIN_MINUTES = 15;
/** A GPS position younger than this is used as the origin of the remaining route. */
export const LIVE_GPS_MAX_AGE_SECONDS = 120;

export interface RoadLegValue {
  meters: number;
  seconds: number;
}

/** Road legs along a list of waypoints; `stopIds[i]` null = tour start / anchor / end point. */
export interface RoadPath {
  stopIds: (string | null)[];
  legs: RoadLegValue[];
}

export type RoadEstimateReason = "routing_unavailable" | "out_of_coverage" | "pending" | "not_configured" | "stale";

/** What the API knows about a tour's roads (wire format, part of the dispatch dataset). */
export type TourRoad =
  | {
      source: "osrm";
      /** Whole planned order: tour start → every located stop → end point (if any). */
      plan: RoadPath;
      /** Remaining order: anchor (last completed stop, else tour start) → open located stops → end. */
      remaining?: RoadPath & { anchorStopId: string | null };
      gps?: TourGps;
    }
  | { source: "estimate"; reason: RoadEstimateReason; stopIds?: string[]; gps?: TourGps };

export interface TourGps {
  /** Age of the driver's latest position (seconds). */
  ageSeconds: number;
  /** Road leg from the live position to the next open stop (only when the position is fresh). */
  firstLeg?: RoadLegValue;
  toStopId?: string;
}

/**
 * State of a stop's deadline:
 * - deadline_missed: deadline already passed, stop still open (a fact)
 * - delivered_late: completed after its deadline (a fact)
 * - projected_late: the projected arrival is after the deadline (a prediction)
 * - at_risk: projected within AT_RISK_MARGIN_MINUTES of the deadline
 * - on_time / done: no issue; unknown: open stop without a position (no ETA possible)
 */
export type StopDeadlineState = "deadline_missed" | "delivered_late" | "projected_late" | "at_risk" | "on_time" | "done" | "unknown";

export interface StopProjection {
  stopId: string;
  /** Projected arrival (open stops) or actual completion (closed stops), minutes since midnight. */
  etaMinute: number;
  state: StopDeadlineState;
  deadlineMinute: number | null;
  /** Minutes after the deadline (projected or actual). */
  lateMinutes: number;
  priority: boolean;
  /** Back-compatible flags: late = deadline_missed | delivered_late | projected_late. */
  late: boolean;
  atRisk: boolean;
}

export type ProjectionOrigin = "gps" | "last_completed_stop" | "tour_start" | "completed";
/** The projection assumes something that is not happening now (labelled in the UI). */
export type ProjectionCondition = "resume_now" | "start_now" | null;
/** confirmed: a fact (deadline already missed); projected: road projection; estimated: straight line. */
export type DelayCertainty = "confirmed" | "projected" | "estimated";

export interface DelayReason {
  kind: "deadline_missed" | "projected_late" | "finish_after_shift" | "no_driver";
  certainty: DelayCertainty;
  count?: number;
  text: string;
}

export interface TourProjection {
  source: "road" | "estimate";
  estimateReason: RoadEstimateReason | null;
  /** Stops named by a routing failure (e.g. outside the road data). */
  estimateStopIds: string[];
  origin: ProjectionOrigin;
  condition: ProjectionCondition;
  /** Age of the latest GPS position, when there is one (also when too old to be used). */
  gpsAgeSeconds: number | null;
  /** False when open stops have no position: the finish is a lower bound, never definitive. */
  complete: boolean;
  unlocatedStopIds: string[];
  stops: Map<string, StopProjection>;
  /** Minute the projection counts from. */
  fromMinute: number;
  /** Projected finish (return to the end point, or end of service at the last stop). */
  finishMinute: number;
  /**
   * Finish had the tour left at its planned start – set only when it differs in kind from
   * `finishMinute`: a planned tour that is late to start (condition "start_now"), so the
   * scheduled finish and the revised "departs now" finish can be shown side by side.
   */
  scheduledFinishMinute: number | null;
  endsAtLastStop: boolean;
  shiftEndMinute: number;
  totalMeters: number;
  totalDriveSeconds: number;
  remainingMeters: number;
  remainingDriveSeconds: number;
  remainingServiceSeconds: number;
  remainingWaitSeconds: number;
  delayed: boolean;
  delayCertainty: DelayCertainty | null;
  delayReasons: DelayReason[];
}

export interface ProjectionInput {
  tour: Pick<Tour, "id" | "status" | "driverId" | "plannedStartMinute" | "startedAt" | "finishedAt" | "startLocation" | "endMode" | "endLocation">;
  stops: Stop[];
  depotLocation: GeoPoint;
  maxShiftMinutes: number;
  nowMinute: number;
  /** Operating day is today: deadlines in the past count as missed, a late start as "start now". */
  isToday?: boolean;
  timeZone?: string;
  road?: TourRoad;
  minuteOf: (iso: string | undefined) => number | null;
}

/** The stop the driver completed last (latest completion time; sequence as tie-break). */
export function lastCompletedStop(stops: Stop[], minuteOf: (iso: string | undefined) => number | null): Stop | undefined {
  let best: Stop | undefined;
  let bestMinute = -Infinity;
  for (const s of sortBySequence(stops)) {
    if (s.type === "break" || isOpen(s.status) || !s.location) continue;
    const m = minuteOf(s.completedAt) ?? -1;
    if (m >= bestMinute) {
      best = s;
      bestMinute = m;
    }
  }
  return best;
}

const same = (a: (string | null)[], b: (string | null)[]) => a.length === b.length && a.every((x, i) => x === b[i]);

export function projectTour(input: ProjectionInput): TourProjection {
  const { tour, nowMinute, minuteOf } = input;
  const ordered = sortBySequence(input.stops.filter((s) => s.type !== "break"));
  const start = tourStartPoint(tour, input.depotLocation);
  const end = tourEndPoint(tour, input.depotLocation);
  const shiftEndMinute = tour.plannedStartMinute + input.maxShiftMinutes;
  const open = ordered.filter((s) => isOpen(s.status));
  const openLocated = open.filter((s) => s.location);
  // A completed tour predicts nothing: stops left open there get no ETA and make nothing "incomplete".
  const unlocatedStopIds = tour.status === "completed" ? [] : open.filter((s) => !s.location).map((s) => s.id);
  // Same rule as the driver app's remaining figures: from the last completed stop, if any.
  const anchor = lastCompletedStop(ordered, minuteOf);
  const anchorPoint = anchor?.location ?? start;
  const road = input.road;
  const gpsAgeSeconds = road?.gps ? road.gps.ageSeconds : null;
  const running = tour.status === "in_progress" || tour.status === "paused";
  const deadlinesCanBeMissed = running || (tour.status === "planned" && input.isToday === true);

  // ---- legs for the remaining route: all road (same stop order) or all straight line
  const remainingIds: (string | null)[] = [null, ...openLocated.map((s) => s.id), ...(end ? [null] : [])];
  const planIds: (string | null)[] = [null, ...ordered.filter((s) => s.location).map((s) => s.id), ...(end ? [null] : [])];
  let legs: RoadLegValue[] | null = null;
  let estimateReason: RoadEstimateReason | null = null;
  if (road?.source === "osrm") {
    if (road.remaining && road.remaining.anchorStopId === (anchor?.id ?? null) && same(road.remaining.stopIds, remainingIds)) legs = road.remaining.legs;
    else if (!anchor && same(road.plan.stopIds, planIds) && openLocated.length === ordered.filter((s) => s.location).length) legs = road.plan.legs;
    else estimateReason = "stale"; // order or progress changed since the road data was computed
  } else {
    estimateReason = road?.source === "estimate" ? road.reason : "not_configured";
  }
  const source: TourProjection["source"] = legs ? "road" : "estimate";

  // ---- origin and the minute the projection starts
  let origin: ProjectionOrigin;
  let condition: ProjectionCondition = null;
  let fromMinute: number;
  const anchorDone = minuteOf(anchor?.completedAt);
  if (tour.status === "completed") {
    origin = "completed";
    fromMinute = minuteOf(tour.startedAt) ?? tour.plannedStartMinute;
  } else if (tour.status === "planned") {
    origin = "tour_start";
    if (input.isToday && nowMinute > tour.plannedStartMinute) {
      fromMinute = nowMinute;
      condition = "start_now";
    } else fromMinute = tour.plannedStartMinute;
  } else {
    fromMinute = Math.max(nowMinute, anchorDone ?? minuteOf(tour.startedAt) ?? tour.plannedStartMinute);
    const gps = road?.gps;
    const firstOpen = openLocated[0];
    if (legs && gps && gps.firstLeg && gps.ageSeconds <= LIVE_GPS_MAX_AGE_SECONDS && firstOpen && gps.toStopId === firstOpen.id) {
      origin = "gps";
      legs = [gps.firstLeg, ...legs.slice(1)];
      fromMinute = nowMinute;
    } else origin = anchor ? "last_completed_stop" : "tour_start";
    if (tour.status === "paused") condition = "resume_now";
  }

  const leg = (i: number, from: GeoPoint, to: GeoPoint): RoadLegValue => (legs ? (legs[i] ?? { meters: 0, seconds: 0 }) : estimateDrive(from, to));

  // ---- stops
  const stops = new Map<string, StopProjection>();
  for (const s of ordered) {
    if (isOpen(s.status)) continue;
    const m = minuteOf(s.completedAt);
    if (m === null) continue;
    const deadline = s.timeWindow?.end ?? null;
    const lateMinutes = deadline !== null && m > deadline ? m - deadline : 0;
    stops.set(s.id, {
      stopId: s.id,
      etaMinute: m,
      state: lateMinutes > 0 ? "delivered_late" : "done",
      deadlineMinute: deadline,
      lateMinutes,
      priority: s.priority,
      late: lateMinutes > 0,
      atRisk: false,
    });
  }
  let t = fromMinute;
  let pos = anchorPoint;
  let remainingMeters = 0;
  let remainingDriveSeconds = 0;
  let remainingServiceSeconds = 0;
  let remainingWaitSeconds = 0;
  if (tour.status !== "completed") {
    openLocated.forEach((s, i) => {
      const l = leg(i, pos, s.location!);
      remainingMeters += l.meters;
      remainingDriveSeconds += l.seconds;
      let arrive = t + l.seconds / 60;
      if (s.timeWindow && arrive < s.timeWindow.start) {
        remainingWaitSeconds += (s.timeWindow.start - arrive) * 60;
        arrive = s.timeWindow.start;
      }
      const deadline = s.timeWindow?.end ?? null;
      const lateMinutes = deadline !== null && arrive > deadline ? arrive - deadline : 0;
      let state: StopDeadlineState = "on_time";
      if (deadline !== null && deadlinesCanBeMissed && nowMinute > deadline) state = "deadline_missed";
      else if (lateMinutes > 0) state = "projected_late";
      else if (deadline !== null && arrive > deadline - AT_RISK_MARGIN_MINUTES) state = "at_risk";
      stops.set(s.id, {
        stopId: s.id,
        etaMinute: arrive,
        state,
        deadlineMinute: deadline,
        lateMinutes: state === "deadline_missed" ? Math.max(lateMinutes, nowMinute - deadline!) : lateMinutes,
        priority: s.priority,
        late: state === "deadline_missed" || state === "projected_late",
        atRisk: state === "at_risk",
      });
      t = arrive + s.serviceSeconds / 60;
      remainingServiceSeconds += s.serviceSeconds;
      pos = s.location!;
    });
    for (const id of unlocatedStopIds) {
      const s = ordered.find((x) => x.id === id)!;
      const deadline = s.timeWindow?.end ?? null;
      const missed = deadline !== null && deadlinesCanBeMissed && nowMinute > deadline;
      stops.set(id, {
        stopId: id,
        etaMinute: NaN,
        state: missed ? "deadline_missed" : "unknown",
        deadlineMinute: deadline,
        lateMinutes: missed ? nowMinute - deadline! : 0,
        priority: s.priority,
        late: missed,
        atRisk: false,
      });
    }
    if (end) {
      const l = leg(openLocated.length, pos, end);
      remainingMeters += l.meters;
      remainingDriveSeconds += l.seconds;
      t += l.seconds / 60;
    }
  }
  const finishMinute = tour.status === "completed" ? (minuteOf(tour.finishedAt) ?? t) : t;
  // Same legs, waits and service, departing at the planned start instead of now.
  let scheduledFinishMinute: number | null = null;
  if (condition === "start_now") {
    let st = tour.plannedStartMinute;
    let p = anchorPoint;
    openLocated.forEach((s, i) => {
      let arrive = st + leg(i, p, s.location!).seconds / 60;
      if (s.timeWindow && arrive < s.timeWindow.start) arrive = s.timeWindow.start;
      st = arrive + s.serviceSeconds / 60;
      p = s.location!;
    });
    if (end) st += leg(openLocated.length, p, end).seconds / 60;
    scheduledFinishMinute = st;
  }

  // ---- totals for the whole tour (road plan or straight line)
  let totalMeters = 0;
  let totalDriveSeconds = 0;
  if (source === "road" && road?.source === "osrm") {
    for (const l of road.plan.legs) {
      totalMeters += l.meters;
      totalDriveSeconds += l.seconds;
    }
  } else {
    let p = start;
    for (const s of ordered) {
      if (!s.location) continue;
      const l = estimateDrive(p, s.location);
      totalMeters += l.meters;
      totalDriveSeconds += l.seconds;
      p = s.location;
    }
    if (end) {
      const l = estimateDrive(p, end);
      totalMeters += l.meters;
      totalDriveSeconds += l.seconds;
    }
  }

  // ---- delay assessment: facts are "confirmed", predictions "projected" (road) or "estimated"
  const predicted: DelayCertainty = source === "road" ? "projected" : "estimated";
  const reasons: DelayReason[] = [];
  if (tour.status !== "completed") {
    const all = [...stops.values()];
    const missed = all.filter((x) => x.state === "deadline_missed").length;
    const projectedLate = all.filter((x) => x.state === "projected_late").length;
    if (missed > 0) reasons.push({ kind: "deadline_missed", certainty: "confirmed", count: missed, text: `${missed} deadline${missed > 1 ? "s" : ""} already missed` });
    if (projectedLate > 0)
      reasons.push({
        kind: "projected_late",
        certainty: predicted,
        count: projectedLate,
        text: `${projectedLate} stop${projectedLate > 1 ? "s" : ""} ${predicted === "projected" ? "projected late" : "possibly late (estimate)"}`,
      });
    if (finishMinute > shiftEndMinute)
      reasons.push({ kind: "finish_after_shift", certainty: predicted, text: predicted === "projected" ? "Projected finish after the shift ends" : "Finish possibly after the shift ends (estimate)" });
    // Only on the operating day itself: other days' clocks (00:00 / 23:59) say nothing about "the next hour".
    if (tour.status === "planned" && !tour.driverId && input.isToday === true && tour.plannedStartMinute - nowMinute < 60) {
      const h = Math.floor(tour.plannedStartMinute / 60), m = tour.plannedStartMinute % 60;
      const overdue = nowMinute > tour.plannedStartMinute;
      reasons.push({
        kind: "no_driver",
        certainty: "confirmed",
        text: overdue ? `Should have started at ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")} – no driver` : "Starts within the hour without a driver",
      });
    }
  }
  const certainty: DelayCertainty | null = reasons.length === 0 ? null : reasons.some((r) => r.certainty === "confirmed") ? "confirmed" : reasons.some((r) => r.certainty === "projected") ? "projected" : "estimated";

  return {
    source,
    estimateReason: source === "estimate" ? estimateReason : null,
    estimateStopIds: road?.source === "estimate" ? (road.stopIds ?? []) : [],
    origin,
    condition,
    gpsAgeSeconds,
    complete: unlocatedStopIds.length === 0,
    unlocatedStopIds,
    stops,
    fromMinute,
    finishMinute,
    scheduledFinishMinute,
    endsAtLastStop: !end,
    shiftEndMinute,
    totalMeters,
    totalDriveSeconds,
    remainingMeters,
    remainingDriveSeconds,
    remainingServiceSeconds,
    remainingWaitSeconds,
    delayed: reasons.length > 0,
    delayCertainty: certainty,
    delayReasons: reasons,
  };
}

/** Road waypoints the API must route for a tour (same rules as projectTour uses to read them). */
export function roadWaypoints(
  tour: ProjectionInput["tour"],
  stops: Stop[],
  depotLocation: GeoPoint,
  minuteOf: (iso: string | undefined) => number | null,
): { plan: { points: GeoPoint[]; stopIds: (string | null)[] }; remaining: { points: GeoPoint[]; stopIds: (string | null)[]; anchorStopId: string | null } | null; firstOpen: Stop | null } {
  const ordered = sortBySequence(stops.filter((s) => s.type !== "break"));
  const start = tourStartPoint(tour, depotLocation);
  const end = tourEndPoint(tour, depotLocation);
  const located = ordered.filter((s) => s.location);
  const plan = { points: [start, ...located.map((s) => s.location!), ...(end ? [end] : [])], stopIds: [null, ...located.map((s) => s.id), ...(end ? [null] : [])] };
  if (tour.status === "completed") return { plan, remaining: null, firstOpen: null };
  const anchor = lastCompletedStop(ordered, minuteOf);
  const openLocated = ordered.filter((s) => isOpen(s.status) && s.location);
  if (!anchor && openLocated.length === located.length) return { plan, remaining: null, firstOpen: openLocated[0] ?? null };
  return {
    plan,
    remaining: {
      points: [anchor?.location ?? start, ...openLocated.map((s) => s.location!), ...(end ? [end] : [])],
      stopIds: [null, ...openLocated.map((s) => s.id), ...(end ? [null] : [])],
      anchorStopId: anchor?.id ?? null,
    },
    firstOpen: openLocated[0] ?? null,
  };
}
