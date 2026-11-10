import { existsSync, readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { StopLocationCheck } from "@turvio/shared";
import { PostgresGeocoder } from "../../src/geocode";
import { LocationChecker } from "../../src/location-check";
import { OsrmRouting } from "../../src/routing";
import { SEED_USERS as U } from "../../src/seed";
import { createTestEnv, postgresAvailable, type TestEnv } from "./helpers";

/**
 * Location checks through the API (P0-3.1), with the real PostgreSQL address data (geo.addresses)
 * and a simulated OSRM: every point is 12 m from "Teststraße", except points east of 9.80 (on the
 * A 2 motorway, normal road 49 m away) and north of 60° (outside the road data).
 */
const available = await postgresAvailable();
let env: TestEnv;

const fakeOsrm: typeof fetch = async (input) => {
  const url = new URL(String(input));
  const coords = url.pathname.split("/").at(-1)!.split(";").map((c) => c.split(",").map(Number) as [number, number]);
  const wp = (c: [number, number]) => ({ distance: c[1] >= 60 ? 900_000 : c[0] > 9.8 ? 0 : 12, name: c[0] > 9.8 ? "" : "Teststraße", location: c });
  if (url.pathname.startsWith("/nearest")) return Response.json({ code: "Ok", waypoints: [{ distance: 49, name: "Klusriede", location: coords[0] }] });
  if (url.pathname.startsWith("/table")) {
    const s = url.searchParams.get("sources")!.split(";");
    const d = url.searchParams.get("destinations")!.split(";");
    return Response.json({ code: "Ok", durations: s.map(() => d.map(() => 60)) });
  }
  return Response.json({
    code: "Ok",
    waypoints: coords.map(wp),
    routes: [{ legs: coords.slice(0, -1).map((c) => ({ steps: [{ ref: c[0] > 9.8 ? "A 2" : "", intersections: [{ classes: c[0] > 9.8 ? ["motorway"] : [] }] }] })) }],
  });
};

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

describe.runIf(available)("location checks (API)", () => {
  beforeAll(async () => {
    const q = <R,>(sql: string, params: unknown[]) => env.superuser.query(sql, params) as unknown as Promise<{ rows: R[] }>;
    env = await createTestEnv("locations", { routing: new OsrmRouting("http://osrm.test", { fetchImpl: fakeOsrm }), geocoder: new PostgresGeocoder((sql, params) => q(sql, params)) });
    // Two real OSM house addresses (Hannover).
    for (const r of [
      ["Borkumer Straße", "31", "30163", "Hannover", 52.397376, 9.74687],
      ["Borkumer Straße", "33", "30163", "Hannover", 52.39745, 9.74702],
    ])
      await env.superuser.query(`insert into geo.addresses (street, house_number, postcode, city, lat, lng) values ($1,$2,$3,$4,$5,$6)`, r);
  }, 120_000);
  afterAll(async () => {
    await env?.close();
  });
  const org = () => env.data.orgs.jarbou;

  let tourId = "";
  const ids: Record<string, string> = {};
  it("checks the open stops of the day: warnings and errors with reasons; coordinates unchanged", async () => {
    const t = (await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/tours`, { depotId: env.data.depots.hannover, date: today(), name: "LOC-01" })).json();
    tourId = t.id;
    const stops = [
      { key: "house", street: "Borkumer Straße", houseNumber: "31", location: { lat: 52.397376, lng: 9.74687 } },
      { key: "moved", street: "Borkumer Straße", houseNumber: "33", location: { lat: 52.40045, lng: 9.74702 } }, // 334 m north of the house
      { key: "street", street: "Borkumer Straße", houseNumber: "999", location: { lat: 52.397413, lng: 9.746945 } }, // street centre of the two houses
      { key: "motorway", street: "Klusriede", houseNumber: "1", location: { lat: 52.427361, lng: 9.841878 } },
      { key: "outside", street: "Teststraße", houseNumber: "1", location: { lat: 60.5, lng: 9.7 } },
      { key: "swapped", street: "Teststraße", houseNumber: "2", location: { lat: 9.74687, lng: 52.397376 } },
      { key: "none", street: "Ohne Position", houseNumber: "1" },
    ];
    const r = await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/stops`, {
      tourId,
      stops: stops.map((s) => ({ recipientName: s.key, address: { street: s.street, houseNumber: s.houseNumber, postalCode: "30163", city: "Hannover" }, ...(s.location ? { location: s.location } : {}) })),
    });
    expect(r.statusCode).toBe(201);
    (r.json().ids as string[]).forEach((id, i) => (ids[stops[i]!.key] = id));

    const res = await env.as(U.dispatcherHannover, "GET", `/v1/orgs/${org()}/location-checks?tourId=${tourId}`);
    expect(res.statusCode).toBe(200);
    const body = res.json() as { pending: boolean; checks: StopLocationCheck[]; summary: Record<string, number>; thresholds: Record<string, number> };
    expect(body.pending).toBe(false);
    expect(body.thresholds).toMatchObject({ farFromRoadMeters: 150, addressMismatchMeters: 250, coverageMeters: 1000 });
    const by = Object.fromEntries(body.checks.map((c) => [c.stopId, c]));
    const codes = (k: string) => by[ids[k]!]!.issues.map((i) => `${i.severity}:${i.code}`);
    expect(by[ids.house!]).toMatchObject({ status: "checked", severity: null, issues: [] });
    expect(codes("moved")).toEqual(["warning:address_mismatch"]);
    expect(codes("street")).toEqual(["warning:approximate_location"]);
    expect(codes("motorway")).toContain("warning:motorway");
    expect(by[ids.motorway!]!.issues.find((i) => i.code === "motorway")!.suggestion).toMatchObject({ roadName: "Klusriede", distanceMeters: 49 });
    expect(codes("outside")).toEqual(["error:outside_country"]);
    expect(codes("swapped")).toEqual(["error:outside_country"]);
    expect(by[ids.none!]!.status).toBe("no_location");
    expect(body.summary).toMatchObject({ stops: 7, errors: 2, noLocation: 1 });

    // Read-only: the stored coordinates are exactly what was imported.
    const stored = (await env.superuser.query<{ id: string; lat: number; lng: number }>(`select id, lat, lng from stops where tour_id = $1`, [tourId])).rows;
    expect(stored.find((s) => s.id === ids.moved)).toMatchObject({ lat: 52.40045, lng: 9.74702 });
    expect(stored.find((s) => s.id === ids.motorway)).toMatchObject({ lat: 52.427361, lng: 9.841878 });
  });

  const CSV = "/opt/turvio-de/city-addresses.csv";
  it.runIf(existsSync(CSV))("performance: address cross-check for 100 stops against all 21,000 Hannover addresses", async () => {
    const rows = readFileSync(CSV, "utf8").trim().split(/\r?\n/).slice(1).map((l) => l.split(";")).filter((r) => r[0] === "Hannover" && r.length === 7); // a few rows have quoted "6;8" house numbers
    for (let i = 0; i < rows.length; i += 2000) {
      const chunk = rows.slice(i, i + 2000);
      const values = chunk.map((_, j) => `($${j * 6 + 1},$${j * 6 + 2},$${j * 6 + 3},$${j * 6 + 4},$${j * 6 + 5},$${j * 6 + 6})`).join(",");
      await env.superuser.query(`insert into geo.addresses (street, house_number, postcode, city, lat, lng) values ${values} on conflict do nothing`, chunk.flatMap((r) => [r[1], r[2], r[3], r[4], Number(r[5]), Number(r[6])]));
    }
    await env.superuser.query("analyze geo.addresses");
    const q = <R,>(sql: string, params: unknown[]) => env.superuser.query(sql, params) as unknown as Promise<{ rows: R[] }>;
    const step = Math.floor(rows.length / 100);
    const stops = Array.from({ length: 100 }, (_, i) => rows[i * step]!).map((r, i) => ({ id: `p${i}`, location: { lat: Number(r[5]), lng: Number(r[6]) }, address: { street: r[1]!, houseNumber: r[2]!, postalCode: r[3]!, city: r[4]!, countryCode: "DE" } }));
    const checker = new LocationChecker(undefined, new PostgresGeocoder((sql, params) => q(sql, params)), { budgetMs: 30_000 });
    const t0 = performance.now();
    const { checks } = await checker.check([{ origin: null, stops }]);
    const ms = performance.now() - t0;
    const flagged = checks.filter((c) => c.issues.some((i) => i.code === "address_mismatch" || i.code === "approximate_location"));
    console.log("address-check report", JSON.stringify({ addresses: rows.length, stops: 100, ms: Math.round(ms), flagged: flagged.length, notFound: checks.filter((c) => c.issues.some((i) => i.code === "address_not_in_map_data")).length }));
    expect(flagged).toEqual([]); // real addresses with their own coordinates: no mismatch
    expect(ms).toBeLessThan(5000);
    // The same addresses with coordinates 300 m off (a wrong geocode / import column): detected,
    // although such points still lie close to some road (snap distance alone cannot tell).
    const moved = stops.map((x, i) => ({ ...x, id: `m${i}`, location: { lat: x.location.lat + (300 / 111_320) * Math.cos(i), lng: x.location.lng + (300 / (111_320 * Math.cos((x.location.lat * Math.PI) / 180))) * Math.sin(i) } }));
    const m = await checker.check([{ origin: null, stops: moved }]);
    const detected = m.checks.filter((c) => c.issues.some((i) => i.code === "address_mismatch")).length;
    console.log("address-check moved 300 m", JSON.stringify({ detected, of: moved.length, missed: m.checks.filter((c) => !c.issues.some((i) => i.code === "address_mismatch")).map((c) => [moved.find((x) => x.id === c.stopId)!.address, c.issues.map((i) => i.code)]) }));
    // ≥ 98 %: an address with several entrances in OSM (e.g. Zur Bettfedernfabrik 3: three points
    // up to 106 m apart) can still be within 250 m of one of them – conservative, no false alarm.
    expect(detected).toBeGreaterThanOrEqual(98);
  }, 180_000);

  it("drivers cannot read the company-wide checks", async () => {
    expect((await env.as(U.driverHannover1, "GET", `/v1/orgs/${org()}/location-checks`)).statusCode).toBe(403);
  });

  it("multi-tour optimization reports stops without a map position instead of omitting them silently", async () => {
    const r = await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/plans/optimize`, { tourIds: [tourId], includeUnassigned: false });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { unlocatedStopIds: string[]; routes: { tourId: string; stops: number }[] };
    expect(body.unlocatedStopIds).toEqual([ids.none]);
    // The stop stays on its tour (at the end), its data untouched.
    const row = (await env.superuser.query<{ tour_id: string; lat: number | null; sequence: number }>(`select tour_id, lat, sequence from stops where id = $1`, [ids.none])).rows[0]!;
    expect(row).toMatchObject({ tour_id: tourId, lat: null });
    const max = (await env.superuser.query<{ m: number }>(`select max(sequence) as m from stops where tour_id = $1`, [tourId])).rows[0]!.m;
    expect(row.sequence).toBe(max);
    const meta = (await env.superuser.query<{ optimization: { unlocatedStopIds: string[] } }>(`select optimization from tours where id = $1`, [tourId])).rows[0]!.optimization;
    expect(meta.unlocatedStopIds).toEqual([ids.none]);
  });
});
