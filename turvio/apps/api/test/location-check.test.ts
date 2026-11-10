import { describe, expect, it } from "vitest";
import { buildRoads } from "../src/data/roads";
import { LocationChecker, type CheckStop } from "../src/location-check";
import { OsrmRouting, RoutingOutOfCoverage, type RoadRoute, type RoutingProvider } from "../src/routing";
import type { DispatchDataset, Stop, Tour } from "@turvio/shared";

/**
 * Location checks against a simulated OSRM (P0-3.1). Points are encoded by longitude:
 *  lng 9.70x → normal street "Teststraße" 10 m; 9.71x → motorway A 2 (normal road 49 m away);
 *  9.72x → restricted street; 9.73x → 400 m from any road; 9.74x → no road connection.
 */
type Req = { path: string; params: URLSearchParams };
function fakeOsrm(opts: { latencyMs?: number; fail?: () => boolean } = {}) {
  const log: Req[] = [];
  const kind = (lng: number) => Math.round((lng - 9.7) * 100);
  const fetchImpl: typeof fetch = async (input) => {
    const url = new URL(String(input));
    log.push({ path: url.pathname, params: url.searchParams });
    if (opts.latencyMs) await new Promise((r) => setTimeout(r, opts.latencyMs));
    if (opts.fail?.()) throw new Error("connect ECONNREFUSED");
    const coords = url.pathname.split("/").at(-1)!.split(";").map((c) => c.split(",").map(Number) as [number, number]);
    const wp = (c: [number, number]) => {
      const k = kind(c[0]);
      return { distance: k === 3 ? 400 : k === 1 ? 0 : 10, name: k === 1 ? "" : k === 2 ? "Anliegerweg" : "Teststraße", location: c };
    };
    if (url.pathname.startsWith("/nearest")) {
      if (url.searchParams.get("exclude") === "motorway") return Response.json({ code: "Ok", waypoints: [{ distance: 49, name: "Klusriede", location: [c0(coords)[0] + 0.0004, c0(coords)[1]] }] });
      return Response.json({ code: "Ok", waypoints: [wp(coords[0]!)] });
    }
    if (url.pathname.startsWith("/table")) {
      const src = url.searchParams.get("sources")!.split(";").map(Number);
      const dst = url.searchParams.get("destinations")!.split(";").map(Number);
      return Response.json({ code: "Ok", durations: src.map((s) => dst.map((d) => (kind(coords[s]![0]) === 4 || kind(coords[d]![0]) === 4 ? null : 60))) });
    }
    // route through all points with steps
    const single = coords.length === 2 && coords[0]![0] === coords[1]![0] && coords[0]![1] === coords[1]![1];
    if (!single && coords.some((c) => kind(c[0]) === 4)) return Response.json({ code: "NoRoute", message: "Impossible route" });
    const legs = coords.slice(0, -1).map((c) => {
      const k = kind(c[0]);
      return { steps: [{ ref: k === 1 ? "A 2" : "", intersections: [{ classes: k === 1 ? ["motorway"] : k === 2 ? ["restricted"] : undefined }] }, { maneuver: { type: "arrive" } }] };
    });
    return Response.json({ code: "Ok", waypoints: coords.map(wp), routes: [{ legs }] });
  };
  return { log, fetchImpl };
}
const c0 = (c: [number, number][]) => c[0]!;
const stop = (id: string, lng: number, street = "Teststraße"): CheckStop => ({ id, location: { lat: 52.37, lng }, address: { street, houseNumber: "1", postalCode: "30159", city: "Hannover", countryCode: "DE" } });
const ORIGIN = { lat: 52.37, lng: 9.7001 };

