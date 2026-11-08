/**
 * Bulk import ACCEPTANCE TEST on an isolated database (fresh PostgreSQL per run, synthetic data):
 * CSV / Windows-1252 CSV / XLSX -> column mapping -> import plan (the same shared code Dispatch and
 * the driver app use) -> postcode check + server geocoding -> stops and parcels in the database ->
 * real optimizer + OSRM (when running).
 *
 * Requirement: 1,000 parcels at 100 addresses stay 1,000 individually traceable shipments (own
 * tracking number, recipient and company) and need exactly 100 delivery stops. Data:
 * fixtures/bulk-import (generate.py).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { detectColumns, parseDelimited, parseXlsx, planImport, rowsFromTable, type ImportField, type ImportGroup, type ImportRow } from "@turvio/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PostgresGeocoder } from "../../src/geocode";
import { SEED_USERS as U } from "../../src/seed";
import { createTestEnv, postgresAvailable, type TestEnv } from "./helpers";

const DIR = join(import.meta.dirname, "../fixtures/bulk-import");
type Canonical = { street: string; houseNumber: string; postalCode: string; city: string; lat: number; lng: number };
const M = JSON.parse(readFileSync(join(DIR, "manifest.json"), "utf8")) as {
  duplicates: { exact: string[]; otherAddress: string[] };
  addresses_detail: { index: number; canonical: Canonical; parcels: number; company: string; trackingNumbers: string[] }[];
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
if (available && !optimizerUp) console.warn(`bulk-import: optimizer at ${OPTIMIZER} not reachable – the optimization step is skipped`);
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const timings: Record<string, number> = {};
const time = async <T>(k: string, f: () => T | Promise<T>): Promise<T> => {
  const t = performance.now();
  const r = await f();
  timings[k] = Math.round(performance.now() - t);
  return r;
};

const csv = (f: string, enc = "utf-8") => parseDelimited(new TextDecoder(enc).decode(readFileSync(join(DIR, f))));
const xlsx = () => parseXlsx(new Uint8Array(readFileSync(join(DIR, "parcels.xlsx"))));
/** What a dispatcher picks in the column-mapping step for the XLSX's unknown headers. */
const XLSX_MAPPING: (ImportField | null)[] = ["tracking", "recipientName", "company", "street", "houseNumber", "postalCode", "city"];
const parcelsOf = (gs: ImportGroup[]) => gs.flatMap((g) => g.input.parcels ?? []);
/** Source of truth per tracking number: recipient, company and real address (from the generator). */
const truth = (rows: ImportRow[]) => new Map(rows.map((r) => [r.trackingNumbers[0]!, { recipientName: r.recipientName, company: r.company }]));
const addressOf = new Map(M.addresses_detail.flatMap((a) => a.trackingNumbers.map((t) => [t, a.index] as const)));

