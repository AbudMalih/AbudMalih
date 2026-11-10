import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { OsrmRouting } from "../../src/routing";
import { SEED_USERS as U } from "../../src/seed";
import { createTestEnv, postgresAvailable, type TestEnv } from "./helpers";

/**
 * P0-3.2 security and behaviour: original-location records, audit, decisions, versions, retention.
 * Real PostgreSQL with the full migration chain; SQL is also run directly as each role
 * (authenticated with a user's claims, the API's service role, the database owner) to prove the
 * database itself enforces the rules – not only the API.
 */
const available = await postgresAvailable();
let env: TestEnv;

// Simulated OSRM: every point 8 m from "Teststraße"; points east of 9.80 lie on the A 2.
const fakeOsrm: typeof fetch = async (input) => {
  const url = new URL(String(input));
  const coords = url.pathname.split("/").at(-1)!.split(";").map((c) => c.split(",").map(Number) as [number, number]);
  if (url.pathname.startsWith("/nearest")) return Response.json({ code: "Ok", waypoints: [{ distance: 49, name: "Klusriede", location: coords[0] }] });
  if (url.pathname.startsWith("/table")) {
    const s = url.searchParams.get("sources")!.split(";");
    const d = url.searchParams.get("destinations")!.split(";");
    return Response.json({ code: "Ok", durations: s.map(() => d.map(() => 60)) });
  }
  return Response.json({
    code: "Ok",
    waypoints: coords.map((c) => ({ distance: c[0] > 9.8 ? 0 : 8, name: c[0] > 9.8 ? "" : "Teststraße", location: c })),
    routes: [
      {
        distance: (coords.length - 1) * 1000,
        duration: (coords.length - 1) * 120,
        geometry: { coordinates: coords },
        legs: coords.slice(0, -1).map((c) => ({ distance: 1000, duration: 120, steps: [{ ref: c[0] > 9.8 ? "A 2" : "", intersections: [{ classes: c[0] > 9.8 ? ["motorway"] : [] }] }] })),
      },
    ],
  });
};

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

