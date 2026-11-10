import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { OsrmRouting } from "../../src/routing";
import { SEED_USERS as U } from "../../src/seed";
import { adminUrl, createTestEnv, postgresAvailable, type TestEnv } from "./helpers";

/**
 * Staging defect (P0-3 hotfix): the hosted server runs with `extra_float_digits = 0`, which prints
 * 15 significant digits. A driver GPS pin (13+ decimals) read that way no longer equals the stored
 * value, so check results were never stored and "Confirm location" / "Choose navigation approach"
 * failed with "stop location changed". Here the test database has the same server setting.
 */
const available = await postgresAvailable();
let env: TestEnv;

// Simulated OSRM: every point 12 m from "Teststraße", no motorway.
const fakeOsrm: typeof fetch = async (input) => {
  const url = new URL(String(input));
  const coords = url.pathname.split("/").at(-1)!.split(";").map((c) => c.split(",").map(Number) as [number, number]);
  if (url.pathname.startsWith("/nearest")) return Response.json({ code: "Ok", waypoints: [{ distance: 12, name: "Teststraße", location: coords[0] }] });
  if (url.pathname.startsWith("/table")) {
    const s = url.searchParams.get("sources")!.split(";");
    const d = url.searchParams.get("destinations")!.split(";");
    return Response.json({ code: "Ok", durations: s.map(() => d.map(() => 60)) });
  }
  return Response.json({
    code: "Ok",
    waypoints: coords.map((c) => ({ distance: 12, name: "Teststraße", location: c })),
    routes: [{ legs: coords.slice(0, -1).map(() => ({ steps: [{ ref: "", intersections: [{ classes: [] }] }] })) }],
  });
};

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
// An existing pin exactly as a phone delivered it before the fix (as on staging: 13+ decimals).
const RAW = { lat: 52.38123456789012, lng: 9.741234567890123 };

