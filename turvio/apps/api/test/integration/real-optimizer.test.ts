import { summarizeTours, type DispatchDataset } from "@turvio/shared";
/**
 * The full production path on REAL road data: TURVIO API -> optimizer service (VROOM + OR-Tools)
 * -> OSRM. No fake optimizer, no fake router. Skipped (with a note) unless both services run:
 *
 *   OSRM:      osrm-routed on a graph covering Hannover and Suhl (e.g. Germany)  TEST_OSRM_URL
 *   optimizer: OSRM_URL=<osrm> ROUTING_REQUIRED=true uvicorn turvio_optimizer.app:app --port 8000
 *              (services/optimizer)                                                TEST_OPTIMIZER_URL
 *
 * Addresses: real public OSM addresses (fixtures/osm-addresses.json, ODbL), no personal data.
 * Quality gates compare TURVIO with the stored import order and with an independent baseline
 * (nearest neighbour + 2-opt/or-opt on the same OSRM matrix; ignores deadlines, there are none
 * here). Thresholds: docs/ROUTE_OPTIMIZATION.md §4D.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { OsrmRouting } from "../../src/routing";
import { SEED_USERS as U } from "../../src/seed";
import { createTestEnv, postgresAvailable, type TestEnv } from "./helpers";

const OSRM = process.env.TEST_OSRM_URL ?? "http://127.0.0.1:5001";
const OPTIMIZER = process.env.TEST_OPTIMIZER_URL ?? "http://127.0.0.1:8000";
const reachable = async (url: string) => {
  try {
    return (await fetch(url, { signal: AbortSignal.timeout(3000) })).ok;
  } catch {
    return false;
  }
};
const available = (await postgresAvailable()) && (await reachable(`${OPTIMIZER}/health`)) && (await reachable(`${OSRM}/nearest/v1/driving/9.73,52.37`));
if (!available) console.warn(`real-optimizer tests skipped: needs PostgreSQL, ${OPTIMIZER}/health and OSRM at ${OSRM}`);

type Addr = { street: string; houseNumber: string; postalCode: string; city: string; lat: number; lng: number };
const FIX = JSON.parse(readFileSync(join(import.meta.dirname, "../fixtures/osm-addresses.json"), "utf8")) as Record<string, { addresses: Addr[] }>;
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

/** Deterministic shuffle: the "import order" of a real manifest is not sorted by route. */
function shuffled<T>(xs: T[], seed: number): T[] {
  const out = [...xs];
  let s = seed;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) % 2147483648;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

async function osrmTable(points: { lat: number; lng: number }[]) {
  const coords = points.map((p) => `${p.lng},${p.lat}`).join(";");
  const r = (await (await fetch(`${OSRM}/table/v1/driving/${coords}?annotations=duration,distance`)).json()) as { code: string; durations: number[][]; distances: number[][] };
  expect(r.code).toBe("Ok");
  return r;
}

/** Independent baseline on node 0 = start: nearest neighbour, then 2-opt + or-opt (first improvement). */
function nnLocalSearch(dur: number[][], openEnd: boolean): number {
  const n = dur.length - 1;
  const left = new Set(Array.from({ length: n }, (_, i) => i + 1));
  const route = [0];
  while (left.size) {
    const cur = route.at(-1)!;
    let best = -1;
    for (const j of left) if (best < 0 || dur[cur]![j]! < dur[cur]![best]!) best = j;
    route.push(best);
    left.delete(best);
  }
  route.push(0);
  const cost = (r: number[]) => {
    let c = 0;
    for (let k = 0; k < r.length - (openEnd ? 2 : 1); k++) c += dur[r[k]!]![r[k + 1]!]!;
    return c;
  };
  let r = route;
  let best = cost(r);
  for (let improved = true; improved; ) {
    improved = false;
    outer: for (let i = 1; i < r.length - 2; i++)
      for (let j = i + 1; j < r.length - 1; j++) {
        const cand = [...r.slice(0, i), ...r.slice(i, j + 1).reverse(), ...r.slice(j + 1)];
        const c = cost(cand);
        if (c < best) {
          [r, best, improved] = [cand, c, true];
          break outer;
        }
      }
    if (improved) continue;
    outer2: for (const seg of [1, 2, 3])
      for (let i = 1; i < r.length - seg; i++) {
        const piece = r.slice(i, i + seg);
        const rest = [...r.slice(0, i), ...r.slice(i + seg)];
        for (let k = 1; k < rest.length; k++) {
          const cand = [...rest.slice(0, k), ...piece, ...rest.slice(k)];
          const c = cost(cand);
          if (c < best) {
            [r, best, improved] = [cand, c, true];
            break outer2;
          }
        }
      }
  }
  return best;
}

