import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { RoadRoute, RoutingProvider } from "../../src/routing";
import { SEED_USERS as U } from "../../src/seed";
import { createTestEnv, fakeOptimizerFetch, postgresAvailable, type TestEnv } from "./helpers";

const available = await postgresAvailable();
let env: TestEnv;
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

/** Every optimizer request the API sends (the response comes from the deterministic fake). */
const sent: { vehicles: { start: { lat: number; lng: number }; end?: { lat: number; lng: number } }[] }[] = [];
const recording: typeof fetch = async (url, init) => {
  sent.push(JSON.parse(String(init?.body)));
  return fakeOptimizerFetch(url, init);
};
/** Deterministic road router (not real road data): every leg 1 km / 2 min; records the waypoints. */
const routed: { lat: number; lng: number }[][] = [];
const fakeRouting: RoutingProvider = {
  name: "fake",
  async route(points): Promise<RoadRoute> {
    routed.push(points);
    const legs = points.slice(1).map(() => ({ meters: 1000, seconds: 120 }));
    return { source: "osrm", legs, distanceMeters: legs.length * 1000, durationSeconds: legs.length * 120, geometry: points.map((p) => [p.lat, p.lng]) };
  },
};

const OFFICE = { lat: 52.3759, lng: 9.732, label: "Ernst-August-Platz 1, 30159 Hannover" };
const HOME = { lat: 52.3906, lng: 9.7128, label: "Engelbosteler Damm 10, 30167 Hannover" };

