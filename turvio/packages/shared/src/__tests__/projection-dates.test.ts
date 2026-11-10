import { describe, expect, it } from "vitest";
import { minuteOfDay, operatingClock, summarizeTours } from "../dispatch/ops";
import { projectTour, roadWaypoints, type TourRoad } from "../dispatch/projection";
import type { DispatchDataset } from "../dispatch/dataset";
import type { GeoPoint, Stop, Tour } from "../schemas";

/**
 * P0-2 verification: planned (tomorrow / today, not started), completed and paused tours, and the
 * operating-day clock in Germany (date boundary, CET/CEST, DST change days).
 * Every leg 10 min; service 2 min. A 3-stop tour from 08:00 with a depot return finishes at 08:46.
 */
const TZ = "Europe/Berlin";
const DEPOT: GeoPoint = { lat: 52.37, lng: 9.73 };
const minuteOf = (iso: string | undefined) => minuteOfDay(iso, TZ);
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
const tour = (extra: Partial<Tour> = {}): Tour =>
  ({ id: "t", organizationId: "o", name: "T", date: "2026-11-11", depotId: "d", driverId: "drv", vehicleId: null, status: "planned", plannedStartMinute: 480, ...extra }) as Tour;
function roadFor(t: Tour, stops: Stop[]): TourRoad {
  const wp = roadWaypoints(t, stops, DEPOT, minuteOf);
  const legs = (n: number) => Array.from({ length: n }, () => ({ meters: 3000, seconds: 600 }));
  return {
    source: "osrm",
    plan: { stopIds: wp.plan.stopIds, legs: legs(wp.plan.points.length - 1) },
    ...(wp.remaining ? { remaining: { stopIds: wp.remaining.stopIds, anchorStopId: wp.remaining.anchorStopId, legs: legs(wp.remaining.points.length - 1) } } : {}),
  };
}
const three = () => [stop(0), stop(1), stop(2)];
/** Dataset exactly as the API builds it (operatingClock) for `date`, seen at instant `now`. */
function dataset(date: string, now: Date, t: Tour, stops: Stop[]): DispatchDataset {
  const clock = operatingClock(date, TZ, now);
  return {
    organizationId: "o",
    date: clock.date,
    asOfMinute: clock.asOfMinute,
    isToday: clock.isToday,
    timeZone: TZ,
    depots: [{ id: "d", organizationId: "o", name: "Depot", address: { street: "x", houseNumber: "1", postalCode: "30161", city: "Hannover", countryCode: "DE" }, location: DEPOT }],
    drivers: [{ id: "drv", organizationId: "o", displayName: "D", depotId: "d", maxShiftMinutes: 480, active: true }],
    vehicles: [],
    tours: [{ ...t, date }],
    stops,
    unassigned: [],
    roads: { t: roadFor(t, stops) },
  } as DispatchDataset;
}

describe("1. tour scheduled tomorrow 08:00", () => {
  // Today is 2026-11-10, 14:30 in Berlin (13:30 UTC).
  const now = new Date("2026-11-10T13:30:00Z");
  it("projects from tomorrow's planned departure, not from the current time", () => {
    const s = summarizeTours(dataset("2026-11-11", now, tour(), three()))[0]!;
    const p = s.timeline.projection;
    expect(p.fromMinute).toBe(480);
    expect(p.condition).toBeNull();
    expect(p.scheduledFinishMinute).toBeNull(); // one finish only: the scheduled one
    expect(p.stops.get("s0")!.etaMinute).toBe(490);
    expect(p.finishMinute).toBe(526); // 08:00 + 3×(10+2) + 10 back
    expect(s.timeline.projectedEndMinute).toBe(526);
    expect(p.delayed).toBe(false);
  });
  it("no deadline counts as missed and no 'within the hour' warning on another day", () => {
    const t = tour({ driverId: null, plannedStartMinute: 30 }); // 00:30 tomorrow, no driver
    const stops = [stop(0, { timeWindow: { start: 0, end: 20 } })];
    const p = summarizeTours(dataset("2026-11-11", now, t, stops))[0]!.timeline.projection;
    expect(p.stops.get("s0")!.state).not.toBe("deadline_missed");
    expect(p.delayReasons.map((r) => r.kind)).not.toContain("no_driver");
  });
  it("a past day's planned tour also keeps its plan and gets no 'starts within the hour'", () => {
    const p = summarizeTours(dataset("2026-11-09", now, tour({ driverId: null }), three()))[0]!.timeline.projection;
    expect(p).toMatchObject({ fromMinute: 480, condition: null, finishMinute: 526, scheduledFinishMinute: null });
    expect(p.delayReasons.map((r) => r.kind)).not.toContain("no_driver");
  });
});

