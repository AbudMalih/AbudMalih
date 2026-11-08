import { describe, expect, it } from "vitest";
import { summarizeTours, tourTimeline } from "../dispatch/ops";
import { estimateDrive } from "../geo";
import type { Depot, Driver, GeoPoint, Stop, Tour } from "../schemas";
import her01 from "./fixtures/her01-2026-11-08.json";

/** HER-01 on staging after optimization (2026-11-08): see the fixture's _source. */
const HER01 = her01 as unknown as {
  depot: GeoPoint;
  start: GeoPoint;
  plannedStartMinute: number;
  maxShiftMinutes: number;
  optimizer: { endMinute: number };
  stops: { lat: number; lng: number; serviceSeconds: number }[];
};

const depotAt = (location: GeoPoint): Depot => ({ id: "dep", organizationId: "org", name: "Depot", address: { street: "Depotweg", houseNumber: "1", postalCode: "98527", city: "Suhl", countryCode: "DE" }, location }) as Depot;
const driver = (maxShiftMinutes = 480): Driver => ({ id: "drv", organizationId: "org", displayName: "Florin", depotId: "dep", maxShiftMinutes, active: true }) as Driver;
const tourWith = (extra: Partial<Tour> = {}): Tour =>
  ({ id: "tour", organizationId: "org", name: "HER-01", date: "2026-11-08", depotId: "dep", driverId: "drv", vehicleId: null, status: "planned", plannedStartMinute: 450, ...extra }) as Tour;
const stopsAt = (points: GeoPoint[], serviceSeconds = 120, extra: (i: number) => Partial<Stop> = () => ({})): Stop[] =>
  points.map(
    (p, i) =>
      ({ id: `s${i}`, tourId: "tour", type: "delivery", sequence: i, status: "pending", address: { street: "Teststraße", houseNumber: String(i + 1), postalCode: "30163", city: "Hannover", countryCode: "DE" }, location: p, serviceSeconds, priority: false, parcels: [], ...extra(i) }) as Stop,
  );
const minutes = (a: GeoPoint, b: GeoPoint) => estimateDrive(a, b).seconds / 60;

describe("tour timeline respects the tour's own start and end (HER-01 regression)", () => {
  const depot = depotAt(HER01.depot); // Hermes Suhl – 210 km from the stops
  const stops = stopsAt(HER01.stops.map((s) => ({ lat: s.lat, lng: s.lng })));
  const her01 = tourWith({ startLocation: HER01.start, endMode: "last_stop", plannedStartMinute: HER01.plannedStartMinute });

  it("100 stops in Hannover, custom start in Hannover, depot in Suhl, end at last stop: not delayed", () => {
    const tl = tourTimeline(her01, stops, depot, driver(HER01.maxShiftMinutes), 600);
    expect(tl.delayed).toBe(false);
    expect(tl.delayReasons).toEqual([]);
    // First stop: a few minutes from the custom start – not 9 h from Suhl (bug: 17:02).
    const first = tl.projections.get("s0")!.etaMinute;
    expect(first - HER01.plannedStartMinute).toBeCloseTo(minutes(HER01.start, stops[0]!.location!), 6);
    expect(first).toBeLessThan(HER01.plannedStartMinute + 10);
    // Ends at the last stop (no drive back to Suhl; bug: 11:34 the next day), within the shift.
    const last = tl.projections.get("s99")!.etaMinute;
    expect(tl.projectedEndMinute).toBeCloseTo(last + 2, 6); // + service at the last stop
    expect(tl.projectedEndMinute).toBeLessThan(tl.shiftEndMinute);
    // Same ballpark as the optimizer's road-based plan (12:13): straight-line estimate, ±1 h.
    expect(Math.abs(tl.projectedEndMinute - HER01.optimizer.endMinute)).toBeLessThan(60);
    // Distance from the custom start, no return leg: tens of km, not hundreds.
    expect(tl.distanceMeters).toBeLessThan(60_000);
  });

  it("Dispatch shows HER-01 as planned, not delayed (tour list / KPI status)", () => {
    const data = { organizationId: "org", date: "2026-11-08", asOfMinute: 600, timeZone: "Europe/Berlin", depots: [depot], drivers: [driver(HER01.maxShiftMinutes)], vehicles: [], tours: [her01], stops, unassigned: [] };
    const [summary] = summarizeTours(data as never);
    expect(summary!.status).toBe("planned");
    expect(summary!.timeline.delayed).toBe(false);
  });

  it("the same tour without its own start and end is (correctly) far from its Suhl depot", () => {
    const tl = tourTimeline(tourWith({ plannedStartMinute: HER01.plannedStartMinute }), stops, depot, driver(HER01.maxShiftMinutes), 600);
    expect(tl.projections.get("s0")!.etaMinute).toBeCloseTo(450 + minutes(HER01.depot, stops[0]!.location!), 6);
    expect(tl.delayed).toBe(true); // 2 × 210 km – the warning is right here
  });
});

