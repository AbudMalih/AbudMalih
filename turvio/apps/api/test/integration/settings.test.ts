import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SEED_USERS as U } from "../../src/seed";
import { trackingState } from "../../src/routes/settings";
import { createTestEnv, postgresAvailable, type TestEnv } from "./helpers";

/**
 * Settings: personal preferences (own row only), company settings (admin-only changes),
 * live tracking administration (per-driver state, bulk pilot switching – existing tracking model,
 * acknowledgement never bypassed).
 */
const available = await postgresAvailable();
let env: TestEnv;
const org = () => env.data.orgs.jarbou;
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

describe("tracking state rules (order of reasons)", () => {
  const cfg = { mode: "pilot", noticeVersion: 2, staleSeconds: 120 };
  const d = { tracking_pilot: true, has_login: true, ack_version: 2, tour_id: "t", tour_status: "in_progress", position_age: 30 };
  it("each missing condition is named, never shown as live", () => {
    expect(trackingState({ ...cfg, mode: "off" }, d)).toBe("disabled");
    expect(trackingState(cfg, { ...d, tracking_pilot: false })).toBe("pilot_not_enabled");
    expect(trackingState({ ...cfg, mode: "active_tours" }, { ...d, tracking_pilot: false })).toBe("live");
    expect(trackingState(cfg, { ...d, has_login: false })).toBe("no_app_login");
    expect(trackingState(cfg, { ...d, ack_version: 1 })).toBe("awaiting_acknowledgement");
    expect(trackingState(cfg, { ...d, tour_id: null, tour_status: null })).toBe("no_active_tour");
    expect(trackingState(cfg, { ...d, tour_status: "paused" })).toBe("tour_paused");
    expect(trackingState(cfg, { ...d, position_age: null })).toBe("no_recent_position");
    expect(trackingState(cfg, { ...d, position_age: 121 })).toBe("no_recent_position");
    expect(trackingState(cfg, d)).toBe("live");
  });
});