describe("bulk import: parsing, mapping and the import plan", () => {
  const files: Record<string, () => ImportRow[]> = {
    "UTF-8 CSV (;)": () => rowsFromTable(csv("parcels.csv")).rows,
    "Windows-1252 CSV (,)": () => rowsFromTable(csv("parcels-win1252.csv", "windows-1252")).rows,
    "XLSX, mapped by hand": () => rowsFromTable(xlsx(), { columns: XLSX_MAPPING, header: true }).rows,
  };
  for (const [name, read] of Object.entries(files)) {
    it(`${name}: 1,000 parcels -> exactly 100 stops, every parcel with its own recipient and company`, async () => {
      const rows = await time(`parse ${name}`, read);
      expect(rows).toHaveLength(1000);
      expect(rows.filter((r) => r.errors.length)).toEqual([]);
      const plan = await time(`plan ${name}`, () => planImport(rows));
      expect(plan).toMatchObject({ unresolved: 0, blockingGroups: 0, duplicates: [], conflicts: [] });
      expect(plan.groups).toHaveLength(100);
      const parcels = parcelsOf(plan.groups);
      expect(parcels).toHaveLength(1000);
      expect(new Set(parcels.map((p) => p.trackingNumber)).size).toBe(1000);
      // No stop mixes addresses, every address is one stop.
      for (const g of plan.groups) expect(new Set(g.input.parcels!.map((p) => addressOf.get(p.trackingNumber))).size).toBe(1);
      // Zero wrong recipients or companies.
      const t = truth(rows);
      const wrong = parcels.filter((p) => p.recipientName !== t.get(p.trackingNumber)!.recipientName || p.company !== t.get(p.trackingNumber)!.company);
      expect(wrong).toEqual([]);
      // The large customer: 120 parcels, one stop.
      const big = plan.groups.find((g) => g.input.parcels!.some((p) => p.trackingNumber === M.addresses_detail[0]!.trackingNumbers[0]))!;
      expect(big.input.parcels).toHaveLength(120);
    });
  }

  it("headers: German and English recognised (recipient and company separately); unknown XLSX headers need the mapping step", () => {
    const expected = ["tracking", "recipientName", "company", "street", "houseNumber", "postalCode", "city"];
    expect(detectColumns(csv("parcels.csv")[0]!)).toEqual(expected);
    expect(detectColumns(csv("parcels-win1252.csv", "windows-1252")[0]!)).toEqual(expected);
    expect(detectColumns(xlsx()[0]!)).toBeNull();
  });

  it("duplicates file: exact repeats are one parcel and listed; a tracking number at two addresses is a conflict that blocks until resolved", () => {
    const rows = rowsFromTable(csv("duplicates.csv")).rows;
    const open = planImport(rows);
    expect(open.duplicates.map((d) => d.trackingNumber).sort()).toEqual([...M.duplicates.exact].sort());
    expect(open.conflicts.map((c) => c.trackingNumber).sort()).toEqual([...M.duplicates.otherAddress].sort());
    expect(open.unresolved).toBe(2);
    // Until resolved the two conflicting parcels are not in any stop – and they are listed, not lost.
    expect(parcelsOf(open.groups)).toHaveLength(998);
    // Resolve: keep each at its first (true) address -> all 1,000 parcels, 100 stops, nothing doubled.
    const resolutions = Object.fromEntries(open.conflicts.map((c) => [c.trackingNumber, c.options[0]!.line]));
    const done = planImport(rows, resolutions);
    expect(done.unresolved).toBe(0);
    expect(done.groups).toHaveLength(100);
    expect(parcelsOf(done.groups)).toHaveLength(1000);
    for (const t of M.duplicates.otherAddress) {
      const g = done.groups.find((x) => x.input.parcels!.some((p) => p.trackingNumber === t))!;
      expect(g.input.parcels!.find((p) => p.trackingNumber === t)!.recipientName).not.toBe("Wrong Address");
    }
  });

  it("incomplete addresses: refused row by row with a reason; a 4-digit postcode is never padded silently", () => {
    const rows = rowsFromTable(csv("incomplete.csv")).rows.slice(20);
    expect(rows.map((r) => r.errors)).toEqual([["street_missing"], ["postal_code_invalid"], ["city_missing"], ["postal_code_4_digits"], [], []]);
    expect(rows[3]).toMatchObject({ postalCode: "3016", postalCodeSuggestion: "03016" });
    expect(rows[4]!.warnings).toContain("house_number_missing");
  });
});

