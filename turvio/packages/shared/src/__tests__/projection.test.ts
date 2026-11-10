import { describe, expect, it } from "vitest";
import { minuteOfDay, summarizeTours, tourTimeline } from "../dispatch/ops";
import { LIVE_GPS_MAX_AGE_SECONDS, projectTour, roadWaypoints, type ProjectionInput, type TourRoad } from "../dispatch/projection";
import type { Depot, Driver, GeoPoint, Stop, Tour } from "../schemas";
import her01 from "./fixtures/her01-2026-11-08.json";
import her01Legs from "./fixtures/her01-road-legs-2026-11-10.json";

// ---------------------------------------------------------------- helpers
const DEPOT: GeoPoint = { lat: 52.37, lng: 9.73 };
const minuteOf = (iso: string | undefined) => minuteOfDay(iso, "UTC");
const at = (minute: number) => `2026-11-10T${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(Math.round(minute % 60)).padStart(2, "0")}:00.000Z`;
const tour = (extra: Partial<Tour> = {}): Tour =>
  ({ id: "t", organizationId: "o", name: "T", date: "2026-11-10", depotId: "d", driverId: "drv", vehicleId: null, status: "planned", plannedStartMinute: 480, ...extra }) as Tour;
const stop = (i: number, extra: Partial<Stop> = {}): Stop =>
  ({
    id: `s${i}`,
    tourId: "t",
    type: "delivery",
    sequence: i,
    status: "pending",
    address: { street: "Teststraße", houseNumber: String(i + 1), postalCode: "30161", city: "Hannover", countryCode: "DE" },
    location: { lat: 52.38 + i * 0.002, lng: 9.74 },
    serviceSeconds: 120,
    priority: false,
    parcels: [],
    ...extra,
  }) as Stop;
/** Every leg 10 min / 3 km – easy to check by hand. */
const leg = { meters: 3000, seconds: 600 };
const legs = (n: number) => Array.from({ length: n }, () => ({ ...leg }));

function roadFor(t: Tour, stops: Stop[], gps?: { ageSeconds: number; firstLeg?: { meters: number; seconds: number } }): TourRoad {
  const wp = roadWaypoints(t, stops, DEPOT, minuteOf);
  return {
    source: "osrm",
    plan: { stopIds: wp.plan.stopIds, legs: legs(wp.plan.points.length - 1) },
    ...(wp.remaining ? { remaining: { stopIds: wp.remaining.stopIds, anchorStopId: wp.remaining.anchorStopId, legs: legs(wp.remaining.points.length - 1) } } : {}),
    ...(gps ? { gps: { ...gps, ...(gps.firstLeg && wp.firstOpen ? { toStopId: wp.firstOpen.id } : {}) } } : {}),
  };
}
const project = (t: Tour, stops: Stop[], nowMinute: number, road?: TourRoad, extra: Partial<ProjectionInput> = {}) =>
  projectTour({ tour: t, stops, depotLocation: DEPOT, maxShiftMinutes: 480, nowMinute, road, minuteOf, ...extra });

