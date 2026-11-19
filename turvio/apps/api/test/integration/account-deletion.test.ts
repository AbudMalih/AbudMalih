import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SEED_USERS as U } from "../../src/seed";
import { createTestEnv, postgresAvailable, type TestEnv } from "./helpers";

/** Store requirement: users can ask for their account to be deleted from inside the app. */
const available = await postgresAvailable();

describe.runIf(available)("account deletion request", () => {
  let env: TestEnv;
  const mails = async (to: string) => (await env.superuser.query<{ subject: string; body: string }>(`select subject, body from app_auth.outbox where to_email = $1 order by id`, [to])).rows;
  beforeAll(async () => {
    env = await createTestEnv("acctdel");
  });
  afterAll(async () => {
    await env?.close();
  });

  it("sends the request to TURVIO support (with the companies) and confirms it to the user; deletes nothing", async () => {
    const r = await env.as(U.driverHannover1, "POST", "/v1/me/account-deletion-request", { reason: "Ich arbeite nicht mehr hier" });
    expect(r.statusCode).toBe(202);
    const support = await mails("support@turvio.test");
    expect(support.at(-1)!.subject).toContain(U.driverHannover1);
    expect(support.at(-1)!.body).toMatch(/JARBOU/i);
    expect(support.at(-1)!.body).toContain("Ich arbeite nicht mehr hier");
    expect((await mails(U.driverHannover1)).at(-1)!.subject).toContain("deletion request");
    expect((await env.as(U.driverHannover1, "GET", "/v1/me")).statusCode).toBe(200); // account still there
    // A second request right away is throttled.
    expect((await env.as(U.driverHannover1, "POST", "/v1/me/account-deletion-request", {})).statusCode).toBe(429);
  });

  it("needs a signed-in user", async () => {
    expect((await env.app.inject({ method: "POST", url: "/v1/me/account-deletion-request", payload: {} })).statusCode).toBe(401);
  });
});
