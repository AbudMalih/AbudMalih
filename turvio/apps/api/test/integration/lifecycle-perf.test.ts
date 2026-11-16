import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SEED_USERS as U } from "../../src/seed";
import { createTestEnv, postgresAvailable, type TestEnv } from "./helpers";

/**
 * Volume check (run with TURVIO_PERF=1): 60 drivers × 30 days × 90 stops in one location (~162,000 stops,
 * 1,800 tours), read as that location's dispatcher (row-level security active). Measures the
 * Analytics summary / driver table, the month's tour list, a 500-tour bulk preview and closing a
 * 100-stop tour. Synthetic data only.
 */
const available = (await postgresAvailable()) && process.env.TURVIO_PERF === "1";
let env: TestEnv;
const org = () => env.data.orgs.jarbou;
const timings: Record<string, number> = {};
async function timed<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const t0 = performance.now();
  const r = await fn();
  timings[name] = Math.round(performance.now() - t0);
  return r;
}

describe.runIf(available)("lifecycle and analytics at volume", () => {
  beforeAll(async () => {
    env = await createTestEnv("perf");
    const h = env.data.depots.hannover!;
    const s = env.superuser;
    // Synthetic volume beyond the seed plan's driver limit: plan triggers off for the fixture only.
    await s.query(`alter table drivers disable trigger user`);
    await s.query(`insert into drivers (organization_id, depot_id, display_name) select $1, $2, 'Perf Fahrer ' || g from generate_series(1, 60) g`, [org(), h]);
    await s.query(`alter table drivers enable trigger user`);
    await s.query(
      `insert into tours (organization_id, depot_id, name, tour_date, planned_start_minute, driver_id, status, started_at, finished_at, published_at)
       select $1, $2, 'P-' || d.n || '-' || x.day, date '2026-05-01' + x.day, 480, d.id, 'completed',
              ((date '2026-05-01' + x.day) + time '08:05') at time zone 'Europe/Berlin',
              ((date '2026-05-01' + x.day) + time '16:05') at time zone 'Europe/Berlin', now()
         from (select id, row_number() over (order by id) n from drivers where display_name like 'Perf Fahrer %') d
        cross join generate_series(0, 29) x(day)`,
      [org(), h],
    );
    await s.query(`alter table stops disable trigger user`);
    await s.query(
      `insert into stops (organization_id, tour_id, sequence, street, postal_code, city, lat, lng, status, completed_at, failure_reason)
       select t.organization_id, t.id, g, 'Perfstraße', '30159', 'Hannover', 52.37, 9.73,
              (case when g % 15 = 0 then 'failed' when g % 31 = 0 then 'attempted' else 'delivered' end)::stop_status,
              t.started_at + make_interval(mins => g * 5), case when g % 15 = 0 then 'recipient_absent' when g % 31 = 0 then 'recipient_absent' end
         from tours t cross join generate_series(0, 89) g
        where t.name like 'P-%'`,
    );
    await s.query(`alter table stops enable trigger user`);
    await s.query(`analyze tours; analyze stops`);
  }, 600_000);
  afterAll(async () => {
    console.log("PERF timings (ms):", JSON.stringify(timings));
    if (process.env.TURVIO_PERF_OUT) (await import("node:fs")).writeFileSync(process.env.TURVIO_PERF_OUT, JSON.stringify(timings, null, 1));
    await env?.close();
  });

  it.runIf(process.env.TURVIO_EXPLAIN === "1")("explain", async () => {
    const plan = await env.db.asUser({ sub: env.data.users.dispatcherHannover }, async (tx) =>
      (await tx.query(`explain (analyze, buffers off, timing on) with t as (select t.* from tours t where t.organization_id = $1 and t.tour_date between '2026-05-01' and '2026-05-30') select count(*) from t join stops s on s.tour_id = t.id`, [org()])).rows.map((r) => r["QUERY PLAN"]).join("\n"));
    (await import("node:fs")).writeFileSync(process.env.TURVIO_EXPLAIN_OUT ?? "/dev/null", plan);
  });

  it("analytics over 30 days stays interactive", async () => {
    const r = await timed("analytics.summary.30d", () => env.as(U.dispatcherHannover, "GET", `/v1/orgs/${org()}/analytics/summary?from=2026-05-01&to=2026-05-30`));
    expect(r.statusCode).toBe(200);
    expect(r.json().current.stops.stops).toBe(162_000);
    const d = await timed("analytics.drivers.30d", () => env.as(U.dispatcherHannover, "GET", `/v1/orgs/${org()}/analytics/drivers?from=2026-05-01&to=2026-05-30`));
    expect(d.json().drivers.length).toBeGreaterThanOrEqual(60);
    const csv = await timed("analytics.export.tours.30d", () => env.as(U.dispatcherHannover, "GET", `/v1/orgs/${org()}/analytics/export?from=2026-05-01&to=2026-05-30&view=tours`));
    expect(csv.statusCode).toBe(200);
    expect(timings["analytics.summary.30d"]).toBeLessThan(5000);
  });

  it("tour list for a month, bulk preview of 500 tours", async () => {
    const list = await timed("tours.list.month", () => env.as(U.dispatcherHannover, "GET", `/v1/orgs/${org()}/tours?month=2026-05&limit=100`));
    expect(list.json().total).toBe(1800);
    const ids = await timed("tours.ids.month", () => env.as(U.dispatcherHannover, "GET", `/v1/orgs/${org()}/tours?month=2026-05&ids=1`));
    expect(ids.json().ids).toHaveLength(1000);
    const p = await timed("bulk.preview.archive.500", () =>
      env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/tours/bulk/preview`, { action: "archive", selection: { tourIds: ids.json().ids.slice(0, 500) } }),
    );
    expect(p.json().summary.eligible).toBe(500);
    const a = await timed("bulk.archive.500", () => env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/tours/bulk`, { action: "archive", selection: { tourIds: ids.json().ids.slice(0, 500) } }));
    expect(a.json().done).toBe(500);
    const del = await timed("bulk.preview.delete.200", () =>
      env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/tours/bulk/preview`, { action: "delete", selection: { tourIds: ids.json().ids.slice(0, 200) } }),
    );
    expect(del.json().summary.protected).toBe(200);
  });

  it("closing a 100-stop tour (open stops back to the pool)", async () => {
    const t = (await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/tours`, { depotId: env.data.depots.hannover, date: "2026-07-01", driverId: env.data.drivers.hannover![0] })).json();
    await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/stops`, {
      tourId: t.id,
      stops: Array.from({ length: 100 }, (_, i) => ({ address: { street: "Weg", houseNumber: String(i + 1), postalCode: "30159", city: "Hannover" }, location: { lat: 52.37 + i * 0.0005, lng: 9.73 } })),
    });
    const cur = (await env.as(U.dispatcherHannover, "GET", `/v1/orgs/${org()}/tours/${t.id}`)).json();
    await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/tours/${t.id}/publish`, { expectedVersion: cur.tour.version });
    await env.as(U.driverHannover1, "POST", `/v1/orgs/${org()}/tours/${t.id}/status`, { status: "in_progress" });
    const v = (await env.as(U.dispatcherHannover, "GET", `/v1/orgs/${org()}/tours/${t.id}`)).json().tour.version;
    const r = await timed("close.100stops", () => env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/tours/${t.id}/close`, { status: "completed", expectedVersion: v, reason: "Volumentest" }));
    expect(r.json().openStops.count).toBe(100);
  });
});
