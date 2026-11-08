import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SEED_USERS as U } from "../../src/seed";
import { createTestEnv, postgresAvailable, type TestEnv } from "./helpers";

const available = await postgresAvailable();
let env: TestEnv;

/**
 * Dispatch Fleet -> Team (GET /members). Regression: on hosted Supabase auth.users.email is
 * varchar(255); org_members() declared text and failed with a 500 ("Team not loaded"). The test
 * database uses the hosted type (supabase/local/00_supabase_stubs.sql).
 */
describe.runIf(available)("team list", () => {
  beforeAll(async () => {
    env = await createTestEnv("team");
  }, 120_000);
  afterAll(async () => {
    await env?.close();
  });
  const url = () => `/v1/orgs/${env.data.orgs.jarbou}/members`;

  it("the owner gets every member with email, role and locations, plus open invitations", async () => {
    const r = await env.as(U.jarbouOwner, "GET", url());
    expect(r.statusCode).toBe(200);
    const body = r.json();
    const emails = body.members.map((m: { email: string }) => m.email);
    expect(emails).toEqual(expect.arrayContaining([U.jarbouOwner, U.dispatcherHannover, U.driverHannover1]));
    expect(body.members.find((m: { email: string }) => m.email === U.dispatcherHannover)).toMatchObject({ role: "dispatcher", active: true });
    expect(body.members.find((m: { email: string }) => m.email === U.driverHannover1).driverId).toBeTruthy();
    expect(Array.isArray(body.invitations)).toBe(true);
    expect(emails.some((e: string) => e === U.musterOwner)).toBe(false); // other company
  });

  it("dispatchers, drivers and other companies are refused", async () => {
    for (const u of [U.dispatcherHannover, U.driverHannover1, U.musterOwner]) {
      expect((await env.as(u, "GET", url())).statusCode).toBe(403);
    }
  });
});