describe.runIf(available)("stop location history (P0-3.2)", () => {
  beforeAll(async () => {
    env = await createTestEnv("lochist", { routing: new OsrmRouting("http://osrm.test", { fetchImpl: fakeOsrm }) });
  }, 120_000);
  afterAll(async () => {
    await env?.close();
  });
  const org = () => env.data.orgs.jarbou;
  const uid = async (email: string) => (await env.superuser.query<{ id: string }>(`select id from auth.users where email = $1`, [email])).rows[0]!.id;

  /** Run SQL as a user, exactly like the API's asUser (role authenticated + JWT claims), in a rolled-back or committed transaction. */
  async function sqlAs<R = Record<string, unknown>>(email: string | null, sql: string, params: unknown[] = [], opts: { commit?: boolean; role?: string } = {}) {
    const c = env.superuser;
    const id = email ? await uid(email) : null;
    await c.query("begin");
    try {
      await c.query(`set local role ${opts.role ?? "authenticated"}`);
      if (email && id) {
        await c.query("select set_config('request.jwt.claims', $1, true), set_config('request.jwt.claim.sub', $2, true)", [JSON.stringify({ sub: id, email, role: "authenticated" }), id]);
      }
      const r = await c.query(sql, params);
      await c.query(opts.commit ? "commit" : "rollback");
      return r.rows as R[];
    } catch (e) {
      await c.query("rollback");
      throw e;
    }
  }
  const stopRow = async (id: string) => (await env.superuser.query(`select street, lat, lng, address_version, location_version, location_precision from stops where id = $1`, [id])).rows[0];
  const origin = async (id: string) => (await env.superuser.query(`select kind, provenance, street, lat, lng, location_precision, captured_by from stop_location_origins where stop_id = $1`, [id])).rows[0];
  const events = async (id: string) =>
    (await env.superuser.query<{ action: string; actor_role: string; reason: string | null; actor_user_id: string | null }>(`select action, actor_role, reason, actor_user_id from stop_location_events where stop_id = $1 order by id`, [id])).rows;

  let tourId = "";
  let version = 0;
  const S: Record<string, string> = {};

  it("creation records the original with the declared channel; drivers' stops are always driver captures", async () => {
    const t = (await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/tours`, { depotId: env.data.depots.hannover, date: today(), name: "HIST-01", driverId: env.data.drivers.hannover![0] })).json();
    tourId = t.id;
    version = t.version;
    const r = await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/stops`, {
      tourId,
      provenance: "import_file",
      stops: [
        { recipientName: "a", address: { street: "Lister Meile", houseNumber: "1", postalCode: "30161", city: "Hannover" }, location: { lat: 52.38, lng: 9.74 }, locationSource: "import", locationPrecision: "house" },
        { recipientName: "b", address: { street: "Lister Meile", houseNumber: "3", postalCode: "30161", city: "Hannover" }, location: { lat: 52.381, lng: 9.741 }, locationSource: "import" },
        { recipientName: "c", address: { street: "Lister Meile", houseNumber: "5", postalCode: "30161", city: "Hannover" } },
      ],
    });
    expect(r.statusCode).toBe(201);
    [S.a, S.b, S.c] = r.json().ids;
    expect(await origin(S.a!)).toMatchObject({ kind: "original", provenance: "import_file", street: "Lister Meile", lat: 52.38, location_precision: "house", captured_by: await uid(U.dispatcherHannover) });
    expect((await origin(S.b!)).location_precision).toBe("import_unverified");
    expect(await events(S.a!)).toEqual([{ action: "created", actor_role: "dispatcher", reason: null, actor_user_id: await uid(U.dispatcherHannover) }]);
    // A staff stop without a declared channel: "api".
    const plain = await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/stops`, { tourId, stops: [{ address: { street: "Podbielskistraße", postalCode: "30163", city: "Hannover" } }] });
    expect((await origin(plain.json().ids[0])).provenance).toBe("api");

    // Publish, then the driver adds a stop – declaring "import_file" does not make it one.
    expect((await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/tours/${tourId}/publish`, { expectedVersion: version })).statusCode).toBe(200);
    const d = await env.as(U.driverHannover1, "POST", `/v1/orgs/${org()}/stops`, { tourId, provenance: "import_file", stops: [{ address: { street: "Driverweg", houseNumber: "1", postalCode: "30161", city: "Hannover" }, location: { lat: 52.382, lng: 9.742 }, locationSource: "manual_pin" }] });
    expect(d.statusCode).toBe(201);
    S.d = d.json().ids[0];
    expect(await origin(S.d!)).toMatchObject({ kind: "original", provenance: "driver_capture", captured_by: await uid(U.driverHannover1), location_precision: "manual_pin" });
    expect((await events(S.d!))[0]).toMatchObject({ action: "created", actor_role: "driver" });
  });

  it("D4: after publication a dispatcher must give a reason; the original never changes", async () => {
    const no = await env.as(U.dispatcherHannover, "PATCH", `/v1/orgs/${org()}/stops/${S.a}`, { location: { lat: 52.3801, lng: 9.7401 } });
    expect(no.statusCode).toBe(422);
    expect(no.json().error.message).toMatch(/reason is required/);
    const ok = await env.as(U.dispatcherHannover, "PATCH", `/v1/orgs/${org()}/stops/${S.a}`, { location: { lat: 52.3801, lng: 9.7401 }, reason: "Customer: entrance is round the corner", expectedLocationVersion: 1 });
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toMatchObject({ locationVersion: 2, addressVersion: 1, locationPrecision: "manual_pin" });
    expect(await stopRow(S.a!)).toMatchObject({ lat: 52.3801, location_version: 2 });
    expect(await origin(S.a!)).toMatchObject({ kind: "original", lat: 52.38, street: "Lister Meile", location_precision: "house" });
    expect((await events(S.a!)).at(-1)).toMatchObject({ action: "location_changed", actor_role: "dispatcher", reason: "Customer: entrance is round the corner" });
    // Address change with a reason: original address still the imported one.
    const addr = await env.as(U.dispatcherHannover, "PATCH", `/v1/orgs/${org()}/stops/${S.a}`, { address: { street: "Lister Meile", houseNumber: "1a", postalCode: "30161", city: "Hannover" }, location: { lat: 52.3802, lng: 9.7402 }, reason: "Corrected house number" });
    expect(addr.statusCode).toBe(200);
    expect(await origin(S.a!)).toMatchObject({ street: "Lister Meile", lat: 52.38 });
    expect((await env.superuser.query(`select house_number from stop_location_origins where stop_id = $1`, [S.a])).rows[0].house_number).toBe("1");
    // Unpublished tours: no reason needed (stop c's tour is published too, so use an unassigned stop).
    const u = await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/stops`, { depotId: env.data.depots.hannover, stops: [{ address: { street: "Freie Straße", postalCode: "30161", city: "Hannover" }, location: { lat: 52.39, lng: 9.75 } }] });
    S.u = u.json().ids[0];
    expect((await env.as(U.dispatcherHannover, "PATCH", `/v1/orgs/${org()}/stops/${S.u}`, { location: { lat: 52.391, lng: 9.751 } })).statusCode).toBe(200);
  });

  it("drivers keep their location edits, fully audited as the driver; original unchanged", async () => {
    const r = await env.as(U.driverHannover1, "POST", `/v1/orgs/${org()}/stops/${S.b}/driver-update`, { location: { lat: 52.3811, lng: 9.7411 }, reason: "Gate is on the side street" });
    expect(r.statusCode).toBe(204);
    expect(await stopRow(S.b!)).toMatchObject({ lat: 52.3811, location_version: 2, location_precision: "manual_pin" });
    expect(await origin(S.b!)).toMatchObject({ lat: 52.381 });
    expect((await events(S.b!)).at(-1)).toMatchObject({ action: "location_changed", actor_role: "driver", reason: "Gate is on the side street", actor_user_id: await uid(U.driverHannover1) });
    // A second manual pin stays a manual pin.
    await env.as(U.driverHannover1, "POST", `/v1/orgs/${org()}/stops/${S.b}/driver-update`, { location: { lat: 52.3812, lng: 9.7412 } });
    expect((await stopRow(S.b!)).location_precision).toBe("manual_pin");
    const e = await env.as(U.driverHannover1, "POST", `/v1/orgs/${org()}/stops/${S.c}/edit`, { address: { street: "Lister Meile", houseNumber: "7", postalCode: "30161", city: "Hannover" }, location: { lat: 52.383, lng: 9.743 } });
    expect(e.statusCode).toBe(200);
    expect(await origin(S.c!)).toMatchObject({ street: "Lister Meile", lat: null });
    expect((await events(S.c!)).at(-1)).toMatchObject({ action: "address_changed", actor_role: "driver" });
  });

  it("versions cannot be set by clients; actor identity cannot be supplied by the client", async () => {
    await sqlAs(U.dispatcherHannover, `select set_config('turvio.change_reason', 'x', true); update stops set address_version = 99, location_version = 99, notes = 'n' where id = $1`.split(";")[1]!, [S.u], { commit: true });
    expect(await stopRow(S.u!)).toMatchObject({ address_version: 1, location_version: 2 });
    // Claims of another user cannot be smuggled through the audit settings: actor is auth.uid().
    await sqlAs(
      U.dispatcherHannover,
      `with s as (select set_config('turvio.change_reason', 'spoof', true), set_config('turvio.origin_provenance', 'import_file', true)) update stops set lat = 52.392 from s where id = $1 returning id`,
      [S.u],
      { commit: true },
    );
    expect((await events(S.u!)).at(-1)).toMatchObject({ actor_role: "dispatcher", actor_user_id: await uid(U.dispatcherHannover), reason: "spoof" });
  });

  it("originals are immutable for every role; the audit is append-only", async () => {
    for (const sql of [`update stop_location_origins set lat = 1 where stop_id = $1`, `delete from stop_location_origins where stop_id = $1`, `insert into stop_location_origins (stop_id, organization_id, kind, provenance, street, postal_code, city, country_code, location_precision) select $1::uuid, organization_id, 'original', 'api', 'x', '1', 'x', 'DE', 'unknown' from stops where id = $1`]) {
      await expect(sqlAs(U.jarbouOwner, sql, [S.a])).rejects.toThrow(/permission denied/);
    }
    for (const sql of [`update stop_location_events set reason = 'x' where stop_id = $1`, `delete from stop_location_events where stop_id = $1`, `insert into stop_location_events (organization_id, stop_id, actor_role, action) select organization_id, id, 'owner', 'confirmed' from stops where id = $1`, `truncate stop_location_events`]) {
      await expect(sqlAs(U.jarbouOwner, sql, [S.a].slice(0, sql.includes("$1") ? 1 : 0))).rejects.toThrow(/permission denied/);
    }
    // The API's own database role cannot write them either.
    await expect(sqlAs(null, `update stop_location_origins set lat = 1 where stop_id = $1`, [S.a], { role: "turvio_service" })).rejects.toThrow(/permission denied/);
    await expect(sqlAs(null, `delete from stop_location_events where stop_id = $1`, [S.a], { role: "turvio_service" })).rejects.toThrow(/permission denied/);
    await expect(sqlAs(null, `select app.purge_expired_data()`, [], { role: "authenticated" })).rejects.toThrow(/permission denied/);
    // Even the table owner is stopped by the guard triggers.
    await expect(env.superuser.query(`update stop_location_origins set lat = 1 where stop_id = $1`, [S.a])).rejects.toThrow(/append-only/);
    await expect(env.superuser.query(`delete from stop_location_origins where stop_id = $1`, [S.a])).rejects.toThrow(/cannot be deleted/);
    await expect(env.superuser.query(`update stop_location_events set reason = 'x' where stop_id = $1`, [S.a])).rejects.toThrow(/append-only/);
    await expect(env.superuser.query(`delete from stop_location_events where stop_id = $1`, [S.a])).rejects.toThrow(/cannot be deleted/);
    // Check results and decisions: no direct writes by users either.
    await expect(sqlAs(U.jarbouOwner, `insert into stop_location_decisions (stop_id, organization_id, confirmed_at) select id, organization_id, now() from stops where id = $1`, [S.a])).rejects.toThrow(/permission denied/);
    await expect(sqlAs(U.jarbouOwner, `select app.store_location_check($1, 'checked', null, '[]', null, null, null, null, null, 1, 1, 1, 'x', 'x', 1)`, [S.a])).rejects.toThrow(/permission denied/);
  });

  it("cross-organisation and other locations: nothing visible, nothing changeable", async () => {
    const count = async (email: string, table: string) => (await sqlAs<{ n: number }>(email, `select count(*)::int n from ${table} where stop_id = $1`, [S.a]))[0]!.n;
    for (const t of ["stop_location_origins", "stop_location_events", "stop_location_checks", "stop_location_decisions"]) {
      expect(await count(U.musterOwner, t), `muster ${t}`).toBe(0);
      expect(await count(U.dispatcherBremen, t), `bremen ${t}`).toBe(0);
    }
    expect(await count(U.dispatcherHannover, "stop_location_origins")).toBe(1);
    expect(await count(U.jarbouOwner, "stop_location_events")).toBeGreaterThan(0);
    const cur = await stopRow(S.a!);
    for (const email of [U.musterOwner, U.dispatcherBremen]) {
      await expect(sqlAs(email, `select confirm_stop_location($1, $2, $3, $4, '{}')`, [S.a, cur.lat, cur.lng, cur.address_version])).rejects.toThrow(/stop not found/);
      await expect(sqlAs(email, `select accept_stop_approach($1, $2, $3, 'x', null, $2, $3, $4)`, [S.a, cur.lat, cur.lng, cur.address_version])).rejects.toThrow(/stop not found/);
    }
    expect((await env.as(U.dispatcherBremen, "GET", `/v1/orgs/${org()}/stops/${S.a}/location`)).statusCode).toBe(404);
    expect((await env.as(U.musterOwner, "GET", `/v1/orgs/${org()}/stops/${S.a}/location`)).statusCode).toBe(403);
  });

  it("drivers: no originals or history, no confirmations or approaches; checks and decisions of their own published tour only", async () => {
    expect((await sqlAs<{ n: number }>(U.driverHannover1, `select count(*)::int n from stop_location_origins`))[0]!.n).toBe(0);
    expect((await sqlAs<{ n: number }>(U.driverHannover1, `select count(*)::int n from stop_location_events`))[0]!.n).toBe(0);
    const cur = await stopRow(S.a!);
    await expect(sqlAs(U.driverHannover1, `select confirm_stop_location($1, $2, $3, $4, '{}')`, [S.a, cur.lat, cur.lng, cur.address_version])).rejects.toThrow(/stop not found/);
    await expect(sqlAs(U.driverHannover1, `select accept_stop_approach($1, $2, $3, 'x', null, $2, $3, $4)`, [S.a, cur.lat, cur.lng, cur.address_version])).rejects.toThrow(/stop not found/);
    expect((await env.as(U.driverHannover1, "GET", `/v1/orgs/${org()}/stops/${S.a}/location`)).statusCode).toBe(403);
    expect((await env.as(U.driverHannover1, "GET", `/v1/orgs/${org()}/stops/${S.a}/location/history`)).statusCode).toBe(403);
    expect((await env.as(U.driverHannover1, "POST", `/v1/orgs/${org()}/stops/${S.a}/location/confirm`, { expectedLat: cur.lat, expectedLng: cur.lng, expectedAddressVersion: cur.address_version })).statusCode).toBe(403);
    // Another driver of the same company sees nothing of this tour.
    await env.as(U.dispatcherHannover, "GET", `/v1/orgs/${org()}/location-checks?tourId=${tourId}`);
    expect((await sqlAs<{ n: number }>(U.driverHannover1, `select count(*)::int n from stop_location_checks where stop_id = $1`, [S.a]))[0]!.n).toBe(1);
    expect((await sqlAs<{ n: number }>(U.driverHannover2, `select count(*)::int n from stop_location_checks where stop_id = $1`, [S.a]))[0]!.n).toBe(0);
  });

  it("a confirmation is tied to the exact coordinate and address version; edits invalidate it (audited)", async () => {
    const cur = await stopRow(S.b!);
    const stale = await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/stops/${S.b}/location/confirm`, { expectedLat: 52.381, expectedLng: 9.741, expectedAddressVersion: cur.address_version, issueCodes: [] });
    expect(stale.statusCode).toBe(409);
    const ok = await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/stops/${S.b}/location/confirm`, { expectedLat: cur.lat, expectedLng: cur.lng, expectedAddressVersion: cur.address_version, issueCodes: ["far_from_road"], note: "Checked on the satellite map" });
    expect(ok.statusCode).toBe(204);
    const loc = (await env.as(U.dispatcherHannover, "GET", `/v1/orgs/${org()}/stops/${S.b}/location`)).json();
    expect(loc.check.confirmation).toMatchObject({ issueCodes: ["far_from_road"], note: "Checked on the satellite map" });
    // Unrelated change keeps it.
    await env.as(U.dispatcherHannover, "PATCH", `/v1/orgs/${org()}/stops/${S.b}`, { notes: "Bell broken" });
    expect((await env.superuser.query(`select count(*)::int n from stop_location_decisions where stop_id = $1 and confirmed_at is not null`, [S.b])).rows[0].n).toBe(1);
    // The driver moves the pin: confirmation gone, audited with the driver as actor.
    await env.as(U.driverHannover1, "POST", `/v1/orgs/${org()}/stops/${S.b}/driver-update`, { location: { lat: 52.3813, lng: 9.7413 } });
    expect((await env.superuser.query(`select count(*)::int n from stop_location_decisions where stop_id = $1`, [S.b])).rows[0].n).toBe(0);
    expect((await events(S.b!)).slice(-3).map((e) => `${e.action}:${e.actor_role}`)).toEqual(["confirmed:dispatcher", "location_changed:driver", "confirmation_invalidated:driver"]);
  });

  it("approach points: explicit only, within 300 m, on a non-motorway road; invalidated by edits; never applied from a suggestion", async () => {
    // Motorway stop: the check suggests Klusriede – nothing is applied.
    const mw = await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/stops`, { tourId, stops: [{ address: { street: "Klusriede", houseNumber: "1", postalCode: "30419", city: "Hannover" }, location: { lat: 52.4274, lng: 9.8419 } }] });
    S.mw = mw.json().ids[0];
    const checks = (await env.as(U.dispatcherHannover, "GET", `/v1/orgs/${org()}/location-checks?tourId=${tourId}`)).json();
    const c = checks.checks.find((x: { stopId: string }) => x.stopId === S.mw);
    expect(c.issues.find((i: { code: string }) => i.code === "motorway").suggestion).toMatchObject({ roadName: "Klusriede", distanceMeters: 49 });
    expect(c.approach).toBeNull();
    expect((await env.superuser.query(`select count(*)::int n from stop_location_decisions where stop_id = $1`, [S.mw])).rows[0].n).toBe(0);
    const stored = (await env.superuser.query(`select suggested_road_name from stop_location_checks where stop_id = $1`, [S.mw])).rows[0];
    expect(stored.suggested_road_name).toBe("Klusriede");
    expect(await stopRow(S.mw!)).toMatchObject({ lat: 52.4274, lng: 9.8419 }); // coordinate untouched

    const cur = await stopRow(S.b!);
    const base = { expectedLat: cur.lat, expectedLng: cur.lng, expectedAddressVersion: cur.address_version };
    expect((await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/stops/${S.b}/location/approach`, { ...base, lat: cur.lat + 0.004, lng: cur.lng })).statusCode).toBe(422); // ~445 m
    expect((await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/stops/${S.b}/location/approach`, { ...base, lat: cur.lat, lng: 9.85 })).json().error.code).toBe("approach_on_motorway");
    const ok = await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/stops/${S.b}/location/approach`, { ...base, lat: cur.lat + 0.001, lng: cur.lng, reason: "Delivery bay" });
    expect(ok.statusCode).toBe(204);
    const loc = (await env.as(U.dispatcherHannover, "GET", `/v1/orgs/${org()}/stops/${S.b}/location`)).json();
    expect(loc.check.approach).toMatchObject({ lat: cur.lat + 0.001, roadName: "Teststraße" });
    // Address edit by staff (with reason) invalidates the approach.
    await env.as(U.dispatcherHannover, "PATCH", `/v1/orgs/${org()}/stops/${S.b}`, { address: { street: "Lister Meile", houseNumber: "3a", postalCode: "30161", city: "Hannover" }, location: { lat: cur.lat, lng: cur.lng }, reason: "House number" });
    expect((await env.superuser.query(`select count(*)::int n from stop_location_decisions where stop_id = $1`, [S.b])).rows[0].n).toBe(0);
    expect((await events(S.b!)).slice(-2).map((e) => e.action)).toEqual(["address_changed", "approach_invalidated"]);
  });

  it("concurrent dispatcher and driver edits: one wins, the other gets a version conflict – nothing is silently overwritten", async () => {
    const cur = await stopRow(S.b!);
    const v = cur.location_version as number;
    const [dispatcher, driver] = await Promise.all([
      env.as(U.dispatcherHannover, "PATCH", `/v1/orgs/${org()}/stops/${S.b}`, { location: { lat: 52.3901, lng: 9.7501 }, reason: "Dispatcher fix", expectedLocationVersion: v }),
      env.as(U.driverHannover1, "POST", `/v1/orgs/${org()}/stops/${S.b}/driver-update`, { location: { lat: 52.3902, lng: 9.7502 }, expectedLocationVersion: v }),
    ]);
    // Exactly one succeeds (dispatcher 200 or driver 204); the other gets 409 version_conflict.
    const won = [dispatcher.statusCode === 200, driver.statusCode === 204].filter(Boolean).length;
    expect(won).toBe(1);
    expect([dispatcher.statusCode, driver.statusCode]).toContain(409);
    const after = await stopRow(S.b!);
    expect(after.location_version).toBe(v + 1);
    const winner = dispatcher.statusCode === 200 ? 52.3901 : 52.3902;
    expect(after.lat).toBe(winner);
    // The loser's stale retry is refused again; with the new version it goes through.
    expect((await env.as(U.driverHannover1, "POST", `/v1/orgs/${org()}/stops/${S.b}/driver-update`, { location: { lat: 52.3903, lng: 9.7503 }, expectedLocationVersion: v })).statusCode).toBe(409);
    expect((await env.as(U.driverHannover1, "POST", `/v1/orgs/${org()}/stops/${S.b}/driver-update`, { location: { lat: 52.3903, lng: 9.7503 }, expectedLocationVersion: v + 1 })).statusCode).toBe(204);
    expect((await env.as(U.dispatcherHannover, "PATCH", `/v1/orgs/${org()}/stops/${S.b}`, { location: { lat: 52.39, lng: 9.75 }, reason: "x", expectedLocationVersion: v + 1 })).statusCode).toBe(409);
    // Address edits by the driver against an outdated address version.
    const av = (await stopRow(S.b!)).address_version as number;
    expect((await env.as(U.driverHannover1, "POST", `/v1/orgs/${org()}/stops/${S.b}/edit`, { address: { street: "Lister Meile", houseNumber: "9", postalCode: "30161", city: "Hannover" }, expectedAddressVersion: av - 1 })).statusCode).toBe(409);
  });

  it("stored check results: reused while current, stale after a move or a data/rules version change", async () => {
    const first = (await env.as(U.dispatcherHannover, "GET", `/v1/orgs/${org()}/location-checks?tourId=${tourId}`)).json();
    const again = (await env.as(U.dispatcherHannover, "GET", `/v1/orgs/${org()}/location-checks?tourId=${tourId}`)).json();
    const a1 = first.checks.find((c: { stopId: string }) => c.stopId === S.d);
    const a2 = again.checks.find((c: { stopId: string }) => c.stopId === S.d);
    expect(a2.source).toBe("stored");
    expect(a2.checkedAt).toBe(a1.checkedAt);
    // A move deletes the stored result; the next request computes a new one.
    await env.as(U.driverHannover1, "POST", `/v1/orgs/${org()}/stops/${S.d}/driver-update`, { location: { lat: 52.3825, lng: 9.7425 } });
    expect((await env.superuser.query(`select count(*)::int n from stop_location_checks where stop_id = $1`, [S.d])).rows[0].n).toBe(0);
    const moved = (await env.as(U.dispatcherHannover, "GET", `/v1/orgs/${org()}/location-checks?tourId=${tourId}`)).json().checks.find((c: { stopId: string }) => c.stopId === S.d);
    expect(moved.source).toBe("computed");
    // Another road-data version / older rules: never shown as current.
    await env.superuser.query(`update stop_location_checks set road_data_version = 'de-old' where stop_id = $1`, [S.d]);
    expect((await env.as(U.dispatcherHannover, "GET", `/v1/orgs/${org()}/location-checks?tourId=${tourId}`)).json().checks.find((c: { stopId: string }) => c.stopId === S.d).source).toBe("computed");
    await env.superuser.query(`update stop_location_checks set rules_version = 0 where stop_id = $1`, [S.d]);
    expect((await env.as(U.dispatcherHannover, "GET", `/v1/orgs/${org()}/location-checks?tourId=${tourId}`)).json().checks.find((c: { stopId: string }) => c.stopId === S.d).source).toBe("computed");
    // Unversioned data: a result older than 24 h is stale.
    await env.superuser.query(`update stop_location_checks set checked_at = now() - interval '25 hours' where stop_id = $1`, [S.d]);
    expect((await env.as(U.dispatcherHannover, "GET", `/v1/orgs/${org()}/location-checks?tourId=${tourId}`)).json().checks.find((c: { stopId: string }) => c.stopId === S.d).source).toBe("computed");
  });

  it("history endpoint: staff of the depot see who changed what and why", async () => {
    const h = (await env.as(U.dispatcherHannover, "GET", `/v1/orgs/${org()}/stops/${S.a}/location/history`)).json();
    expect(h.events.map((e: { action: string }) => e.action)).toEqual(["address_changed", "location_changed", "created"]);
    expect(h.events[1]).toMatchObject({ reason: "Customer: entrance is round the corner", actor: { role: "dispatcher", userId: await uid(U.dispatcherHannover) } });
    expect(h.events[1].previous).toMatchObject({ lat: 52.38 });
    expect(h.events[1].new).toMatchObject({ lat: 52.3801 });
    const loc = (await env.as(U.dispatcherHannover, "GET", `/v1/orgs/${org()}/stops/${S.a}/location`)).json();
    expect(loc.original).toMatchObject({ kind: "original", label: "Original (as created)", provenance: "import_file", location: { lat: 52.38, lng: 9.74 } });
    expect(loc.current.location).toEqual({ lat: 52.3802, lng: 9.7402 });
  });

  it("P0-3.5: the driver gets the tour's checks (own published tour only) and the accepted approach in the sync payload", async () => {
    const r = await env.as(U.driverHannover1, "GET", `/v1/orgs/${org()}/tours/${tourId}/location-checks`);
    expect(r.statusCode).toBe(200);
    const body = r.json();
    expect(body.checks.length).toBeGreaterThan(0);
    expect(Object.keys(body.checks[0]).sort()).toEqual(["acknowledged", "issues", "severity", "status", "stopId"]);
    expect((await env.as(U.driverHannover2, "GET", `/v1/orgs/${org()}/tours/${tourId}/location-checks`)).statusCode).toBe(404);
    expect((await env.as(U.musterDriver, "GET", `/v1/orgs/${org()}/tours/${tourId}/location-checks`)).statusCode).toBe(403);
    const cur = await stopRow(S.d!);
    expect(
      (await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/stops/${S.d}/location/approach`, { lat: cur.lat + 0.0005, lng: cur.lng, expectedLat: cur.lat, expectedLng: cur.lng, expectedAddressVersion: cur.address_version, reason: "Rear entrance" }))
        .statusCode,
    ).toBe(204);
    const me = (await env.as(U.driverHannover1, "GET", `/v1/me/tours`)).json();
    const st = me.tours.flatMap((t: { stops: { id: string }[] }) => t.stops).find((x: { id: string }) => x.id === S.d);
    expect(st).toMatchObject({ approach: { lat: cur.lat + 0.0005, lng: cur.lng, roadName: "Teststraße" }, locationVersion: cur.location_version, addressVersion: cur.address_version });
    // The driver's own route line goes to the approach point too.
    const route = (await env.as(U.driverHannover1, "GET", `/v1/orgs/${org()}/tours/${tourId}/route`)).json();
    expect(route.source).toBe("osrm");
    const i = route.waypointStopIds.indexOf(S.d);
    expect(route.geometry).toContainEqual([cur.lat + 0.0005, cur.lng]);
    expect(i).toBeGreaterThan(0);
  });

  it("deleted stops: original removed with the stop, history kept (admins), purged by retention; checks purged after completion", async () => {
    // A pending stop on the published tour is deletable through the API.
    const del = await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/stops`, { depotId: env.data.depots.hannover, stops: [{ address: { street: "Löschweg", postalCode: "30161", city: "Hannover" }, location: { lat: 52.395, lng: 9.755 } }] });
    const id = del.json().ids[0];
    expect((await env.as(U.dispatcherHannover, "DELETE", `/v1/orgs/${org()}/stops/${id}`)).statusCode).toBe(204);
    expect(await origin(id)).toBeUndefined();
    expect((await events(id)).map((e) => e.action)).toEqual(["created", "stop_deleted"]);
    // Admins still see the history of the deleted stop; a dispatcher (location no longer resolvable) does not.
    expect((await env.as(U.jarbouOwner, "GET", `/v1/orgs/${org()}/stops/${id}/location/history`)).json().events).toHaveLength(2);
    expect((await env.as(U.dispatcherHannover, "GET", `/v1/orgs/${org()}/stops/${id}/location/history`)).json().events).toHaveLength(0);

    // Retention: 30 days for this company; events older than that go, newer stay; originals stay.
    await env.superuser.query(`update organizations set location_audit_retention_days = 30 where id = $1`, [org()]);
    await env.superuser.query(`alter table stop_location_events disable trigger stop_location_events_guard`);
    await env.superuser.query(`update stop_location_events set occurred_at = now() - interval '31 days' where stop_id = $1`, [id]);
    await env.superuser.query(`alter table stop_location_events enable trigger stop_location_events_guard`);
    const before = (await env.superuser.query(`select count(*)::int n from stop_location_events where organization_id = $1`, [org()])).rows[0].n;
    // Completed tour finished 40 days ago: its check results go (30-day check retention).
    const t = (await env.superuser.query<{ id: string }>(`select id from tours where id = $1`, [tourId])).rows[0]!;
    await env.superuser.query(`update stops set status = 'delivered', completed_at = now() where tour_id = $1 and status = 'pending'`, [t.id]);
    await env.superuser.query(`update tours set status = 'completed', started_at = now() - interval '41 days', finished_at = now() - interval '40 days' where id = $1`, [t.id]);
    const checksBefore = (await env.superuser.query(`select count(*)::int n from stop_location_checks c join stops s on s.id = c.stop_id where s.tour_id = $1`, [t.id])).rows[0].n;
    expect(checksBefore).toBeGreaterThan(0);
    const origins = (await env.superuser.query(`select count(*)::int n from stop_location_origins`)).rows[0].n;
    await sqlAs(null, `select app.purge_expired_data()`, [], { role: "turvio_service", commit: true });
    expect(await events(id)).toEqual([]);
    expect((await env.superuser.query(`select count(*)::int n from stop_location_events where organization_id = $1`, [org()])).rows[0].n).toBe(before - 2);
    expect((await env.superuser.query(`select count(*)::int n from stop_location_checks c join stops s on s.id = c.stop_id where s.tour_id = $1`, [t.id])).rows[0].n).toBe(0);
    expect((await env.superuser.query(`select count(*)::int n from stop_location_origins`)).rows[0].n).toBe(origins);
    // null = keep: nothing more is deleted.
    await env.superuser.query(`update organizations set location_audit_retention_days = null where id = $1`, [org()]);
  });

  it("deleting a whole company removes its history without tripping the append-only guards", async () => {
    const other = env.data.orgs.muster;
    const n = (await env.superuser.query(`select count(*)::int n from stop_location_origins where organization_id = $1`, [other])).rows[0].n;
    await env.superuser.query(`insert into stops (organization_id, tour_id, sequence, street, postal_code, city, lat, lng) select organization_id, id, 99, 'Musterweg', '12345', 'Musterstadt', 50.1, 8.6 from tours where organization_id = $1 limit 1`, [other]);
    expect((await env.superuser.query(`select count(*)::int n from stop_location_origins where organization_id = $1`, [other])).rows[0].n).toBeGreaterThan(n);
    await env.superuser.query(`delete from organizations where id = $1`, [other]);
    for (const t of ["stop_location_origins", "stop_location_events"]) expect((await env.superuser.query(`select count(*)::int n from ${t} where organization_id = $1`, [other])).rows[0].n, t).toBe(0);
  });
});