// ---------------------------------------------------------------- road times
describe("projection from road legs", () => {
  it("planned tour: road legs + service time + waiting; return leg to the depot", () => {
    const t = tour();
    const stops = [stop(0), stop(1, { timeWindow: { start: 520, end: 600 } }), stop(2)];
    const p = project(t, stops, 400, roadFor(t, stops));
    expect(p.source).toBe("road");
    expect(p.origin).toBe("tour_start");
    expect(p.stops.get("s0")!.etaMinute).toBe(490); // 08:00 + 10 min
    expect(p.stops.get("s1")!.etaMinute).toBe(520); // 08:12 + 10 = 08:22 -> waits for 08:40
    expect(p.remainingWaitSeconds).toBe(18 * 60);
    expect(p.stops.get("s2")!.etaMinute).toBe(532); // 08:40 + 2 + 10
    expect(p.finishMinute).toBe(544); // + 2 min service + 10 min back
    expect(p.endsAtLastStop).toBe(false);
    expect(p.totalDriveSeconds).toBe(4 * 600);
    expect(p.remainingServiceSeconds).toBe(3 * 120);
    expect(p.delayed).toBe(false);
  });

  it("tour ending at its last stop: no return leg in time or distance", () => {
    const t = tour({ endMode: "last_stop" });
    const stops = [stop(0), stop(1)];
    const p = project(t, stops, 400, roadFor(t, stops));
    expect(p.endsAtLastStop).toBe(true);
    expect(p.finishMinute).toBe(480 + 10 + 2 + 10 + 2);
    expect(p.totalMeters).toBe(2 * 3000);
  });

  it("running tour with a fresh GPS position: counts from the live position now", () => {
    const t = tour({ status: "in_progress", startedAt: at(480) });
    const stops = [stop(0, { status: "delivered", completedAt: at(492) }), stop(1), stop(2)];
    const road = roadFor(t, stops, { ageSeconds: 30, firstLeg: { meters: 900, seconds: 180 } });
    const p = project(t, stops, 540, road);
    expect(p.origin).toBe("gps");
    expect(p.gpsAgeSeconds).toBe(30);
    expect(p.stops.get("s1")!.etaMinute).toBe(543); // now + 3 min from the live position
    expect(p.stops.get("s0")!.state).toBe("done");
  });

  it("running tour with a stale GPS position: from the last completed stop, GPS age reported", () => {
    const t = tour({ status: "in_progress", startedAt: at(480) });
    const stops = [stop(0, { status: "delivered", completedAt: at(492) }), stop(1), stop(2)];
    const road = roadFor(t, stops, { ageSeconds: LIVE_GPS_MAX_AGE_SECONDS + 600 });
    const p = project(t, stops, 540, road);
    expect(p.origin).toBe("last_completed_stop");
    expect(p.gpsAgeSeconds).toBe(LIVE_GPS_MAX_AGE_SECONDS + 600);
    expect(p.stops.get("s1")!.etaMinute).toBe(550); // max(now, completion) + 10 min road leg
  });

  it("paused tour: conditional ETA assuming the driver resumes now", () => {
    const t = tour({ status: "paused", startedAt: at(480) });
    const stops = [stop(0, { status: "delivered", completedAt: at(492) }), stop(1)];
    const p = project(t, stops, 600, roadFor(t, stops));
    expect(p.condition).toBe("resume_now");
    expect(p.stops.get("s1")!.etaMinute).toBe(610);
  });

  it("overdue tour without a driver says so (not 'starts within the hour')", () => {
    const t = tour({ driverId: null });
    const p = project(t, [stop(0)], 540, roadFor(t, [stop(0)]), { isToday: true });
    expect(p.delayReasons.find((r) => r.kind === "no_driver")!.text).toBe("Should have started at 08:00 – no driver");
    expect(project(t, [stop(0)], 450, roadFor(t, [stop(0)]), { isToday: true }).delayReasons.find((r) => r.kind === "no_driver")!.text).toBe("Starts within the hour without a driver");
  });

  it("planned tour that should have started: 'start now' today, the plan on other days", () => {
    const t = tour();
    const stops = [stop(0)];
    expect(project(t, stops, 540, roadFor(t, stops), { isToday: true })).toMatchObject({ condition: "start_now", fromMinute: 540 });
    expect(project(t, stops, 540, roadFor(t, stops), { isToday: false })).toMatchObject({ condition: null, fromMinute: 480 });
  });
});

