import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SEED_USERS as U } from "../../src/seed";
import { createTestEnv, postgresAvailable, type TestEnv } from "./helpers";

/** J2: a file import of up to 2,000 rows is one request and one transaction – all saved or none. */
const available = await postgresAvailable();

describe.runIf(available)("atomic import of 2,000 stops", () => {
  let env: TestEnv;
  const org = () => env.data.orgs.jarbou;
  const stop = (i: number, tracking = `ATOM${String(i).padStart(6, "0")}`) => ({
    address: { street: "Lister Meile", houseNumber: String(i + 1), postalCode: "30161", city: "Hannover", countryCode: "DE" },
    location: { lat: 52.38 + (i % 50) * 0.0004, lng: 9.74 + Math.floor(i / 50) * 0.0004 },
    trackingNumbers: [tracking],
  });
  const count = async () => Number((await env.superuser.query<{ n: string }>(`select count(*) as n from parcels where tracking_number like 'ATOM%'`)).rows[0]!.n);
  beforeAll(async () => {
    env = await createTestEnv("importatomic");
    await env.superuser.query(`update subscriptions set limit_overrides = '{"max_stops_per_month": 1000000}'::jsonb`);
  });
  afterAll(async () => {
    await env?.close();
  });

  it("a duplicate in the last row refuses the whole request: nothing saved", async () => {
    const stops = Array.from({ length: 2000 }, (_, i) => stop(i));
    stops[1999] = stop(1999, "ATOM000000"); // same tracking number as row 1
    const r = await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/stops`, { depotId: env.data.depots.hannover, stops, rejectPlannedTracking: true });
    expect(r.statusCode).toBe(409);
    expect(await count()).toBe(0);
  });

  it("2,000 stops in one request are saved together", async () => {
    const r = await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/stops`, { depotId: env.data.depots.hannover, stops: Array.from({ length: 2000 }, (_, i) => stop(i)), rejectPlannedTracking: true });
    expect(r.statusCode).toBe(201);
    expect(r.json().ids).toHaveLength(2000);
    expect(await count()).toBe(2000);
  }, 60_000);

  it("more than 2,000 in one request is refused before anything is written", async () => {
    const r = await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/stops`, { depotId: env.data.depots.hannover, stops: Array.from({ length: 2001 }, (_, i) => stop(i, `OVER${i}`)) });
    expect(r.statusCode).toBe(400);
  });
});
