import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SEED_USERS as U } from "../../src/seed";
import { PASSWORD, createTestEnv, postgresAvailable, type TestEnv } from "./helpers";

const available = await postgresAvailable();
if (!available) console.warn("PostgreSQL not reachable – integration tests skipped (start it with scripts/db.sh start)");

let env: TestEnv;
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

const synthStop = (i: number) => ({
  type: i % 9 === 4 ? "pickup" : "delivery",
  recipientName: `Testkunde ${i + 1}`,
  address: { street: `Teststraße`, houseNumber: String(i + 1), postalCode: "30159", city: "Hannover" },
  location: { lat: 52.36 + (i % 5) * 0.006, lng: 9.71 + Math.floor(i / 5) * 0.008 },
  timeWindow: i % 9 === 4 ? { start: 780, end: 900 } : undefined,
  priority: i === 3,
  trackingNumbers: [`TVOIT${String(i).padStart(4, "0")}DE`],
});

describe.runIf(available)("TURVIO API on PostgreSQL", () => {
  beforeAll(async () => {
    env = await createTestEnv("api");
  }, 120_000);
  afterAll(async () => {
    await env?.close();
  });

  const jarbou = () => env.data.orgs.jarbou;
  const muster = () => env.data.orgs.muster;

  describe("authentication", () => {
    it("logs in, refreshes with rotation and detects refresh-token reuse", async () => {
      const r1 = await env.app.inject({ method: "POST", url: "/v1/auth/login", payload: { email: U.jarbouOwner, password: PASSWORD } });
      expect(r1.statusCode).toBe(200);
      const s1 = r1.json();
      expect(s1.user.email).toBe(U.jarbouOwner);
      const r2 = await env.app.inject({ method: "POST", url: "/v1/auth/refresh", payload: { refreshToken: s1.refreshToken } });
      expect(r2.statusCode).toBe(200);
      const s2 = r2.json();
      expect(s2.refreshToken).not.toBe(s1.refreshToken);
      // Reusing the rotated token is rejected and kills the newer session too.
      expect((await env.app.inject({ method: "POST", url: "/v1/auth/refresh", payload: { refreshToken: s1.refreshToken } })).statusCode).toBe(401);
      expect((await env.app.inject({ method: "POST", url: "/v1/auth/refresh", payload: { refreshToken: s2.refreshToken } })).statusCode).toBe(401);
    });

    it("rejects wrong passwords and throttles repeated failures", async () => {
      for (let i = 0; i < 5; i++) {
        const r = await env.app.inject({ method: "POST", url: "/v1/auth/login", payload: { email: U.musterOwner, password: "wrong-password-1" } });
        expect(r.statusCode).toBe(401);
      }
      const blocked = await env.app.inject({ method: "POST", url: "/v1/auth/login", payload: { email: U.musterOwner, password: PASSWORD } });
      expect(blocked.statusCode).toBe(429);
      await env.superuser.query(`delete from app_auth.login_failures`);
    });

    it("logout revokes the refresh token", async () => {
      const s = (await env.app.inject({ method: "POST", url: "/v1/auth/login", payload: { email: U.dispatcherBremen, password: PASSWORD } })).json();
      expect((await env.app.inject({ method: "POST", url: "/v1/auth/logout", payload: { refreshToken: s.refreshToken } })).statusCode).toBe(204);
      expect((await env.app.inject({ method: "POST", url: "/v1/auth/refresh", payload: { refreshToken: s.refreshToken } })).statusCode).toBe(401);
    });

    it("resets a password via emailed single-use link without revealing unknown accounts", async () => {
      expect((await env.app.inject({ method: "POST", url: "/v1/auth/password/forgot", payload: { email: "nobody@example.test" } })).statusCode).toBe(202);
      expect((await env.app.inject({ method: "POST", url: "/v1/auth/password/forgot", payload: { email: U.driverBremen1 } })).statusCode).toBe(202);
      const mails = (await env.app.inject({ method: "GET", url: `/v1/dev/outbox?to=${encodeURIComponent(U.driverBremen1)}` })).json();
      expect(mails).toHaveLength(1);
      const token = /token=([^\s]+)/.exec(mails[0].body)![1]!;
      const weak = await env.app.inject({ method: "POST", url: "/v1/auth/password/reset", payload: { token: decodeURIComponent(token), password: "short" } });
      expect(weak.statusCode).toBe(422);
      const ok = await env.app.inject({ method: "POST", url: "/v1/auth/password/reset", payload: { token: decodeURIComponent(token), password: "New-Passw0rd-2026" } });
      expect(ok.statusCode).toBe(204);
      expect((await env.app.inject({ method: "POST", url: "/v1/auth/password/reset", payload: { token: decodeURIComponent(token), password: "Another-Passw0rd" } })).statusCode).toBe(401);
      expect((await env.app.inject({ method: "POST", url: "/v1/auth/login", payload: { email: U.driverBremen1, password: "New-Passw0rd-2026" } })).statusCode).toBe(200);
      expect((await env.app.inject({ method: "POST", url: "/v1/auth/login", payload: { email: U.driverBremen1, password: PASSWORD } })).statusCode).toBe(401);
      await env.superuser.query(`delete from app_auth.login_failures`);
    });

    it("rejects missing and forged tokens", async () => {
      expect((await env.app.inject({ method: "GET", url: "/v1/me" })).statusCode).toBe(401);
      expect((await env.app.inject({ method: "GET", url: "/v1/me", headers: { authorization: "Bearer abc.def.ghi" } })).statusCode).toBe(401);
    });
  });

  describe("company invitations and workspace", () => {
    it("owner invites a depot-limited dispatcher who accepts and gets exactly that scope", async () => {
      const kassel = env.data.depots.kassel!;
      const inv = await env.as(U.jarbouOwner, "POST", `/v1/orgs/${jarbou()}/invitations`, { email: "new.dispatcher@jarbou.test", role: "dispatcher", depotIds: [kassel] });
      expect(inv.statusCode).toBe(201);
      const mail = (await env.app.inject({ method: "GET", url: `/v1/dev/outbox?to=new.dispatcher@jarbou.test` })).json()[0];
      const token = decodeURIComponent(/token=([^\s]+)/.exec(mail.body)![1]!);
      const info = (await env.app.inject({ method: "GET", url: `/v1/invitations/${token}` })).json();
      expect(info).toMatchObject({ organizationName: "JARBOU Logistik GmbH", role: "dispatcher", state: "open" });
      const acc = await env.app.inject({ method: "POST", url: "/v1/invitations/accept", payload: { token, password: "Kassel-Dispatch-1", displayName: "Kai Kassel" } });
      expect(acc.statusCode).toBe(200);
      const me = await env.app.inject({ method: "GET", url: "/v1/me", headers: { authorization: `Bearer ${acc.json().accessToken}` } });
      expect(me.json().memberships).toEqual([{ organizationId: jarbou(), organizationName: "JARBOU Logistik GmbH", role: "dispatcher", depotIds: [kassel] }]);
      const ds = await env.app.inject({ method: "GET", url: `/v1/orgs/${jarbou()}/dispatch`, headers: { authorization: `Bearer ${acc.json().accessToken}` } });
      expect(ds.json().depots.map((d: { name: string }) => d.name)).toEqual(["Kassel"]);
      expect((await env.app.inject({ method: "POST", url: "/v1/invitations/accept", payload: { token, password: "Kassel-Dispatch-1" } })).statusCode).toBe(410);
    });

    it("dispatchers may invite drivers but not admins", async () => {
      const admin = await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${jarbou()}/invitations`, { email: "x@jarbou.test", role: "admin" });
      expect(admin.statusCode).toBe(403);
      const driver = await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${jarbou()}/invitations`, { email: "samir@jarbou.test", role: "driver", driverId: env.data.drivers.hannover![2] });
      expect(driver.statusCode).toBe(201);
    });

    it("lists memberships for workspace switching", async () => {
      const me = (await env.as(U.musterOwner, "GET", "/v1/me")).json();
      expect(me.memberships.map((m: { organizationName: string }) => m.organizationName)).toEqual(["Muster Kurier GmbH"]);
      expect(me.platformAdmin).toBe(false);
    });
  });

  describe("tenant and role isolation", () => {
    it("company A cannot read or change company B", async () => {
      expect((await env.as(U.musterOwner, "GET", `/v1/orgs/${jarbou()}/dispatch`)).statusCode).toBe(403);
      expect((await env.as(U.jarbouOwner, "GET", `/v1/orgs/${muster()}/dispatch`)).statusCode).toBe(403);
      expect((await env.as(U.musterOwner, "POST", `/v1/orgs/${jarbou()}/tours`, { depotId: env.data.depots.hannover, date: today() })).statusCode).toBe(403);
      // Using its own org id with a foreign depot fails in the database (RLS / composite keys).
      const foreignDepot = await env.as(U.musterOwner, "POST", `/v1/orgs/${muster()}/tours`, { depotId: env.data.depots.hannover, date: today() });
      expect([403, 404, 422]).toContain(foreignDepot.statusCode);
    });

    it("depot-restricted dispatchers only see and change their depots", async () => {
      const ds = (await env.as(U.dispatcherHannover, "GET", `/v1/orgs/${jarbou()}/dispatch`)).json();
      expect(ds.depots.map((d: { name: string }) => d.name)).toEqual(["Hannover"]);
      expect(ds.drivers.every((d: { depotId: string }) => d.depotId === env.data.depots.hannover)).toBe(true);
      const bremenTour = await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${jarbou()}/tours`, { depotId: env.data.depots.bremen, date: today() });
      expect([403, 404]).toContain(bremenTour.statusCode);
      const bremenDispatcherTour = (await env.as(U.dispatcherBremen, "POST", `/v1/orgs/${jarbou()}/tours`, { depotId: env.data.depots.bremen, date: today() })).json();
      const patch = await env.as(U.dispatcherHannover, "PATCH", `/v1/orgs/${jarbou()}/tours/${bremenDispatcherTour.id}`, { expectedVersion: 1, name: "hijack" });
      expect(patch.statusCode).toBe(404);
    });

    it("cannot assign a driver or vehicle of another company", async () => {
      const t = (await env.as(U.jarbouOwner, "POST", `/v1/orgs/${jarbou()}/tours`, { depotId: env.data.depots.kassel, date: today() })).json();
      const musterDriver = (await env.superuser.query(`select id from drivers where organization_id = $1`, [muster()])).rows[0].id;
      const r = await env.as(U.jarbouOwner, "PATCH", `/v1/orgs/${jarbou()}/tours/${t.id}`, { expectedVersion: t.version, driverId: musterDriver });
      expect(r.statusCode).toBe(422);
      expect(r.json().error.code).toBe("invalid_reference");
    });

    it("drivers cannot manage tours and see only their own published tours", async () => {
      const t = (await env.as(U.jarbouOwner, "POST", `/v1/orgs/${jarbou()}/tours`, { depotId: env.data.depots.haiger, date: today() })).json();
      expect((await env.as(U.driverHannover1, "PATCH", `/v1/orgs/${jarbou()}/tours/${t.id}`, { expectedVersion: t.version, name: "x" })).statusCode).toBe(403);
      expect((await env.as(U.driverHannover1, "GET", `/v1/orgs/${jarbou()}/dispatch`)).statusCode).toBe(403);
      const mine = (await env.as(U.musterDriver, "GET", "/v1/me/tours")).json().tours;
      expect(mine.map((x: { tour: { name: string } }) => x.tour.name)).toEqual(["LEI-01"]);
      const stopOfMuster = mine[0].stops[0].id;
      // A JARBOU driver cannot touch Muster's stop (not visible -> 404 / no access to org -> 403).
      expect([403, 404]).toContain((await env.as(U.driverHannover1, "POST", `/v1/orgs/${muster()}/stops/${stopOfMuster}/status`, { status: "delivered" })).statusCode);
      expect((await env.as(U.driverHannover1, "POST", `/v1/orgs/${jarbou()}/stops/${stopOfMuster}/status`, { status: "delivered" })).statusCode).toBe(404);
    });

    it("platform admins see aggregates but no delivery data", async () => {
      const ov = await env.as(U.platformAdmin, "GET", "/v1/platform/overview");
      expect(ov.statusCode).toBe(200);
      const j = ov.json().organizations.find((o: { id: string }) => o.id === jarbou());
      expect(j.activeDrivers).toBe(16);
      expect(j.subscription.planCode).toBe("business");
      expect((await env.as(U.platformAdmin, "GET", `/v1/orgs/${jarbou()}/dispatch`)).statusCode).toBe(403);
      expect((await env.as(U.jarbouOwner, "GET", "/v1/platform/overview")).statusCode).toBe(403);
    });
  });

  describe("dispatcher → driver workflow (Hannover, 25 stops)", () => {
    let tour: { id: string; version: number; name: string };
    const H = () => env.data.depots.hannover!;
    const lenaDriver = () => env.data.drivers.hannover![0]!;
    const sprinter = () => env.data.vehicles.hannover![0]!;

    it("creates a tour, adds 25 stops, assigns driver and vehicle", async () => {
      const created = await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${jarbou()}/tours`, { depotId: H(), date: today(), plannedStartMinute: 450 });
      expect(created.statusCode).toBe(201);
      tour = created.json();
      expect(tour.name).toBe("HAN-01");
      const stops = await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${jarbou()}/stops`, { tourId: tour.id, stops: Array.from({ length: 25 }, (_, i) => synthStop(i)) });
      expect(stops.statusCode).toBe(201);
      expect(stops.json().ids).toHaveLength(25);
      const assigned = await env.as(U.dispatcherHannover, "PATCH", `/v1/orgs/${jarbou()}/tours/${tour.id}`, { expectedVersion: tour.version, driverId: lenaDriver(), vehicleId: sprinter() });
      expect(assigned.statusCode).toBe(200);
      expect(assigned.json().version).toBe(tour.version + 1);
      // Stale version -> conflict.
      const stale = await env.as(U.dispatcherHannover, "PATCH", `/v1/orgs/${jarbou()}/tours/${tour.id}`, { expectedVersion: tour.version, name: "stale" });
      expect(stale.statusCode).toBe(409);
      tour = assigned.json();
      // The same driver cannot be booked on a second open tour that day.
      const other = (await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${jarbou()}/tours`, { depotId: H(), date: today() })).json();
      const busy = await env.as(U.dispatcherHannover, "PATCH", `/v1/orgs/${jarbou()}/tours/${other.id}`, { expectedVersion: other.version, driverId: lenaDriver() });
      expect(busy.statusCode).toBe(409);
      expect(busy.json().error.code).toBe("driver_busy");
      expect((await env.as(U.dispatcherHannover, "DELETE", `/v1/orgs/${jarbou()}/tours/${other.id}?expectedVersion=${other.version}`)).statusCode).toBe(204);
    });

    it("optimizes and saves the stop order", async () => {
      const before = (await env.as(U.dispatcherHannover, "GET", `/v1/orgs/${jarbou()}/tours/${tour.id}`)).json().stops.map((s: { id: string }) => s.id);
      const r = await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${jarbou()}/tours/${tour.id}/optimize`, {});
      expect(r.statusCode).toBe(200);
      const after = r.json().stops.map((s: { id: string }) => s.id);
      expect(after).toEqual([...before].reverse()); // fake optimizer reverses
      expect(r.json().tour.optimization.matrixSource).toBe("haversine_estimate");
      tour = r.json().tour;
    });

    it("drivers do not see the tour until it is published", async () => {
      expect((await env.as(U.driverHannover1, "GET", "/v1/me/tours")).json().tours).toHaveLength(0);
      const pub = await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${jarbou()}/tours/${tour.id}/publish`, { expectedVersion: tour.version });
      expect(pub.statusCode).toBe(200);
      tour = pub.json().tour;
      const mine = (await env.as(U.driverHannover1, "GET", "/v1/me/tours")).json().tours;
      expect(mine).toHaveLength(1);
      expect(mine[0].stops).toHaveLength(25);
      expect(mine[0].vehicle.label).toBe("Sprinter 1");
      // The other Hannover driver sees nothing.
      expect((await env.as(U.driverHannover2, "GET", "/v1/me/tours")).json().tours).toHaveLength(0);
    });

    it("driver starts the tour and completes five stops; dispatch sees the progress", async () => {
      expect((await env.as(U.driverHannover1, "POST", `/v1/orgs/${jarbou()}/tours/${tour.id}/status`, { status: "in_progress" })).statusCode).toBe(200);
      const stops = (await env.as(U.driverHannover1, "GET", "/v1/me/tours")).json().tours[0].stops as { id: string; type: string }[];
      for (const s of stops.slice(0, 5)) {
        const r = await env.as(U.driverHannover1, "POST", `/v1/orgs/${jarbou()}/stops/${s.id}/status`, { status: s.type === "pickup" ? "picked_up" : "delivered" });
        expect(r.statusCode).toBe(200);
      }
      // Another driver cannot update this tour's stops.
      expect((await env.as(U.driverHannover2, "POST", `/v1/orgs/${jarbou()}/stops/${stops[6]!.id}/status`, { status: "delivered" })).statusCode).toBe(404);
      const ds = (await env.as(U.dispatcherHannover, "GET", `/v1/orgs/${jarbou()}/dispatch`)).json();
      const mine = ds.stops.filter((s: { tourId: string }) => s.tourId === tour.id);
      expect(mine.filter((s: { status: string }) => s.status !== "pending")).toHaveLength(5);
      expect(ds.tours.find((t: { id: string }) => t.id === tour.id).status).toBe("in_progress");
      const events = (await env.as(U.dispatcherHannover, "GET", `/v1/orgs/${jarbou()}/tours/${tour.id}/events`)).json();
      const kinds = events.filter((e: { source: string }) => e.source === "tour").map((e: { kind: string }) => e.kind).reverse();
      expect(kinds).toEqual(["created", "assigned", "optimized", "published", "started"]);
      expect(events.filter((e: { source: string }) => e.source === "stop")).toHaveLength(5);
    });

    it("emits change notifications for the dispatcher's depot", async () => {
      const seen: unknown[] = [];
      const off = env.events.subscribe((e) => seen.push(e));
      const stops = (await env.as(U.driverHannover1, "GET", "/v1/me/tours")).json().tours[0].stops as { id: string; status: string }[];
      const next = stops.find((s) => s.status === "pending")!;
      await env.as(U.driverHannover1, "POST", `/v1/orgs/${jarbou()}/stops/${next.id}/status`, { status: "failed", failureReason: "recipient_absent", notes: "Niemand angetroffen" });
      await new Promise((r) => setTimeout(r, 300));
      off();
      expect(seen).toContainEqual(expect.objectContaining({ org: jarbou(), depot: H(), tour: tour.id, table: "stops" }));
    });

    it("unassigned stops can be planned onto tours of the same depot only", async () => {
      const add = await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${jarbou()}/stops`, { depotId: H(), stops: [synthStop(99)] });
      const id = add.json().ids[0];
      const ds = (await env.as(U.dispatcherHannover, "GET", `/v1/orgs/${jarbou()}/dispatch`)).json();
      expect(ds.unassigned.map((u: { id: string }) => u.id)).toContain(id);
      const bremen = (await env.as(U.dispatcherBremen, "POST", `/v1/orgs/${jarbou()}/tours`, { depotId: env.data.depots.bremen, date: today() })).json();
      expect((await env.as(U.jarbouOwner, "POST", `/v1/orgs/${jarbou()}/stops/assign`, { stopIds: [id], tourId: bremen.id })).statusCode).toBe(422);
      expect((await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${jarbou()}/stops/assign`, { stopIds: [id], tourId: tour.id })).statusCode).toBe(204);
      const t = (await env.as(U.dispatcherHannover, "GET", `/v1/orgs/${jarbou()}/tours/${tour.id}`)).json();
      expect(t.stops.at(-1).id).toBe(id);
    });

    it("data persists: a fresh login sees the same state", async () => {
      const fresh = await env.app.inject({ method: "POST", url: "/v1/auth/login", payload: { email: U.dispatcherHannover, password: PASSWORD } });
      const ds = await env.app.inject({ method: "GET", url: `/v1/orgs/${jarbou()}/dispatch`, headers: { authorization: `Bearer ${fresh.json().accessToken}` } });
      const t = ds.json().tours.find((x: { id: string }) => x.id === tour.id);
      expect(t.publishedAt).toBeTruthy();
      expect(ds.json().stops.filter((s: { tourId: string; status: string }) => s.tourId === tour.id && s.status !== "pending")).toHaveLength(6);
    });
  });

  describe("fleet management", () => {
    it("creates and updates drivers and vehicles; enforces plan limits", async () => {
      const d = await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${jarbou()}/drivers`, { displayName: "Neu Fahrer", depotId: env.data.depots.hannover, maxShiftMinutes: 420 });
      expect(d.statusCode).toBe(201);
      const v = await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${jarbou()}/vehicles`, { label: "Sprinter 9", licensePlate: "h-jl 999", depotId: env.data.depots.hannover, capacityParcels: 150 });
      expect(v.statusCode).toBe(201);
      expect(v.json().licensePlate).toBe("H-JL 999");
      // Muster: team plan with 3 seats, 1 driver -> two more allowed, then limit.
      const add = (n: string) => env.as(U.musterOwner, "POST", `/v1/orgs/${muster()}/drivers`, { displayName: n, depotId: null });
      expect((await add("A")).statusCode).toBe(201);
      expect((await add("B")).statusCode).toBe(201);
      const limited = await add("C");
      expect(limited.statusCode).toBe(422);
      expect(limited.json().error.code).toBe("plan_limit_reached");
    });

    it("only admins manage depots", async () => {
      const body = { name: "Göttingen", street: "Weg", postalCode: "37073", city: "Göttingen", lat: 51.54, lng: 9.93 };
      expect((await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${jarbou()}/depots`, body)).statusCode).toBe(403);
      expect((await env.as(U.jarbouOwner, "POST", `/v1/orgs/${jarbou()}/depots`, body)).statusCode).toBe(201);
    });
  });
});
