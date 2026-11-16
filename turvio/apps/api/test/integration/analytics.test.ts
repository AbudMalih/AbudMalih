import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { parseXlsx } from "@turvio/shared";
import { SEED_USERS as U } from "../../src/seed";
import { createTestEnv, postgresAvailable, type TestEnv } from "./helpers";

/**
 * Analytics KPIs against a hand-computed fixture (fixed local times, Europe/Berlin), company and
 * location isolation, role checks, CSV / Excel export and the export audit.
 *
 * Fixture day D:
 *  A  Hannover, Lena   planned 08:00, started 08:05, finished 12:05 (240 min). Stops: delivered at
 *     09:00 09:30 10:00 10:30, failed 11:00 (recipient_absent), 1 open. Optimized on the road network
 *     before the start: 42 km / 150 min.
 *  B  Hannover, Mihai  planned 08:00, started 08:40 (late), finished 10:40 (120 min). Stops: delivered
 *     09:00 09:20, 1 cancelled. Optimization from straight-line estimates (not a planned figure).
 *  C  Bremen, Aylin    planned, not started, 2 open stops.
 *  D  Hannover, no driver, cancelled, no stops.
 */
const available = await postgresAvailable();
let env: TestEnv;
const D = "2026-06-10";
const org = () => env.data.orgs.jarbou;
const at = (time: string) => `(date '${D}' + time '${time}') at time zone 'Europe/Berlin'`;

async function tour(depot: string, driverId: string | null, name: string) {
  const r = await env.superuser.query(
    `insert into tours (organization_id, depot_id, name, tour_date, planned_start_minute, driver_id) values ($1, $2, $3, $4, 480, $5) returning id`,
    [org(), depot, name, D, driverId],
  );
  return r.rows[0].id as string;
}
async function stop(tourId: string, seq: number, status: string, time: string | null, reason: string | null = null) {
  await env.superuser.query(
    `insert into stops (organization_id, tour_id, sequence, street, postal_code, city, lat, lng, status, completed_at, failure_reason, status_changed_at)
     values ($1, $2, $3, 'Teststraße', '30159', 'Hannover', 52.37, 9.73, $4::stop_status, ${time ? at(time) : "null"}, $5, ${time ? at(time) : "null"})`,
    [org(), tourId, seq, status, reason],
  );
}

