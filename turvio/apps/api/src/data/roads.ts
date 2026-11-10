import { LIVE_GPS_MAX_AGE_SECONDS, minuteOfDay, roadWaypoints, routePoint, type DispatchDataset, type GeoPoint, type RoadLegValue, type TourRoad } from "@turvio/shared";
import { RoutingOutOfCoverage, type RoadRoute, type RoutingProvider } from "../routing";

/**
 * Road data for the dispatch dataset (`DispatchDataset.roads`): the legs every Dispatch figure is
 * computed from (shared projectTour). Per tour: the planned order (cached until the order or a
 * position changes) and, once stops are done, the remaining order from the last completed stop
 * (cached until the next stop is completed). Live positions: one OSRM table request for all
 * running tours (GPS -> next open stop). Never blocks the dashboard: whatever is not done within
 * `budgetMs` is marked "pending" (a labelled straight-line estimate) and finishes in the background,
 * so the next load finds it in the routing cache.
 */

export interface LivePosition {
  lat: number;
  lng: number;
  ageSeconds: number;
}

export interface RoadBuildOptions {
  budgetMs?: number;
  concurrency?: number;
}

export interface RoadBuildReport {
  tours: number;
  pending: number;
  estimated: number;
  elapsedMs: number;
}

function limiter(concurrency: number) {
  let active = 0;
  const queue: (() => void)[] = [];
  return async <T>(fn: () => Promise<T>): Promise<T> => {
    if (active >= concurrency) await new Promise<void>((r) => queue.push(r));
    active++;
    try {
      return await fn();
    } finally {
      active--;
      queue.shift()?.();
    }
  };
}

const legsOf = (r: RoadRoute): RoadLegValue[] => r.legs.map((l) => ({ meters: l.meters, seconds: l.seconds }));

export async function buildRoads(
  data: DispatchDataset,
  routing: RoutingProvider | undefined,
  positions: Map<string, LivePosition>,
  opts: RoadBuildOptions = {},
): Promise<{ roads: Record<string, TourRoad>; pending: boolean; report: RoadBuildReport }> {
  const t0 = Date.now();
  const roads: Record<string, TourRoad> = {};
  const minuteOf = (iso: string | undefined) => minuteOfDay(iso, data.timeZone ?? "UTC");
  const gpsOf = (tourId: string) => {
    const p = positions.get(tourId);
    return p ? { ageSeconds: p.ageSeconds } : undefined;
  };
  if (!routing) {
    for (const t of data.tours) roads[t.id] = { source: "estimate", reason: "not_configured", gps: gpsOf(t.id) };
    return { roads, pending: false, report: { tours: data.tours.length, pending: 0, estimated: data.tours.length, elapsedMs: Date.now() - t0 } };
  }
  const run = limiter(opts.concurrency ?? 4);
  const budgetMs = opts.budgetMs ?? 1500;
  const deadline = new Promise<"timeout">((r) => setTimeout(() => r("timeout"), budgetMs).unref?.());

  type Job = { tourId: string; done: Promise<TourRoad>; gpsPair?: { from: GeoPoint; to: GeoPoint; toStopId: string } };
  const jobs: Job[] = [];
  for (const tour of data.tours) {
    const depot = data.depots.find((d) => d.id === tour.depotId);
    if (!depot) continue;
    const stops = data.stops.filter((s) => s.tourId === tour.id);
    const wp = roadWaypoints(tour, stops, depot.location, minuteOf);
    const pos = positions.get(tour.id);
    const running = tour.status === "in_progress" || tour.status === "paused";
    const gpsPair = running && pos && pos.ageSeconds <= LIVE_GPS_MAX_AGE_SECONDS && wp.firstOpen ? { from: { lat: pos.lat, lng: pos.lng }, to: routePoint(wp.firstOpen)!, toStopId: wp.firstOpen.id } : undefined;
    const done = (async (): Promise<TourRoad> => {
      // Which stop list a routing error's point indexes refer to: the plan, or the remaining route
      // (whose index 0 is the last completed stop, the anchor).
      let failedIds: (string | null)[] = wp.plan.stopIds;
      try {
        const plan = wp.plan.points.length >= 2 ? await run(() => routing.route(wp.plan.points)) : null;
        if (wp.remaining) failedIds = wp.remaining.stopIds.map((id, i) => (i === 0 ? wp.remaining!.anchorStopId : id));
        const rem = wp.remaining && wp.remaining.points.length >= 2 ? await run(() => routing.route(wp.remaining!.points)) : null;
        return {
          source: "osrm",
          plan: { stopIds: wp.plan.stopIds, legs: plan ? legsOf(plan) : [] },
          ...(wp.remaining ? { remaining: { stopIds: wp.remaining.stopIds, anchorStopId: wp.remaining.anchorStopId, legs: rem ? legsOf(rem) : [] } } : {}),
          gps: gpsOf(tour.id),
        };
      } catch (e) {
        if (e instanceof RoutingOutOfCoverage) {
          const ids = e.points.map((p) => failedIds[p.index]).filter((x): x is string => !!x);
          return { source: "estimate", reason: "out_of_coverage", stopIds: ids, gps: gpsOf(tour.id) };
        }
        return { source: "estimate", reason: "routing_unavailable", gps: gpsOf(tour.id) };
      }
    })();
    jobs.push({ tourId: tour.id, done, gpsPair });
  }

  // Live legs: one request for every running tour with a fresh position.
  const pairs = jobs.filter((j) => j.gpsPair);
  const liveLegs: Promise<RoadLegValue[] | null> =
    pairs.length === 0
      ? Promise.resolve(null)
      : (routing.pairLegs ? routing.pairLegs(pairs.map((j) => j.gpsPair!)) : Promise.all(pairs.map((j) => routing.route([j.gpsPair!.from, j.gpsPair!.to]).then((r) => r.legs[0] ?? { meters: NaN, seconds: NaN })))).catch(
          () => null,
        );

  const settled = await Promise.race([Promise.all([Promise.all(jobs.map((j) => j.done)), liveLegs]), deadline]);
  let pending = false;
  if (settled === "timeout") {
    pending = true;
    // Use what is finished; the rest keeps running and lands in the routing cache.
    const results = await Promise.all(jobs.map((j) => Promise.race([j.done, Promise.resolve(null)])));
    jobs.forEach((j, i) => {
      roads[j.tourId] = results[i] ?? { source: "estimate", reason: "pending", gps: gpsOf(j.tourId) };
    });
    void liveLegs; // dropped for this load
  } else {
    const [results, live] = settled;
    jobs.forEach((j, i) => (roads[j.tourId] = results[i]!));
    if (live) {
      pairs.forEach((j, i) => {
        const road = roads[j.tourId];
        const leg = live[i];
        if (road?.source === "osrm" && leg && Number.isFinite(leg.seconds)) road.gps = { ...road.gps!, firstLeg: leg, toStopId: j.gpsPair!.toStopId };
      });
    }
  }
  const values = Object.values(roads);
  return {
    roads,
    pending,
    report: {
      tours: jobs.length,
      pending: values.filter((r) => r.source === "estimate" && r.reason === "pending").length,
      estimated: values.filter((r) => r.source === "estimate").length,
      elapsedMs: Date.now() - t0,
    },
  };
}
