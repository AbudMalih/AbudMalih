import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PostgresGeocoder, normAddressPart, parseQuery } from "../../src/geocode";
import { SEED_USERS as U } from "../../src/seed";
import { createTestEnv, postgresAvailable, type TestEnv } from "./helpers";

const available = await postgresAvailable();
const ROOT = join(import.meta.dirname, "../../../..");

/** Addresses from tools/osm_addresses.py on the SYNTHETIC fixture; falls back to the same rows if pyosmium is missing. */
function syntheticCsv(): string {
  try {
    return execFileSync("python3", ["-I", join(ROOT, "tools/osm_addresses.py"), join(ROOT, "tools/fixtures/synthetic-addresses.osm")], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return "street;house_number;postcode;city;lat;lng\nLister Meile;42;30161;Hannover;52.3826;9.7462\nLister Meile;44a;30161;Hannover;52.383;9.747\nPodbielskistraße;11;30163;Hannover;52.379;9.74\nHildesheimer Straße;15;30169;Hannover;52.4001;9.7502\n";
  }
}

describe("query parsing", () => {
  it("splits German address queries", () => {
    expect(parseQuery("Lister Meile 42a, 30161 Hannover")).toEqual({ street: "Lister Meile", houseNumber: "42a", postcode: "30161", city: "Hannover" });
    expect(parseQuery("Podbielskistr. 11")).toEqual({ street: "Podbielskistr.", houseNumber: "11", postcode: undefined, city: undefined });
    expect(normAddressPart("Podbielskistraße")).toBe(normAddressPart("podbielski str."));
    // Found with real OSM data (Region Hannover): city without comma/postcode, ASCII umlauts.
    expect(parseQuery("herrenhäuser str. 4 hannover")).toEqual({ street: "herrenhäuser str.", houseNumber: "4", postcode: undefined, city: "hannover" });
    expect(parseQuery("Lister Meile 42 a")).toEqual({ street: "Lister Meile", houseNumber: "42a", postcode: undefined, city: undefined });
    expect(normAddressPart("Herrenhaeuser Strasse")).toBe(normAddressPart("Herrenhäuser Straße"));
    expect(normAddressPart("Goethestraße")).toBe(normAddressPart("Göthestr."));
  });
});

describe.runIf(available)("self-hosted geocoder (PostgreSQL, synthetic OSM data)", () => {
  let env: TestEnv;
  beforeAll(async () => {
    const q = <R,>(sql: string, params: unknown[]) => env.superuser.query(sql, params) as unknown as Promise<{ rows: R[] }>;
    env = await createTestEnv("geo", { geocoder: new PostgresGeocoder((sql, params) => q(sql, params)) });
    const rows = syntheticCsv().trim().split("\n").slice(1).map((l) => l.split(";"));
    expect(rows).toHaveLength(4);
    for (const r of rows) await env.superuser.query(`insert into geo.addresses (street, house_number, postcode, city, lat, lng) values ($1,$2,$3,$4,$5,$6)`, r);
  }, 120_000);
  afterAll(async () => {
    await env?.close();
  });

  it("TypeScript and SQL normalisation agree", async () => {
    for (const t of ["Hildesheimer Straße", "Podbielskistr.", "Göttinger Chaussee", "Am Ägidientorplatz", "ŞTEFAN Str 4", "Herrenhaeuser Strasse", "Müllerstraße", "Queerweg"]) {
      const sql = (await env.superuser.query<{ n: string }>(`select geo.norm($1) as n`, [t])).rows[0]!.n;
      expect(sql).toBe(normAddressPart(t));
    }
  });

  it("autocompletes street + house number, also with 'Str.' spelling and partial input", async () => {
    const full = (await env.as(U.driverHannover1, "GET", `/v1/geocode/search?q=${encodeURIComponent("Podbielskistr. 11, 30163 Hannover")}`)).json();
    expect(full.provider).toBe("postgres");
    expect(full.results[0]).toMatchObject({ street: "Podbielskistraße", houseNumber: "11", postalCode: "30163", precision: "house", location: { lat: 52.379, lng: 9.74 } });
    const partial = (await env.as(U.driverHannover1, "GET", `/v1/geocode/search?q=${encodeURIComponent("Lister Mei")}`)).json();
    expect(partial.results.map((r: { houseNumber: string }) => r.houseNumber)).toEqual(["42", "44a"]);
  });

  it("an unknown house number gives a street-level result, never an invented house position", async () => {
    const r = (await env.as(U.driverHannover1, "GET", `/v1/geocode/search?q=${encodeURIComponent("Lister Meile 999, 30161")}`)).json();
    expect(r.results).toHaveLength(1);
    expect(r.results[0]).toMatchObject({ precision: "street", street: "Lister Meile" });
    expect(r.results[0].houseNumber).toBeUndefined();
    const none = (await env.as(U.driverHannover1, "GET", `/v1/geocode/search?q=${encodeURIComponent("Gibtsnichtweg 1")}`)).json();
    expect(none.results).toEqual([]);
  });

  it("bulk-geocodes import rows with exact matches only", async () => {
    const r = await env.as(U.driverHannover1, "POST", "/v1/geocode/batch", {
      addresses: [
        { street: "Lister Meile", houseNumber: "44a", postalCode: "30161" },
        { street: "Hildesheimer Str.", houseNumber: "15", postalCode: "30169" },
        { street: "Lister Meile", houseNumber: "1", postalCode: "30161" },
        { street: "Unbekannt", houseNumber: "3", postalCode: "30159" },
      ],
    });
    const res = r.json().results;
    expect(res[0]).toMatchObject({ precision: "house", houseNumber: "44a" });
    expect(res[1]).toMatchObject({ precision: "house", location: { lat: 52.4001, lng: 9.7502 } }); // building centroid
    expect(res[2]).toMatchObject({ precision: "street" });
    expect(res[3]).toBeNull();
    expect((await env.app.inject({ method: "POST", url: "/v1/geocode/batch", payload: { addresses: [] } })).statusCode).toBe(401);
  });
});
