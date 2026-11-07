import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { RoadRoute, RoutingProvider } from "../../src/routing";
import { SEED_USERS as U } from "../../src/seed";
import { createTestEnv, postgresAvailable, type TestEnv } from "./helpers";

const available = await postgresAvailable();
let env: TestEnv;
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const fix = (secondsAgo: number, lat = 52.38, lng = 9.74) => ({ id: randomUUID(), lat, lng, accuracy: 6, speed: 8.3, heading: 120, recordedAt: new Date(Date.now() - secondsAgo * 1000).toISOString() });

/** Deterministic road router for tests: every leg 5 min / 2 km. Not real road data. */
const fakeRouting: RoutingProvider = {
  name: "fake",
  async route(points): Promise<RoadRoute> {
    const legs = points.slice(1).map(() => ({ meters: 2000, seconds: 300 }));
    return { source: "osrm", legs, distanceMeters: legs.length * 2000, durationSeconds: legs.length * 300, geometry: points.map((p) => [p.lat, p.lng]) };
  },
};

describe.runIf(available)("live tracking API", () => {
  beforeAll(async () => {
    env = await createTestEnv("tracking", { routing: fakeRouting });
  }, 120_000);
  afterAll(async () => {
    await env?.close();
  });

  const org = () => env.data.orgs.jarbou;
  let tourId = "";

  it("a published tour is started by Lena", async () => {
    const t = (await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/tours`, { depotId: env.data.depots.hannover, date: today(), driverId: env.data.drivers.hannover![0] })).json();
    tourId = t.id;
    await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/stops`, {
      tourId,
      stops: [0, 1, 2].map((i) => ({ recipientName: `Kunde ${i}`, address: { street: "Teststraße", houseNumber: String(i + 1), postalCode: "30159", city: "Hannover" }, location: { lat: 52.37 + i * 0.004, lng: 9.73 } })),
    });
    expect((await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/tours/${tourId}/publish`, { expectedVersion: t.version })).statusCode).toBe(200);
    expect((await env.as(U.driverHannover1, "POST", `/v1/orgs/${org()}/tours/${tourId}/status`, { status: "in_progress" })).statusCode).toBe(200);
  });

  it("nothing is recorded while the company has tracking switched off (default)", async () => {
    const cfg = (await env.as(U.driverHannover1, "GET", `/v1/orgs/${org()}/tracking/config`)).json();
    expect(cfg).toMatchObject({ mode: "off", acknowledgedVersion: null });
    const r = await env.as(U.driverHannover1, "POST", `/v1/orgs/${org()}/tours/${tourId}/locations`, { points: [fix(1)] });
    expect(r.statusCode).toBe(409);
    expect(r.json().error.code).toBe("tracking_disabled");
  });

  it("pilot mode tracks only the named driver (e.g. the owner's own phone), never colleagues", async () => {
    const lena = env.data.drivers.hannover![0]!;
    const unconfirmed = await env.as(U.jarbouOwner, "PATCH", `/v1/orgs/${org()}/tracking`, { mode: "pilot", pilotDriverIds: [lena] });
    expect(unconfirmed.json().error.code).toBe("pilot_not_confirmed");
    const pilot = await env.as(U.jarbouOwner, "PATCH", `/v1/orgs/${org()}/tracking`, { mode: "pilot", pilotDriverIds: [lena], confirmPilotConsent: true });
    expect(pilot.statusCode).toBe(200);
    expect((await env.as(U.driverHannover1, "GET", `/v1/orgs/${org()}/tracking/config`)).json()).toMatchObject({ mode: "active_tours", companyMode: "pilot" });
    // A colleague's app sees tracking as off, and the database refuses positions from them.
    expect((await env.as(U.driverHannover2, "GET", `/v1/orgs/${org()}/tracking/config`)).json()).toMatchObject({ mode: "off", companyMode: "pilot" });
    const other = await env.superuser.query(`select app.tracking_enabled_for($1, $2) as on`, [org(), env.data.drivers.hannover![1]]);
    expect(other.rows[0].on).toBe(false);
    // Back to off for the following tests.
    expect((await env.as(U.jarbouOwner, "PATCH", `/v1/orgs/${org()}/tracking`, { mode: "off", pilotDriverIds: [] })).statusCode).toBe(200);
  });

  it("only an admin can switch it on, and only after confirming the legal prerequisites", async () => {
    expect((await env.as(U.dispatcherHannover, "PATCH", `/v1/orgs/${org()}/tracking`, { mode: "active_tours", confirmPrerequisites: true })).statusCode).toBe(403);
    const unconfirmed = await env.as(U.jarbouOwner, "PATCH", `/v1/orgs/${org()}/tracking`, { mode: "active_tours" });
    expect(unconfirmed.statusCode).toBe(422);
    expect(unconfirmed.json().error.code).toBe("prerequisites_not_confirmed");
    const on = await env.as(U.jarbouOwner, "PATCH", `/v1/orgs/${org()}/tracking`, { mode: "active_tours", intervalSeconds: 10, confirmPrerequisites: true });
    expect(on.statusCode).toBe(200);
    expect(on.json()).toMatchObject({ mode: "active_tours", intervalSeconds: 10, noticeVersion: 1 });
  });

  it("the driver must acknowledge the notice; then positions are accepted idempotently", async () => {
    const url = `/v1/orgs/${org()}/tours/${tourId}/locations`;
    const before = await env.as(U.driverHannover1, "POST", url, { points: [fix(1)] });
    expect(before.json().error.code).toBe("tracking_notice_required");
    expect((await env.as(U.driverHannover1, "POST", `/v1/orgs/${org()}/tracking/notice`, {})).json()).toEqual({ acknowledgedVersion: 1 });
    const batch = [fix(20, 52.381), fix(10, 52.382), fix(1, 52.383)];
    expect((await env.as(U.driverHannover1, "POST", url, { points: batch })).json()).toEqual({ accepted: 3, duplicates: 0, rejected: [] });
    // The app resends after a lost response: nothing is stored twice.
    expect((await env.as(U.driverHannover1, "POST", url, { points: batch })).json()).toMatchObject({ accepted: 0, duplicates: 3 });
    // Malformed input is refused before it reaches the database.
    expect((await env.as(U.driverHannover1, "POST", url, { points: [{ ...fix(1), lat: 200 }] })).statusCode).toBe(400);
    // Another driver cannot record positions on Lena's tour.
    expect((await env.as(U.driverHannover2, "POST", url, { points: [fix(1)] })).statusCode).toBe(404);
  });

  it("dispatch sees the live position with tour progress – only within its company and depot scope", async () => {
    const live = (await env.as(U.dispatcherHannover, "GET", `/v1/orgs/${org()}/fleet/live`)).json();
    expect(live.vehicles).toHaveLength(1);
    const v = live.vehicles[0];
    expect(v).toMatchObject({ driverName: "Lena Hoffmann", tourId, tourStatus: "in_progress", progress: { done: 0, remaining: 3 } });
    expect(v.position.lat).toBeCloseTo(52.383, 5); // newest fix
    expect(v.position.accuracyMeters).toBe(6);
    expect(v.nextStop.street).toBe("Teststraße");
    expect(Date.parse(live.serverTime) - Date.parse(v.recordedAt)).toBeLessThan(60_000);
    // Bremen dispatcher: other depot -> nothing. Other company: no access. Drivers: no permission.
    expect((await env.as(U.dispatcherBremen, "GET", `/v1/orgs/${org()}/fleet/live`)).json().vehicles).toHaveLength(0);
    expect((await env.as(U.musterOwner, "GET", `/v1/orgs/${org()}/fleet/live`)).statusCode).toBe(403);
    expect((await env.as(U.driverHannover2, "GET", `/v1/orgs/${org()}/fleet/live`)).statusCode).toBe(403);
  });

  it("the recorded track is available to dispatch and every read is audited", async () => {
    const track = (await env.as(U.dispatcherHannover, "GET", `/v1/orgs/${org()}/tours/${tourId}/track`)).json();
    expect(track.points).toHaveLength(3);
    expect(track.events.map((e: { kind: string }) => e.kind)).toEqual(["started"]);
    expect(track.gaps).toEqual([]);
    const audit = await env.superuser.query(`select count(*)::int as n from audit_log where action = 'read' and table_name = 'location_pings' and record_id = $1`, [tourId]);
    expect(audit.rows[0].n).toBe(1);
    expect((await env.as(U.dispatcherBremen, "GET", `/v1/orgs/${org()}/tours/${tourId}/track`)).statusCode).toBe(404);
  });

  it("live ETA starts at the vehicle's current position and flags deadline risks (suggestion only)", async () => {
    const eta = (await env.as(U.dispatcherHannover, "GET", `/v1/orgs/${org()}/tours/${tourId}/eta`)).json();
    expect(eta).toMatchObject({ source: "osrm", from: "gps", remainingMeters: 4 * 2000, remainingDriveSeconds: 4 * 300 });
    expect(eta.stops).toHaveLength(3);
    // 5 min driving per leg + service time between stops: strictly increasing ETAs.
    expect(eta.stops[1].etaMinute).toBeGreaterThan(eta.stops[0].etaMinute);
    expect(eta.stops[0].etaMinute - eta.computedAtMinute).toBe(5);
    expect(eta.suggestReoptimize).toBe(false);
    // Drivers have no access to the fleet ETA view.
    expect((await env.as(U.driverHannover2, "GET", `/v1/orgs/${org()}/tours/${tourId}/eta`)).statusCode).toBe(403);
  });

  it("re-optimizing a running tour starts from the fresh GPS position", async () => {
    const r = await env.as(U.driverHannover1, "POST", `/v1/orgs/${org()}/tours/${tourId}/optimize`, {});
    expect(r.statusCode).toBe(200);
    expect(r.json().result.startSource).toBe("gps");
  });

  it("a stale position gives no live ETA – it is never presented as current", async () => {
    await env.superuser.query(`update driver_positions set recorded_at = now() - interval '10 minutes' where tour_id = $1`, [tourId]);
    const eta = (await env.as(U.dispatcherHannover, "GET", `/v1/orgs/${org()}/tours/${tourId}/eta`)).json();
    expect(eta).toMatchObject({ source: "none", reason: "position_stale" });
    expect(eta.positionAgeSeconds).toBeGreaterThanOrEqual(600);
    // The live list still shows it – with its real age (the dispatch UI marks it "No signal").
    const live = (await env.as(U.dispatcherHannover, "GET", `/v1/orgs/${org()}/fleet/live`)).json();
    expect(Date.parse(live.serverTime) - Date.parse(live.vehicles[0].recordedAt)).toBeGreaterThanOrEqual(600_000);
  });

  it("completing the tour ends the live position", async () => {
    expect((await env.as(U.driverHannover1, "POST", `/v1/orgs/${org()}/tours/${tourId}/status`, { status: "completed" })).statusCode).toBe(200);
    expect((await env.as(U.dispatcherHannover, "GET", `/v1/orgs/${org()}/fleet/live`)).json().vehicles).toHaveLength(0);
    // After completion nothing new is accepted.
    const late = (await env.as(U.driverHannover1, "POST", `/v1/orgs/${org()}/tours/${tourId}/locations`, { points: [fix(-60)] })).json();
    expect(late.rejected.map((x: { reason: string }) => x.reason)).toEqual(["outside_active_tour"]);
  });
});
