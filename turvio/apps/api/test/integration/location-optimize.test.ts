import { roadWaypoints, minuteOfDay, type DispatchDataset } from "@turvio/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { OsrmRouting } from "../../src/routing";
import { SEED_USERS as U } from "../../src/seed";
import { createTestEnv, fakeOptimizerFetch, postgresAvailable, type TestEnv } from "./helpers";

/**
 * P0-3.3: the optimizer and Dispatch consume location checks and accepted approach points.
 * - stops with a certain location error are kept out of the optimization and reported;
 * - pending / unchecked stops are never excluded (the optimizer's coverage check stays the backstop);
 * - an accepted approach point is where routing goes (optimizer request, road waypoints).
 * Simulated OSRM: every point 8 m from "Teststraße"; points east of 13° E are 900 km from any road.
 */
const available = await postgresAvailable();
let env: TestEnv;
const requests: { stops: { id: string; location: { lat: number; lng: number } }[] }[] = [];
const optimizer: typeof fetch = async (url, init) => {
  requests.push(JSON.parse(String(init?.body)));
  return fakeOptimizerFetch(url, init);
};
const fakeOsrm: typeof fetch = async (input) => {
  const url = new URL(String(input));
  const coords = url.pathname.split("/").at(-1)!.split(";").map((c) => c.split(",").map(Number) as [number, number]);
  const far = (c: [number, number]) => c[0] > 13;
  if (url.pathname.startsWith("/nearest")) return Response.json({ code: "Ok", waypoints: [{ distance: 49, name: "Klusriede", location: coords[0] }] });
  if (url.pathname.startsWith("/table")) {
    const s = url.searchParams.get("sources")!.split(";");
    const d = url.searchParams.get("destinations")!.split(";");
    return Response.json({ code: "Ok", durations: s.map(() => d.map(() => 60)), distances: s.map(() => d.map(() => 500)), sources: s.map(() => ({ distance: 8 })), destinations: d.map(() => ({ distance: 8 })) });
  }
  const legs = coords.slice(1).map(() => ({ distance: 2000, duration: 300, steps: [{ ref: "", intersections: [{ classes: [] }] }] }));
  return Response.json({
    code: "Ok",
    waypoints: coords.map((c) => ({ distance: far(c) ? 900_000 : 8, name: "Teststraße", location: c })),
    routes: [{ distance: legs.length * 2000, duration: legs.length * 300, legs, geometry: { coordinates: coords } }],
  });
};
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