describe("2. tour scheduled today 08:00, not started", () => {
  it("before 08:00: the scheduled finish only", () => {
    const p = summarizeTours(dataset("2026-11-10", new Date("2026-11-10T06:30:00Z"), tour(), three()))[0]!.timeline.projection; // 07:30
    expect(p).toMatchObject({ fromMinute: 480, condition: null, finishMinute: 526, scheduledFinishMinute: null });
  });
  it("at 10:00: scheduled finish (08:46) and revised finish assuming departure now (10:46), told apart", () => {
    const p = summarizeTours(dataset("2026-11-10", new Date("2026-11-10T09:00:00Z"), tour(), three()))[0]!.timeline.projection; // 10:00
    expect(p.condition).toBe("start_now");
    expect(p.fromMinute).toBe(600);
    expect(p.finishMinute).toBe(646);
    expect(p.scheduledFinishMinute).toBe(526);
    expect(p.stops.get("s0")!.etaMinute).toBe(610); // stop ETAs are the revised ones
  });
  it("the scheduled finish uses the same waits as the revised one", () => {
    const stops = [stop(0, { timeWindow: { start: 540, end: 900 } }), stop(1)];
    const p = summarizeTours(dataset("2026-11-10", new Date("2026-11-10T08:00:00Z"), tour(), stops))[0]!.timeline.projection; // 09:00
    expect(p.scheduledFinishMinute).toBe(540 + 2 + 10 + 2 + 10); // waits for 09:00 window
    expect(p.finishMinute).toBe(540 + 10 + 2 + 10 + 2 + 10);
  });
});

describe("3. completed tour", () => {
  const stops = [
    stop(0, { status: "delivered", completedAt: "2026-11-10T07:20:00Z" }), // 08:20 Berlin
    stop(1, { status: "delivered", completedAt: "2026-11-10T07:45:00Z" }),
    stop(2, { status: "failed", completedAt: "2026-11-10T08:05:00Z", location: undefined }),
  ];
  const t = tour({ status: "completed", startedAt: "2026-11-10T07:05:00Z", finishedAt: "2026-11-10T08:30:00Z" });
  it("shows actual times, predicts nothing", () => {
    const s = summarizeTours(dataset("2026-11-10", new Date("2026-11-10T13:00:00Z"), t, stops))[0]!;
    const p = s.timeline.projection;
    expect(p.origin).toBe("completed");
    expect(p.finishMinute).toBe(570); // 09:30 actual
    expect(s.timeline.projectedEndMinute).toBe(570);
    expect(p.stops.get("s0")).toMatchObject({ etaMinute: 500, state: "done" });
    expect(p.remainingDriveSeconds).toBe(0);
    expect(p.complete).toBe(true);
    expect(p.condition).toBeNull();
    expect(p.scheduledFinishMinute).toBeNull();
    expect(p.delayed).toBe(false);
  });
  it("a stop left open in a completed tour gets no ETA and no 'incomplete' finish", () => {
    const open = [...stops.slice(0, 2), stop(3), stop(4, { location: undefined })];
    const p = summarizeTours(dataset("2026-11-10", new Date("2026-11-10T13:00:00Z"), t, open))[0]!.timeline.projection;
    expect(p.stops.has("s3")).toBe(false);
    expect(p.stops.has("s4")).toBe(false);
    expect(p.complete).toBe(true);
    expect(p.finishMinute).toBe(570);
  });
});

describe("4. paused tour", () => {
  it("conditional ETAs assuming the driver resumes now (here 11:00)", () => {
    const t = tour({ date: "2026-11-10", status: "paused", startedAt: "2026-11-10T07:00:00Z" });
    const stops = [stop(0, { status: "delivered", completedAt: "2026-11-10T07:12:00Z" }), stop(1), stop(2)];
    const p = summarizeTours(dataset("2026-11-10", new Date("2026-11-10T10:00:00Z"), t, stops))[0]!.timeline.projection;
    expect(p.condition).toBe("resume_now");
    expect(p.origin).toBe("last_completed_stop");
    expect(p.fromMinute).toBe(660);
    expect(p.stops.get("s1")!.etaMinute).toBe(670);
    expect(p.finishMinute).toBe(660 + 10 + 2 + 10 + 2 + 10);
    expect(p.scheduledFinishMinute).toBeNull();
  });
});