describe.runIf(available)("exact coordinates on a server with extra_float_digits = 0", () => {
  const org = () => env.data.orgs.jarbou;
  let tourId = "";
  const S: Record<string, string> = {};
  const row = async (id: string) =>
    (await env.superuser.query(`select lat, lng, address_version, location_version, lat = $2 and lng = $3 as raw from stops where id = $1`, [id, RAW.lat, RAW.lng])).rows[0] as {
      lat: number;
      lng: number;
      address_version: number;
      location_version: number;
      raw: boolean;
    };
  const loc = async (id: string) => (await env.as(U.dispatcherHannover, "GET", `/v1/orgs/${org()}/stops/${id}/location`)).json();

  beforeAll(async () => {
    env = await createTestEnv("floats", { routing: new OsrmRouting("http://osrm.test", { fetchImpl: fakeOsrm }), databaseSettings: { extra_float_digits: "0" } });
    await env.superuser.query("set extra_float_digits = 1"); // the test's own reads stay exact
    const t = (await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/tours`, { depotId: env.data.depots.hannover, date: today(), driverId: env.data.drivers.hannover![0], name: "FLOAT-01" })).json();
    tourId = t.id;
    const r = await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/stops`, {
      tourId,
      stops: ["legacy", "driver", "edit", "plain"].map((k, i) => ({ recipientName: k, address: { street: "Teststraße", houseNumber: String(i + 1), postalCode: "30159", city: "Hannover" }, location: { lat: 52.38 + i * 0.001, lng: 9.74 } })),
    });
    expect(r.statusCode, r.body).toBe(201);
    ["legacy", "driver", "edit", "plain"].forEach((k, i) => (S[k] = r.json().ids[i]));
    // Existing data from before the fix: a raw device pin (written directly, as old builds did).
    await env.superuser.query(`update stops set lat = $2, lng = $3 where id = $1`, [S.legacy, RAW.lat, RAW.lng]);
    const cur = (await env.as(U.dispatcherHannover, "GET", `/v1/orgs/${org()}/tours/${tourId}`)).json();
    const p = await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/tours/${tourId}/publish`, { expectedVersion: (cur.tour ?? cur).version });
    expect(p.statusCode, p.body).toBeLessThan(300);
  }, 120_000);
  afterAll(async () => {
    await env?.close();
  });

  it("reproduces the staging server: a plain connection prints 15 digits, the API's pool prints exactly", async () => {
    const raw = new pg.Client({ connectionString: adminUrl(`turvio_it_floats_${process.pid}`) });
    await raw.connect();
    const plain = (await raw.query(`select current_setting('extra_float_digits') efd, lat from stops where id = $1`, [S.legacy])).rows[0];
    await raw.end();
    expect(plain.efd).toBe("0");
    expect(plain.lat).not.toBe(RAW.lat); // the defect: rounded on the way out
    const pooled = await env.db.pool.query(`select current_setting('extra_float_digits') efd, $1::float8 lat, $2::float8 lng`, [RAW.lat, RAW.lng]);
    expect(pooled.rows[0]).toEqual({ efd: "1", lat: RAW.lat, lng: RAW.lng });
  });

  it("existing high-precision pin: read exactly, check result stored, data unchanged", async () => {
    const before = await row(S.legacy!);
    const l = await loc(S.legacy!);
    expect(l.current.location).toEqual(RAW);
    const stored = await env.superuser.query(`select checked_lat = $2 and checked_lng = $3 as exact from stop_location_checks c where c.stop_id = $1`, [S.legacy, RAW.lat, RAW.lng]);
    expect(stored.rows).toEqual([{ exact: true }]);
    // A second view reuses the stored result instead of recomputing.
    expect((await loc(S.legacy!)).check.source).toBe("stored");
    expect(await row(S.legacy!)).toEqual(before);
    expect(before.raw).toBe(true);
  });

  it("Confirm location and Choose navigation approach work with the coordinates the API returned", async () => {
    const l = await loc(S.legacy!);
    const firstEvent = (await env.superuser.query(`select coalesce(max(id), 0)::int n from stop_location_events`)).rows[0].n as number;
    const expected = { expectedLat: l.current.location.lat, expectedLng: l.current.location.lng, expectedAddressVersion: l.current.addressVersion };
    const c = await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/stops/${S.legacy}/location/confirm`, { ...expected, issueCodes: [], note: "checked" });
    expect(c.statusCode, c.body).toBe(204);
    const a = await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/stops/${S.legacy}/location/approach`, { ...expected, lat: 52.3816, lng: 9.7412, reason: "Gate" });
    expect(a.statusCode, a.body).toBe(204);
    // No false conflict on repeat, and no drift: the pin and its version are untouched.
    expect((await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/stops/${S.legacy}/location/confirm`, { ...expected, issueCodes: [] })).statusCode).toBe(204);
    const r = await row(S.legacy!);
    expect(r.raw).toBe(true);
    expect(r.location_version).toBe(l.current.locationVersion);
    const ev = (await env.superuser.query(`select action, reason from stop_location_events where stop_id = $1 and id > $2 order by id`, [S.legacy, firstEvent])).rows;
    expect(ev.filter((x) => ["location_changed", "confirmation_invalidated", "approach_invalidated"].includes(x.action)), JSON.stringify(ev)).toEqual([]);
    expect(ev.map((x) => x.action)).toEqual(["confirmed", "approach_accepted", "confirmed"]);
  });

  it("a real change is still detected exactly (the check is not loosened)", async () => {
    const l = await loc(S.legacy!);
    const fifteen = Number(RAW.lat.toPrecision(15)); // what the server sent before the fix
    expect(fifteen).not.toBe(RAW.lat);
    const r = await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/stops/${S.legacy}/location/confirm`, { expectedLat: fifteen, expectedLng: RAW.lng, expectedAddressVersion: l.current.addressVersion, issueCodes: [] });
    expect(r.statusCode).toBe(409);
  });

  it("new driver-captured positions are stored to 7 decimals and then confirmable", async () => {
    const gps = { lat: 52.38212345678901, lng: 9.742987654321098 };
    const want = { lat: 52.3821235, lng: 9.7429877 };
    const v = (await row(S.driver!)).location_version;
    const u = await env.as(U.driverHannover1, "POST", `/v1/orgs/${org()}/stops/${S.driver}/driver-update`, { location: gps, locationSource: "manual_pin", expectedLocationVersion: v });
    expect(u.statusCode, u.body).toBe(204);
    const e = await env.as(U.driverHannover1, "POST", `/v1/orgs/${org()}/stops/${S.edit}/edit`, { address: { street: "Teststraße", houseNumber: "3a", postalCode: "30159", city: "Hannover" }, location: gps, locationSource: "manual_pin" });
    expect(e.statusCode, e.body).toBe(200);
    expect(e.json().stop.location).toEqual(want);
    for (const id of [S.driver!, S.edit!]) {
      const db = (await env.superuser.query(`select lat, lng from stops where id = $1`, [id])).rows[0];
      expect(db).toEqual(want);
      const l = await loc(id);
      expect(l.current.location).toEqual(want);
      const c = await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/stops/${id}/location/confirm`, { expectedLat: want.lat, expectedLng: want.lng, expectedAddressVersion: l.current.addressVersion, issueCodes: [] });
      expect(c.statusCode, c.body).toBe(204);
    }
    // Rounding moves a point by at most 0.5e-7° (< 1 cm).
    expect(Math.abs(want.lat - gps.lat)).toBeLessThan(0.6e-7);
  });

  it("staff coordinates (6 decimals from the map picker) are stored unchanged", async () => {
    const p = { lat: 52.383456, lng: 9.743211 };
    const l = await loc(S.plain!);
    const r = await env.as(U.dispatcherHannover, "PATCH", `/v1/orgs/${org()}/stops/${S.plain}`, { location: p, reason: "Pin corrected", expectedLocationVersion: l.current.locationVersion });
    expect(r.statusCode, r.body).toBeLessThan(300);
    expect((await env.superuser.query(`select lat, lng from stops where id = $1`, [S.plain])).rows[0]).toEqual(p);
  });
});
