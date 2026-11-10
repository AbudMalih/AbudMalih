import { summarizeTours, type DispatchDataset } from "@turvio/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { OsrmRouting } from "../../src/routing";
import { SEED_USERS as U } from "../../src/seed";
import { createTestEnv, postgresAvailable, type TestEnv } from "./helpers";

/**
 * Road-based Dispatch times (P0-2): the dispatch dataset carries OSRM legs per tour; every figure is
 * computed by the shared projectTour. A simulated OSRM server behind the real OsrmRouting provider:
 * every leg 2 km / 5 min, live-position legs 900 m / 3 min. Points north of 60° N are "outside the
 * road data". Requests are counted (cache, in-flight sharing, one table call for live positions).
 */
const available = await postgresAvailable();
let env: TestEnv;

const osrm = { route: 0, table: 0, fail: false, latencyMs: 0 };
const fakeOsrm: typeof fetch = async (input) => {
  const url = new URL(String(input));
  if (osrm.latencyMs) await new Promise((r) => setTimeout(r, osrm.latencyMs));
  if (osrm.fail) throw new Error("connect ECONNREFUSED");
  const coords = url.pathname.split("/").at(-1)!.split(";").map((c) => c.split(",").map(Number) as [number, number]);
  const snap = (c: [number, number]) => ({ distance: c[1] >= 60 ? 50_000 : 8 });
  if (url.pathname.includes("/table/")) {
    osrm.table++;
    const n = url.searchParams.get("sources")!.split(";").length;
    return Response.json({
      code: "Ok",
      durations: Array.from({ length: n }, () => Array.from({ length: n }, () => 180)),
      distances: Array.from({ length: n }, () => Array.from({ length: n }, () => 900)),
      sources: coords.slice(0, n).map(snap),
      destinations: coords.slice(n).map(snap),
    });
  }
  osrm.route++;
  const legs = coords.slice(1).map(() => ({ distance: 2000, duration: 300 }));
  return Response.json({
    code: "Ok",
    waypoints: coords.map(snap),
    routes: [{ distance: legs.length * 2000, duration: legs.length * 300, legs, geometry: { coordinates: coords } }],
  });
};
const routing = new OsrmRouting("http://osrm.test", { fetchImpl: fakeOsrm });

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

