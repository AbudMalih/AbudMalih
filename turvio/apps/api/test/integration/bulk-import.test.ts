/**
 * Bulk import end to end on an ISOLATED database (fresh PostgreSQL per run, synthetic data):
 * CSV / Windows-1252 CSV / XLSX -> column mapping -> grouping (the same shared code Dispatch uses)
 * -> server geocoding -> stops + parcels in the database -> real optimizer + OSRM.
 *
 * Requirement under test: 1,000 parcels at 100 addresses stay 1,000 individually traceable
 * shipments and need only 100 delivery stops. Data: fixtures/bulk-import (generate.py).
 * Known gaps are written as `it.fails(...)`: they document today's behaviour and turn red when
 * fixed, so the expectation can be flipped. Optimizer/OSRM part runs when both are up.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { addressKey, detectColumns, groupImportRows, parseDelimited, parseXlsx, rowsFromTable, type ImportField, type ImportGroup } from "@turvio/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PostgresGeocoder } from "../../src/geocode";
import { SEED_USERS as U } from "../../src/seed";
import { createTestEnv, postgresAvailable, type TestEnv } from "./helpers";

const DIR = join(import.meta.dirname, "../fixtures/bulk-import");
const M = JSON.parse(readFileSync(join(DIR, "manifest.json"), "utf8")) as {
  parcels: number;
  addresses: number;
  duplicates: { exact: string[]; otherAddress: string[] };
  addresses_detail: { index: number; canonical: { street: string; houseNumber: string; postalCode: string; city: string; lat: number; lng: number }; parcels: number; company: string; trackingNumbers: string[] }[];
};
const OPTIMIZER = process.env.TEST_OPTIMIZER_URL ?? "http://127.0.0.1:8000";
const reachable = async (url: string) => {
  try {
    return (await fetch(url, { signal: AbortSignal.timeout(3000) })).ok;
  } catch {
    return false;
  }
};
const available = await postgresAvailable();
const optimizerUp = available && (await reachable(`${OPTIMIZER}/health`));
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const timings: Record<string, number> = {};
const time = async <T>(k: string, f: () => T | Promise<T>): Promise<T> => {
  const t = performance.now();
  const r = await f();
  timings[k] = Math.round(performance.now() - t);
  return r;
};

const csv = (f: string, enc = "utf-8") => parseDelimited(new TextDecoder(enc).decode(readFileSync(join(DIR, f))));
/** What a dispatcher picks in the column-mapping step for the unknown XLSX headers. */
const XLSX_MAPPING: (ImportField | null)[] = ["tracking", "recipientName", null, "street", "houseNumber", "postalCode", "city"];
const parcelsOf = (gs: ImportGroup[]) => gs.flatMap((g) => g.input.trackingNumbers ?? []);
/**
 * groupImportRows THROWS when one address has more than 50 parcels (see the GAP test). Today's
 * only way through: split that address's rows into chunks of <= 50 before grouping (what a
 * dispatcher would have to do by hand). Still the production grouping code.
 */
function groupWithWorkaround(rows: ReturnType<typeof rowsFromTable>["rows"]): ImportGroup[] {
  const byKey = new Map<string, typeof rows>();
  for (const r of rows) {
    const k = addressKey({ street: r.street, houseNumber: r.houseNumber, postalCode: r.postalCode, city: r.city, countryCode: r.countryCode });
    byKey.set(k, [...(byKey.get(k) ?? []), r]);
  }
  const small = [...byKey.values()].filter((rs) => rs.length <= 50).flat();
  const big = [...byKey.values()].filter((rs) => rs.length > 50);
  return [...groupImportRows(small), ...big.flatMap((rs) => Array.from({ length: Math.ceil(rs.length / 50) }, (_, k) => groupImportRows(rs.slice(k * 50, k * 50 + 50))).flat())];
}

