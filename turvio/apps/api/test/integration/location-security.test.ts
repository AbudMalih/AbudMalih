import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SEED_USERS as U } from "../../src/seed";
import { PASSWORD, createTestEnv, postgresAvailable, type TestEnv } from "./helpers";

const available = await postgresAvailable();
let env: TestEnv;

/**
 * Phase B regression: strict location scope, safe invitations, no driver-profile takeover,
 * no role overwrite – checked through the API (the database enforces the same rules on its own;
 * see packages/db/test/location-security.test.ts).
 */
describe.runIf(available)("location security (API)", () => {
  beforeAll(async () => {
    env = await createTestEnv("locsec");
    await env.superuser.query(`update subscriptions set seats = 50`);
  }, 120_000);
  afterAll(async () => {
    await env?.close();
  });

  const org = () => env.data.orgs.jarbou;
  const muster = () => env.data.orgs.muster;
  const drv = (depot: string, i: number) => env.data.drivers[depot]![i]!;
  const invite = (as: string, body: object, o = org()) => env.as(as, "POST", `/v1/orgs/${o}/invitations`, body);
  const tokenFor = async (email: string) => {
    const mail = (await env.app.inject({ method: "GET", url: `/v1/dev/outbox?to=${encodeURIComponent(email)}` })).json()[0];
    return decodeURIComponent(/token=([^\s]+)/.exec(mail.body)![1]!);
  };
  const accept = async (email: string, password: string) => env.app.inject({ method: "POST", url: "/v1/invitations/accept", payload: { token: await tokenFor(email), password } });
  const linkOf = async (driverId: string) => (await env.superuser.query(`select user_id from drivers where id = $1`, [driverId])).rows[0].user_id as string | null;
  const membershipId = async (email: string) =>
    (await env.as(U.jarbouOwner, "GET", `/v1/orgs/${org()}/members`)).json().members.find((m: { email: string }) => m.email === email).membershipId as string;
  const depotsSeen = async (email: string) => (await env.as(email, "GET", `/v1/orgs/${org()}/dispatch`)).json().depots.map((d: { name: string }) => d.name).sort();

  describe("driver-profile takeover", () => {
    it("a dispatcher cannot invite into a driver profile outside their locations", async () => {
      const r = await invite(U.dispatcherBremen, { email: "intruder@evil.test", role: "driver", driverId: drv("hannover", 3) });
      expect(r.statusCode).toBe(409);
      expect(r.json().error.code).toBe("driver_profile_unavailable");
      expect(await linkOf(drv("hannover", 3))).toBeNull();
    });

    it("nobody – not even the owner – can invite into a profile that already has a login", async () => {
      const lena = drv("hannover", 0);
      const before = await linkOf(lena);
      expect(before).toBeTruthy();
      for (const who of [U.dispatcherHannover, U.jarbouOwner]) {
        const r = await invite(who, { email: "attacker@evil.test", role: "driver", driverId: lena });
        expect(r.statusCode).toBe(409);
      }
      expect(await linkOf(lena)).toBe(before);
      const open = await env.superuser.query(`select count(*)::int as n from invitations where driver_id = $1 and accepted_at is null`, [lena]);
      expect(open.rows[0].n).toBe(0);
    });

    it("a profile can be claimed only once, even with two open invitations", async () => {
      const p = drv("hannover", 3);
      expect((await invite(U.dispatcherHannover, { email: "first@jarbou.test", role: "driver", driverId: p })).statusCode).toBe(201);
      expect((await invite(U.jarbouOwner, { email: "second@jarbou.test", role: "driver", driverId: p })).statusCode).toBe(201);
      const [a, b] = await Promise.all([accept("first@jarbou.test", "First-Driver-2026"), accept("second@jarbou.test", "Second-Driver-2026")]);
      const codes = [a.statusCode, b.statusCode].sort();
      expect(codes).toEqual([200, 409]);
      const winner = a.statusCode === 200 ? "first@jarbou.test" : "second@jarbou.test";
      const uid = (await env.superuser.query(`select id from auth.users where email = $1`, [winner])).rows[0].id;
      expect(await linkOf(p)).toBe(uid);
    });

    it("another company cannot invite into this company's driver profiles", async () => {
      const r = await invite(U.musterOwner, { email: "x@muster.test", role: "driver", driverId: drv("kassel", 0) }, muster());
      expect(r.statusCode).toBe(409);
      expect((await invite(U.musterOwner, { email: "x@muster.test", role: "driver", driverId: drv("kassel", 0) })).statusCode).toBe(403);
    });

    it("a driver profile is ignored on non-driver invitations", async () => {
      const r = await invite(U.jarbouOwner, { email: "admin.with.profile@jarbou.test", role: "admin", driverId: drv("kassel", 1) });
      expect(r.statusCode).toBe(201);
      const row = await env.superuser.query(`select driver_id from invitations where email = 'admin.with.profile@jarbou.test'`);
      expect(row.rows[0].driver_id).toBeNull();
    });
  });

  describe("invitations never overwrite existing members", () => {
    it("inviting an existing dispatcher as Admin is refused on acceptance; the role is unchanged", async () => {
      expect((await invite(U.jarbouOwner, { email: U.dispatcherBremen, role: "admin" })).statusCode).toBe(201);
      const r = await accept(U.dispatcherBremen, PASSWORD);
      expect(r.statusCode).toBe(409);
      const role = await env.superuser.query(`select m.role from memberships m join auth.users u on u.id = m.user_id where u.email = $1 and m.organization_id = $2`, [U.dispatcherBremen, org()]);
      expect(role.rows[0].role).toBe("dispatcher");
    });

    it("an existing driver login cannot be moved onto another profile by invitation", async () => {
      const p = drv("hannover", 2);
      expect((await invite(U.jarbouOwner, { email: U.driverHannover1, role: "driver", driverId: p })).statusCode).toBe(201);
      expect((await accept(U.driverHannover1, PASSWORD)).statusCode).toBe(409);
      expect(await linkOf(p)).toBeNull();
    });
  });

  describe("who may invite whom", () => {
    it("dispatchers cannot invite or create Admins, Owners or Dispatchers", async () => {
      for (const role of ["admin", "owner", "dispatcher"]) {
        expect((await invite(U.dispatcherHannover, { email: `${role}@evil.test`, role, depotIds: [env.data.depots.hannover], allLocations: true })).statusCode).toBe(403);
      }
    });

    it("a dispatcher invitation needs a location; all locations is an explicit admin choice", async () => {
      const none = await invite(U.jarbouOwner, { email: "noloc@jarbou.test", role: "dispatcher" });
      expect(none.statusCode).toBe(422);
      expect(none.json().error.code).toBe("location_required");
      expect((await invite(U.jarbouOwner, { email: "noloc@jarbou.test", role: "dispatcher", depotIds: [] })).statusCode).toBe(422);
      expect((await invite(U.jarbouOwner, { email: "all@jarbou.test", role: "dispatcher", allLocations: true })).statusCode).toBe(201);
      const acc = await accept("all@jarbou.test", "All-Locations-2026");
      await env.login("all@jarbou.test", "All-Locations-2026");
      expect(acc.statusCode).toBe(200);
      const me = await env.app.inject({ method: "GET", url: "/v1/me", headers: { authorization: `Bearer ${acc.json().accessToken}` } });
      expect(me.json().memberships[0]).toMatchObject({ role: "dispatcher", allLocations: true });
      expect(await depotsSeen("all@jarbou.test")).toEqual(["Bremen", "Haiger", "Hannover", "Kassel"]);
    });

    it("a location from another company is refused", async () => {
      const leipzig = (await env.superuser.query(`select id from depots where organization_id = $1`, [muster()])).rows[0].id;
      const r = await invite(U.jarbouOwner, { email: "leipzig@jarbou.test", role: "dispatcher", depotIds: [leipzig] });
      expect(r.statusCode).toBeGreaterThanOrEqual(400);
      expect(r.statusCode).toBeLessThan(500);
    });
  });

  describe("invitation cancellation is scoped", () => {
    it("a dispatcher can cancel driver invitations of their locations only, never admin-made team invitations", async () => {
      expect((await invite(U.jarbouOwner, { email: "bremen.driver@jarbou.test", role: "driver", driverId: drv("bremen", 3) })).statusCode).toBe(201);
      expect((await invite(U.jarbouOwner, { email: "team.disp@jarbou.test", role: "dispatcher", depotIds: [env.data.depots.bremen] })).statusCode).toBe(201);
      const ids = await env.superuser.query<{ id: string; email: string }>(`select id, email from invitations where email in ('bremen.driver@jarbou.test','team.disp@jarbou.test')`);
      const id = (e: string) => ids.rows.find((r) => r.email === e)!.id;
      const del = (as: string, e: string) => env.as(as, "DELETE", `/v1/orgs/${org()}/invitations/${id(e)}`);
      expect((await del(U.dispatcherHannover, "bremen.driver@jarbou.test")).statusCode).toBe(404);
      expect((await del(U.dispatcherBremen, "team.disp@jarbou.test")).statusCode).toBe(404);
      expect((await del(U.musterOwner, "bremen.driver@jarbou.test")).statusCode).toBe(403);
      const open = await env.superuser.query(`select count(*)::int as n from invitations where id = any($1) and revoked_at is null`, [ids.rows.map((r) => r.id)]);
      expect(open.rows[0].n).toBe(2);
      expect((await del(U.dispatcherBremen, "bremen.driver@jarbou.test")).statusCode).toBe(204);
      expect((await del(U.jarbouOwner, "team.disp@jarbou.test")).statusCode).toBe(204);
    });

    it("the team list (with all invitations) stays admin-only", async () => {
      for (const u of [U.dispatcherHannover, U.dispatcherBremen, U.driverHannover1, U.musterOwner]) {
        expect((await env.as(u, "GET", `/v1/orgs/${org()}/members`)).statusCode).toBe(403);
      }
    });
  });

  describe("fail-closed location scope", () => {
    it("removing a dispatcher's last location removes access – it never widens to the company", async () => {
      const mid = await membershipId(U.dispatcherBremen);
      expect(await depotsSeen(U.dispatcherBremen)).toEqual(["Bremen"]);
      expect((await env.as(U.jarbouOwner, "PATCH", `/v1/orgs/${org()}/members/${mid}`, { depotIds: [] })).statusCode).toBe(204);
      expect(await depotsSeen(U.dispatcherBremen)).toEqual([]);
      const ds = (await env.as(U.dispatcherBremen, "GET", `/v1/orgs/${org()}/dispatch`)).json();
      expect(ds.tours).toEqual([]);
      expect(ds.drivers).toEqual([]);
      expect(ds.vehicles).toEqual([]);
      expect((await env.as(U.dispatcherBremen, "GET", `/v1/orgs/${org()}/fleet/live`)).json().vehicles).toEqual([]);
      const me = (await env.as(U.dispatcherBremen, "GET", "/v1/me")).json().memberships[0];
      expect(me.allLocations).toBe(false);
      // null (the old "no restriction") is also no access now.
      expect((await env.as(U.jarbouOwner, "PATCH", `/v1/orgs/${org()}/members/${mid}`, { depotIds: null })).statusCode).toBe(204);
      expect(await depotsSeen(U.dispatcherBremen)).toEqual([]);
      // The team list shows it.
      const m = (await env.as(U.jarbouOwner, "GET", `/v1/orgs/${org()}/members`)).json().members.find((x: { email: string }) => x.email === U.dispatcherBremen);
      expect(m).toMatchObject({ allLocations: false });
    });

    it("company-wide access needs the explicit all-locations grant by an admin; dispatchers cannot grant it", async () => {
      const mid = await membershipId(U.dispatcherBremen);
      expect((await env.as(U.dispatcherHannover, "PATCH", `/v1/orgs/${org()}/members/${mid}`, { allLocations: true })).statusCode).toBe(403);
      const self = await membershipId(U.dispatcherHannover);
      expect((await env.as(U.dispatcherHannover, "PATCH", `/v1/orgs/${org()}/members/${self}`, { allLocations: true })).statusCode).toBe(403);
      expect(await depotsSeen(U.dispatcherHannover)).toEqual(["Hannover"]);
      expect((await env.as(U.jarbouOwner, "PATCH", `/v1/orgs/${org()}/members/${mid}`, { allLocations: true })).statusCode).toBe(204);
      expect(await depotsSeen(U.dispatcherBremen)).toEqual(["Bremen", "Haiger", "Hannover", "Kassel"]);
      // Back to Bremen only.
      expect((await env.as(U.jarbouOwner, "PATCH", `/v1/orgs/${org()}/members/${mid}`, { allLocations: false, depotIds: [env.data.depots.bremen] })).statusCode).toBe(204);
      expect(await depotsSeen(U.dispatcherBremen)).toEqual(["Bremen"]);
    });

    it("cross-location: a dispatcher cannot read or change another location's drivers and tours", async () => {
      const ds = (await env.as(U.dispatcherHannover, "GET", `/v1/orgs/${org()}/dispatch`)).json();
      expect(ds.drivers.every((d: { depotId: string }) => d.depotId === env.data.depots.hannover)).toBe(true);
      const kasselDriver = drv("kassel", 2);
      const body = { displayName: "Hijacked", depotId: env.data.depots.hannover, maxShiftMinutes: 480, active: true };
      const r = await env.as(U.dispatcherHannover, "PATCH", `/v1/orgs/${org()}/drivers/${kasselDriver}`, body);
      expect([403, 404]).toContain(r.statusCode);
      const row = (await env.superuser.query(`select display_name, depot_id from drivers where id = $1`, [kasselDriver])).rows[0];
      expect(row).toEqual({ display_name: "Marco Rossi", depot_id: env.data.depots.kassel });
      // Nor move one of their own drivers out to a location they cannot see.
      const own = drv("hannover", 1);
      const out = await env.as(U.dispatcherHannover, "PATCH", `/v1/orgs/${org()}/drivers/${own}`, { ...body, displayName: "Mihai Popescu", depotId: env.data.depots.kassel });
      expect(out.statusCode).toBeGreaterThanOrEqual(400);
      expect((await env.superuser.query(`select depot_id from drivers where id = $1`, [own])).rows[0].depot_id).toBe(env.data.depots.hannover);
    });

    it("cross-company: no access to another company's data or members", async () => {
      for (const path of ["dispatch", "members", "fleet/live", "events"]) {
        expect((await env.as(U.musterOwner, "GET", `/v1/orgs/${org()}/${path}`)).statusCode).toBe(403);
      }
      expect((await env.as(U.jarbouOwner, "GET", `/v1/orgs/${muster()}/dispatch`)).statusCode).toBe(403);
    });
  });

  describe("existing Owner, Admin and Driver functionality", () => {
    it("the owner still sees every location and can invite drivers anywhere", async () => {
      expect(await depotsSeen(U.jarbouOwner)).toEqual(["Bremen", "Haiger", "Hannover", "Kassel"]);
      expect((await invite(U.jarbouOwner, { email: "kassel.driver@jarbou.test", role: "driver", driverId: drv("kassel", 3) })).statusCode).toBe(201);
      const acc = await accept("kassel.driver@jarbou.test", "Kassel-Driver-2026");
      expect(acc.statusCode).toBe(200);
      const uid = (await env.superuser.query(`select id from auth.users where email = 'kassel.driver@jarbou.test'`)).rows[0].id;
      expect(await linkOf(drv("kassel", 3))).toBe(uid);
    });

    it("an invited admin is company-wide", async () => {
      expect((await invite(U.jarbouOwner, { email: "new.admin@jarbou.test", role: "admin" })).statusCode).toBe(201);
      expect((await accept("new.admin@jarbou.test", "New-Admin-2026!")).statusCode).toBe(200);
      await env.login("new.admin@jarbou.test", "New-Admin-2026!");
      expect(await depotsSeen("new.admin@jarbou.test")).toEqual(["Bremen", "Haiger", "Hannover", "Kassel"]);
    });

    it("a dispatcher still invites drivers of their own location", async () => {
      expect((await invite(U.dispatcherBremen, { email: "bremen2@jarbou.test", role: "driver", driverId: drv("bremen", 2) })).statusCode).toBe(201);
    });

    it("drivers keep their own tours and tracking config", async () => {
      expect((await env.as(U.driverHannover1, "GET", `/v1/orgs/${org()}/tracking/config`)).statusCode).toBe(200);
      expect((await env.as(U.driverHannover1, "GET", "/v1/me")).json().memberships[0]).toMatchObject({ role: "driver" });
    });
  });
});
