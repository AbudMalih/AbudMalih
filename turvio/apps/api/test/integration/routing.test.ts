import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { RoutingProvider } from "../../src/routing";
import { SEED_USERS as U } from "../../src/seed";
import { createTestEnv, postgresAvailable, type TestEnv } from "./helpers";

const available = await postgresAvailable();
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

/** Deterministic road router: every leg 1 km / 120 s. */
const fakeRouting: RoutingProvider = {
  name: "fake-osrm",
  async route(points) {
    const legs = points.slice(1).map(() => ({ meters: 1000, seconds: 120 }));
    return { source: "osrm", legs, distanceMeters: legs.length * 1000, durationSeconds: legs.length * 120, geometry: points.map((p) => [p.lat, p.lng] as [number, number]) };
  },
};

describe.runIf(available)("road route endpoint", () => {
  let env: TestEnv;
  let bare: TestEnv;
  let tourId = "";
  beforeAll(async () => {
    env = await createTestEnv("route", { routing: fakeRouting });
    bare = await createTestEnv("noroute");
  }, 120_000);
  afterAll(async () => {
    await env?.close();
    await bare?.close();
  });

  const setup = async (e: TestEnv) => {
    const org = e.data.orgs.jarbou;
    const t = (await e.as(U.dispatcherHannover, "POST", `/v1/orgs/${org}/tours`, { depotId: e.data.depots.hannover, date: today(), driverId: e.data.drivers.hannover![0] })).json();
    await e.as(U.dispatcherHannover, "POST", `/v1/orgs/${org}/stops`, {
      tourId: t.id,
      stops: [0, 1, 2].map((i) => ({ address: { street: "Weg", houseNumber: String(i + 1), postalCode: "30159", city: "Hannover" }, location: { lat: 52.37 + i * 0.01, lng: 9.73 } })).concat([{ address: { street: "Ohne Pin", houseNumber: "1", postalCode: "30159", city: "Hannover" }, location: null } as never]),
    });
    await e.as(U.dispatcherHannover, "POST", `/v1/orgs/${org}/tours/${t.id}/publish`, { expectedVersion: t.version });
    return t.id as string;
  };

  it("returns road legs, geometry and the same metrics to dispatcher and driver", async () => {
    tourId = await setup(env);
    const org = env.data.orgs.jarbou;
    const d = (await env.as(U.dispatcherHannover, "GET", `/v1/orgs/${org}/tours/${tourId}/route`)).json();
    const drv = (await env.as(U.driverHannover1, "GET", `/v1/orgs/${org}/tours/${tourId}/route`)).json();
    expect(d.source).toBe("osrm");
    expect(d.legs).toHaveLength(4); // depot -> 3 located stops -> depot
    expect(d.waypointStopIds[0]).toBeNull();
    expect(d.unlocatedStopIds).toHaveLength(1);
    expect(d.metrics.totalMeters).toBe(4000);
    expect(drv.metrics).toEqual(d.metrics);
    // Another depot's dispatcher cannot read it.
    expect((await env.as(U.dispatcherBremen, "GET", `/v1/orgs/${org}/tours/${tourId}/route`)).statusCode).toBe(404);
  });

  it("without a routing service it says so (no road figures are invented)", async () => {
    const id = await setup(bare);
    const r = (await bare.as(U.dispatcherHannover, "GET", `/v1/orgs/${bare.data.orgs.jarbou}/tours/${id}/route`)).json();
    expect(r.source).toBe("none");
    expect(r.note).toMatch(/straight-line estimates/);
    expect(r.metrics).toBeUndefined();
  });
});