describe("6. Germany: date boundary, CET/CEST and DST change days", () => {
  it("the operating day switches at Berlin midnight, not UTC midnight", () => {
    expect(operatingClock(undefined, TZ, new Date("2026-11-10T22:59:00Z"))).toEqual({ date: "2026-11-10", asOfMinute: 23 * 60 + 59, isToday: true });
    expect(operatingClock(undefined, TZ, new Date("2026-11-10T23:00:00Z"))).toEqual({ date: "2026-11-11", asOfMinute: 0, isToday: true });
    // 00:30 Berlin on the 11th: the 11th is today, the 10th is over.
    expect(operatingClock("2026-11-11", TZ, new Date("2026-11-10T23:30:00Z"))).toMatchObject({ isToday: true, asOfMinute: 30 });
    expect(operatingClock("2026-11-10", TZ, new Date("2026-11-10T23:30:00Z"))).toMatchObject({ isToday: false, asOfMinute: 1439 });
    expect(operatingClock("2026-11-12", TZ, new Date("2026-11-10T23:30:00Z"))).toMatchObject({ isToday: false, asOfMinute: 0 });
  });
  it("summer time (CEST, UTC+2) and winter time (CET, UTC+1) give the same local minutes", () => {
    expect(minuteOfDay("2026-07-15T06:00:00Z", TZ)).toBe(480);
    expect(minuteOfDay("2026-11-10T07:00:00Z", TZ)).toBe(480);
  });
  it("spring change day 2026-03-29: clock jumps 02:00 → 03:00; a day tour is unaffected", () => {
    expect(operatingClock(undefined, TZ, new Date("2026-03-29T00:59:00Z"))).toEqual({ date: "2026-03-29", asOfMinute: 119, isToday: true });
    expect(operatingClock(undefined, TZ, new Date("2026-03-29T01:00:00Z"))).toEqual({ date: "2026-03-29", asOfMinute: 180, isToday: true });
    const t = tour({ date: "2026-03-29", status: "in_progress", startedAt: "2026-03-29T06:00:00Z" }); // 08:00 CEST
    const stops = [stop(0, { status: "delivered", completedAt: "2026-03-29T06:10:00Z" }), stop(1), stop(2)];
    const p = summarizeTours(dataset("2026-03-29", new Date("2026-03-29T07:00:00Z"), t, stops))[0]!.timeline.projection; // 09:00 CEST
    expect(p.fromMinute).toBe(540);
    expect(p.stops.get("s1")!.etaMinute).toBe(550);
  });
  it("autumn change day 2026-10-25: 02:00–03:00 happens twice; local clock and day stay right", () => {
    expect(operatingClock(undefined, TZ, new Date("2026-10-25T00:30:00Z"))).toEqual({ date: "2026-10-25", asOfMinute: 150, isToday: true }); // 02:30 CEST
    expect(operatingClock(undefined, TZ, new Date("2026-10-25T01:30:00Z"))).toEqual({ date: "2026-10-25", asOfMinute: 150, isToday: true }); // 02:30 CET
    expect(operatingClock(undefined, TZ, new Date("2026-10-25T22:59:00Z"))).toEqual({ date: "2026-10-25", asOfMinute: 1439, isToday: true });
    expect(operatingClock(undefined, TZ, new Date("2026-10-25T23:00:00Z"))).toMatchObject({ date: "2026-10-26", asOfMinute: 0 });
    const p = summarizeTours(dataset("2026-10-25", new Date("2026-10-25T09:00:00Z"), tour(), three()))[0]!.timeline.projection; // 10:00 CET, planned 08:00
    expect(p).toMatchObject({ condition: "start_now", fromMinute: 600, scheduledFinishMinute: 526, finishMinute: 646 });
  });
  it("a planned tour on the next day is not affected by the evening before crossing UTC midnight", () => {
    // 00:30 UTC on the 11th = 01:30 Berlin on the 11th → the 11th is today; 08:00 tour not overdue.
    const p = summarizeTours(dataset("2026-11-11", new Date("2026-11-11T00:30:00Z"), tour(), three()))[0]!.timeline.projection;
    expect(p).toMatchObject({ condition: null, fromMinute: 480, finishMinute: 526 });
  });
});

describe("projectTour directly: scheduled finish only for a late start", () => {
  it("running tours never carry a scheduled finish", () => {
    const t = tour({ status: "in_progress", startedAt: "2026-11-10T07:00:00Z" });
    const p = projectTour({ tour: t, stops: three(), depotLocation: DEPOT, maxShiftMinutes: 480, nowMinute: 600, isToday: true, road: roadFor(t, three()), minuteOf });
    expect(p.scheduledFinishMinute).toBeNull();
  });
});
