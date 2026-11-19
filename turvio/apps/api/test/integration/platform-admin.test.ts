import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SEED_USERS as U } from "../../src/seed";
import { createTestEnv, postgresAvailable, type TestEnv } from "./helpers";

/**
 * J1b: company administration for TURVIO Admin and the company audit log / invitation renewal for
 * Dispatch – suspend and reactivate, plan and limits, members, audit with actors, platform admins.
 */
const available = await postgresAvailable();

describe.runIf(available)("platform company administration", () => {
  let env: TestEnv;
  const org = () => env.data.orgs.jarbou;
  const lastMail = async (to: string) =>
    (await env.superuser.query<{ subject: string; body: string }>(`select subject, body from app_auth.outbox where to_email = $1 order by id desc limit 1`, [to])).rows[0];

  beforeAll(async () => {
    env = await createTestEnv("platformadm");
  });
  afterAll(async () => {
    await env?.close();
  });

  it("lists every company, searchable, and refuses non-platform users", async () => {
    const all = (await env.as(U.platformAdmin, "GET", "/v1/platform/organizations")).json();
    expect(all.total).toBeGreaterThanOrEqual(1);
    expect(all.organizations.some((o: { id: string }) => o.id === org())).toBe(true);
    const found = (await env.as(U.platformAdmin, "GET", "/v1/platform/organizations?q=jarb")).json();
    expect(found.organizations.map((o: { id: string }) => o.id)).toContain(org());
    expect((await env.as(U.jarbouOwner, "GET", "/v1/platform/organizations")).statusCode).toBe(403);
  });

  it("shows a company's plan, usage and members with e-mail addresses", async () => {
    const d = (await env.as(U.platformAdmin, "GET", `/v1/platform/organizations/${org()}`)).json();
    expect(d.subscription.planCode).toBeTruthy();
    expect(d.usage.members).toBeGreaterThan(0);
    expect(d.members.map((m: { email: string }) => m.email)).toContain(U.jarbouOwner);
  });

  it("suspending cuts the company's access; reactivating restores it", async () => {
    expect((await env.as(U.platformAdmin, "PATCH", `/v1/platform/organizations/${org()}`, { status: "suspended" })).statusCode).toBe(204);
    expect((await env.as(U.dispatcherHannover, "GET", `/v1/orgs/${org()}/drivers`)).statusCode).toBe(403);
    expect((await env.as(U.platformAdmin, "PATCH", `/v1/platform/organizations/${org()}`, { status: "active" })).statusCode).toBe(204);
    expect((await env.as(U.dispatcherHannover, "GET", `/v1/orgs/${org()}/drivers`)).statusCode).toBe(200);
  });

  it("limit overrides are enforced and can be removed again; plan changes apply", async () => {
    const drivers = ((await env.as(U.jarbouOwner, "GET", `/v1/orgs/${org()}/drivers`)).json() as Array<{ active: boolean }>).filter((d) => d.active).length;
    expect((await env.as(U.platformAdmin, "PATCH", `/v1/platform/organizations/${org()}`, { limitOverrides: { max_drivers: drivers } })).statusCode).toBe(204);
    const over = await env.as(U.jarbouOwner, "POST", `/v1/orgs/${org()}/drivers`, { displayName: "Limit Test", depotId: env.data.depots.hannover });
    expect(over.statusCode).toBe(422);
    expect(over.json().error.code).toBe("plan_limit_reached");
    expect((await env.as(U.platformAdmin, "PATCH", `/v1/platform/organizations/${org()}`, { limitOverrides: { max_drivers: null } })).statusCode).toBe(204);
    expect((await env.as(U.platformAdmin, "GET", `/v1/platform/organizations/${org()}`)).json().subscription.limitOverrides).toEqual({});
    expect((await env.as(U.platformAdmin, "PATCH", `/v1/platform/organizations/${org()}`, { seats: 7 })).statusCode).toBe(204);
    expect((await env.as(U.platformAdmin, "GET", `/v1/platform/organizations/${org()}`)).json().subscription.seats).toBe(7);
    expect((await env.as(U.platformAdmin, "PATCH", `/v1/platform/organizations/${org()}`, { limitOverrides: { max_unknown: 3 } })).statusCode).toBe(400);
  });

  it("renews a pending invitation with a new link, in the company's language", async () => {
    const inv = (await env.as(U.jarbouOwner, "POST", `/v1/orgs/${org()}/invitations`, { email: "new.dispo@example.test", role: "dispatcher", allLocations: true })).json();
    const first = await lastMail("new.dispo@example.test");
    expect(first!.subject).toContain("Einladung"); // seeded company: default language German
    const r = await env.as(U.jarbouOwner, "POST", `/v1/orgs/${org()}/invitations/${inv.id}/resend`);
    expect(r.statusCode).toBe(200);
    const second = await lastMail("new.dispo@example.test");
    expect(second!.subject).toContain("Erinnerung");
    expect(second!.body).not.toBe(first!.body); // new token
    // A dispatcher may not renew a dispatcher invitation (RLS).
    expect((await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/invitations/${inv.id}/resend`)).statusCode).toBe(404);
    // Platform admins can renew too (e.g. an owner who never accepted).
    expect((await env.as(U.platformAdmin, "POST", `/v1/platform/organizations/${org()}/invitations/${inv.id}/resend`)).statusCode).toBe(200);
  });

  it("audit logs show who changed what, paged; company admins see only their company", async () => {
    const p = (await env.as(U.platformAdmin, "GET", `/v1/platform/audit?table=organizations&limit=1`)).json();
    expect(p.entries).toHaveLength(1);
    expect(p.entries[0]).toMatchObject({ table: "organizations", actor: { email: U.platformAdmin } });
    expect(p.nextBefore).toBe(p.entries[0].id);
    const next = (await env.as(U.platformAdmin, "GET", `/v1/platform/audit?table=organizations&limit=1&before=${p.nextBefore}`)).json();
    expect(next.entries[0].id).toBeLessThan(p.entries[0].id);
    const c = (await env.as(U.jarbouOwner, "GET", `/v1/orgs/${org()}/audit?table=invitations`)).json();
    expect(c.entries.length).toBeGreaterThan(0);
    expect(c.entries[0].actor.email).toMatch(/@/);
    expect((await env.as(U.dispatcherHannover, "GET", `/v1/orgs/${org()}/audit`)).statusCode).toBe(403);
  });

  it("platform admins can be added and removed, never yourself and never by others", async () => {
    const list = (await env.as(U.platformAdmin, "GET", "/v1/platform/admins")).json();
    expect(list.admins.find((a: { you: boolean }) => a.you).email).toBe(U.platformAdmin);
    const add = await env.as(U.platformAdmin, "POST", "/v1/platform/admins", { email: U.dispatcherBremen });
    expect(add.statusCode).toBe(201);
    expect((await env.as(U.platformAdmin, "POST", "/v1/platform/admins", { email: "nobody@example.test" })).statusCode).toBe(404);
    const me = list.admins.find((a: { you: boolean }) => a.you).userId;
    expect((await env.as(U.platformAdmin, "DELETE", `/v1/platform/admins/${me}`)).statusCode).toBe(422);
    expect((await env.as(U.platformAdmin, "DELETE", `/v1/platform/admins/${add.json().userId}`)).statusCode).toBe(204);
    // Not a platform admin: the database refuses even a direct call.
    expect((await env.as(U.jarbouOwner, "POST", "/v1/platform/admins", { email: U.jarbouOwner })).statusCode).toBe(403);
  });
});
