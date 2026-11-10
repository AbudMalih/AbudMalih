import { dispatchKpis, minuteOfDay, pickupRows, roadWaypoints, summarizeTours, type DispatchDataset, type Stop, type Tour, type TourRoad } from "@turvio/shared";
import { describe, expect, it } from "vitest";
import { delayLabel, finishTitle, finishValue, projectionNote, stopStateLabel } from "../lib/eta";

/**
 * One projection for every Dispatch view (P0-2): the stop row, map tooltip, tour status, KPI and
 * pickup state of the same stop must agree, and labels never present a guess as a fact.
 */
const DEPOT = { lat: 52.37, lng: 9.73 };
const at = (m: number) => `2026-11-10T${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}:00.000Z`;
const minuteOf = (iso: string | undefined) => minuteOfDay(iso, "UTC");
const stop = (tourId: string, i: number, extra: Partial<Stop> = {}): Stop =>
  ({
    id: `${tourId}-s${i}`,
    tourId,
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
const tour = (id: string, extra: Partial<Tour> = {}): Tour =>
  ({ id, organizationId: "o", name: id, date: "2026-11-10", depotId: "d", driverId: "drv", vehicleId: null, status: "in_progress", startedAt: at(480), plannedStartMinute: 480, ...extra }) as Tour;
const roadOf = (t: Tour, stops: Stop[], gps?: { ageSeconds: number; leg?: boolean }): TourRoad => {
  const wp = roadWaypoints(t, stops, DEPOT, minuteOf);
  const legs = (n: number) => Array.from({ length: n }, () => ({ meters: 3000, seconds: 600 }));
  return {
    source: "osrm",
    plan: { stopIds: wp.plan.stopIds, legs: legs(wp.plan.points.length - 1) },
    ...(wp.remaining ? { remaining: { stopIds: wp.remaining.stopIds, anchorStopId: wp.remaining.anchorStopId, legs: legs(wp.remaining.points.length - 1) } } : {}),
    ...(gps ? { gps: { ageSeconds: gps.ageSeconds, ...(gps.leg && wp.firstOpen ? { firstLeg: { meters: 500, seconds: 120 }, toStopId: wp.firstOpen.id } : {}) } } : {}),
  };
};

function dataset(): DispatchDataset {
  // A: running, live GPS, one missed deadline (pickup), one projected late (pickup), one close.
  const a = tour("A");
  const aStops = [
    stop("A", 0, { status: "delivered", completedAt: at(500) }),
    stop("A", 1, { type: "pickup", timeWindow: { start: 480, end: 590 } }),
    stop("A", 2, { type: "pickup", timeWindow: { start: 480, end: 612 } }),
    stop("A", 3, { timeWindow: { start: 480, end: 640 } }),
  ];
  // B: paused, stale GPS, straight-line estimate (routing failed), finish after shift.
  const b = tour("B", { status: "paused" });
  const bStops = [stop("B", 0, { location: { lat: 52.6, lng: 10.2 } }), stop("B", 1, { type: "pickup", timeWindow: { start: 480, end: 700 } })];
  // C: planned, ends at its last stop, one stop without a position.
  const c = tour("C", { status: "planned", startedAt: undefined, plannedStartMinute: 720, endMode: "last_stop" });
  const cStops = [stop("C", 0), stop("C", 1, { location: undefined }), stop("C", 2)];
  return {
    organizationId: "o",
    date: "2026-11-10",
    asOfMinute: 600,
    isToday: true,
    timeZone: "UTC",
    depots: [{ id: "d", organizationId: "o", name: "Depot", address: { street: "x", houseNumber: "1", postalCode: "30161", city: "Hannover", countryCode: "DE" }, location: DEPOT }],
    drivers: [{ id: "drv", organizationId: "o", displayName: "D", depotId: "d", maxShiftMinutes: 120, active: true }],
    vehicles: [],
    tours: [a, b, c],
    stops: [...aStops, ...bStops, ...cStops],
    unassigned: [],
    roads: { A: roadOf(a, aStops, { ageSeconds: 25, leg: true }), B: { source: "estimate", reason: "routing_unavailable", gps: { ageSeconds: 900 } }, C: roadOf(c, cStops) },
  } as DispatchDataset;
}

describe("one projection for every Dispatch view", () => {
  const data = dataset();
  const summaries = summarizeTours(data);
  const byId = Object.fromEntries(summaries.map((s) => [s.tour.id, s]));

  it("stop row, map and pickup state of the same stop agree", () => {
    const pickups = pickupRows(data, summaries);
    const map = { deadline_missed: "missed", projected_late: "late", at_risk: "at_risk", on_time: "scheduled" } as const;
    for (const row of pickups.filter((r) => r.tourId)) {
      const s = byId[row.tourId!]!;
      const p = s.timeline.projections.get(row.stop.id)!;
      expect(row.state).toBe(map[p.state as keyof typeof map]);
      expect(row.etaMinute).toBe(p.etaMinute);
      expect(row.estimated).toBe(s.timeline.projection.source === "estimate");
    }
    // Facts and predictions use different words.
    const a = byId.A!.timeline;
    expect(stopStateLabel(a.projections.get("A-s1")!.state, "road")!.label).toBe("Deadline missed");
    expect(stopStateLabel(a.projections.get("A-s2")!.state, "road")!.label).toBe("Projected late");
    expect(stopStateLabel("projected_late", "estimate")!.label).toBe("Possibly late (estimate)");
  });

  it("tour status, KPIs and delay certainty agree", () => {
    const kpis = dispatchKpis(data, summaries);
    expect(byId.A!.status).toBe("delayed");
    expect(byId.A!.delayCertainty).toBe("confirmed"); // a deadline already passed
    expect(byId.B!.delayCertainty).toBe("estimated"); // only a straight-line prediction
    expect(delayLabel(byId.B!.delayCertainty)).toBe("Delay possible (estimate)");
    expect(kpis.delayedTours).toBe(summaries.filter((s) => s.status === "delayed").length);
    expect(kpis.delayedConfirmed + kpis.delayedProjected + kpis.delayedEstimated).toBe(kpis.delayedTours);
  });

  it("live position, stale GPS and pause are labelled; GPS age shown", () => {
    const a = byId.A!.timeline.projection;
    expect(a.origin).toBe("gps");
    expect(projectionNote(a)).toBe("Road times (OSRM) · from live position (25 s old)");
    const b = byId.B!.timeline.projection;
    expect(projectionNote(b)).toBe(
      "Straight-line estimate – road routing is unavailable · from tour start · last GPS 15 min ago · Paused – times assume the driver resumes now",
    );
  });

  it("incomplete tours never show a definitive finish; open end is named as such", () => {
    const c = byId.C!;
    expect(c.timeline.projection.complete).toBe(false);
    expect(finishValue(c.timeline.projection)).toMatch(/^≥ /);
    expect(finishTitle(c.tour, c.timeline.projection)).toBe("Finish at last stop");
    expect(finishTitle(byId.A!.tour, byId.A!.timeline.projection)).toBe("Return to depot");
    expect(projectionNote(c.timeline.projection)).toMatch(/incomplete: 1 stop without a usable map position/);
    expect(stopStateLabel(c.timeline.projections.get("C-s1")!.state, "road")!.label).toBe("No ETA – no usable map position");
  });
});