describe.runIf(available)("optimization and Dispatch use location checks and approach points (P0-3.3)", () => {
  beforeAll(async () => {
    env = await createTestEnv("locopt", { routing: new OsrmRouting("http://osrm.test", { fetchImpl: fakeOsrm }), fetchImpl: optimizer });
  }, 120_000);
  afterAll(async () => {
    await env?.close();
  });
  const org = () => env.data.orgs.jarbou;
  const S: Record<string, string> = {};
  let tourId = "";

  it("certain location errors are excluded and reported; approach points are sent as the stop's routing location", async () => {
    const t = (await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/tours`, { depotId: env.data.depots.hannover, date: today(), name: "OPT-LOC" })).json();
    tourId = t.id;
    const mk = (key: string, lat: number, lng: number) => ({ recipientName: key, address: { street: "Teststraße", houseNumber: key, postalCode: "30159", city: "Hannover" }, location: { lat, lng } });
    const r = await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/stops`, {
      tourId,
      stops: [mk("ok1", 52.37, 9.73), mk("ok2", 52.38, 9.74), mk("zero", 0, 0), mk("far", 52.52, 13.4), mk("appr", 52.39, 9.75)],
    });
    [S.ok1, S.ok2, S.zero, S.far, S.appr] = r.json().ids;
    // Checks run (and are stored) – the far stop gets out_of_coverage.
    const checks = (await env.as(U.dispatcherHannover, "GET", `/v1/orgs/${org()}/location-checks?tourId=${tourId}`)).json();
    expect(checks.pending).toBe(false);
    const by = Object.fromEntries(checks.checks.map((c: { stopId: string }) => [c.stopId, c]));
    expect(by[S.far!].issues[0].code).toBe("out_of_coverage");
    expect(by[S.zero!].issues[0].code).toBe("coordinates_invalid");
    // A dispatcher accepts an approach point for "appr" (explicitly).
    expect(
      (await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/stops/${S.appr}/location/approach`, { lat: 52.3905, lng: 9.7505, expectedLat: 52.39, expectedLng: 9.75, expectedAddressVersion: 1 })).statusCode,
    ).toBe(204);

    requests.length = 0;
    const o = await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/tours/${tourId}/optimize`, {});
    expect(o.statusCode).toBe(200);
    const sent = requests[0]!.stops;
    expect(sent.map((s) => s.id).sort()).toEqual([S.ok1, S.ok2, S.appr].sort());
    expect(sent.find((s) => s.id === S.appr)!.location).toEqual({ lat: 52.3905, lng: 9.7505 });
    const body = o.json();
    expect(body.result.locationErrors).toEqual(expect.arrayContaining([{ stopId: S.zero, codes: ["coordinates_invalid"] }, { stopId: S.far, codes: ["out_of_coverage"] }]));
    expect(body.result.approachStopIds).toEqual([S.appr]);
    // Excluded stops stay on the tour, at the end, with their data untouched.
    const ids = body.stops.map((s: { id: string }) => s.id);
    expect(ids.slice(-2).sort()).toEqual([S.zero, S.far].sort());
    expect(body.stops.find((s: { id: string }) => s.id === S.far).location).toEqual({ lat: 52.52, lng: 13.4 });
  });

  it("a stop that was never checked (or whose check is pending) is not excluded – the optimizer decides", async () => {
    const r = await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/stops`, { tourId, stops: [{ address: { street: "Neu", postalCode: "30159", city: "Hannover" }, location: { lat: 52.52, lng: 13.41 } }] });
    const fresh = r.json().ids[0];
    await env.superuser.query(`delete from stop_location_checks where stop_id = $1`, [fresh]); // warm-up may have stored it already
    requests.length = 0;
    await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/tours/${tourId}/optimize`, {});
    expect(requests[0]!.stops.map((s) => s.id)).toContain(fresh);
    await env.as(U.dispatcherHannover, "DELETE", `/v1/orgs/${org()}/stops/${fresh}`);
  });

  it("a moved stop loses its error and its approach point (both belonged to the old coordinate)", async () => {
    await env.as(U.dispatcherHannover, "PATCH", `/v1/orgs/${org()}/stops/${S.far}`, { location: { lat: 52.36, lng: 9.72 } });
    await env.as(U.dispatcherHannover, "PATCH", `/v1/orgs/${org()}/stops/${S.appr}`, { location: { lat: 52.391, lng: 9.751 } });
    requests.length = 0;
    await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/tours/${tourId}/optimize`, {});
    const sent = requests[0]!.stops;
    expect(sent.map((s) => s.id)).toContain(S.far);
    expect(sent.find((s) => s.id === S.appr)!.location).toEqual({ lat: 52.391, lng: 9.751 });
  });

  it("Dispatch dataset: the stop carries its valid approach point and road waypoints use it", async () => {
    // Accept again for the moved stop.
    await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/stops/${S.appr}/location/approach`, { lat: 52.3912, lng: 9.7512, expectedLat: 52.391, expectedLng: 9.751, expectedAddressVersion: 1 });
    const d = (await env.as(U.dispatcherHannover, "GET", `/v1/orgs/${org()}/dispatch`)).json() as DispatchDataset;
    const stop = d.stops.find((s) => s.id === S.appr)!;
    expect(stop.approach).toMatchObject({ lat: 52.3912, lng: 9.7512 });
    expect(stop.location).toEqual({ lat: 52.391, lng: 9.751 });
    const tour = d.tours.find((t) => t.id === tourId)!;
    const wp = roadWaypoints(tour, d.stops.filter((s) => s.tourId === tourId), d.depots.find((x) => x.id === tour.depotId)!.location, (iso) => minuteOfDay(iso, d.timeZone ?? "UTC"));
    const i = wp.plan.stopIds.indexOf(S.appr!);
    expect(wp.plan.points[i]).toEqual({ lat: 52.3912, lng: 9.7512 });
    expect(d.roads?.[tourId]?.source).toBe("osrm");
  });

  it("multi-tour optimization: error stops are left out and reported, unassigned ones stay unassigned", async () => {
    const u = await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/stops`, { depotId: env.data.depots.hannover, stops: [{ address: { street: "Null", postalCode: "30159", city: "Hannover" }, location: { lat: 0, lng: 0 } }] });
    const zeroU = u.json().ids[0];
    requests.length = 0;
    const r = await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/plans/optimize`, { tourIds: [tourId], includeUnassigned: true });
    expect(r.statusCode).toBe(200);
    expect(requests[0]!.stops.map((s) => s.id)).not.toContain(zeroU);
    expect(requests[0]!.stops.map((s) => s.id)).not.toContain(S.zero);
    expect(r.json().locationErrors).toEqual(expect.arrayContaining([{ stopId: zeroU, codes: ["coordinates_invalid"] }, { stopId: S.zero, codes: ["coordinates_invalid"] }]));
    expect((await env.superuser.query(`select tour_id from stops where id = $1`, [zeroU])).rows[0].tour_id).toBeNull();
  });
});