describe("OSRM probes", () => {
  it("one route request snaps up to 99 points with name, ref and classes; cached afterwards", async () => {
    const o = fakeOsrm();
    const r = new OsrmRouting("http://osrm.test", { fetchImpl: o.fetchImpl });
    const pts = [9.7001, 9.7101, 9.7201].map((lng) => ({ lat: 52.37, lng }));
    const s = await r.snapPoints(pts);
    expect(s.map((x) => [x.roadName, x.roadRef, x.classes])).toEqual([
      ["Teststraße", "", []],
      ["", "A 2", ["motorway"]],
      ["Anliegerweg", "", ["restricted"]],
    ]);
    expect(o.log.filter((l) => l.path.startsWith("/route"))).toHaveLength(1);
    await r.snapPoints(pts);
    expect(o.log).toHaveLength(1);
    expect(r.stats().snapCacheHits).toBe(3);
  });
  it("a point without road connection to the others: each point on its own, classes still known", async () => {
    const o = fakeOsrm();
    const r = new OsrmRouting("http://osrm.test", { fetchImpl: o.fetchImpl });
    const s = await r.snapPoints([{ lat: 52.37, lng: 9.7101 }, { lat: 52.37, lng: 9.7401 }]);
    expect(s.map((x) => x.classes)).toEqual([["motorway"], []]);
    expect(o.log.filter((l) => l.path.startsWith("/route"))).toHaveLength(3); // 1 chain + 2 single
  });
  it("if even the single-point route fails: /nearest, classes unknown (null)", async () => {
    const o = fakeOsrm();
    const fetchImpl: typeof fetch = async (u, init) => (String(u).includes("/route/") ? Response.json({ code: "NoRoute" }) : o.fetchImpl(u, init));
    const s = await new OsrmRouting("http://osrm.test", { fetchImpl }).snapPoints([{ lat: 52.37, lng: 9.7001 }]);
    expect(s[0]).toMatchObject({ roadName: "Teststraße", classes: null });
  });
  it("chunks of 99 points", async () => {
    const o = fakeOsrm();
    const r = new OsrmRouting("http://osrm.test", { fetchImpl: o.fetchImpl });
    await r.snapPoints(Array.from({ length: 250 }, (_, i) => ({ lat: 52.37 + i * 1e-4, lng: 9.7001 })));
    expect(o.log.filter((l) => l.path.startsWith("/route"))).toHaveLength(3);
  });
  it("reachability: two table requests per 99 points; nulls mean no connection", async () => {
    const o = fakeOsrm();
    const r = new OsrmRouting("http://osrm.test", { fetchImpl: o.fetchImpl });
    const reach = await r.reachability(ORIGIN, [{ lat: 52.37, lng: 9.7001 }, { lat: 52.37, lng: 9.7401 }]);
    expect(reach).toEqual([{ fromOrigin: true, toOrigin: true }, { fromOrigin: false, toOrigin: false }]);
    expect(o.log.filter((l) => l.path.startsWith("/table"))).toHaveLength(2);
  });
});

describe("LocationChecker", () => {
  it("errors vs warnings vs information, with explicit reasons; nothing is moved", async () => {
    const o = fakeOsrm();
    const checker = new LocationChecker(new OsrmRouting("http://osrm.test", { fetchImpl: o.fetchImpl }), undefined);
    const stops = [stop("ok", 9.7001), stop("mw", 9.7101), stop("restricted", 9.7201), stop("far", 9.7301), stop("island", 9.7401), stop("zero", 0), { ...stop("none", 0), location: null }];
    stops[5]!.location = { lat: 0, lng: 0 };
    const before = JSON.stringify(stops);
    const { checks } = await checker.check([{ origin: ORIGIN, stops }]);
    const by = Object.fromEntries(checks.map((c) => [c.stopId, c]));
    expect(by.ok!.issues).toEqual([]);
    expect(by.mw!.issues.map((i) => i.code)).toEqual(["motorway"]);
    expect(by.mw!.issues[0]!.suggestion).toMatchObject({ kind: "approach", roadName: "Klusriede", distanceMeters: 49 });
    expect(by.restricted!.issues.map((i) => `${i.severity}:${i.code}`)).toEqual(["info:restricted_access"]);
    expect(by.far!.issues.map((i) => `${i.severity}:${i.code}`)).toEqual(["warning:far_from_road"]);
    expect(by.island!.issues.map((i) => `${i.severity}:${i.code}`)).toEqual(["error:unreachable"]);
    expect(by.zero!.issues.map((i) => i.code)).toEqual(["coordinates_invalid"]);
    expect(by.none!.status).toBe("no_location");
    // No address data configured: the checks that ran are reported, the rest is "partial".
    expect(by.ok!.status).toBe("partial");
    expect(by.ok!.unavailable).toContain("no local address data configured");
    expect(JSON.stringify(stops)).toBe(before);
  });

  it("slow routing: 'pending' within the budget (never a verdict), complete on the next request", async () => {
    const o = fakeOsrm({ latencyMs: 300 });
    const checker = new LocationChecker(new OsrmRouting("http://osrm.test", { fetchImpl: o.fetchImpl }), undefined);
    const group = { origin: ORIGIN, stops: [stop("a", 9.7001), stop("b", 9.7301)] };
    const first = await checker.check([group], 50);
    expect(first.checks.every((c) => c.status === "pending" && c.severity === null)).toBe(true);
    expect(first.report.pending).toBe(2);
    await new Promise((r) => setTimeout(r, 800));
    const requests = o.log.length;
    const second = await checker.check([group], 50);
    expect(second.checks.map((c) => c.status)).toEqual(["partial", "partial"]);
    expect(second.checks[1]!.severity).toBe("warning");
    expect(o.log.length).toBe(requests); // served from the checker's results, no new requests
  });

  it("routing failure: 'unavailable' this time, retried on the next request", async () => {
    let down = true;
    const o = fakeOsrm({ fail: () => down });
    const checker = new LocationChecker(new OsrmRouting("http://osrm.test", { fetchImpl: o.fetchImpl }), undefined);
    const group = { origin: ORIGIN, stops: [stop("a", 9.7301)] };
    const first = await checker.check([group]);
    expect(first.checks[0]).toMatchObject({ status: "partial", severity: null });
    expect(first.checks[0]!.unavailable).toContain("road routing unavailable");
    down = false;
    const second = await checker.check([group]);
    expect(second.checks[0]!.issues.map((i) => i.code)).toEqual(["far_from_road"]);
  });

  it("without any routing: partial, reasons named, coordinate errors still found", async () => {
    const checker = new LocationChecker(undefined, undefined);
    const { checks } = await checker.check([{ origin: ORIGIN, stops: [stop("a", 9.7001), { ...stop("swap", 0), location: { lat: 9.73, lng: 52.37 } }] }]);
    expect(checks[0]).toMatchObject({ status: "partial", severity: null });
    expect(checks[0]!.unavailable).toEqual(["no road routing configured", "no road routing configured", "no local address data configured"]);
    expect(checks[1]!.issues[0]).toMatchObject({ code: "outside_country", details: { swapped: true } });
  });

  it("warm() starts the road checks right after stops are created", async () => {
    const o = fakeOsrm();
    const checker = new LocationChecker(new OsrmRouting("http://osrm.test", { fetchImpl: o.fetchImpl }), undefined);
    checker.warm([stop("a", 9.7001), stop("b", 9.7101)]);
    await new Promise((r) => setTimeout(r, 50));
    expect(o.log.some((l) => l.path.startsWith("/route"))).toBe(true);
  });
});