// ---------------------------------------------------------------- deadlines and delay certainty
describe("deadlines: facts vs predictions", () => {
  const t = tour({ status: "in_progress", startedAt: at(480) });

  it("deadline already passed = confirmed; projected after the deadline = projected; completed late = delivered late", () => {
    const stops = [
      stop(0, { status: "delivered", completedAt: at(560), timeWindow: { start: 480, end: 540 } }),
      stop(1, { timeWindow: { start: 480, end: 590 } }), // now 600: already missed
      stop(2, { timeWindow: { start: 480, end: 615 } }), // ETA after 615: projected late
      stop(3, { timeWindow: { start: 480, end: 645 } }), // ETA 634, within 15 min of 645: close
      stop(4),
    ];
    const p = project(t, stops, 600, roadFor(t, stops));
    expect(p.stops.get("s0")).toMatchObject({ state: "delivered_late", lateMinutes: 20 });
    expect(p.stops.get("s1")!.state).toBe("deadline_missed");
    expect(p.stops.get("s2")!.state).toBe("projected_late");
    expect(p.stops.get("s3")!.state).toBe("at_risk");
    expect(p.stops.get("s4")!.state).toBe("on_time");
    expect(p.delayCertainty).toBe("confirmed");
    expect(p.delayReasons.map((r) => [r.kind, r.certainty])).toEqual([
      ["deadline_missed", "confirmed"],
      ["projected_late", "projected"],
    ]);
  });

  it("only a prediction: 'projected' with road times, 'estimated' without", () => {
    const stops = [stop(0, { timeWindow: { start: 480, end: 602 } })]; // road ETA 610, straight-line ETA ~603.5
    expect(project(t, stops, 600, roadFor(t, stops)).delayCertainty).toBe("projected");
    const est = project(t, stops, 600, { source: "estimate", reason: "routing_unavailable" });
    expect(est.delayCertainty).toBe("estimated");
    expect(est.delayReasons[0]!.text).toMatch(/estimate/);
  });
});

// ---------------------------------------------------------------- incomplete and fallbacks
describe("incomplete data and fallbacks", () => {
  it("stops without coordinates: incomplete, named, no ETA for them", () => {
    const t = tour();
    const stops = [stop(0), stop(1, { location: undefined }), stop(2)];
    const p = project(t, stops, 400, roadFor(t, stops));
    expect(p.complete).toBe(false);
    expect(p.unlocatedStopIds).toEqual(["s1"]);
    expect(p.stops.get("s1")).toMatchObject({ state: "unknown" });
    expect(Number.isFinite(p.stops.get("s1")!.etaMinute)).toBe(false);
  });

  it("never mixes: road data for another stop order makes the whole tour a labelled estimate", () => {
    const t = tour();
    const stops = [stop(0), stop(1), stop(2)];
    const road = roadFor(t, stops);
    const reordered = [stop(0, { sequence: 2 }), stop(1), stop(2, { sequence: 0 })];
    const p = project(t, reordered, 400, road);
    expect(p.source).toBe("estimate");
    expect(p.estimateReason).toBe("stale");
    // Every leg is a straight-line value now – none of the 10-minute road legs survives.
    expect(p.stops.get("s2")!.etaMinute).not.toBe(490);
  });

  it("routing failures are labelled and keep the named stops", () => {
    const t = tour();
    const p = project(t, [stop(0)], 400, { source: "estimate", reason: "out_of_coverage", stopIds: ["s0"] });
    expect(p).toMatchObject({ source: "estimate", estimateReason: "out_of_coverage", estimateStopIds: ["s0"] });
    expect(project(t, [stop(0)], 400).estimateReason).toBe("not_configured");
  });

  it("a GPS leg is never applied to a straight-line estimate", () => {
    const t = tour({ status: "in_progress", startedAt: at(480) });
    const p = project(t, [stop(0)], 500, { source: "estimate", reason: "routing_unavailable", gps: { ageSeconds: 10 } });
    expect(p.origin).toBe("tour_start");
    expect(p.gpsAgeSeconds).toBe(10);
  });
});