describe.runIf(available)("analytics", () => {
  beforeAll(async () => {
    env = await createTestEnv("analytics");
    const h = env.data.depots.hannover!;
    const b = env.data.depots.bremen!;
    const A = await tour(h, env.data.drivers.hannover![0]!, "A");
    for (const [i, t] of ["09:00", "09:30", "10:00", "10:30"].entries()) await stop(A, i, "delivered", t);
    await stop(A, 4, "failed", "11:00", "recipient_absent");
    await stop(A, 5, "pending", null);
    await env.superuser.query(
      `update tours set optimization = '{"distanceMeters": 42000, "durationSeconds": 9000, "matrixSource": "osrm"}', optimized_at = ${at("07:30")} where id = $1`,
      [A],
    );
    await env.superuser.query(`update tours set status = 'in_progress', started_at = ${at("08:05")} where id = $1`, [A]);
    await env.superuser.query(`update tours set status = 'completed', finished_at = ${at("12:05")} where id = $1`, [A]);

    const B = await tour(h, env.data.drivers.hannover![1]!, "B");
    await stop(B, 0, "delivered", "09:00");
    await stop(B, 1, "delivered", "09:20");
    await stop(B, 2, "cancelled", "09:10");
    await env.superuser.query(`update tours set optimization = '{"distanceMeters": 1, "durationSeconds": 1, "matrixSource": "haversine_estimate"}', optimized_at = ${at("07:00")} where id = $1`, [B]);
    await env.superuser.query(`update tours set status = 'in_progress', started_at = ${at("08:40")} where id = $1`, [B]);
    await env.superuser.query(`update tours set status = 'completed', finished_at = ${at("10:40")} where id = $1`, [B]);

    const C = await tour(b, env.data.drivers.bremen![0]!, "C");
    await stop(C, 0, "pending", null);
    await stop(C, 1, "pending", null);

    const Dt = await tour(h, null, "D");
    await env.superuser.query(`update tours set status = 'cancelled' where id = $1`, [Dt]);
  }, 120_000);
  afterAll(async () => {
    await env?.close();
  });

  const summary = async (who: string, q = `date=${D}`) => env.as(who, "GET", `/v1/orgs/${org()}/analytics/summary?${q}`);

  it("company-wide figures match the hand-computed values", async () => {
    const r = await summary(U.jarbouOwner);
    expect(r.statusCode).toBe(200);
    const { current, previous, definitions } = r.json();
    expect(current.stops).toEqual({
      stops: 11, delivered: 6, pickedUp: 0, failed: 1, attempted: 0, rescheduled: 0, returned: 0, skipped: 0, cancelled: 1, open: 3, processed: 7, successRate: 0.8571,
    });
    expect(current.tours).toMatchObject({
      tours: 4,
      byStatus: { planned: 1, running: 0, completed: 2, cancelled: 1 },
      toursStarted: 2,
      completionRate: 1,
      onTimeStartRate: 0.5,
      avgTourMinutes: 180,
      activeHours: 6,
      stopsPerTour: 2.33,
      stopsPerActiveHour: 1.17,
      planned: { coveredTours: 1, plannedDistanceKm: 42, plannedMinutes: 150 },
    });
    // 09:00→09:30→10:00→10:30→11:00 (4 × 30) and 09:00→09:20 (20): 140 / 5.
    expect(current.avgIntervalMinutes).toBe(28);
    expect(previous.stops.stops).toBe(0);
    expect(r.json().failureReasons).toEqual([{ reason: "recipient_absent", status: "failed", count: 1 }]);
    // Every reported figure is defined; the interval is explicitly not a service time.
    expect(definitions.avgIntervalMinutes).toMatch(/not the service time/);
    expect(definitions.successRate).toMatch(/Open and cancelled stops are excluded/);
  });

  it("a location's dispatcher sees only their locations", async () => {
    const h = (await summary(U.dispatcherHannover)).json().current;
    expect(h.stops).toMatchObject({ stops: 9, delivered: 6, failed: 1, cancelled: 1, open: 1, processed: 7 });
    expect(h.tours.tours).toBe(3);
    const b = (await summary(U.dispatcherBremen)).json().current;
    expect(b.stops).toMatchObject({ stops: 2, open: 2, processed: 0, successRate: null });
    expect(b.tours).toMatchObject({ tours: 1, toursStarted: 0, completionRate: null, onTimeStartRate: null, avgTourMinutes: null });
    const depots = (await env.as(U.dispatcherBremen, "GET", `/v1/orgs/${org()}/analytics/depots?date=${D}`)).json().depots;
    expect(depots.map((d: { name: string }) => d.name)).toEqual(["Bremen"]);
  });

  it("drivers, depots and tours tables", async () => {
    const drivers = (await env.as(U.jarbouOwner, "GET", `/v1/orgs/${org()}/analytics/drivers?date=${D}`)).json().drivers;
    const lena = drivers.find((d: { name: string }) => d.name === "Lena Hoffmann");
    expect(lena).toMatchObject({ stops: 6, delivered: 4, failed: 1, open: 1, processed: 5, successRate: 0.8, tours: 1, onTimeStartRate: 1, avgTourMinutes: 240, stopsPerActiveHour: 1.25 });
    const mihai = drivers.find((d: { name: string }) => d.name === "Mihai Popescu");
    expect(mihai).toMatchObject({ processed: 2, successRate: 1, onTimeStartRate: 0, cancelled: 1 });
    const unassigned = drivers.find((d: { name: string | null }) => d.name === null);
    expect(unassigned).toMatchObject({ tours: 1, stops: 0, byStatus: { cancelled: 1 } });
    const tours = (await env.as(U.jarbouOwner, "GET", `/v1/orgs/${org()}/analytics/tours?date=${D}`)).json().tours;
    expect(tours.map((t: { name: string; stops: number }) => [t.name, t.stops])).toEqual([["A", 6], ["B", 3], ["C", 2], ["D", 0]]);
    expect(tours.find((t: { name: string }) => t.name === "A")).toMatchObject({ minutes: 240, plannedDistanceKm: 42 });
    expect(tours.find((t: { name: string }) => t.name === "B").plannedDistanceKm).toBeNull();
  });

  it("trend buckets and the previous-period comparison", async () => {
    const r = (await summary(U.jarbouOwner, `from=2026-06-08&to=2026-06-12`)).json();
    expect(r.granularity).toBe("day");
    expect(r.previousRange).toEqual({ from: "2026-06-03", to: "2026-06-07" });
    expect(r.trend).toEqual([expect.objectContaining({ bucket: D, tours: 4, toursCompleted: 2, delivered: 6, processed: 7 })]);
    expect((await summary(U.jarbouOwner, `month=2026-06`)).json().range).toEqual({ from: "2026-06-01", to: "2026-06-30" });
  });

  it("roles and companies: drivers and other companies get nothing", async () => {
    expect((await summary(U.driverHannover1)).statusCode).toBe(403);
    expect((await summary(U.musterOwner)).statusCode).toBe(403);
    const muster = (await env.as(U.musterOwner, "GET", `/v1/orgs/${env.data.orgs.muster}/analytics/summary?date=${D}`)).json();
    expect(muster.current.stops.stops).toBe(0);
  });

  it("export: CSV and Excel carry the same rows; every export is logged", async () => {
    const csv = await env.as(U.dispatcherHannover, "GET", `/v1/orgs/${org()}/analytics/export?date=${D}&view=drivers&format=csv`);
    expect(csv.statusCode).toBe(200);
    expect(csv.headers["content-disposition"]).toMatch(/turvio-drivers-2026-06-10_2026-06-10\.csv/);
    const lines = csv.body.replace(/^﻿/, "").trim().split("\r\n");
    expect(lines[0]!.split(";").slice(0, 3)).toEqual(["Driver", "Stops", "Delivered"]);
    expect(lines.find((l) => l.startsWith("Lena Hoffmann"))!.split(";").slice(0, 3)).toEqual(["Lena Hoffmann", "6", "4"]);
    const xlsx = await env.as(U.dispatcherHannover, "GET", `/v1/orgs/${org()}/analytics/export?date=${D}&view=drivers&format=xlsx`);
    const rows = parseXlsx(new Uint8Array(xlsx.rawPayload));
    expect(rows.length).toBe(lines.length);
    expect(rows.find((r) => r[0] === "Lena Hoffmann")!.slice(0, 3)).toEqual(["Lena Hoffmann", "6", "4"]);
    const log = (await env.superuser.query(`select record_id from audit_log where table_name = 'analytics_export' order by id`)).rows.map((r) => r.record_id);
    expect(log).toEqual(["drivers:2026-06-10..2026-06-10", "drivers:2026-06-10..2026-06-10"]);
    expect((await env.as(U.driverHannover1, "GET", `/v1/orgs/${org()}/analytics/export?date=${D}&view=drivers`)).statusCode).toBe(403);
  });
});