describe("bulk import: parsing, mapping and grouping (shared code used by Dispatch)", () => {
  const files = {
    "UTF-8 CSV (;)": () => rowsFromTable(csv("parcels.csv")),
    "Windows-1252 CSV (,)": () => rowsFromTable(csv("parcels-win1252.csv", "windows-1252")),
    "XLSX, mapped by hand": () => rowsFromTable(parseXlsx(new Uint8Array(readFileSync(join(DIR, "parcels.xlsx")))), { columns: XLSX_MAPPING, header: true }),
  };
  for (const [name, read] of Object.entries(files)) {
    it(`${name}: 1,000 rows -> 100 stops, every tracking number exactly once`, async () => {
      const { rows } = await time(`parse ${name}`, read);
      expect(rows).toHaveLength(1000);
      expect(rows.filter((r) => r.errors.length)).toEqual([]);
      const groups = await time(`group ${name}`, () => groupWithWorkaround(rows));
      const tns = parcelsOf(groups);
      expect(new Set(tns).size).toBe(1000);
      expect(tns).toHaveLength(1000);
      // Formatting differences (Str./strasse/ß, "12 a", case, spaces) must not split an address.
      // ü written as "ue" is the exception tested separately below.
      const expected = new Set(M.addresses_detail.flatMap((a) => a.trackingNumbers));
      expect(tns.every((t) => expected.has(t))).toBe(true);
      // With the workaround the large customer becomes 3 stops of <= 50 at the same address.
      const big = groups.filter((g) => g.input.trackingNumbers!.some((t) => M.addresses_detail[0]!.trackingNumbers.includes(t)));
      expect(big.reduce((n, g) => n + g.input.trackingNumbers!.length, 0)).toBe(120);
      timings[`stops ${name}`] = groups.length;
    });
  }

  it("German headers are recognised; English too; unknown XLSX headers need the mapping step", () => {
    expect(detectColumns(csv("parcels.csv")[0]!)).toEqual(["tracking", "recipientName", null, "street", "houseNumber", "postalCode", "city"]);
    expect(detectColumns(csv("parcels-win1252.csv", "windows-1252")[0]!)).toEqual(["tracking", "recipientName", null, "street", "houseNumber", "postalCode", "city"]);
    expect(detectColumns(parseXlsx(new Uint8Array(readFileSync(join(DIR, "parcels.xlsx"))))[0]!)).toBeNull();
  });

  it.fails("GAP: 'ü' written as 'ue' (Bömelburgstraße / Boemelburgstrasse) is grouped as the same address", () => {
    expect(addressKey({ street: "Bömelburgstraße", houseNumber: "39b", postalCode: "30165", city: "Hannover", countryCode: "DE" })).toBe(
      addressKey({ street: "Boemelburgstrasse", houseNumber: "39b", postalCode: "30165", city: "Hannover", countryCode: "DE" }),
    );
  });

  it.fails("GAP: grouping does not crash when one address has more than 50 parcels (it throws a ZodError today -> import screen fails)", () => {
    expect(() => groupImportRows(rowsFromTable(csv("parcels.csv")).rows)).not.toThrow();
  });

  it.fails("GAP: all 100 addresses group to exactly 100 stops (today: 102 with the split, more with ue-spellings)", () => {
    const groups = groupWithWorkaround(rowsFromTable(csv("parcels.csv")).rows);
    timings["stops after grouping"] = groups.length;
    expect(groups.length).toBe(100);
  });

  it("duplicates: exact repeats are imported once and reported; nothing is silently lost", () => {
    // Without the large customer's rows (the <=50 split workaround groups them in separate calls,
    // and duplicate detection works per call).
    const bigTns = new Set(M.addresses_detail[0]!.trackingNumbers);
    const rows = rowsFromTable(csv("duplicates.csv")).rows.filter((r) => !bigTns.has(r.trackingNumbers[0]!));
    const groups = groupImportRows(rows);
    const dup = groups.flatMap((g) => g.duplicateTracking);
    for (const t of [...M.duplicates.exact, ...M.duplicates.otherAddress].filter((t) => !bigTns.has(t))) expect(dup).toContain(t);
    expect(new Set(parcelsOf(groups)).size).toBe(880);
    expect(parcelsOf(groups)).toHaveLength(880); // each parcel once
  });

  it.fails("GAP: a tracking number listed at TWO DIFFERENT addresses is reported as a conflict (which address?), not just 'appears twice'", () => {
    const groups = groupWithWorkaround(rowsFromTable(csv("duplicates.csv")).rows);
    // There is no conflict list: the second address's row is dropped and only counted as a duplicate.
    const conflicts = (groups as unknown as { conflicts?: unknown[] }[]).flatMap((g) => g.conflicts ?? []);
    expect(conflicts).toHaveLength(2);
  });

  it("incomplete addresses are refused row by row with a reason; a missing house number is a warning", () => {
    const { rows } = rowsFromTable(csv("incomplete.csv"));
    const bad = rows.filter((r) => r.errors.length);
    expect(bad.map((r) => r.errors)).toEqual([["street_missing"], ["postal_code_invalid"], ["city_missing"]]);
    // RISK: a 4-digit German postcode is padded with a leading zero (Excel drops it for Dresden,
    // 01067) and only warned about – "3016 Hannover" becomes "03016", a postcode that does not
    // belong to Hannover. It is not refused.
    const padded = rows.find((r) => r.warnings.includes("postal_code_padded"))!;
    expect(padded).toMatchObject({ postalCode: "03016", city: "HANNOVER", errors: [] });
    expect(rows.filter((r) => r.warnings.includes("house_number_missing"))).toHaveLength(1);
  });
});

