import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SEED_USERS as U } from "../../src/seed";
import { createTestEnv, postgresAvailable, type TestEnv } from "./helpers";

/**
 * Tour lifecycle (Phase B): finish / cancel by Dispatch, archive / restore, safe delete, bulk,
 * closed-tour guards, offline events from before a close, and the contract of the driver app
 * that is installed today (it knows neither 'cancelled' nor archive).
 */
const available = await postgresAvailable();
let env: TestEnv;
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const plusDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 1)]).toString("base64");
/** Statuses the installed driver app can parse. */
const OLD_TOUR_STATUSES = ["planned", "in_progress", "paused", "completed"];
const OLD_STOP_STATUSES = ["pending", "in_progress", "delivered", "picked_up", "failed", "attempted", "rescheduled", "returned", "skipped"];

const org = () => env.data.orgs.jarbou;
const lena = () => env.data.drivers.hannover![0]!;
const mihai = () => env.data.drivers.hannover![1]!;

async function makeTour(opts: { driverId?: string | null; stops?: number; publish?: boolean; date?: string; depot?: string; as?: string } = {}) {
  const who = opts.as ?? U.dispatcherHannover;
  const t = (await env.as(who, "POST", `/v1/orgs/${org()}/tours`, { depotId: opts.depot ?? env.data.depots.hannover, date: opts.date ?? today(), driverId: opts.driverId ?? null })).json();
  if (!t.id) throw new Error(JSON.stringify(t));
  const n = opts.stops ?? 0;
  if (n) {
    const r = await env.as(who, "POST", `/v1/orgs/${org()}/stops`, {
      tourId: t.id,
      stops: Array.from({ length: n }, (_, i) => ({
        recipientName: `Kunde ${i}`,
        address: { street: "Teststraße", houseNumber: String(i + 1), postalCode: "30159", city: "Hannover" },
        location: { lat: 52.37 + i * 0.003, lng: 9.73 },
        trackingNumbers: [`TVLC${randomUUID().slice(0, 8).toUpperCase()}`],
      })),
    });
    if (r.statusCode !== 201) throw new Error(r.body);
  }
  let tour = (await env.as(who, "GET", `/v1/orgs/${org()}/tours/${t.id}`)).json();
  if (opts.publish) {
    const p = await env.as(who, "POST", `/v1/orgs/${org()}/tours/${t.id}/publish`, { expectedVersion: tour.tour.version });
    if (p.statusCode !== 200) throw new Error(p.body);
    tour = p.json();
  }
  return tour as { tour: { id: string; version: number; status: string }; stops: { id: string; parcels: { trackingNumber: string }[] }[] };
}
const getTour = async (id: string) => (await env.as(U.dispatcherHannover, "GET", `/v1/orgs/${org()}/tours/${id}`)).json();
const stopStatus = (stopId: string, status: string, occurredAt?: string, extra: Record<string, unknown> = {}) =>
  env.as(U.driverHannover1, "POST", `/v1/orgs/${org()}/stops/${stopId}/status`, { status, clientEventId: randomUUID(), ...(occurredAt ? { occurredAt } : {}), ...extra });
const evidence = async (tourId: string) =>
  (
    await env.superuser.query(
      `select (select count(*) from stop_events e join stops s on s.id = e.stop_id where s.tour_id = $1)::int as stop_events,
              (select count(*) from proofs p join stops s on s.id = p.stop_id where s.tour_id = $1)::int as proofs,
              (select count(*) from location_pings where tour_id = $1)::int as pings,
              (select count(*) from tour_events where tour_id = $1 and kind not in ('archived', 'restored'))::int as tour_events,
              (select count(*) from stops where tour_id = $1)::int as stops,
              (select count(*) from parcels p join stops s on s.id = p.stop_id where s.tour_id = $1 and p.loaded_at is not null)::int as scanned,
              (select string_agg(id::text || ':' || status::text || ':' || coalesce(completed_at::text, ''), ',' order by id) from stops where tour_id = $1) as outcomes`,
      [tourId],
    )
  ).rows[0];
/** Moves a tour's close (and its driving period) into the past, so "after the close" is measurable. */
async function backdateClose(tourId: string, minutes: number) {
  await env.superuser.query(`update tours set closed_at = now() - make_interval(mins => $2) where id = $1`, [tourId, minutes]);
  await env.superuser.query(`update tour_events set created_at = now() - make_interval(mins => $2) where tour_id = $1 and kind in ('completed', 'cancelled')`, [tourId, minutes]);
  await env.superuser.query(`update tour_events set created_at = now() - make_interval(mins => $2 * 3) where tour_id = $1 and kind in ('started')`, [tourId, minutes]);
}
const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