describe("roads.ts: an out-of-coverage remaining route names the right stops (fix)", () => {
  it("indexes of the remaining route are mapped onto the remaining stop list, not the plan", async () => {
    const at = (m: number) => `2026-11-10T${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}:00.000Z`;
    const mk = (i: number, extra: Partial<Stop> = {}) =>
      ({ id: `s${i}`, tourId: "t", type: "delivery", sequence: i, status: "pending", address: { street: "x", houseNumber: "1", postalCode: "30159", city: "Hannover", countryCode: "DE" }, location: { lat: 52.37 + i * 0.01, lng: 9.73 }, serviceSeconds: 60, priority: false, parcels: [], ...extra }) as Stop;
    const stops = [mk(0, { status: "delivered", completedAt: at(490) }), mk(1, { status: "delivered", completedAt: at(500) }), mk(2), mk(3)];
    const tour = { id: "t", organizationId: "o", name: "T", date: "2026-11-10", depotId: "d", driverId: "drv", vehicleId: null, status: "in_progress", startedAt: at(480), plannedStartMinute: 480 } as Tour;
    const data = { organizationId: "o", date: "2026-11-10", asOfMinute: 600, isToday: true, timeZone: "UTC", depots: [{ id: "d", location: { lat: 52.36, lng: 9.73 } }], drivers: [], vehicles: [], tours: [tour], stops, unassigned: [] } as unknown as DispatchDataset;
    // Plan: depot, s0, s1, s2, s3, depot (6 points). Remaining: s1 (anchor), s2, s3, depot (4 points).
    // The remaining route fails at its index 2 = s3; the plan's index 2 would be s1 (wrong).
    const routing: RoutingProvider = {
      name: "stub",
      async route(points): Promise<RoadRoute> {
        if (points.length === 4) throw new RoutingOutOfCoverage("far", [{ index: 2, snapMeters: 5000 }]);
        return { source: "osrm", legs: points.slice(1).map(() => ({ meters: 1000, seconds: 60 })), distanceMeters: 0, durationSeconds: 0, geometry: [] };
      },
    };
    const { roads } = await buildRoads(data, routing, new Map());
    expect(roads.t).toMatchObject({ source: "estimate", reason: "out_of_coverage", stopIds: ["s3"] });
  });
});
