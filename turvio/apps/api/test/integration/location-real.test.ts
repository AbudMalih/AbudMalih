import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { StopLocationCheck } from "@turvio/shared";
import { LocationChecker, type CheckStop } from "../../src/location-check";
import { OsrmRouting } from "../../src/routing";
import fixture from "../fixtures/osm-addresses.json";

/**
 * Location checks on REAL Hannover roads (P0-3.1): needs an OSRM with the Region Hannover graph
 * (TEST_OSRM_URL, default http://127.0.0.1:5001); skipped otherwise, like the real-optimizer suite.
 * Addresses and coordinates: OpenStreetMap (ODbL).
 */
const OSRM = process.env.TEST_OSRM_URL ?? "http://127.0.0.1:5001";
async function reachable(url: string) {
  try {
    return (await fetch(url, { signal: AbortSignal.timeout(3000) })).ok;
  } catch {
    return false;
  }
}
const available = await reachable(`${OSRM}/nearest/v1/driving/9.73,52.37`);
const DEPOT = { lat: 52.3759, lng: 9.732 }; // Hannover, Ernst-August-Platz
const at = (id: string, street: string, houseNumber: string, postalCode: string, lat: number, lng: number): CheckStop => ({
  id,
  location: { lat, lng },
  address: { street, houseNumber, postalCode, city: "Hannover", countryCode: "DE" },
});
const codes = (c: StopLocationCheck) => c.issues.map((i) => `${i.severity}:${i.code}`);

describe.runIf(available)("location checks on real Hannover roads (OSRM)", () => {
  const routing = new OsrmRouting(OSRM, { timeoutMs: 20_000 });
  const checker = new LocationChecker(routing, undefined, { budgetMs: 30_000 });

  it("legitimate deliveries are never errors or warnings: pedestrian zone, residents-only streets", async () => {
    const stops = [
      at("bahnhof13", "Bahnhofstraße", "13", "30159", 52.375038, 9.7388577),
      at("karmarsch14", "Karmarschstraße", "14", "30159", 52.3737659, 9.7378792),
      at("georg21", "Georgstraße", "21", "30159", 52.375391, 9.7354527),
      at("henckell29", "Henckellweg", "29", "30459", 52.3471528, 9.7279895),
      at("kueck7", "Kückstraße", "7", "30539", 52.33684, 9.8122002),
      at("wuelfeler39", "Wülfeler Straße", "39", "30539", 52.3386007, 9.8197194),
    ];
    const { checks } = await checker.check([{ origin: DEPOT, stops }]);
    for (const c of checks) {
      expect(c.issues.filter((i) => i.severity !== "info"), c.stopId).toEqual([]);
      expect(c.status).toBe("partial"); // no address data here – never "checked"
    }
    const by = Object.fromEntries(checks.map((c) => [c.stopId, c]));
    // Residents-only access is visible as information.
    expect(codes(by.henckell29!)).toContain("info:restricted_access");
    expect(codes(by.kueck7!)).toContain("info:restricted_access");
    // At least one pedestrian-zone stop names its car access road.
    expect(["bahnhof13", "karmarsch14", "georg21"].some((k) => codes(by[k]!).includes("info:different_access_road"))).toBe(true);
  });

  it("a point on the A2 (Hannover-Nord): motorway warning with the nearest normal road as suggestion", async () => {
    const { checks } = await checker.check([{ origin: DEPOT, stops: [at("a2", "Klusriede", "1", "30419", 52.427361, 9.741878)] }]);
    const mw = checks[0]!.issues.find((i) => i.code === "motorway")!;
    expect(mw.severity).toBe("warning");
    expect(mw.suggestion!.distanceMeters).toBeGreaterThan(20);
    expect(mw.suggestion!.distanceMeters).toBeLessThan(100);
    expect(checks[0]!.issues.some((i) => i.severity === "error")).toBe(false);
  });

  it("a point 40 m beside the A2 snaps to the normal road: no motorway warning", async () => {
    const { checks } = await checker.check([{ origin: DEPOT, stops: [at("beside", "Klusriede", "1", "30419", 52.4277, 9.7418)] }]);
    expect(checks[0]!.issues.map((i) => i.code)).not.toContain("motorway");
  });

  it("hard errors: swapped coordinates, 0,0 and a location outside the road data (Berlin)", async () => {
    const { checks } = await checker.check([
      {
        origin: DEPOT,
        stops: [at("swapped", "Lister Meile", "1", "30161", 9.7462, 52.3826), at("zero", "Lister Meile", "1", "30161", 0, 0), at("berlin", "Unter den Linden", "1", "10117", 52.517, 13.389)],
      },
    ]);
    const by = Object.fromEntries(checks.map((c) => [c.stopId, c]));
    expect(by.swapped!.issues[0]).toMatchObject({ code: "outside_country", details: { swapped: true } });
    expect(codes(by.zero!)).toEqual(["error:coordinates_invalid"]);
    expect(codes(by.berlin!)).toContain("error:out_of_coverage");
  });

  it("no false alarms on 100 real Hannover house addresses (repository fixture)", async () => {
    const stops = fixture.hannover.addresses.map((a, i) => at(`h${i}`, a.street, a.houseNumber, a.postalCode, a.lat, a.lng));
    const { checks } = await checker.check([{ origin: DEPOT, stops }]);
    expect(checks.filter((c) => c.severity === "error" || c.severity === "warning").map((c) => [c.stopId, codes(c)])).toEqual([]);
  });

  const CSV = "/opt/turvio-de/city-addresses.csv";
  it.runIf(existsSync(CSV))("no false alarms on 1,000 real Hannover addresses; time per 100 stops", async () => {
    const rows = readFileSync(CSV, "utf8").trim().split(/\r?\n/).slice(1).map((l) => l.split(";")).filter((r) => r[0] === "Hannover" && r.length === 7); // a few rows have quoted "6;8" house numbers
    // Deterministic sample (every n-th row).
    const step = Math.floor(rows.length / 1000);
    const sample = Array.from({ length: 1000 }, (_, i) => rows[i * step]!);
    const stops = sample.map((r, i) => at(`c${i}`, r[1]!, r[2]!, r[3]!, Number(r[5]), Number(r[6])));
    const fresh = new LocationChecker(new OsrmRouting(OSRM, { timeoutMs: 20_000 }), undefined, { budgetMs: 60_000 });
    const t0 = performance.now();
    const { checks, report } = await fresh.check([{ origin: DEPOT, stops }]);
    const ms = performance.now() - t0;
    const bad = checks.filter((c) => c.severity === "error" || c.severity === "warning");
    const info = checks.filter((c) => c.severity === "info");
    console.log("location-real report", JSON.stringify({ stops: 1000, ms: Math.round(ms), per100: Math.round(ms / 10), warningsOrErrors: bad.length, info: info.length, routing: report.routing, examples: bad.slice(0, 5).map((c) => [c.stopId, codes(c)]) }));
    expect(bad.length).toBeLessThanOrEqual(2); // ≤ 0.2 %: real data has a few genuinely odd points
    expect(bad.filter((c) => c.severity === "error")).toEqual([]);
    const t1 = performance.now();
    await fresh.check([{ origin: DEPOT, stops }]);
    expect(performance.now() - t1).toBeLessThan(200); // cached
  }, 120_000);
});