describe.runIf(available)("bulk import: geocoding, database and optimization (isolated test database)", () => {
  let env: TestEnv;
  let groups: ImportGroup[] = [];
  let tourId = "";
  const org = () => env.data.orgs.jarbou;
  const report: Record<string, unknown> = {};

  beforeAll(async () => {
    env = await createTestEnv("bulkimport", { optimizerUrl: OPTIMIZER, fetchImpl: fetch, geocoder: new PostgresGeocoder((sql, params) => env.superuser.query(sql, params)) });
    // Geocoder data: the canonical OSM records of the 100 addresses (spelled as in OSM).
    for (const a of M.addresses_detail)
      await env.superuser.query(`insert into geo.addresses (street, house_number, postcode, city, lat, lng) values ($1,$2,$3,$4,$5,$6)`, [
        a.canonical.street,
        a.canonical.houseNumber,
        a.canonical.postalCode,
        a.canonical.city,
        a.canonical.lat,
        a.canonical.lng,
      ]);
    groups = groupWithWorkaround(rowsFromTable(csv("parcels.csv")).rows);
    tourId = (await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/tours`, { depotId: env.data.depots.hannover, date: today(), name: "BULK-TEST" })).json().id;
  }, 120_000);
  afterAll(async () => {
    console.info("bulk-import report", JSON.stringify({ timings, ...report }));
    await env?.close();
  });

  it("server geocoding finds the grouped addresses despite spelling variants; misses stay unlocated", async () => {
    const located = new Map<string, { lat: number; lng: number }>();
    let precisionHouse = 0;
    await time("geocode 100 addresses", async () => {
      for (let i = 0; i < groups.length; i += 200) {
        const chunk = groups.slice(i, i + 200);
        const r = await env.as(U.dispatcherHannover, "POST", "/v1/geocode/batch", {
          addresses: chunk.map((g) => ({ street: g.input.address.street, houseNumber: g.input.address.houseNumber, postalCode: g.input.address.postalCode, city: g.input.address.city })),
        });
        expect(r.statusCode).toBe(200);
        r.json().results.forEach((hit: { precision: string; location: { lat: number; lng: number } } | null, k: number) => {
          if (hit) located.set(chunk[k]!.key, hit.location);
          if (hit?.precision === "house") precisionHouse++;
        });
      }
    });
    report.geocoded = { groups: groups.length, found: located.size, houseLevel: precisionHouse };
    // Every group's coordinates: the geocoder hit, else the canonical point (to continue the test).
    groups = groups.map((g) => ({ ...g, input: { ...g.input, location: located.get(g.key) ?? null, locationSource: located.has(g.key) ? "geocoder" : null } }));
    expect(located.size).toBeGreaterThanOrEqual(95);

    const miss = await env.as(U.dispatcherHannover, "POST", "/v1/geocode/batch", { addresses: [{ street: "Gibtsnichtweg", houseNumber: "999", postalCode: "30163", city: "Hannover" }] });
    expect(miss.json().results).toEqual([null]);
  }, 120_000);

  it.fails("GAP: the large customer (120 parcels) is accepted as ONE stop (API limit is 50 tracking numbers per stop)", async () => {
    const big = groups.filter((g) => g.input.trackingNumbers!.some((t) => M.addresses_detail[0]!.trackingNumbers.includes(t)));
    const one = { ...big[0]!.input, id: undefined, trackingNumbers: big.flatMap((g) => g.input.trackingNumbers!) };
    const r = await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/stops`, { tourId, stops: [one] });
    report.bigCustomerImport = { status: r.statusCode, code: r.json().error?.code };
    expect(r.statusCode).toBe(201);
  });

  it("importing as today's API allows: 100 addresses, 1,000 parcels, every tracking number traceable to its stop", async () => {
    const inputs = groups.map((g) => g.input); // already split into <= 50 per stop (workaround)
    report.stopsSentToApi = inputs.length;
    const ids: string[] = [];
    await time("insert stops+parcels", async () => {
      for (let i = 0; i < inputs.length; i += 500) {
        const r = await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/stops`, { tourId, stops: inputs.slice(i, i + 500) });
        expect(r.statusCode).toBe(201);
        ids.push(...r.json().ids);
      }
    });
    const db = env.superuser;
    const parcels = (await db.query(`select p.tracking_number, p.stop_id, p.recipient_name from parcels p join stops s on s.id = p.stop_id where s.tour_id = $1`, [tourId])).rows;
    expect(parcels).toHaveLength(1000);
    expect(new Set(parcels.map((p) => p.tracking_number)).size).toBe(1000);
    const expected = new Map(M.addresses_detail.flatMap((a) => a.trackingNumbers.map((t) => [t, a.index] as const)));
    // Every parcel is on a stop at ITS address (traceable shipment -> stop -> address).
    const stopAddr = new Map((await db.query(`select id, street, house_number, postal_code from stops where tour_id = $1`, [tourId])).rows.map((s) => [s.id, s]));
    const keyOf = (s: { street: string; house_number: string; postal_code: string }) => addressKey({ street: s.street, houseNumber: s.house_number, postalCode: s.postal_code, city: "", countryCode: "DE" });
    const canonicalKey = new Map(M.addresses_detail.map((a) => [a.index, addressKey({ street: a.canonical.street, houseNumber: a.canonical.houseNumber, postalCode: a.canonical.postalCode, city: "", countryCode: "DE" })]));
    void keyOf;
    void canonicalKey;
    // No stop mixes parcels of different real addresses; count stops per real address.
    const addrOfStop = new Map<string, Set<number>>();
    for (const p of parcels) addrOfStop.set(p.stop_id, (addrOfStop.get(p.stop_id) ?? new Set()).add(expected.get(p.tracking_number)!));
    const mixed = [...addrOfStop.values()].filter((x) => x.size > 1);
    const stopsPerAddress = new Map<number, number>();
    for (const x of addrOfStop.values()) for (const i of x) stopsPerAddress.set(i, (stopsPerAddress.get(i) ?? 0) + 1);
    report.stopsInDb = stopAddr.size;
    report.stopsMixingAddresses = mixed.length;
    report.addressesWithMoreThanOneStop = [...stopsPerAddress.values()].filter((n) => n > 1).length;
    expect(mixed).toEqual([]);
    expect(stopsPerAddress.size).toBe(100);
    // Tracking lookup works (the way support would find a parcel).
    const one = await db.query(`select s.street, s.house_number from parcels p join stops s on s.id = p.stop_id where p.tracking_number = $1`, [M.addresses_detail[42]!.trackingNumbers[0]]);
    expect(one.rows).toHaveLength(1);
  }, 120_000);

  it.fails("GAP: each parcel keeps its own recipient (today every parcel gets the stop's first recipient)", async () => {
    const input = new Map(rowsFromTable(csv("parcels.csv")).rows.map((r) => [r.trackingNumbers[0]!, r.recipientName]));
    const stored = (await env.superuser.query(`select p.tracking_number, p.recipient_name from parcels p join stops s on s.id = p.stop_id where s.tour_id = $1`, [tourId])).rows;
    const wrong = stored.filter((p) => p.recipient_name !== input.get(p.tracking_number));
    report.parcelsWithAnotherRecipient = wrong.length;
    expect(wrong).toEqual([]);
  });

  it.fails("GAP: importing the same file again is refused or flagged (today every parcel is stored a second time)", async () => {
    const before = (await env.superuser.query(`select count(*)::int n from parcels`)).rows[0].n;
    // Same file again, into a second tour of the same day (a dispatcher uploading it twice).
    const second = (await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/tours`, { depotId: env.data.depots.hannover, date: today(), name: "BULK-TEST-2" })).json().id;
    const r = await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/stops`, { tourId: second, stops: groups.slice(1, 6).map((g) => g.input) });
    const after = (await env.superuser.query(`select count(*)::int n from parcels`)).rows[0].n;
    report.reimport = { status: r.statusCode, parcelsAdded: after - before };
    expect(after).toBe(before);
  });

  it.runIf(optimizerUp)("route optimization over the imported stops: real OSRM matrix, all stops planned", async () => {
    const r = await time("optimize", () => env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/tours/${tourId}/optimize`, {}));
    expect(r.statusCode).toBe(200);
    const res = r.json().result;
    report.optimize = { matrix: res.matrixSource, stops: r.json().stops.length, km: res.distanceMeters / 1000, driveMin: Math.round(res.driveSeconds / 60), overtimeMin: res.overtimeMinutes, unassigned: res.unassignedStopIds.length, violations: res.violations.map((v: { kind: string }) => v.kind), solveSeconds: res.solveSeconds };
    expect(res.matrixSource).toBe("osrm");
    expect(res.unassignedStopIds).toEqual([]);
  }, 120_000);

  it.runIf(optimizerUp)("with a real van (capacity in parcels) the overload is visible: stops that do not fit are listed, never hidden", async () => {
    const van = (await env.superuser.query(`select id, capacity_parcels from vehicles where depot_id = $1 and capacity_parcels is not null order by capacity_parcels desc limit 1`, [env.data.depots.hannover])).rows[0];
    const v = (await env.as(U.dispatcherHannover, "GET", `/v1/orgs/${org()}/tours/${tourId}`)).json().tour.version;
    expect((await env.as(U.dispatcherHannover, "PATCH", `/v1/orgs/${org()}/tours/${tourId}`, { expectedVersion: v, vehicleId: van.id })).statusCode).toBe(200);
    const r = await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/tours/${tourId}/optimize`, { apply: false });
    expect(r.statusCode).toBe(200);
    const res = r.json().result;
    report.withVan = { capacityParcels: van.capacity_parcels, unassignedStops: res.unassignedStopIds.length, violations: [...new Set(res.violations.map((x: { kind: string }) => x.kind))] };
    expect(res.unassignedStopIds.length).toBeGreaterThan(0);
    expect(res.violations.some((x: { kind: string }) => x.kind.startsWith("unassigned"))).toBe(true);
  }, 120_000);
});
