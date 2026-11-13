import { describe, expect, it } from "vitest";
import { RoutingOutOfCoverage, type RoutingProvider } from "../src/routing";
import { checkSystem, type SystemInfo } from "../src/system-status";

const info: SystemInfo = { authProvider: "supabase", adminMfaRequired: true, mailer: "outbox", proofStorage: "local", geocoder: "postgres", addressDataVersion: "osm-test", roadDataVersion: null, release: "abc123" };
const fakeDb = (fail = false) => ({ asService: async (fn: (tx: unknown) => Promise<unknown>) => (fail ? Promise.reject(new Error("connection refused")) : fn({ query: async () => ({ rows: [{ v: "17.2 (Debian)" }] }) })) }) as never;
const okFetch = (async () => new Response("{}", { status: 200 })) as typeof fetch;
const failFetch = (async () => {
  throw new Error("ECONNREFUSED");
}) as typeof fetch;

describe("system status", () => {
  it("reports measured results, never a status it did not verify", async () => {
    const routing: RoutingProvider = { name: "osrm", route: async () => ({ source: "osrm", legs: [], distanceMeters: 412, durationSeconds: 60, geometry: [] }) };
    const geocoder = { name: "postgres", search: async () => [{ precision: "house" }], reverse: async () => null } as never;
    const s = await checkSystem({ db: fakeDb(), optimizerUrl: "http://opt", fetchImpl: okFetch, routing, geocoder }, info);
    const by = Object.fromEntries(s.services.map((x) => [x.key, x]));
    expect(by.database!.state).toBe("operational");
    expect(by.database!.detail).toContain("PostgreSQL 17.2");
    expect(by.optimizer!.state).toBe("operational");
    expect(by.routing!.detail).toContain("412 m");
    expect(by.geocoding!.detail).toContain("osm-test");
    expect(s.release).toBe("abc123");
  });

  it("marks failures as down, missing services as not configured and out-of-coverage as degraded", async () => {
    const routing: RoutingProvider = {
      name: "osrm",
      route: async () => {
        throw new RoutingOutOfCoverage("outside");
      },
    };
    const s = await checkSystem({ db: fakeDb(true), optimizerUrl: "http://opt", fetchImpl: failFetch, routing }, { ...info, geocoder: "none" });
    const by = Object.fromEntries(s.services.map((x) => [x.key, x]));
    expect(by.database!.state).toBe("down");
    expect(by.optimizer!.state).toBe("down");
    expect(by.routing!.state).toBe("degraded");
    expect(by.geocoding!.state).toBe("not_configured");
    const none = await checkSystem({ optimizerUrl: "http://opt", fetchImpl: okFetch }, info);
    expect(Object.fromEntries(none.services.map((x) => [x.key, x.state])).routing).toBe("not_configured");
  });
});