describe.runIf(available)("settings API", () => {
  beforeAll(async () => {
    env = await createTestEnv("settings");
  }, 120_000);
  afterAll(async () => {
    await env?.close();
  });

  describe("personal preferences", () => {
    it("default, update, per-user isolation", async () => {
      expect((await env.as(U.dispatcherHannover, "GET", `/v1/me/preferences`)).json()).toMatchObject({ language: null, theme: "system", dateFormat: "dmy", orgDefaults: {} });
      const put = await env.as(U.dispatcherHannover, "PUT", `/v1/me/preferences`, { language: "ar", theme: "dark", orgDefaults: { [org()]: { defaultDepotId: env.data.depots.hannover, toursView: "list" } } });
      expect(put.statusCode).toBe(200);
      expect(put.json()).toMatchObject({ language: "ar", theme: "dark", orgDefaults: { [org()]: { defaultDepotId: env.data.depots.hannover, toursView: "list" } } });
      // Partial update keeps the rest.
      expect((await env.as(U.dispatcherHannover, "PUT", `/v1/me/preferences`, { theme: "light" })).json()).toMatchObject({ language: "ar", theme: "light" });
      expect((await env.as(U.dispatcherBremen, "GET", `/v1/me/preferences`)).json()).toMatchObject({ language: null, theme: "system" });
      // Another user's row is invisible even to a direct query.
      const rows = await env.superuser.query(`select count(*)::int n from user_preferences`);
      expect(rows.rows[0].n).toBe(1);
    });

    it("defaults only for own companies and accessible locations", async () => {
      const bremen = await env.as(U.dispatcherHannover, "PUT", `/v1/me/preferences`, { orgDefaults: { [org()]: { defaultDepotId: env.data.depots.bremen } } });
      expect(bremen.statusCode).toBe(422);
      const foreign = await env.as(U.dispatcherHannover, "PUT", `/v1/me/preferences`, { orgDefaults: { [env.data.orgs.muster]: { toursView: "map" } } });
      expect(foreign.statusCode).toBe(422);
      expect((await env.as(U.dispatcherHannover, "PUT", `/v1/me/preferences`, { language: "xx" })).statusCode).toBe(400);
    });
  });

  describe("company settings", () => {
    it("staff read the overview; only admins may edit (the overview says so)", async () => {
      const disp = await env.as(U.dispatcherHannover, "GET", `/v1/orgs/${org()}/settings`);
      expect(disp.statusCode).toBe(200);
      expect(disp.json().canEdit).toEqual({ company: false, tracking: false, driverRules: false, team: false, locations: false });
      expect(disp.json().subscription).toBeNull();
      const owner = (await env.as(U.jarbouOwner, "GET", `/v1/orgs/${org()}/settings`)).json();
      expect(owner.canEdit).toEqual({ company: true, tracking: true, driverRules: true, team: true, locations: true });
      expect(owner.tracking).toMatchObject({ mode: "off", pilotLimit: 20 });
      expect(owner.roles.dispatcher).toEqual(expect.arrayContaining(["tours.close", "tours.archive", "tours.delete"]));
      expect(owner.roles.dispatcher).not.toContain("org.settings.manage");
      expect((await env.as(U.driverHannover1, "GET", `/v1/orgs/${org()}/settings`)).statusCode).toBe(403);
      expect((await env.as(U.musterOwner, "GET", `/v1/orgs/${org()}/settings`)).statusCode).toBe(403);
    });

    it("company profile: admin only, validated, audited", async () => {
      expect((await env.as(U.dispatcherHannover, "PATCH", `/v1/orgs/${org()}/settings/company`, { contactPhone: "+49 511 1234" })).statusCode).toBe(403);
      expect((await env.as(U.jarbouOwner, "PATCH", `/v1/orgs/${org()}/settings/company`, { website: "http://insecure.example" })).statusCode).toBe(400);
      const ok = await env.as(U.jarbouOwner, "PATCH", `/v1/orgs/${org()}/settings/company`, { contactEmail: "dispo@jarbou.test", contactPhone: "+49 511 1234", addressCity: "Hannover" });
      expect(ok.statusCode).toBe(204);
      expect((await env.as(U.dispatcherHannover, "GET", `/v1/orgs/${org()}/settings`)).json().company).toMatchObject({ contactEmail: "dispo@jarbou.test", address: { city: "Hannover", country: "DE" } });
      const audit = (await env.superuser.query(`select changed_columns from audit_log where table_name = 'organizations' and actor_user_id = $1 order by id desc limit 1`, [env.data.users.jarbouOwner])).rows[0];
      expect(audit.changed_columns).toEqual(expect.arrayContaining(["contact_email", "contact_phone", "address_city"]));
    });
  });

  describe("live tracking administration", () => {
    const lena = () => env.data.drivers.hannover![0]!;
    const state = async (who: string, driverId: string) =>
      (await env.as(who, "GET", `/v1/orgs/${org()}/tracking/drivers`)).json().drivers.find((d: { driverId: string }) => d.driverId === driverId);

    it("each driver shows why they are (not) tracked – from disabled to live", async () => {
      expect((await state(U.dispatcherHannover, lena())).state).toBe("disabled");
      // Pilot switching: admin only, consent required, existing tracking model.
      expect((await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/tracking/pilots`, { driverIds: [lena()], enabled: true, confirmPilotConsent: true })).statusCode).toBe(403);
      expect((await env.as(U.jarbouOwner, "POST", `/v1/orgs/${org()}/tracking/pilots`, { driverIds: [lena()], enabled: true })).json().error.code).toBe("pilot_not_confirmed");
      const on = await env.as(U.jarbouOwner, "POST", `/v1/orgs/${org()}/tracking/pilots`, { driverIds: [lena(), env.data.drivers.hannover![1]!], enabled: true, confirmPilotConsent: true });
      expect(on.json()).toEqual({ changed: 2, pilots: 2 });
      expect((await env.as(U.jarbouOwner, "PATCH", `/v1/orgs/${org()}/tracking`, { mode: "pilot", pilotDriverIds: [lena(), env.data.drivers.hannover![1]!], confirmPilotConsent: true })).statusCode).toBe(200);

      const list = (await env.as(U.dispatcherHannover, "GET", `/v1/orgs/${org()}/tracking/drivers`)).json();
      expect(list.mode).toBe("pilot");
      const byId = Object.fromEntries(list.drivers.map((d: { driverId: string; state: string }) => [d.driverId, d.state]));
      expect(byId[lena()]).toBe("awaiting_acknowledgement");
      expect(byId[env.data.drivers.hannover![2]!]).toBe("pilot_not_enabled");
      expect(list.drivers.every((d: { permission: string }) => d.permission === "unknown")).toBe(true);
      // Never coordinates in this list.
      expect(JSON.stringify(list)).not.toMatch(/"lat"|"lng"/);

      await env.as(U.driverHannover1, "POST", `/v1/orgs/${org()}/tracking/notice`, {});
      expect((await state(U.dispatcherHannover, lena())).state).toBe("no_active_tour");

      const t = (await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/tours`, { depotId: env.data.depots.hannover, date: today(), driverId: lena() })).json();
      await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/stops`, { tourId: t.id, stops: [{ address: { street: "A", houseNumber: "1", postalCode: "30159", city: "Hannover" }, location: { lat: 52.37, lng: 9.73 } }] });
      await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/tours/${t.id}/publish`, { expectedVersion: t.version });
      await env.as(U.driverHannover1, "POST", `/v1/orgs/${org()}/tours/${t.id}/status`, { status: "in_progress" });
      expect((await state(U.dispatcherHannover, lena())).state).toBe("no_recent_position");
      await env.as(U.driverHannover1, "POST", `/v1/orgs/${org()}/tours/${t.id}/locations`, { points: [{ id: randomUUID(), lat: 52.38, lng: 9.74, recordedAt: new Date().toISOString() }] });
      const live = await state(U.dispatcherHannover, lena());
      expect(live).toMatchObject({ state: "live", pilot: true, acknowledgedCurrent: true, currentTour: { id: t.id, status: "in_progress" } });
      // A stale position is never shown as current.
      await env.superuser.query(`update driver_positions set recorded_at = now() - interval '10 minutes' where tour_id = $1`, [t.id]);
      expect((await state(U.dispatcherHannover, lena())).state).toBe("no_recent_position");
      // A new notice version requires a new acknowledgement.
      await env.as(U.jarbouOwner, "PATCH", `/v1/orgs/${org()}/tracking`, { newNoticeVersion: true });
      expect((await state(U.dispatcherHannover, lena())).state).toBe("awaiting_acknowledgement");
    });

    it("location scope applies; drivers cannot read it", async () => {
      const bremen = (await env.as(U.dispatcherBremen, "GET", `/v1/orgs/${org()}/tracking/drivers`)).json();
      expect(bremen.drivers.find((d: { driverId: string }) => d.driverId === env.data.drivers.hannover![0])).toBeUndefined();
      expect((await env.as(U.driverHannover1, "GET", `/v1/orgs/${org()}/tracking/drivers`)).statusCode).toBe(403);
      expect((await env.as(U.musterOwner, "POST", `/v1/orgs/${org()}/tracking/pilots`, { driverIds: [env.data.drivers.hannover![0]!], enabled: false })).statusCode).toBe(403);
      // A driver of another company is refused (nothing changes).
      const r = await env.as(U.musterOwner, "POST", `/v1/orgs/${env.data.orgs.muster}/tracking/pilots`, { driverIds: [env.data.drivers.hannover![0]!], enabled: false });
      expect(r.json().error.code).toBe("invalid_reference");
    });
  });
});