describe.runIf(available)("road-based Dispatch times", () => {
  beforeAll(async () => {
    env = await createTestEnv("roads", { routing });
  }, 120_000);
  afterAll(async () => {
    await env?.close();
  });

  const org = () => env.data.orgs.jarbou;
  const dataset = async (as: string = U.dispatcherHannover) => {
    const r = await env.as(as, "GET", `/v1/orgs/${org()}/dispatch`);
    expect(r.statusCode).toBe(200);
    return r.json() as DispatchDataset;
  };
  const summaryOf = (d: DispatchDataset, tourId: string) => summarizeTours(d).find((s) => s.tour.id === tourId)!;
  async function makeTour(driverIdx: number, n: number, lat0 = 52.37, extra: { express?: number } = {}) {
    const t = (await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/tours`, { depotId: env.data.depots.hannover, date: today(), driverId: env.data.drivers.hannover![driverIdx] })).json();
    const r = await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/stops`, {
      tourId: t.id,
      stops: Array.from({ length: n }, (_, i) => ({
        recipientName: `Kunde ${i}`,
        address: { street: "Teststraße", houseNumber: String(i + 1), postalCode: "30159", city: "Hannover" },
        location: { lat: lat0 + i * 0.004 + driverIdx * 0.0001, lng: 9.73 },
        ...(extra.express === i ? { priority: true, timeWindow: { start: 0, end: 1439 } } : {}),
      })),
    });
    expect(r.statusCode).toBe(201);
    versions.set(t.id, t.version);
    return t.id as string;
  }
  const versions = new Map<string, number>();

  let tourId = "";

  it("planned tour: road legs in the dataset; the list, KPIs and detail use them; the second load hits the cache", async () => {
    tourId = await makeTour(0, 3);
    const before = { ...osrm };
    const d = await dataset();
    expect(d.isToday).toBe(true);
    const road = d.roads![tourId]!;
    expect(road.source).toBe("osrm");
    const s = summaryOf(d, tourId);
    expect(s.timeline.projection.source).toBe("road");
    expect(s.timeline.projection.totalDriveSeconds).toBe(4 * 300); // start -> 3 stops -> back
    expect(s.timeline.projection.totalMeters).toBe(4 * 2000);
    expect(osrm.route - before.route).toBeGreaterThan(0);
    const routeRequests = osrm.route;
    const hitsBefore = routing.stats().cacheHits;
    await dataset();
    expect(osrm.route).toBe(routeRequests); // nothing new to route: served from the cache
    expect(routing.stats().cacheHits).toBeGreaterThan(hitsBefore);
  });

  it("running tour with a fresh live position: one table request, ETA from the live position", async () => {
    expect((await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/tours/${tourId}/publish`, { expectedVersion: versions.get(tourId) })).statusCode).toBe(200);
    expect((await env.as(U.driverHannover1, "POST", `/v1/orgs/${org()}/tours/${tourId}/status`, { status: "in_progress" })).statusCode).toBe(200);
    await env.superuser.query(
      `insert into driver_positions (organization_id, driver_id, tour_id, lat, lng, recorded_at) values ($1, $2, $3, 52.371, 9.731, now() - interval '20 seconds')
       on conflict (organization_id, driver_id) do update set tour_id = excluded.tour_id, lat = excluded.lat, lng = excluded.lng, recorded_at = excluded.recorded_at`,
      [org(), env.data.drivers.hannover![0], tourId],
    );
    const tables = osrm.table;
    const d = await dataset();
    expect(osrm.table).toBe(tables + 1);
    const p = summaryOf(d, tourId).timeline.projection;
    expect(p.origin).toBe("gps");
    expect(p.gpsAgeSeconds).toBeGreaterThanOrEqual(19);
    const first = [...p.stops.values()].sort((a, b) => a.etaMinute - b.etaMinute)[0]!;
    expect(first.etaMinute - d.asOfMinute).toBeCloseTo(3, 5); // 3 min live leg
    // No position coordinates leave the API in the dataset.
    expect(JSON.stringify(d.roads)).not.toMatch(/52\.371/);
  });

  it("the live panel endpoint (/eta) and the dataset agree", async () => {
    const d = await dataset();
    const p = summaryOf(d, tourId).timeline.projection;
    const eta = (await env.as(U.dispatcherHannover, "GET", `/v1/orgs/${org()}/tours/${tourId}/eta`)).json();
    expect(eta).toMatchObject({ source: "osrm", from: "gps" });
    expect(Math.abs(eta.finishMinute - p.finishMinute)).toBeLessThanOrEqual(1);
    expect(eta.remainingMeters).toBe(Math.round(p.remainingMeters));
  });

  it("stale live position: from the last completed stop, with the GPS age, no table request", async () => {
    await env.superuser.query(`update driver_positions set recorded_at = now() - interval '10 minutes' where tour_id = $1`, [tourId]);
    const tables = osrm.table;
    const p = summaryOf(await dataset(), tourId).timeline.projection;
    expect(osrm.table).toBe(tables);
    expect(p.origin).toBe("tour_start"); // nothing completed yet on this tour
    expect(p.gpsAgeSeconds).toBeGreaterThanOrEqual(600);
    expect(p.source).toBe("road");
  });

  it("paused tour: conditional ETA (resumes now)", async () => {
    expect((await env.as(U.driverHannover1, "POST", `/v1/orgs/${org()}/tours/${tourId}/status`, { status: "paused" })).statusCode).toBe(200);
    const p = summaryOf(await dataset(), tourId).timeline.projection;
    expect(p.condition).toBe("resume_now");
    expect((await env.as(U.driverHannover1, "POST", `/v1/orgs/${org()}/tours/${tourId}/status`, { status: "in_progress" })).statusCode).toBe(200);
  });

  it("tour tomorrow 08:00: projected from tomorrow's planned departure, not from now", async () => {
    const d = new Date(Date.now() + 36 * 3600_000); // safely "tomorrow" in Berlin whatever the hour
    const tomorrow = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
    const t = (await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/tours`, { depotId: env.data.depots.hannover, date: tomorrow, name: "TOMORROW", plannedStartMinute: 480 })).json();
    const r = await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/stops`, {
      tourId: t.id,
      stops: [0, 1, 2].map((i) => ({ recipientName: `Morgen ${i}`, address: { street: "Teststraße", houseNumber: String(i + 1), postalCode: "30159", city: "Hannover" }, location: { lat: 52.37 + i * 0.004, lng: 9.73 } })),
    });
    expect(r.statusCode).toBe(201);
    const res = await env.as(U.dispatcherHannover, "GET", `/v1/orgs/${org()}/dispatch?date=${tomorrow}`);
    expect(res.statusCode).toBe(200);
    const data = res.json() as DispatchDataset;
    expect(data).toMatchObject({ date: tomorrow, isToday: false, asOfMinute: 0 });
    const p = summaryOf(data, t.id).timeline.projection;
    expect(p.source).toBe("road");
    expect(p).toMatchObject({ fromMinute: 480, condition: null, scheduledFinishMinute: null });
    // 3 × (5 min road + service) + 5 min back, from 08:00 – independent of the current time.
    const service = data.stops.filter((s) => s.tourId === t.id).reduce((a, s) => a + s.serviceSeconds / 60, 0);
    expect(p.finishMinute).toBeCloseTo(480 + 4 * 5 + service, 6);
  });

  it("routing down: the tour is a labelled estimate, the page still loads", async () => {
    const id = await makeTour(1, 2, 52.4);
    osrm.fail = true;
    try {
      const d = await dataset();
      expect(d.roads![id]).toMatchObject({ source: "estimate", reason: "routing_unavailable" });
      const s = summaryOf(d, id);
      expect(s.timeline.projection).toMatchObject({ source: "estimate", estimateReason: "routing_unavailable" });
    } finally {
      osrm.fail = false;
    }
  });

  it("a stop outside the road data: labelled estimate naming the stop", async () => {
    const id = await makeTour(2, 2, 52.45);
    const far = (await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/stops`, {
      tourId: id,
      stops: [{ recipientName: "Far", address: { street: "Weit", houseNumber: "1", postalCode: "30159", city: "Hannover" }, location: { lat: 61, lng: 9.73 } }],
    })).json();
    const d = await dataset();
    const road = d.roads![id]!;
    expect(road).toMatchObject({ source: "estimate", reason: "out_of_coverage" });
    expect(road.source === "estimate" ? road.stopIds : []).toContain(far.ids[0]);
  });

  it("slow routing never blocks the page: pending tours are labelled, the next load has road times", async () => {
    const id = await makeTour(3, 2, 52.5);
    osrm.latencyMs = 2500;
    try {
      const t0 = Date.now();
      const d = await dataset();
      expect(Date.now() - t0).toBeLessThan(2400); // 1.5 s routing budget + database
      expect(d.roadsPending).toBe(true);
      expect(d.roads![id]).toMatchObject({ source: "estimate", reason: "pending" });
      await new Promise((r) => setTimeout(r, 3500)); // the background requests land in the cache
      osrm.latencyMs = 0;
      expect((await dataset()).roads![id]!.source).toBe("osrm");
    } finally {
      osrm.latencyMs = 0;
    }
  }, 20_000);

  it("performance: 30 tours x 100 stops (15 running with live GPS): bounded load time, cache effective, OSRM not flooded", async () => {
    const depot = env.data.depots.hannover;
    await env.superuser.query(`update subscriptions set seats = 100 where organization_id = $1`, [org()]).catch(() => undefined);
    // One open tour per driver and day: own drivers for the running tours, none for planned ones.
    const drivers: string[] = [];
    for (let k = 0; k < 15; k++)
      drivers.push((await env.superuser.query<{ id: string }>(`insert into drivers (organization_id, depot_id, display_name) values ($1, $2, $3) returning id`, [org(), depot, `Perf ${k}`])).rows[0]!.id);
    const ids: string[] = [];
    for (let k = 0; k < 30; k++) {
      const running = k < 15;
      const t = (
        await env.superuser.query<{ id: string }>(
          `insert into tours (organization_id, depot_id, driver_id, name, tour_date, status, planned_start_minute, published_at, started_at)
           values ($1, $2, $3, $4, $5, $6, 450, now(), $7) returning id`,
          [org(), depot, running ? drivers[k] : null, `PERF-${k}`, today(), running ? "in_progress" : "planned", running ? new Date(Date.now() - 3 * 3600_000) : null],
        )
      ).rows[0]!.id;
      ids.push(t);
      const values: string[] = [];
      const params: unknown[] = [org(), t];
      for (let i = 0; i < 100; i++) {
        const done = running && i < 30;
        params.push(i, `P${i}`, 52.3 + k * 0.003 + i * 0.0005, 9.6 + i * 0.001, done ? "delivered" : "pending", done ? new Date(Date.now() - (100 - i) * 60_000) : null);
        const b = params.length - 5;
        values.push(`($1, $2, $${b}, $${b + 1}, 'Perfstraße', '1', '30159', 'Hannover', $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5})`);
      }
      await env.superuser.query(`insert into stops (organization_id, tour_id, sequence, recipient_name, street, house_number, postal_code, city, lat, lng, status, completed_at) values ${values.join(",")}`, params);
      if (running)
        await env.superuser.query(
          `insert into driver_positions (organization_id, driver_id, tour_id, lat, lng, recorded_at) values ($1, $2, $3, 52.31, 9.61, now() - interval '15 seconds')
           on conflict (organization_id, driver_id) do update set tour_id = excluded.tour_id, lat = excluded.lat, lng = excluded.lng, recorded_at = excluded.recorded_at`,
          [org(), drivers[k], t],
        );
    }
    osrm.latencyMs = 40;
    try {
      const r0 = { ...osrm };
      let t0 = Date.now();
      const cold = await dataset(U.jarbouOwner);
      const coldMs = Date.now() - t0;
      const r1 = { ...osrm };
      t0 = Date.now();
      const warm = await dataset(U.jarbouOwner);
      const warmMs = Date.now() - t0;
      const r2 = { ...osrm };
      const perfRoads = (d: DispatchDataset) => ids.map((id) => d.roads![id]!);
      const summary = {
        coldMs,
        warmMs,
        coldRouteRequests: r1.route - r0.route,
        coldTableRequests: r1.table - r0.table,
        warmRouteRequests: r2.route - r1.route,
        warmTableRequests: r2.table - r1.table,
        coldRoad: perfRoads(cold).filter((r) => r.source === "osrm").length,
        warmRoad: perfRoads(warm).filter((r) => r.source === "osrm").length,
        warmLiveOrigin: summarizeTours(warm).filter((s) => ids.includes(s.tour.id) && s.timeline.projection.origin === "gps").length,
      };
      console.log("P0-2 performance (30 tours x 100 stops, 40 ms per OSRM request):", JSON.stringify(summary));
      expect(coldMs).toBeLessThan(2500);
      expect(warmMs).toBeLessThan(1500);
      expect(summary.coldRouteRequests).toBeLessThanOrEqual(45); // 15 planned + 15x(plan + remaining), at most
      expect(summary.warmRouteRequests).toBe(0); // everything from the cache
      expect(summary.warmTableRequests).toBe(1); // one request for all live positions
      expect(summary.warmRoad).toBe(30);
      expect(summary.warmLiveOrigin).toBe(15);
    } finally {
      osrm.latencyMs = 0;
    }
  }, 60_000);
});