describe("tour timeline: start and end options", () => {
  const depot = depotAt({ lat: 52.37, lng: 9.73 });
  const pts = [
    { lat: 52.38, lng: 9.74 },
    { lat: 52.39, lng: 9.75 },
    { lat: 52.4, lng: 9.76 },
  ];
  const stops = stopsAt(pts, 180);
  // Expected end: drive between stops + 3 min service each, then the leg to `end` (if any).
  const expectedEnd = (start: GeoPoint, end?: GeoPoint) => {
    let t = 450;
    let pos = start;
    for (const p of pts) {
      t += minutes(pos, p) + 3;
      pos = p;
    }
    return t + (end ? minutes(pos, end) : 0);
  };

  it("default: depot to depot (unchanged behaviour)", () => {
    const tl = tourTimeline(tourWith(), stops, depot, driver(), 400);
    expect(tl.projections.get("s0")!.etaMinute).toBeCloseTo(450 + minutes(depot.location, pts[0]!), 6);
    expect(tl.projectedEndMinute).toBeCloseTo(expectedEnd(depot.location, depot.location), 6);
    expect(tl.delayed).toBe(false);
  });

  it("custom start, back to the depot", () => {
    const start = { lat: 52.42, lng: 9.7 };
    const tl = tourTimeline(tourWith({ startLocation: start, endMode: "depot" }), stops, depot, driver(), 400);
    expect(tl.projections.get("s0")!.etaMinute).toBeCloseTo(450 + minutes(start, pts[0]!), 6);
    expect(tl.projectedEndMinute).toBeCloseTo(expectedEnd(start, depot.location), 6);
  });

  it("custom end address", () => {
    const end = { lat: 52.45, lng: 9.8 };
    const tl = tourTimeline(tourWith({ endMode: "address", endLocation: end }), stops, depot, driver(), 400);
    expect(tl.projectedEndMinute).toBeCloseTo(expectedEnd(depot.location, end), 6);
  });

  it("end at the last stop: no drive back", () => {
    const tl = tourTimeline(tourWith({ endMode: "last_stop" }), stops, depot, driver(), 400);
    expect(tl.projectedEndMinute).toBeCloseTo(expectedEnd(depot.location), 6);
    expect(tl.projectedEndMinute).toBeCloseTo(tl.projections.get("s2")!.etaMinute + 3, 6);
  });

  it("older tours without an end mode but with an end point end there", () => {
    const end = { lat: 52.45, lng: 9.8 };
    const tl = tourTimeline(tourWith({ endLocation: end }), stops, depot, driver(), 400);
    expect(tl.projectedEndMinute).toBeCloseTo(expectedEnd(depot.location, end), 6);
  });

  it("a tour on the road projects from the last completed stop, not from its start", () => {
    const start = { lat: 52.5, lng: 9.6 };
    const driven = stopsAt(pts, 180, (i) => (i === 0 ? { status: "delivered", completedAt: "2026-11-08T08:00:00.000Z" } : {}));
    const tl = tourTimeline(tourWith({ status: "in_progress", startedAt: "2026-11-08T06:30:00.000Z", startLocation: start, endMode: "last_stop" }), driven, depot, driver(), 9 * 60, "Europe/Berlin");
    // Now 09:00, last completed stop s0 -> s1.
    expect(tl.projections.get("s1")!.etaMinute).toBeCloseTo(9 * 60 + minutes(pts[0]!, pts[1]!), 6);
  });

  it("a late projection is still reported (the fix must not hide real delays)", () => {
    const tl = tourTimeline(tourWith({ endMode: "last_stop" }), stops, depot, driver(5), 400);
    expect(tl.delayed).toBe(true);
    expect(tl.delayReasons).toContain("Projected end exceeds the driver's shift");
  });
});