describe.runIf(available)("bulk import: postcode check, geocoding, database, re-import and optimization (isolated test database)", () => {
  let env: TestEnv;
  let rows: ImportRow[] = [];
  let groups: ImportGroup[] = [];
  let tourId = "";
  let otherTourParcelsBefore: { id: string; tracking_number: string; recipient_name: string | null }[] = [];
  const org = () => env.data.orgs.jarbou;
  const report: Record<string, unknown> = {};

  beforeAll(async () => {
    env = await createTestEnv("bulkimport", { optimizerUrl: OPTIMIZER, fetchImpl: fetch, geocoder: new PostgresGeocoder((sql, params) => env.superuser.query(sql, params) as never) });
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
    // A Dresden address, so "1067 Dresden" can be verified as "01067".
    await env.superuser.query(`insert into geo.addresses (street, house_number, postcode, city, lat, lng) values ('Schloßstraße', '1', '01067', 'Dresden', 51.0525, 13.7373)`);
    rows = rowsFromTable(csv("parcels.csv")).rows;
    groups = planImport(rows).groups;
    tourId = (await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/tours`, { depotId: env.data.depots.hannover, date: today(), name: "BULK-TEST" })).json().id;
    otherTourParcelsBefore = (await env.superuser.query(`select id, tracking_number, recipient_name from parcels order by id`)).rows;
  }, 120_000);
  afterAll(async () => {
    console.info("bulk-import report", JSON.stringify({ timings, ...report }));
    await env?.close();
  });

  it("postcode check: matching city ok, wrong city refused, unknown postcode reported, padded suggestion verifiable", async () => {
    const r = await env.as(U.dispatcherHannover, "POST", "/v1/geocode/postcodes", {
      pairs: [
        { postalCode: "30163", city: "HANNOVER" },
        { postalCode: "30163", city: "Bremen" },
        { postalCode: "03016", city: "Hannover" },
        { postalCode: "01067", city: "Dresden" },
      ],
    });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toMatchObject({
      available: true,
      results: [{ status: "ok" }, { status: "mismatch", knownCities: ["Hannover"] }, { status: "unknown" }, { status: "ok" }],
    });
    expect((await env.app.inject({ method: "POST", url: "/v1/geocode/postcodes", payload: { pairs: [{ postalCode: "30163", city: "Hannover" }] } })).statusCode).toBe(401);
  });

  it("server geocoding finds all 100 grouped addresses despite spelling variants; a non-existent one stays unlocated", async () => {
    const located = new Map<string, { lat: number; lng: number }>();
    let house = 0;
    await time("geocode 100 addresses", async () => {
      const r = await env.as(U.dispatcherHannover, "POST", "/v1/geocode/batch", {
        addresses: groups.map((g) => ({ street: g.input.address.street, houseNumber: g.input.address.houseNumber, postalCode: g.input.address.postalCode, city: g.input.address.city })),
      });
      expect(r.statusCode).toBe(200);
      r.json().results.forEach((hit: { precision: string; location: { lat: number; lng: number } } | null, k: number) => {
        if (hit) located.set(groups[k]!.key, hit.location);
        if (hit?.precision === "house") house++;
      });
    });
    report.geocoded = { stops: groups.length, found: located.size, houseLevel: house };
    expect(located.size).toBe(100);
    groups = groups.map((g) => ({ ...g, input: { ...g.input, location: located.get(g.key)!, locationSource: "geocoder" } }));
    const miss = await env.as(U.dispatcherHannover, "POST", "/v1/geocode/batch", { addresses: [{ street: "Gibtsnichtweg", houseNumber: "999", postalCode: "30163", city: "Hannover" }] });
    expect(miss.json().results).toEqual([null]);
  });

  it("pre-check: none of the 1,000 tracking numbers is in TURVIO yet", async () => {
    const r = await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/parcels/lookup`, { trackingNumbers: parcelsOf(groups).map((p) => p.trackingNumber) });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({ found: [], blocking: 0 });
  });

  it("import: 100 stops, 1,000 parcels, each traceable to its stop with its own recipient and company", async () => {
    const r = await time("save 100 stops + 1,000 parcels", () => env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/stops`, { tourId, stops: groups.map((g) => g.input), rejectPlannedTracking: true }));
    expect(r.statusCode).toBe(201);
    expect(r.json().ids).toHaveLength(100);
    const db = env.superuser;
    const parcels = (await db.query(`select p.tracking_number, p.stop_id, p.recipient_name, p.company from parcels p join stops s on s.id = p.stop_id where s.tour_id = $1`, [tourId])).rows;
    expect(parcels).toHaveLength(1000);
    expect(new Set(parcels.map((p) => p.tracking_number)).size).toBe(1000);
    const t = truth(rows);
    const wrong = parcels.filter((p) => (p.recipient_name ?? undefined) !== t.get(p.tracking_number)!.recipientName || (p.company ?? undefined) !== t.get(p.tracking_number)!.company);
    report.wrongRecipientOrCompany = wrong.length;
    expect(wrong).toEqual([]);
    const stopsPerAddress = new Map<number, Set<string>>();
    for (const p of parcels) stopsPerAddress.set(addressOf.get(p.tracking_number)!, (stopsPerAddress.get(addressOf.get(p.tracking_number)!) ?? new Set()).add(p.stop_id));
    expect(stopsPerAddress.size).toBe(100);
    expect([...stopsPerAddress.values()].every((s) => s.size === 1)).toBe(true);
    // The API returns the parcels with their own recipient and company, in file order.
    const tour = (await env.as(U.dispatcherHannover, "GET", `/v1/orgs/${org()}/tours/${tourId}`)).json();
    const bigStop = tour.stops.find((s: { parcels: { trackingNumber: string }[] }) => s.parcels.some((p) => p.trackingNumber === M.addresses_detail[0]!.trackingNumbers[0]));
    expect(bigStop.parcels).toHaveLength(120);
    expect(bigStop.parcels.map((p: { trackingNumber: string }) => p.trackingNumber)).toEqual(groups.find((g) => g.input.parcels!.length === 120)!.input.parcels!.map((p) => p.trackingNumber));
    expect(bigStop.parcels[0].company).toBe("Großhandel Leinetal GmbH (Wareneingang)");
  }, 120_000);

  it("re-import of the same file: refused with the existing tours listed, nothing saved twice", async () => {
    const second = (await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/tours`, { depotId: env.data.depots.hannover, date: today(), name: "BULK-TEST-2" })).json().id;
    const before = (await env.superuser.query(`select count(*)::int n from parcels`)).rows[0].n;
    const r = await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/stops`, { tourId: second, stops: groups.map((g) => g.input), rejectPlannedTracking: true });
    expect(r.statusCode).toBe(409);
    expect(r.json().error).toMatchObject({ code: "tracking_already_planned", count: 1000 });
    expect(r.json().error.parcels[0]).toMatchObject({ blocking: true, tourName: "BULK-TEST", stopStatus: "pending" });
    expect((await env.superuser.query(`select count(*)::int n from parcels`)).rows[0].n).toBe(before);
    expect((await env.superuser.query(`select count(*)::int n from stops where tour_id = $1`, [second])).rows[0].n).toBe(0);
    // The pre-check says the same before anything is sent.
    const look = (await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/parcels/lookup`, { trackingNumbers: [M.addresses_detail[3]!.trackingNumbers[0], "NOT-IN-TURVIO-1"] })).json();
    expect(look.blocking).toBe(1);
    expect(look.found[0]).toMatchObject({ trackingNumber: M.addresses_detail[3]!.trackingNumbers[0], tourName: "BULK-TEST" });
    // Case does not matter.
    expect((await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/parcels/lookup`, { trackingNumbers: [M.addresses_detail[3]!.trackingNumbers[0]!.toLowerCase()] })).json().blocking).toBe(1);
  });

  it("company-wide: another depot's dispatcher is also stopped (without seeing that tour); another company sees nothing", async () => {
    const t = M.addresses_detail[5]!.trackingNumbers[0]!;
    const bremen = (await env.as(U.dispatcherBremen, "POST", `/v1/orgs/${org()}/parcels/lookup`, { trackingNumbers: [t] })).json();
    expect(bremen.blocking).toBe(1);
    expect(bremen.found[0]).toMatchObject({ trackingNumber: t, tourName: null, tourId: null });
    expect((await env.as(U.musterOwner, "POST", `/v1/orgs/${org()}/parcels/lookup`, { trackingNumbers: [t] })).statusCode).toBe(403);
    // Muster's own lookup does not reveal JARBOU's parcels.
    const muster = (await env.as(U.musterOwner, "POST", `/v1/orgs/${env.data.orgs.muster}/parcels/lookup`, { trackingNumbers: [t] })).json();
    expect(muster.found).toEqual([]);
  });

  it("re-delivery stays possible: a parcel whose earlier stop failed is reported but not blocking", async () => {
    const t = M.addresses_detail[9]!.trackingNumbers[0]!;
    await env.superuser.query(`update stops set status = 'failed', failure_reason = 'not_home' where id = (select stop_id from parcels where tracking_number = $1)`, [t]).catch(async () =>
      env.superuser.query(`update stops set status = 'failed' where id = (select stop_id from parcels where tracking_number = $1)`, [t]),
    );
    const look = (await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/parcels/lookup`, { trackingNumbers: [t] })).json();
    expect(look).toMatchObject({ blocking: 0, found: [{ trackingNumber: t, stopStatus: "failed", blocking: false }] });
  });

  it("a tracking number twice in one import request is refused (409), nothing saved", async () => {
    const dup = { address: { street: "Teststraße", houseNumber: "1", postalCode: "30159", city: "Hannover" }, location: { lat: 52.37, lng: 9.73 }, parcels: [{ trackingNumber: "TVODUPREQ0001" }, { trackingNumber: "tvodupreq0001" }] };
    const r = await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/stops`, { tourId, stops: [dup], rejectPlannedTracking: true });
    expect(r.statusCode).toBe(409);
    expect(r.json().error.code).toBe("tracking_duplicated_in_request");
  });

  it("backward compatible: the old request shape (tracking numbers only, no flag) still works, and offline replays stay idempotent", async () => {
    const id = "6f1b8c1e-1d2a-4c3b-9a0e-000000000001";
    const stop = { id, address: { street: "Teststraße", houseNumber: "2", postalCode: "30159", city: "Hannover" }, location: { lat: 52.371, lng: 9.731 }, recipientName: "Alt", trackingNumbers: ["TVOOLDSHAPE01", "TVOOLDSHAPE02"] };
    expect((await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/stops`, { tourId, stops: [stop] })).statusCode).toBe(201);
    expect((await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/stops`, { tourId, stops: [{ ...stop, trackingNumbers: ["TVOOLDSHAPE01", "TVOOLDSHAPE02", "TVOOLDSHAPE03"] }] })).statusCode).toBe(201);
    const p = (await env.superuser.query(`select tracking_number, recipient_name from parcels where stop_id = $1 order by tracking_number`, [id])).rows;
    expect(p).toEqual([
      { tracking_number: "TVOOLDSHAPE01", recipient_name: "Alt" },
      { tracking_number: "TVOOLDSHAPE02", recipient_name: "Alt" },
      { tracking_number: "TVOOLDSHAPE03", recipient_name: "Alt" },
    ]);
  });

  it("existing tours and parcels are unchanged by all of this", async () => {
    const now = (await env.superuser.query(`select id, tracking_number, recipient_name from parcels where id = any($1::uuid[]) order by id`, [otherTourParcelsBefore.map((p) => p.id)])).rows;
    expect(now).toEqual(otherTourParcelsBefore);
  });

  it.runIf(optimizerUp)("route optimization over the 100 grouped stops: real OSRM matrix, all planned", async () => {
    await env.superuser.query(`delete from stops where tour_id = $1 and id = '6f1b8c1e-1d2a-4c3b-9a0e-000000000001'`, [tourId]);
    const r = await time("optimize 100 stops", () => env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/tours/${tourId}/optimize`, {}));
    expect(r.statusCode).toBe(200);
    const res = r.json().result;
    report.optimize = { matrix: res.matrixSource, stops: r.json().stops.length, km: res.distanceMeters / 1000, driveMin: Math.round(res.driveSeconds / 60), unassigned: res.unassignedStopIds.length, violations: res.violations.length, solveSeconds: res.solveSeconds };
    expect(res.matrixSource).toBe("osrm");
    expect(r.json().stops).toHaveLength(100);
    expect(res.unassignedStopIds).toEqual([]);
  }, 120_000);

  it.runIf(optimizerUp)("with a real van (capacity in parcels) the overload is listed, never hidden", async () => {
    const van = (await env.superuser.query(`select id, capacity_parcels from vehicles where depot_id = $1 and capacity_parcels is not null order by capacity_parcels desc limit 1`, [env.data.depots.hannover])).rows[0];
    const v = (await env.as(U.dispatcherHannover, "GET", `/v1/orgs/${org()}/tours/${tourId}`)).json().tour.version;
    expect((await env.as(U.dispatcherHannover, "PATCH", `/v1/orgs/${org()}/tours/${tourId}`, { expectedVersion: v, vehicleId: van.id })).statusCode).toBe(200);
    const res = (await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/tours/${tourId}/optimize`, { apply: false })).json().result;
    report.withVan = { capacityParcels: van.capacity_parcels, unassignedStops: res.unassignedStopIds.length };
    expect(res.unassignedStopIds.length).toBeGreaterThan(0);
    expect(res.violations.some((x: { kind: string }) => x.kind.startsWith("unassigned"))).toBe(true);
  }, 120_000);
});