describe.runIf(available)("tour lifecycle", () => {
  beforeAll(async () => {
    env = await createTestEnv("lifecycle");
  }, 120_000);
  afterAll(async () => {
    await env?.close();
  });

  // ------------------------------------------------------------ installed driver app contract
  describe("driver app contract (installed APK)", () => {
    it("the feed only ever carries statuses the installed app knows; cancelled stops and tours vanish", async () => {
      const t = await makeTour({ driverId: lena(), stops: 3, publish: true });
      expect((await env.as(U.driverHannover1, "POST", `/v1/orgs/${org()}/tours/${t.tour.id}/status`, { status: "in_progress" })).statusCode).toBe(200);
      const c = await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/stops/${t.stops[2]!.id}/cancel`, { reason: "Kunde hat storniert" });
      expect(c.statusCode).toBe(200);
      expect(c.json().stop).toMatchObject({ status: "cancelled", cancelReason: "Kunde hat storniert" });

      const feed = (await env.as(U.driverHannover1, "GET", `/v1/me/tours`)).json();
      const mine = feed.tours.find((x: { tour: { id: string } }) => x.tour.id === t.tour.id);
      expect(mine.stops.map((s: { id: string }) => s.id)).toEqual([t.stops[0]!.id, t.stops[1]!.id]);
      for (const x of feed.tours) {
        expect(OLD_TOUR_STATUSES).toContain(x.tour.status);
        for (const s of x.stops) expect(OLD_STOP_STATUSES).toContain(s.status);
      }
      // Route geometry for the app: the cancelled stop is not driven to.
      const route = (await env.as(U.driverHannover1, "GET", `/v1/orgs/${org()}/tours/${t.tour.id}/route`)).json();
      expect(route.waypointStopIds).not.toContain(t.stops[2]!.id);

      // Dispatch cancels the whole tour: it leaves the driver's list (the app stops tracking there).
      const cur = await getTour(t.tour.id);
      expect((await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/tours/${t.tour.id}/close`, { status: "cancelled", expectedVersion: cur.tour.version, reason: "Fahrzeugschaden" })).statusCode).toBe(200);
      const after = (await env.as(U.driverHannover1, "GET", `/v1/me/tours`)).json();
      expect(after.tours.find((x: { tour: { id: string } }) => x.tour.id === t.tour.id)).toBeUndefined();
      // The installed app's pending "complete" for that tour is refused permanently (shown, not lost).
      const late = await env.as(U.driverHannover1, "POST", `/v1/orgs/${org()}/tours/${t.tour.id}/status`, { status: "completed" });
      expect(late.statusCode).toBe(409);
      expect(late.json().error.code).toBe("tour_closed");
    });

    it("the normal driver flow is unchanged: start, scan, deliver with proof, complete; retries are no-ops", async () => {
      const t = await makeTour({ driverId: mihai(), stops: 2, publish: true });
      const base = `/v1/orgs/${org()}`;
      expect((await env.as(U.driverHannover2, "POST", `${base}/tours/${t.tour.id}/status`, { status: "in_progress" })).statusCode).toBe(200);
      const scans = await env.as(U.driverHannover2, "POST", `${base}/tours/${t.tour.id}/scans`, { scans: [{ code: t.stops[0]!.parcels[0]!.trackingNumber }] });
      expect(scans.json()).toEqual({ matched: [t.stops[0]!.parcels[0]!.trackingNumber], unknown: [] });
      const ev = randomUUID();
      const d = await env.as(U.driverHannover2, "POST", `${base}/stops/${t.stops[0]!.id}/status`, { status: "delivered", clientEventId: ev, occurredAt: new Date().toISOString() });
      expect(d.statusCode).toBe(200);
      expect(d.json()).toMatchObject({ status: "delivered", applied: true });
      expect((await env.as(U.driverHannover2, "POST", `${base}/stops/${t.stops[0]!.id}/status`, { status: "delivered", clientEventId: ev })).statusCode).toBe(200);
      const proof = await env.as(U.driverHannover2, "POST", `${base}/stops/${t.stops[0]!.id}/proofs`, { id: randomUUID(), kind: "photo", contentType: "image/jpeg", dataBase64: JPEG, capturedAt: new Date().toISOString() });
      expect(proof.statusCode).toBe(201);
      expect((await env.as(U.driverHannover2, "POST", `${base}/tours/${t.tour.id}/status`, { status: "completed" })).statusCode).toBe(200);
      expect((await env.as(U.driverHannover2, "POST", `${base}/tours/${t.tour.id}/status`, { status: "completed" })).statusCode).toBe(200);
      const after = await getTour(t.tour.id);
      expect(after.tour).toMatchObject({ status: "completed", closedRemotely: false });
      expect(after.tour.closedAt).toBeTruthy();
    });
  });

  // ------------------------------------------------------------ finish remotely, offline before close
  describe("finish and cancel from Dispatch", () => {
    let tourId = "";
    let stops: { id: string }[] = [];

    it("finishing a running tour keeps every outcome, returns open stops to the pool and records who, when and why", async () => {
      // Tracking on for this test: the live position must end with the tour.
      await env.superuser.query(`update organizations set tracking_mode = 'active_tours' where id = $1`, [org()]);
      await env.as(U.driverHannover1, "POST", `/v1/orgs/${org()}/tracking/notice`, {});
      const t = await makeTour({ driverId: lena(), stops: 4, publish: true, date: plusDays(today(), 1) });
      tourId = t.tour.id;
      stops = t.stops;
      expect((await env.as(U.driverHannover1, "POST", `/v1/orgs/${org()}/tours/${tourId}/status`, { status: "in_progress" })).statusCode).toBe(200);
      expect((await stopStatus(stops[0]!.id, "delivered", new Date().toISOString())).statusCode).toBe(200);
      expect((await stopStatus(stops[1]!.id, "in_progress", new Date().toISOString())).statusCode).toBe(200);
      const ping = await env.as(U.driverHannover1, "POST", `/v1/orgs/${org()}/tours/${tourId}/locations`, {
        points: [{ id: randomUUID(), lat: 52.38, lng: 9.74, recordedAt: new Date().toISOString() }],
      });
      expect(ping.json().accepted).toBe(1);
      expect((await env.superuser.query(`select count(*)::int n from driver_positions where tour_id = $1`, [tourId])).rows[0].n).toBe(1);

      const cur = await getTour(tourId);
      const noReason = await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/tours/${tourId}/close`, { status: "completed", expectedVersion: cur.tour.version, reason: "" });
      expect(noReason.statusCode).toBe(400);
      const stale = await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/tours/${tourId}/close`, { status: "completed", expectedVersion: cur.tour.version - 1, reason: "Schicht beendet" });
      expect(stale.statusCode).toBe(409);
      const r = await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/tours/${tourId}/close`, { status: "completed", expectedVersion: cur.tour.version, reason: "Schicht beendet" });
      expect(r.statusCode).toBe(200);
      expect(r.json()).toMatchObject({ tour: { status: "completed", closedRemotely: true, closeReason: "Schicht beendet" }, openStops: { count: 3, action: "returned_to_pool" } });

      const row = (await env.superuser.query(`select closed_by, closed_at, finished_at from tours where id = $1`, [tourId])).rows[0];
      expect(row.closed_by).toBe(env.data.users.dispatcherHannover);
      const pool = (await env.superuser.query(`select id, status, tour_id, returned_from_tour_id from stops where returned_from_tour_id = $1 order by id`, [tourId])).rows;
      expect(pool).toHaveLength(3);
      expect(pool.every((s) => s.tour_id === null && s.status === "pending")).toBe(true);
      // Delivered stop untouched; live position gone; history kept.
      expect((await env.superuser.query(`select status from stops where id = $1`, [stops[0]!.id])).rows[0].status).toBe("delivered");
      expect((await env.superuser.query(`select count(*)::int n from driver_positions where tour_id = $1`, [tourId])).rows[0].n).toBe(0);
      expect((await env.superuser.query(`select count(*)::int n from location_pings where tour_id = $1`, [tourId])).rows[0].n).toBe(1);
      const ev = (await env.superuser.query(`select detail from tour_events where tour_id = $1 and kind = 'completed'`, [tourId])).rows[0];
      expect(ev.detail).toMatchObject({ remote: true, reason: "Schicht beendet" });
    });

    it("GPS: positions from before the close are accepted, later ones refused", async () => {
      await backdateClose(tourId, 10);
      const r = await env.as(U.driverHannover1, "POST", `/v1/orgs/${org()}/tours/${tourId}/locations`, {
        points: [
          { id: randomUUID(), lat: 52.38, lng: 9.74, recordedAt: minutesAgo(15) },
          { id: randomUUID(), lat: 52.38, lng: 9.74, recordedAt: minutesAgo(1) },
        ],
      });
      expect(r.json().accepted).toBe(1);
      expect(r.json().rejected).toEqual([expect.objectContaining({ reason: "outside_active_tour" })]);
      expect((await env.superuser.query(`select count(*)::int n from driver_positions where tour_id = $1`, [tourId])).rows[0].n).toBe(0);
    });

    it("an offline delivery from before the close is applied (back on its tour); one from after is refused", async () => {
      // Timeline: arrived 20 min ago, delivered (offline) 12 min ago, Dispatch closed 10 min ago.
      await env.superuser.query(`update stops set status_changed_at = now() - interval '20 minutes' where id = $1`, [stops[1]!.id]);
      const before = await stopStatus(stops[1]!.id, "delivered", minutesAgo(12));
      expect(before.statusCode).toBe(200);
      expect(before.json()).toMatchObject({ status: "delivered", applied: true });
      const s = (await env.superuser.query(`select tour_id, returned_from_tour_id from stops where id = $1`, [stops[1]!.id])).rows[0];
      expect(s).toEqual({ tour_id: tourId, returned_from_tour_id: null });
      const proofBefore = await env.as(U.driverHannover1, "POST", `/v1/orgs/${org()}/stops/${stops[2]!.id}/proofs`, { id: randomUUID(), kind: "photo", contentType: "image/jpeg", dataBase64: JPEG, capturedAt: minutesAgo(11) });
      expect(proofBefore.statusCode).toBe(201);

      const after = await stopStatus(stops[2]!.id, "delivered", minutesAgo(1));
      expect(after.statusCode).toBe(409);
      expect(after.json().error.code).toBe("tour_closed");
      const proofAfter = await env.as(U.driverHannover1, "POST", `/v1/orgs/${org()}/stops/${stops[2]!.id}/proofs`, { id: randomUUID(), kind: "photo", contentType: "image/jpeg", dataBase64: JPEG, capturedAt: minutesAgo(1) });
      expect(proofAfter.statusCode).toBe(409);
      // Without a timestamp the event counts as "now" – after the close.
      expect((await stopStatus(stops[3]!.id, "delivered")).statusCode).toBe(409);
      // Scans after the close are refused; nothing changes.
      const scans = await env.as(U.driverHannover1, "POST", `/v1/orgs/${org()}/tours/${tourId}/scans`, { scans: [{ code: "TVOUNKNOWN0001", at: minutesAgo(1) }] });
      expect(scans.statusCode).toBe(409);
    });

    it("a closed tour accepts no edits, no new stops, no optimization and never reopens", async () => {
      const cur = await getTour(tourId);
      const base = `/v1/orgs/${org()}/tours/${tourId}`;
      const patch = await env.as(U.dispatcherHannover, "PATCH", base, { expectedVersion: cur.tour.version, name: "Neu" });
      expect(patch.json().error.code).toBe("tour_closed");
      const add = await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/stops`, { tourId, stops: [{ address: { street: "A", houseNumber: "1", postalCode: "30159", city: "Hannover" } }] });
      expect(add.json().error.code).toBe("tour_closed");
      const edit = await env.as(U.driverHannover1, "POST", `/v1/orgs/${org()}/stops/${stops[0]!.id}/edit`, { address: { street: "X", houseNumber: "1", postalCode: "30159", city: "Hannover" } });
      expect(edit.statusCode).toBe(409);
      const seq = await env.as(U.driverHannover1, "POST", `/v1/me/tours/${tourId}/sequence`, { stopIds: [stops[0]!.id] });
      expect(seq.json().error.code).toBe("tour_closed");
      expect([409, 422]).toContain(seq.statusCode);
      const reopen = await env.as(U.driverHannover1, "POST", `${base}/status`, { status: "in_progress" });
      expect([409, 422]).toContain(reopen.statusCode);
      expect((await getTour(tourId)).tour.status).toBe("completed");
    });

    it("cancel with 'cancel open stops': stops stay on the tour as cancelled; a real outcome from before the cancel still wins", async () => {
      const t = await makeTour({ driverId: lena(), stops: 2, publish: true, date: plusDays(today(), 2) });
      expect((await env.as(U.driverHannover1, "POST", `/v1/orgs/${org()}/tours/${t.tour.id}/status`, { status: "in_progress" })).statusCode).toBe(200);
      const cur = await getTour(t.tour.id);
      const r = await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/tours/${t.tour.id}/close`, { status: "cancelled", expectedVersion: cur.tour.version, reason: "Straßensperrung", openStops: "cancel" });
      expect(r.json()).toMatchObject({ tour: { status: "cancelled" }, openStops: { count: 2, action: "cancelled" } });
      const rows = (await env.superuser.query(`select status, cancel_reason from stops where tour_id = $1`, [t.tour.id])).rows;
      expect(rows).toEqual([{ status: "cancelled", cancel_reason: "Straßensperrung" }, { status: "cancelled", cancel_reason: "Straßensperrung" }]);
      await backdateClose(t.tour.id, 10);
      await env.superuser.query(`update stops set status_changed_at = now() - interval '10 minutes', cancelled_at = now() - interval '10 minutes' where tour_id = $1`, [t.tour.id]);
      const before = await stopStatus(t.stops[0]!.id, "delivered", minutesAgo(12));
      expect(before.json()).toMatchObject({ status: "delivered", applied: true });
      expect((await env.superuser.query(`select cancel_reason from stops where id = $1`, [t.stops[0]!.id])).rows[0].cancel_reason).toBeNull();
      expect((await stopStatus(t.stops[1]!.id, "delivered", minutesAgo(1))).json().error.code).toBe("tour_closed");
    });

    it("a cancelled tour frees the driver for another tour that day; finishing a tour that never started is refused", async () => {
      const d = plusDays(today(), 3);
      const t = await makeTour({ driverId: mihai(), stops: 1, publish: true, date: d });
      const second = await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/tours`, { depotId: env.data.depots.hannover, date: d, driverId: mihai() });
      expect(second.json().error.code).toBe("driver_busy");
      const cur = await getTour(t.tour.id);
      const fin = await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/tours/${t.tour.id}/close`, { status: "completed", expectedVersion: cur.tour.version, reason: "nie gestartet" });
      expect(fin.statusCode).toBe(422);
      expect((await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/tours/${t.tour.id}/close`, { status: "cancelled", expectedVersion: cur.tour.version, reason: "Kunde abgesagt" })).statusCode).toBe(200);
      expect((await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/tours`, { depotId: env.data.depots.hannover, date: d, driverId: mihai() })).statusCode).toBe(201);
    });
  });

  // ------------------------------------------------------------ archive / restore
  describe("archive and restore", () => {
    it("archive hides a completed tour and keeps every record; restore never reactivates it", async () => {
      const t = await makeTour({ driverId: lena(), stops: 2, publish: true, date: plusDays(today(), 4) });
      const base = `/v1/orgs/${org()}`;
      await env.as(U.driverHannover1, "POST", `${base}/tours/${t.tour.id}/status`, { status: "in_progress" });
      await stopStatus(t.stops[0]!.id, "delivered", new Date().toISOString());
      await env.as(U.driverHannover1, "POST", `${base}/stops/${t.stops[0]!.id}/proofs`, { id: randomUUID(), kind: "photo", contentType: "image/jpeg", dataBase64: JPEG, capturedAt: new Date().toISOString() });
      await env.as(U.driverHannover1, "POST", `${base}/tours/${t.tour.id}/status`, { status: "completed" });
      const before = await evidence(t.tour.id);

      let cur = await getTour(t.tour.id);
      const a = await env.as(U.dispatcherHannover, "POST", `${base}/tours/${t.tour.id}/archive`, { expectedVersion: cur.tour.version });
      expect(a.statusCode).toBe(200);
      expect(a.json()).toMatchObject({ status: "completed" });
      expect(a.json().archivedAt).toBeTruthy();
      expect(await evidence(t.tour.id)).toEqual(before);

      // Hidden from the default views and the driver; visible in the Archived view.
      const day = plusDays(today(), 4);
      const ds = (await env.as(U.dispatcherHannover, "GET", `${base}/dispatch?date=${day}`)).json();
      expect(ds.tours.find((x: { id: string }) => x.id === t.tour.id)).toBeUndefined();
      const dsAll = (await env.as(U.dispatcherHannover, "GET", `${base}/dispatch?date=${day}&lifecycle=1`)).json();
      expect(dsAll.tours.find((x: { id: string }) => x.id === t.tour.id)).toBeTruthy();
      const list = (await env.as(U.dispatcherHannover, "GET", `${base}/tours?date=${day}`)).json();
      expect(list.tours.find((x: { tour: { id: string } }) => x.tour.id === t.tour.id)).toBeUndefined();
      const archived = (await env.as(U.dispatcherHannover, "GET", `${base}/tours?date=${day}&archived=only`)).json();
      expect(archived.tours.map((x: { tour: { id: string } }) => x.tour.id)).toEqual([t.tour.id]);
      expect(archived.tours[0].stops).toMatchObject({ total: 2, delivered: 1, open: 1 });

      // Read-only while archived.
      cur = await getTour(t.tour.id);
      const edit = await env.as(U.dispatcherHannover, "PATCH", `${base}/tours/${t.tour.id}`, { expectedVersion: cur.tour.version, name: "x" });
      expect(edit.json().error.code).toBe("tour_closed");
      await expect(env.superuser.query(`update tours set name = 'x' where id = $1`, [t.tour.id])).rejects.toThrow(/tour_archived/);

      const r = await env.as(U.dispatcherHannover, "POST", `${base}/tours/${t.tour.id}/restore`, { expectedVersion: cur.tour.version });
      expect(r.statusCode).toBe(200);
      expect(r.json()).toMatchObject({ status: "completed", archivedAt: null });
      expect(await evidence(t.tour.id)).toEqual(before);
      const kinds = (await env.superuser.query(`select kind from tour_events where tour_id = $1 and kind in ('archived', 'restored') order by id`, [t.tour.id])).rows.map((x) => x.kind);
      expect(kinds).toEqual(["archived", "restored"]);
    });

    it("running and published tours cannot be archived", async () => {
      const t = await makeTour({ driverId: mihai(), stops: 1, publish: true, date: plusDays(today(), 5) });
      const pub = await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/tours/${t.tour.id}/archive`, { expectedVersion: t.tour.version });
      expect(pub.statusCode).toBe(422);
      await env.as(U.driverHannover2, "POST", `/v1/orgs/${org()}/tours/${t.tour.id}/status`, { status: "in_progress" });
      const cur = await getTour(t.tour.id);
      expect((await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/tours/${t.tour.id}/archive`, { expectedVersion: cur.tour.version })).statusCode).toBe(422);
    });
  });

  // ------------------------------------------------------------ permanent delete
  describe("permanent delete", () => {
    it("an empty draft is eligible and deleted with a deletion record; stops go back to the pool", async () => {
      const t = await makeTour({ stops: 2, date: plusDays(today(), 6) });
      const e = (await env.as(U.dispatcherHannover, "GET", `/v1/orgs/${org()}/tours/${t.tour.id}/delete-eligibility`)).json();
      expect(e).toMatchObject({ eligible: true, reasons: [], stops: 2, completedDeliveries: 0 });
      const del = await env.as(U.dispatcherHannover, "DELETE", `/v1/orgs/${org()}/tours/${t.tour.id}?expectedVersion=${t.tour.version}`);
      expect(del.statusCode).toBe(204);
      expect((await env.superuser.query(`select count(*)::int n from stops where id = any($1::uuid[]) and tour_id is null`, [t.stops.map((s) => s.id)])).rows[0].n).toBe(2);
      const log = (await env.superuser.query(`select stop_count, stops_action, deleted_by from tour_deletions where tour_id = $1`, [t.tour.id])).rows[0];
      expect(log).toEqual({ stop_count: 2, stops_action: "returned", deleted_by: env.data.users.dispatcherHannover });
    });

    it("tours with protected history are never deleted – whatever their status (completed, cancelled, archived)", async () => {
      const t = await makeTour({ driverId: lena(), stops: 1, publish: true, date: plusDays(today(), 7) });
      await env.as(U.driverHannover1, "POST", `/v1/orgs/${org()}/tours/${t.tour.id}/status`, { status: "in_progress" });
      await stopStatus(t.stops[0]!.id, "delivered", new Date().toISOString());
      let cur = await getTour(t.tour.id);
      await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/tours/${t.tour.id}/close`, { status: "cancelled", expectedVersion: cur.tour.version, reason: "Test" });
      cur = await getTour(t.tour.id);
      await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/tours/${t.tour.id}/archive`, { expectedVersion: cur.tour.version });
      cur = await getTour(t.tour.id);
      const before = await evidence(t.tour.id);
      const e = (await env.as(U.dispatcherHannover, "GET", `/v1/orgs/${org()}/tours/${t.tour.id}/delete-eligibility`)).json();
      expect(e.eligible).toBe(false);
      expect(e.reasons).toEqual(expect.arrayContaining(["status_cancelled", "started", "published", "processed_stops", "stop_history", "execution_history"]));
      const del = await env.as(U.dispatcherHannover, "DELETE", `/v1/orgs/${org()}/tours/${t.tour.id}?expectedVersion=${cur.tour.version}`);
      expect(del.statusCode).toBe(409);
      expect(del.json().error.code).toBe("tour_protected");
      expect(await evidence(t.tour.id)).toEqual(before);
    });

    it("a published (not started) tour must be withdrawn first; a stop with history cannot be deleted, only cancelled", async () => {
      const t = await makeTour({ driverId: mihai(), stops: 1, publish: true, date: plusDays(today(), 8) });
      expect((await env.as(U.dispatcherHannover, "GET", `/v1/orgs/${org()}/tours/${t.tour.id}/delete-eligibility`)).json().reasons).toEqual(["published"]);
      await env.as(U.driverHannover2, "POST", `/v1/orgs/${org()}/tours/${t.tour.id}/status`, { status: "in_progress" });
      await env.as(U.driverHannover2, "POST", `/v1/orgs/${org()}/stops/${t.stops[0]!.id}/status`, { status: "in_progress", occurredAt: new Date().toISOString() });
      await env.as(U.driverHannover2, "POST", `/v1/orgs/${org()}/stops/${t.stops[0]!.id}/status`, { status: "pending", occurredAt: new Date().toISOString() });
      const del = await env.as(U.dispatcherHannover, "DELETE", `/v1/orgs/${org()}/stops/${t.stops[0]!.id}`);
      expect(del.json().error.code).toBe("stop_protected");
      expect((await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/stops/${t.stops[0]!.id}/cancel`, { reason: "Adresse existiert nicht" })).statusCode).toBe(200);
    });
  });

  describe("remove a stop from its tour", () => {
    it("an arrived stop goes back to the unassigned list as open; stops of an archived tour stay", async () => {
      const t = await makeTour({ driverId: mihai(), stops: 2, publish: true, date: plusDays(today(), 25) });
      await env.as(U.driverHannover2, "POST", `/v1/orgs/${org()}/tours/${t.tour.id}/status`, { status: "in_progress" });
      await env.as(U.driverHannover2, "POST", `/v1/orgs/${org()}/stops/${t.stops[0]!.id}/status`, { status: "in_progress", occurredAt: new Date().toISOString() });
      const r = await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/stops/assign`, { stopIds: [t.stops[0]!.id], tourId: null });
      expect(r.statusCode).toBe(204);
      const row = (await env.superuser.query(`select tour_id, status, arrived_at, depot_id from stops where id = $1`, [t.stops[0]!.id])).rows[0];
      expect(row).toMatchObject({ tour_id: null, status: "pending", arrived_at: null, depot_id: env.data.depots.hannover });

      const d = await makeTour({ stops: 1, date: plusDays(today(), 26) });
      await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/tours/${d.tour.id}/archive`, { expectedVersion: d.tour.version });
      const blocked = await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/stops/assign`, { stopIds: [d.stops[0]!.id], tourId: null });
      expect(blocked.statusCode).toBe(409);
      expect(blocked.json().error.code).toBe("tour_archived");
    });
  });

  // ------------------------------------------------------------ bulk
  describe("bulk actions", () => {
    it("delete preview counts selected / eligible / protected / affected stops / unchanged exactly; execution matches", async () => {
      const day = plusDays(today(), 9);
      const empty = await makeTour({ date: day });
      const draft = await makeTour({ stops: 3, date: day });
      const done = await makeTour({ driverId: lena(), stops: 1, publish: true, date: day });
      await env.as(U.driverHannover1, "POST", `/v1/orgs/${org()}/tours/${done.tour.id}/status`, { status: "in_progress" });
      await env.as(U.driverHannover1, "POST", `/v1/orgs/${org()}/tours/${done.tour.id}/status`, { status: "completed" });
      const foreign = await makeTour({ as: U.dispatcherBremen, depot: env.data.depots.bremen, date: day });
      const ids = [empty.tour.id, draft.tour.id, done.tour.id, foreign.tour.id];

      const p = (await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/tours/bulk/preview`, { action: "delete", selection: { tourIds: ids } })).json();
      expect(p.summary).toEqual({ action: "delete", selected: 4, eligible: 2, protected: 2, unchanged: 0, affectedStops: 3, completedDeliveries: 0 });
      expect(p.tours.find((x: { id: string }) => x.id === foreign.tour.id).reasons).toEqual(["not_found"]);

      const r = (await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/tours/bulk`, { action: "delete", selection: { tourIds: ids } })).json();
      expect(r).toMatchObject({ selected: 4, done: 2, skipped: 2, failed: 0 });
      expect((await env.superuser.query(`select count(*)::int n from tours where id = any($1::uuid[])`, [ids])).rows[0].n).toBe(2);
      // The other location's tour is untouched.
      expect((await env.superuser.query(`select count(*)::int n from tours where id = $1`, [foreign.tour.id])).rows[0].n).toBe(1);
    });

    it("bulk archive by day archives closed tours, skips active ones; a stale version fails only that tour", async () => {
      const day = plusDays(today(), 10);
      const a = await makeTour({ date: day });
      const b = await makeTour({ date: day });
      const active = await makeTour({ driverId: lena(), stops: 1, publish: true, date: day });
      const p = (await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/tours/bulk/preview`, { action: "archive", selection: { filter: { date: day } } })).json();
      expect(p.summary).toMatchObject({ selected: 3, eligible: 2, protected: 1 });
      const r = (
        await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/tours/bulk`, { action: "archive", selection: { filter: { date: day } }, versions: { [b.tour.id]: b.tour.version + 5 } })
      ).json();
      expect(r).toMatchObject({ selected: 3, done: 1, skipped: 1, failed: 1 });
      expect(r.results.find((x: { id: string }) => x.id === b.tour.id)).toMatchObject({ result: "failed", code: "version_conflict" });
      expect(r.results.find((x: { id: string }) => x.id === active.tour.id)).toMatchObject({ result: "skipped", code: "published" });
      const restored = (await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/tours/bulk`, { action: "restore", selection: { tourIds: [a.tour.id, b.tour.id] } })).json();
      expect(restored).toMatchObject({ done: 1, unchanged: 1 });
    });

    it("finish / cancel in bulk need a reason and the close permission", async () => {
      const t = await makeTour({ date: plusDays(today(), 11) });
      const noReason = await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/tours/bulk`, { action: "cancel", selection: { tourIds: [t.tour.id] } });
      expect(noReason.statusCode).toBe(400);
      const asDriver = await env.as(U.driverHannover1, "POST", `/v1/orgs/${org()}/tours/bulk`, { action: "cancel", selection: { tourIds: [t.tour.id] }, reason: "x y z" });
      expect(asDriver.statusCode).toBe(403);
    });
  });

  // ------------------------------------------------------------ isolation
  describe("company, location and role isolation", () => {
    it("another location's dispatcher, another company and drivers cannot close, archive or delete", async () => {
      const t = await makeTour({ date: plusDays(today(), 12) });
      const close = await env.as(U.dispatcherBremen, "POST", `/v1/orgs/${org()}/tours/${t.tour.id}/close`, { status: "cancelled", expectedVersion: t.tour.version, reason: "fremd" });
      expect(close.statusCode).toBe(404);
      expect((await env.as(U.dispatcherBremen, "POST", `/v1/orgs/${org()}/tours/${t.tour.id}/archive`, { expectedVersion: t.tour.version })).statusCode).toBe(404);
      expect((await env.as(U.dispatcherBremen, "DELETE", `/v1/orgs/${org()}/tours/${t.tour.id}?expectedVersion=${t.tour.version}`)).statusCode).toBe(404);
      expect((await env.as(U.musterOwner, "POST", `/v1/orgs/${org()}/tours/${t.tour.id}/archive`, { expectedVersion: t.tour.version })).statusCode).toBe(403);
      expect((await env.as(U.driverHannover1, "POST", `/v1/orgs/${org()}/tours/${t.tour.id}/close`, { status: "cancelled", expectedVersion: t.tour.version, reason: "x y z" })).statusCode).toBe(403);
      expect((await env.as(U.driverHannover1, "DELETE", `/v1/orgs/${org()}/tours/${t.tour.id}?expectedVersion=${t.tour.version}`)).statusCode).toBe(403);
      const list = (await env.as(U.dispatcherBremen, "GET", `/v1/orgs/${org()}/tours?date=${plusDays(today(), 12)}`)).json();
      expect(list.tours.find((x: { tour: { id: string } }) => x.tour.id === t.tour.id)).toBeUndefined();
      // Direct database access as another location's dispatcher is refused as well.
      expect((await getTour(t.tour.id)).tour.status).toBe("planned");
    });
  });

  // ------------------------------------------------------------ duplicate, reschedule, list, calendar
  describe("duplicate, reschedule, filters", () => {
    it("duplicate copies the stops as new open stops (no parcels, no history) into an unpublished tour", async () => {
      const t = await makeTour({ driverId: lena(), stops: 3, publish: true, date: plusDays(today(), 13) });
      await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/stops/${t.stops[2]!.id}/cancel`, { reason: "storniert" });
      const r = await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/tours/${t.tour.id}/duplicate`, { date: plusDays(today(), 14) });
      expect(r.statusCode).toBe(201);
      expect(r.json()).toMatchObject({ stops: 2, tour: { status: "planned", publishedAt: null, driverId: null } });
      const copy = await getTour(r.json().tour.id);
      expect(copy.stops.every((s: { status: string; parcels: unknown[] }) => s.status === "pending" && s.parcels.length === 0)).toBe(true);
      const ev = (await env.superuser.query(`select detail from tour_events where tour_id = $1 and kind = 'created'`, [r.json().tour.id])).rows[0];
      expect(ev.detail).toEqual({ duplicatedFrom: t.tour.id });
    });

    it("reschedule moves a tour that has not started (event recorded); a started tour is refused", async () => {
      const t = await makeTour({ driverId: mihai(), stops: 1, publish: true, date: plusDays(today(), 15) });
      const moved = await env.as(U.dispatcherHannover, "PATCH", `/v1/orgs/${org()}/tours/${t.tour.id}`, { expectedVersion: t.tour.version, date: plusDays(today(), 16) });
      expect(moved.statusCode).toBe(200);
      expect(moved.json().date).toBe(plusDays(today(), 16));
      const ev = (await env.superuser.query(`select detail from tour_events where tour_id = $1 and kind = 'rescheduled'`, [t.tour.id])).rows[0];
      expect(ev.detail).toMatchObject({ fromDate: plusDays(today(), 15), toDate: plusDays(today(), 16) });
      const other = await env.as(U.dispatcherHannover, "PATCH", `/v1/orgs/${org()}/tours/${t.tour.id}`, { expectedVersion: moved.json().version, depotId: env.data.depots.bremen });
      expect(other.statusCode).toBe(404);
    });

    it("list filters (range, status, empty, archived) and the calendar agree", async () => {
      const day = plusDays(today(), 20);
      await makeTour({ date: day });
      await makeTour({ stops: 1, date: day });
      const base = `/v1/orgs/${org()}/tours`;
      const all = (await env.as(U.dispatcherHannover, "GET", `${base}?from=${day}&to=${day}`)).json();
      expect(all.total).toBe(2);
      expect((await env.as(U.dispatcherHannover, "GET", `${base}?date=${day}&empty=true`)).json().total).toBe(1);
      expect((await env.as(U.dispatcherHannover, "GET", `${base}?date=${day}&status=completed`)).json().total).toBe(0);
      const ids = (await env.as(U.dispatcherHannover, "GET", `${base}?date=${day}&ids=1`)).json();
      expect(ids.ids).toHaveLength(2);
      const cal = (await env.as(U.dispatcherHannover, "GET", `${base}/calendar?month=${day.slice(0, 7)}`)).json();
      expect(cal.days.find((d: { day: string }) => d.day === day)).toMatchObject({ tours: 2, empty: 1, archived: 0 });
      const tooLong = await env.as(U.dispatcherHannover, "GET", `${base}?from=2025-01-01&to=2026-12-31`);
      expect(tooLong.statusCode).toBe(400);
    });

    it("tour export (CSV) is limited to export permission and audited", async () => {
      const day = plusDays(today(), 20);
      const csv = await env.as(U.dispatcherHannover, "GET", `/v1/orgs/${org()}/tours/export?date=${day}&format=csv`);
      expect(csv.statusCode).toBe(200);
      expect(csv.headers["content-type"]).toMatch(/text\/csv/);
      expect(csv.body.split("\r\n").filter(Boolean)).toHaveLength(3);
      expect((await env.as(U.driverHannover1, "GET", `/v1/orgs/${org()}/tours/export?date=${day}`)).statusCode).toBe(403);
      const audit = (await env.superuser.query(`select count(*)::int n from audit_log where table_name = 'tours_export' and actor_user_id = $1`, [env.data.users.dispatcherHannover])).rows[0].n;
      expect(audit).toBe(1);
    });
  });
});