describe.runIf(available)("tour start and end addresses", () => {
  beforeAll(async () => {
    env = await createTestEnv("tourends", { fetchImpl: recording, routing: fakeRouting });
  }, 120_000);
  afterAll(async () => {
    await env?.close();
  });

  const org = () => env.data.orgs.jarbou;
  const url = (p = "") => `/v1/orgs/${org()}/tours${p}`;
  const addStops = (tourId: string, n = 3) =>
    env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/stops`, {
      tourId,
      stops: Array.from({ length: n }, (_, i) => ({ recipientName: `Kunde ${i}`, address: { street: "Teststraße", houseNumber: String(i + 1), postalCode: "30159", city: "Hannover" }, location: { lat: 52.37 + i * 0.004, lng: 9.73 } })),
    });
  let tourId = "";

  it("creates a tour with its own start address and end address", async () => {
    const r = await env.as(U.dispatcherHannover, "POST", url(), { depotId: env.data.depots.hannover, date: today(), start: OFFICE, end: { mode: "address", ...HOME } });
    expect(r.statusCode).toBe(201);
    const t = r.json();
    tourId = t.id;
    expect(t).toMatchObject({ startLocation: { lat: OFFICE.lat, lng: OFFICE.lng }, startLabel: OFFICE.label, endMode: "address", endLocation: { lat: HOME.lat, lng: HOME.lng }, endLabel: HOME.label });
    expect((await addStops(tourId)).statusCode).toBe(201);
  });

  it("a tour without settings starts and ends at its depot (unchanged default)", async () => {
    const t = (await env.as(U.dispatcherHannover, "POST", url(), { depotId: env.data.depots.hannover, date: today() })).json();
    expect(t.endMode).toBe("depot");
    expect(t.startLocation).toBeUndefined();
    expect(t.endLocation).toBeUndefined();
  });

  it("rejects start/end points that cannot be meant", async () => {
    const base = { depotId: env.data.depots.hannover, date: today() };
    // Address mode without a position, and a position on a non-address mode, are malformed.
    expect((await env.as(U.dispatcherHannover, "POST", url(), { ...base, end: { mode: "address", label: "Somewhere" } })).statusCode).toBe(400);
    expect((await env.as(U.dispatcherHannover, "POST", url(), { ...base, start: { lat: 95, lng: 9.7 } })).statusCode).toBe(400);
    expect((await env.as(U.dispatcherHannover, "POST", url(), { ...base, end: { mode: "sometimes" } })).statusCode).toBe(400);
    expect((await env.as(U.dispatcherHannover, "POST", url(), { ...base, start: { lat: 52.37, lng: 9.73, label: "x".repeat(201) } })).statusCode).toBe(400);
    // (0, 0) and swapped latitude/longitude (Hannover written as 9.73, 52.37 – the Horn of Africa).
    const zero = await env.as(U.dispatcherHannover, "POST", url(), { ...base, start: { lat: 0, lng: 0 } });
    expect(zero.statusCode).toBe(422);
    expect(zero.json().error.code).toBe("invalid_location");
    const swapped = await env.as(U.dispatcherHannover, "POST", url(), { ...base, end: { mode: "address", lat: 9.73, lng: 52.37 } });
    expect(swapped.statusCode).toBe(422);
    expect(swapped.json().error.message).toMatch(/swapped/);
  });

  it("the database refuses inconsistent rows even when written directly", async () => {
    await expect(env.superuser.query(`update tours set end_mode = 'address', end_lat = null, end_lng = null where id = $1`, [tourId])).rejects.toThrow(/tours_end_point_check/);
    await expect(env.superuser.query(`update tours set end_mode = 'last_stop' where id = $1`, [tourId])).rejects.toThrow(/tours_end_point_check/);
    await expect(env.superuser.query(`update tours set start_lng = null where id = $1`, [tourId])).rejects.toThrow(/tours_start_point_check/);
  });

  it("optimization starts at the start address and ends at the end address", async () => {
    sent.length = 0;
    expect((await env.as(U.dispatcherHannover, "POST", url(`/${tourId}/optimize`), {})).statusCode).toBe(200);
    expect(sent[0]!.vehicles[0]).toMatchObject({ start: { lat: OFFICE.lat, lng: OFFICE.lng }, end: { lat: HOME.lat, lng: HOME.lng } });
  });

  it("'end at last stop' sends no end point and the road route has no trip back", async () => {
    const cur = (await env.as(U.dispatcherHannover, "GET", url(`/${tourId}`))).json();
    const r = await env.as(U.dispatcherHannover, "PATCH", url(`/${tourId}`), { expectedVersion: cur.tour.version, end: { mode: "last_stop" } });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toMatchObject({ endMode: "last_stop", endLabel: null });
    expect(r.json().endLocation).toBeUndefined();
    sent.length = 0;
    await env.as(U.dispatcherHannover, "POST", url(`/${tourId}/optimize`), {});
    expect(sent[0]!.vehicles[0]!.end).toBeUndefined();

    routed.length = 0;
    const route = (await env.as(U.dispatcherHannover, "GET", url(`/${tourId}/route`))).json();
    expect(route.source).toBe("osrm");
    expect(routed[0]).toHaveLength(1 + 3); // start + 3 stops, no end point
    expect(route.legs).toHaveLength(3);
    expect(route.waypointStopIds.at(-1)).not.toBeNull();
    expect(route.metrics.totalMeters).toBe(3000);
  });

  it("back to the depot: the route ends at the depot again; start can be cleared", async () => {
    const cur = (await env.as(U.dispatcherHannover, "GET", url(`/${tourId}`))).json();
    const r = (await env.as(U.dispatcherHannover, "PATCH", url(`/${tourId}`), { expectedVersion: cur.tour.version, start: null, end: { mode: "depot" } })).json();
    expect(r).toMatchObject({ endMode: "depot", startLabel: null });
    expect(r.startLocation).toBeUndefined();
    routed.length = 0;
    const route = (await env.as(U.dispatcherHannover, "GET", url(`/${tourId}/route`))).json();
    expect(route.legs).toHaveLength(4);
    const depot = (await env.superuser.query(`select lat, lng from depots where id = $1`, [env.data.depots.hannover])).rows[0];
    expect(routed[0]![0]).toEqual(depot);
    expect(routed[0]!.at(-1)).toEqual(depot);
  });

  it("other companies and other depots cannot change it; a stale version is refused", async () => {
    const cur = (await env.as(U.dispatcherHannover, "GET", url(`/${tourId}`))).json();
    expect((await env.as(U.musterOwner, "PATCH", url(`/${tourId}`), { expectedVersion: cur.tour.version, end: { mode: "last_stop" } })).statusCode).toBe(403);
    expect([403, 404]).toContain((await env.as(U.dispatcherBremen, "PATCH", url(`/${tourId}`), { expectedVersion: cur.tour.version, end: { mode: "last_stop" } })).statusCode);
    expect((await env.as(U.dispatcherHannover, "PATCH", url(`/${tourId}`), { expectedVersion: cur.tour.version - 1, end: { mode: "last_stop" } })).statusCode).toBe(409);
  });

  it("the driver's 'end at last stop' choice is kept for the tour (route and ETA end there too)", async () => {
    const cur = (await env.as(U.dispatcherHannover, "GET", url(`/${tourId}`))).json();
    await env.as(U.dispatcherHannover, "PATCH", url(`/${tourId}`), { expectedVersion: cur.tour.version, driverId: env.data.drivers.hannover![0] });
    const v = (await env.as(U.dispatcherHannover, "GET", url(`/${tourId}`))).json().tour.version;
    expect((await env.as(U.dispatcherHannover, "POST", url(`/${tourId}/publish`), { expectedVersion: v })).statusCode).toBe(200);
    // A colleague cannot change Lena's tour.
    expect((await env.as(U.driverHannover2, "POST", url(`/${tourId}/optimize`), { end: "none" })).statusCode).toBe(404);
    sent.length = 0;
    expect((await env.as(U.driverHannover1, "POST", url(`/${tourId}/optimize`), { end: "none" })).statusCode).toBe(200);
    expect(sent[0]!.vehicles[0]!.end).toBeUndefined();
    expect((await env.as(U.dispatcherHannover, "GET", url(`/${tourId}`))).json().tour.endMode).toBe("last_stop");
    // A preview never changes the tour.
    await env.as(U.driverHannover1, "POST", url(`/${tourId}/optimize`), { end: "depot", apply: false });
    expect((await env.as(U.dispatcherHannover, "GET", url(`/${tourId}`))).json().tour.endMode).toBe("last_stop");
    await env.as(U.driverHannover1, "POST", url(`/${tourId}/optimize`), { end: "depot" });
    expect((await env.as(U.dispatcherHannover, "GET", url(`/${tourId}`))).json().tour.endMode).toBe("depot");
  });
});
