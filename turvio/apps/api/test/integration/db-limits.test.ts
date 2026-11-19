import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ApiError, Db, mapPgError, withExactFloats } from "../../src/db";
import type { Geocoder } from "../../src/geocode";
import { SEED_USERS as U } from "../../src/seed";
import { adminUrl, createTestEnv, postgresAvailable, type TestEnv } from "./helpers";

/**
 * J1 hardening: requests never hang on the database, and batch geocoding keeps the input order and
 * answers 503 (never a bare 500) when the address service fails.
 */
const available = await postgresAvailable();

describe.runIf(available)("database limits", () => {
  it("a statement over the timeout answers 503 database_timeout", async () => {
    const pool = withExactFloats(new pg.Pool({ connectionString: adminUrl("postgres"), max: 1 }), 200);
    try {
      expect((await pool.query<{ statement_timeout: string }>("show statement_timeout")).rows[0]!.statement_timeout).toBe("200ms");
      const err = await pool.query("select pg_sleep(2)").catch((e) => e);
      const mapped = mapPgError(err) as ApiError;
      expect(mapped).toBeInstanceOf(ApiError);
      expect([mapped.status, mapped.code]).toEqual([503, "database_timeout"]);
    } finally {
      await pool.end();
    }
  });

  it("no free connection in time answers 503 database_busy instead of waiting forever", async () => {
    const db = new Db(adminUrl("postgres"));
    try {
      db.pool.connect = (() => Promise.reject(new Error("timeout exceeded when trying to connect"))) as never;
      const err = await db.asUser({ sub: "00000000-0000-0000-0000-000000000001", email: "x@example.test" } as never, async () => 1).catch((e) => e);
      expect(err).toBeInstanceOf(ApiError);
      expect([err.status, err.code]).toEqual([503, "database_busy"]);
    } finally {
      await db.pool.end();
    }
  });
});

let mode: "ok" | "fail" = "ok";
const fakeGeocoder: Geocoder & { exact: (a: { street: string; houseNumber?: string; postalCode: string }) => Promise<unknown> } = {
  name: "fake",
  search: async () => [],
  reverse: async () => null,
  // Random delays: the answers arrive out of order, the response must still follow the input order.
  exact: async (a) => {
    await new Promise((r) => setTimeout(r, Math.random() * 20));
    if (mode === "fail") throw new Error("connection to address database lost");
    return a.houseNumber === "0" ? null : { street: a.street, houseNumber: a.houseNumber, postalCode: a.postalCode, precision: "house", location: { lat: 52, lng: 9 } };
  },
};

describe.runIf(available)("POST /v1/geocode/batch", () => {
  let env: TestEnv;
  beforeAll(async () => {
    env = await createTestEnv("geobatch", { geocoder: fakeGeocoder });
  });
  afterAll(async () => {
    await env?.close();
  });

  it("keeps the input order (lookups run concurrently) and returns null for no match", async () => {
    mode = "ok";
    const addresses = Array.from({ length: 30 }, (_, i) => ({ street: "Lister Meile", houseNumber: String(i), postalCode: "30161" }));
    const res = await env.as(U.dispatcherHannover, "POST", "/v1/geocode/batch", { addresses });
    expect(res.statusCode).toBe(200);
    const results = res.json().results as Array<{ houseNumber: string } | null>;
    expect(results).toHaveLength(30);
    expect(results[0]).toBeNull();
    expect(results.slice(1).map((r) => r!.houseNumber)).toEqual(addresses.slice(1).map((a) => a.houseNumber));
  });

  it("a failing address service answers 503 geocoder_unavailable, not 500", async () => {
    mode = "fail";
    await new Promise((r) => setTimeout(r, 2100)); // batch rate limiter (0.5/s)
    const res = await env.as(U.dispatcherHannover, "POST", "/v1/geocode/batch", { addresses: [{ street: "Lister Meile", houseNumber: "1", postalCode: "30161" }] });
    expect(res.statusCode).toBe(503);
    expect(res.json().error.code).toBe("geocoder_unavailable");
  });
});