describe.runIf(available)("real optimizer and OSRM through the API", () => {
  beforeAll(async () => {
    env = await createTestEnv("realopt", { optimizerUrl: OPTIMIZER, fetchImpl: fetch, routing: new OsrmRouting(OSRM, { maxSnapMeters: 1000, timeoutMs: 20_000 }) });
  }, 120_000);
  afterAll(async () => {
    await env?.close();
  });
  let env: TestEnv;
  const org = () => env.data.orgs.jarbou;
  const report: Record<string, unknown> = {};
  afterAll(() => console.info("real-optimizer report", JSON.stringify(report)));

  async function tourWith(depot: string, addrs: Addr[], extra: Record<string, unknown> = {}) {
    const t = (await env.as(U.jarbouOwner, "POST", `/v1/orgs/${org()}/tours`, { depotId: depot, date: today(), ...extra })).json();
    expect(t.id).toBeTruthy();
    const r = await env.as(U.jarbouOwner, "POST", `/v1/orgs/${org()}/stops`, {
      tourId: t.id,
      stops: addrs.map((a, i) => ({ recipientName: `Empfänger ${i + 1}`, address: { street: a.street, houseNumber: a.houseNumber, postalCode: a.postalCode, city: a.city }, location: { lat: a.lat, lng: a.lng }, serviceSeconds: 90 })),
    });
    expect(r.statusCode).toBe(201);
    return t.id as string;
  }
  const route = async (id: string) => (await env.as(U.jarbouOwner, "GET", `/v1/orgs/${org()}/tours/${id}/route`)).json();
  const optimize = async (id: string) => {
    const r = await env.as(U.jarbouOwner, "POST", `/v1/orgs/${org()}/tours/${id}/optimize`, {});
    expect(r.statusCode).toBe(200);
    return r.json();
  };

  let hannoverTour = "";
  let roundTripMeters = 0;

  it("Hannover, 100 stops: real road optimization beats the import order and an independent baseline", async () => {
    const addrs = shuffled(FIX.hannover!.addresses, 7);
    hannoverTour = await tourWith(env.data.depots.hannover!, addrs);
    const before = await route(hannoverTour);
    expect(before.source).toBe("osrm");

    const t0 = Date.now();
    const o = await optimize(hannoverTour);
    const wall = (Date.now() - t0) / 1000;
    expect(o.result).toMatchObject({ engine: "or-tools", matrixSource: "osrm", unassignedStopIds: [], violations: [] });
    expect(o.stops.filter((s: { sequence: number }) => s.sequence >= 0)).toHaveLength(100);
    expect(wall).toBeLessThan(10 + 8); // 10 s solver budget for 61–150 stops + matrix + HTTP

    // The stored order, routed again on real roads: no 0 m legs between different addresses.
    const after = await route(hannoverTour);
    expect(after.source).toBe("osrm");
    expect(after.legs).toHaveLength(101);
    expect(after.legs.filter((l: { meters: number }) => l.meters === 0).length).toBe(0);
    roundTripMeters = after.metrics.totalMeters;
    // Optimizer (OSRM table) and road route (OSRM route) agree – the road route must not show a
    // different trip than the one that was planned (it did, by +20 %, before continue_straight=false).
    expect(Math.abs(after.metrics.totalMeters - o.result.distanceMeters) / o.result.distanceMeters).toBeLessThan(0.03);

    const depot = (await env.superuser.query(`select lat, lng from depots where id = $1`, [env.data.depots.hannover])).rows[0];
    const m = await osrmTable([depot, ...addrs]);
    const baseline = nnLocalSearch(m.durations, false);
    report.hannover = { stops: 100, importKm: before.metrics.totalMeters / 1000, turvioKm: after.metrics.totalMeters / 1000, turvioDriveMin: o.result.driveSeconds / 60, baselineDriveMin: baseline / 60, wallSeconds: wall };
    expect(after.metrics.totalMeters).toBeLessThan(before.metrics.totalMeters * 0.5);
    expect(o.result.driveSeconds).toBeLessThanOrEqual(baseline * 1.02);
  }, 120_000);

  it("Dispatch times equal the optimizer's plan on real roads (P0-2); the old straight-line figure did not", async () => {
    const d = (await env.as(U.jarbouOwner, "GET", `/v1/orgs/${org()}/dispatch`)).json() as DispatchDataset;
    const s = summarizeTours(d).find((x) => x.tour.id === hannoverTour)!;
    const p = s.timeline.projection;
    expect(p.source).toBe("road");
    const o = (await env.as(U.jarbouOwner, "POST", `/v1/orgs/${org()}/tours/${hannoverTour}/optimize`, { apply: false })).json();
    const planMinutes = o.result.endMinute - s.tour.plannedStartMinute; // optimizer: shift start -> back at the depot
    const dispatchMinutes = p.finishMinute - p.fromMinute; // same tour, as Dispatch shows it now
    const old = summarizeTours({ ...d, roads: undefined }).find((x) => x.tour.id === hannoverTour)!.timeline.projection; // before P0-2
    const oldMinutes = old.finishMinute - old.fromMinute;
    report.dispatchVsPlan = { planMinutes, dispatchMinutes, oldStraightLineMinutes: oldMinutes, dispatchKm: p.totalMeters / 1000, planKm: o.result.distanceMeters / 1000 };
    expect(Math.abs(dispatchMinutes - planMinutes)).toBeLessThan(1);
    expect(Math.abs(p.totalMeters - o.result.distanceMeters) / o.result.distanceMeters).toBeLessThan(0.03);
  }, 120_000);

  it("Hannover, same tour ending at the last stop: no return leg, shorter, still beats the baseline", async () => {
    const v = (await env.as(U.jarbouOwner, "GET", `/v1/orgs/${org()}/tours/${hannoverTour}`)).json().tour.version;
    expect((await env.as(U.jarbouOwner, "PATCH", `/v1/orgs/${org()}/tours/${hannoverTour}`, { expectedVersion: v, end: { mode: "last_stop" } })).statusCode).toBe(200);
    const o = await optimize(hannoverTour);
    expect(o.result).toMatchObject({ matrixSource: "osrm", violations: [] });
    const r = await route(hannoverTour);
    expect(r.legs).toHaveLength(100); // depot -> 100 stops, nothing back
    expect(r.waypointStopIds.at(-1)).not.toBeNull();
    expect(r.metrics.totalMeters).toBeLessThan(roundTripMeters);

    const depot = (await env.superuser.query(`select lat, lng from depots where id = $1`, [env.data.depots.hannover])).rows[0];
    const addrs = FIX.hannover!.addresses;
    const baseline = nnLocalSearch((await osrmTable([depot, ...addrs])).durations, true);
    report.hannoverOpen = { turvioKm: r.metrics.totalMeters / 1000, roundTripKm: roundTripMeters / 1000, turvioDriveMin: o.result.driveSeconds / 60, baselineDriveMin: baseline / 60 };
    expect(o.result.driveSeconds).toBeLessThanOrEqual(baseline * 1.02);
  }, 120_000);

  it("Suhl, 80 stops from a custom start address, ending at the last stop (outside every seeded depot)", async () => {
    const start = { lat: 50.6106, lng: 10.6936, label: "Suhl Bahnhof (start)" };
    const addrs = shuffled(FIX.suhl!.addresses, 11);
    const id = await tourWith(env.data.depots.kassel!, addrs, { start, end: { mode: "last_stop" } });
    const o = await optimize(id);
    expect(o.result).toMatchObject({ matrixSource: "osrm", unassignedStopIds: [], violations: [], startSource: "tour" });
    const r = await route(id);
    expect(r.source).toBe("osrm");
    expect(r.legs).toHaveLength(80);
    expect(r.geometry[0][0]).toBeCloseTo(start.lat, 2); // starts in Suhl, not at the Kassel depot
    expect(r.legs.filter((l: { meters: number }) => l.meters === 0).length).toBe(0);
    const baseline = nnLocalSearch((await osrmTable([start, ...addrs])).durations, true);
    report.suhlOpen = { stops: 80, turvioKm: r.metrics.totalMeters / 1000, turvioDriveMin: o.result.driveSeconds / 60, baselineDriveMin: baseline / 60 };
    expect(o.result.driveSeconds).toBeLessThanOrEqual(baseline * 1.02);
  }, 120_000);

  it("a stop outside the road data is refused with routing_out_of_coverage – never routed in a straight line", async () => {
    const id = await tourWith(env.data.depots.hannover!, [...FIX.hannover!.addresses.slice(0, 5), { street: "Rue de Rivoli", houseNumber: "1", postalCode: "75001", city: "Paris", lat: 48.8566, lng: 2.3522 }]);
    const r = await env.as(U.jarbouOwner, "POST", `/v1/orgs/${org()}/tours/${id}/optimize`, {});
    expect(r.statusCode).toBe(422);
    expect(r.json().error.code).toBe("routing_out_of_coverage");
  }, 60_000);
});