// ---------------------------------------------------------------- HER-01 on real road legs
describe("HER-01 with real road legs (Hannover OSRM)", () => {
  const depot = { id: "dep", organizationId: "org", name: "Hermes Suhl", address: { street: "Depotweg", houseNumber: "1", postalCode: "98527", city: "Suhl", countryCode: "DE" }, location: her01.depot } as Depot;
  const driver = { id: "drv", organizationId: "org", displayName: "Florin", depotId: "dep", maxShiftMinutes: her01.maxShiftMinutes, active: true } as Driver;
  const t = tour({ id: "her01", startLocation: her01.start, endMode: "last_stop", plannedStartMinute: her01.plannedStartMinute, depotId: "dep" });
  const stops = her01.stops.map((s, i) => stop(i, { tourId: "her01", location: { lat: s.lat, lng: s.lng }, serviceSeconds: s.serviceSeconds }));
  const road: TourRoad = { source: "osrm", plan: { stopIds: [null, ...stops.map((s) => s.id)], legs: her01Legs.legs } };

  it("finish equals the optimizer's plan within 1 minute (straight line was off by up to an hour)", () => {
    const tl = tourTimeline(t, stops, depot, driver, 400, "UTC", { road });
    expect(tl.projection.source).toBe("road");
    expect(Math.abs(tl.projectedEndMinute - her01.optimizer.endMinute)).toBeLessThan(1);
    expect(Math.abs(tl.projection.totalDriveSeconds - her01.optimizer.driveSeconds)).toBeLessThan(60);
    expect(Math.abs(tl.projection.totalMeters - her01.optimizer.distanceMeters)).toBeLessThan(100);
    expect(tl.delayed).toBe(false);
  });

  it("the Dispatch summary (list, KPIs, pickups) uses the same road projection", () => {
    const data = { organizationId: "org", date: "2026-11-10", asOfMinute: 400, timeZone: "UTC", depots: [depot], drivers: [driver], vehicles: [], tours: [t], stops, unassigned: [], roads: { her01: road } };
    const [s] = summarizeTours(data as never);
    expect(s!.timeline.projection.source).toBe("road");
    expect(Math.abs(s!.timeline.projectedEndMinute - her01.optimizer.endMinute)).toBeLessThan(1);
    expect(s!.status).toBe("planned");
  });
});

// ---------------------------------------------------------------- accepted approach points (P0-3.3)
describe("accepted approach point", () => {
  it("routing waypoints and straight-line estimates use the approach point; the stop keeps its coordinate", () => {
    const t = tour();
    const approach = { lat: 52.3905, lng: 9.7505, roadName: "Klusriede" };
    const stops = [stop(0), stop(1, { approach }), stop(2)];
    const wp = roadWaypoints(t, stops, DEPOT, minuteOf);
    expect(wp.plan.points[2]).toEqual({ lat: approach.lat, lng: approach.lng });
    expect(wp.plan.stopIds[2]).toBe("s1");
    expect(stops[1]!.location).toEqual(stop(1).location);
    // Straight-line estimate: different from the same tour without the approach point.
    const withA = project(t, stops, 400);
    const without = project(t, [stop(0), stop(1), stop(2)], 400);
    expect(withA.source).toBe("estimate");
    expect(withA.totalMeters).not.toBe(without.totalMeters);
    // Road legs computed for the approach waypoints are accepted (same stop ids / order).
    const road = roadFor(t, stops);
    expect(project(t, stops, 400, road).source).toBe("road");
  });
});

describe("certainly wrong coordinates (P0-3)", () => {
  it("a swapped or 0,0 coordinate counts as no usable map position: incomplete, named, no 16,000 km estimate", () => {
    const t = tour();
    const swapped = stop(1, { location: { lat: 9.74, lng: 52.38 } });
    const zero = stop(2, { location: { lat: 0, lng: 0 } });
    const p = project(t, [stop(0), swapped, zero], 400);
    expect(p.complete).toBe(false);
    expect(p.unlocatedStopIds).toEqual(["s1", "s2"]);
    expect(p.stops.get("s1")!.state).toBe("unknown");
    expect(p.totalMeters).toBeLessThan(10_000);
    // Road waypoints leave them out too (they would make the whole tour "out of coverage").
    expect(roadWaypoints(t, [stop(0), swapped, zero], DEPOT, minuteOf).plan.stopIds).toEqual([null, "s0", null]);
  });
});
