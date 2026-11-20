import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MAX_EVENT_STREAMS_PER_USER } from "../../src/routes/events";
import { SEED_USERS as U } from "../../src/seed";
import { createTestEnv, postgresAvailable, type TestEnv } from "./helpers";

/**
 * Final stabilization sprint (20261120000100 + API): live-position quality, paused tours,
 * depot/date/company isolation of the live map, server-side freshness, acknowledgement withdrawal
 * with audit, company notice texts, live-update stream limit.
 */
const available = await postgresAvailable();
let env: TestEnv;
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const fix = (secondsAgo: number, lat = 52.38, lng = 9.74, accuracy = 6) => ({ id: randomUUID(), lat, lng, accuracy, speed: 8, heading: 90, recordedAt: new Date(Date.now() - secondsAgo * 1000).toISOString() });

describe.runIf(available)("tracking stabilization", () => {
  beforeAll(async () => {
    env = await createTestEnv("trackstab");
  }, 120_000);
  afterAll(async () => {
    await env?.close();
  });
  const org = () => env.data.orgs.jarbou;
  const lena = () => env.data.drivers.hannover![0]!;
  let tourId = "";
  const live = async (as: string, query = "") => (await env.as(as, "GET", `/v1/orgs/${org()}/fleet/live${query}`)).json();
  const send = async (...points: ReturnType<typeof fix>[]) => (await env.as(U.driverHannover1, "POST", `/v1/orgs/${org()}/tours/${tourId}/locations`, { points })).json();
  const livePos = async () => (await env.superuser.query<{ lat: number; lng: number }>(`select lat, lng from driver_positions where tour_id = $1`, [tourId])).rows[0];
  const pings = async () => Number((await env.superuser.query<{ n: string }>(`select count(*) as n from location_pings where tour_id = $1`, [tourId])).rows[0]!.n);

  it("setup: pilot tracking for Lena, notice acknowledged, tour running", async () => {
    expect((await env.as(U.jarbouOwner, "PATCH", `/v1/orgs/${org()}/tracking`, { mode: "pilot", pilotDriverIds: [lena()], confirmPilotConsent: true })).statusCode).toBe(200);
    expect((await env.as(U.driverHannover1, "POST", `/v1/orgs/${org()}/tracking/notice`)).statusCode).toBe(200);
    const t = (await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/tours`, { depotId: env.data.depots.hannover, date: today(), driverId: lena() })).json();
    tourId = t.id;
    await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/stops`, { tourId, stops: [{ address: { street: "Teststraße", houseNumber: "1", postalCode: "30159", city: "Hannover" }, location: { lat: 52.37, lng: 9.73 } }] });
    expect((await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/tours/${tourId}/publish`, { expectedVersion: t.version })).statusCode).toBe(200);
    expect((await env.as(U.driverHannover1, "POST", `/v1/orgs/${org()}/tours/${tourId}/status`, { status: "in_progress" })).statusCode).toBe(200);
    expect((await send(fix(20))).accepted).toBe(1);
    expect(await livePos()).toMatchObject({ lat: 52.38, lng: 9.74 });
  });

  it("an inaccurate fix (> 150 m) is kept in the history but does not move the live position", async () => {
    const before = await pings();
    expect((await send(fix(15, 52.5, 9.9, 800))).accepted).toBe(1);
    expect(await pings()).toBe(before + 1);
    expect(await livePos()).toMatchObject({ lat: 52.38, lng: 9.74 });
  });

  it("a physically impossible jump is kept in the history but does not move the live position", async () => {
    // ~55 km in 5 s.
    expect((await send(fix(10, 52.88, 9.74))).accepted).toBe(1);
    expect(await livePos()).toMatchObject({ lat: 52.38, lng: 9.74 });
    // A plausible move (≈ 110 m in 5 s = 22 m/s) is applied.
    expect((await send(fix(5, 52.381, 9.74))).accepted).toBe(1);
    expect(await livePos()).toMatchObject({ lat: 52.381 });
  });

  it("an older fix (offline buffer) never replaces a newer live position", async () => {
    // Recorded after the tour started but before the current live fix (5 s ago).
    expect((await send(fix(8, 52.3815, 9.7405))).accepted).toBe(1);
    expect(await livePos()).toMatchObject({ lat: 52.381 });
  });

  it("live map: server-side freshness (live), shape kept for existing clients", async () => {
    const r = await live(U.dispatcherHannover);
    expect(r.staleAfterSeconds).toBeGreaterThanOrEqual(120);
    expect(r.offlineAfterSeconds).toBeGreaterThan(r.staleAfterSeconds);
    expect(r.vehicles).toHaveLength(1);
    expect(r.vehicles[0]).toMatchObject({ driverId: lena(), tourId, state: "live", position: { lat: 52.381 } });
    expect(Date.parse(r.serverTime) - Date.parse(r.vehicles[0].positionAt)).toBeLessThan(60_000);
  });

  it("a fix recorded long ago but uploaded now is not shown as live", async () => {
    await env.superuser.query(`update driver_positions set recorded_at = now() - interval '20 minutes', received_at = now() where tour_id = $1`, [tourId]);
    expect((await live(U.dispatcherHannover)).vehicles[0].state).toBe("offline");
    await env.superuser.query(`update driver_positions set recorded_at = now() - interval '4 minutes', received_at = now() - interval '4 minutes' where tour_id = $1`, [tourId]);
    expect((await live(U.dispatcherHannover)).vehicles[0].state).toBe("delayed");
  });

  it("isolation: other depot, other date, other depot filter and other company see nothing", async () => {
    expect((await live(U.dispatcherBremen)).vehicles).toHaveLength(0);
    expect((await live(U.dispatcherBremen)).unavailable).toHaveLength(0);
    expect((await live(U.dispatcherHannover, `?depotId=${env.data.depots.bremen}`)).vehicles).toHaveLength(0);
    expect((await live(U.dispatcherHannover, `?date=2020-01-01`)).vehicles).toHaveLength(0);
    expect((await live(U.dispatcherHannover, `?tourId=${tourId}`)).vehicles).toHaveLength(1);
    const otherCompany = await env.as(U.musterOwner, "GET", `/v1/orgs/${org()}/fleet/live`);
    expect(otherCompany.statusCode).toBe(403);
  });

  it("a paused tour shows no position (break time) – listed as paused instead", async () => {
    expect((await env.as(U.driverHannover1, "POST", `/v1/orgs/${org()}/tours/${tourId}/status`, { status: "paused" })).statusCode).toBe(200);
    const r = await live(U.dispatcherHannover);
    expect(r.vehicles).toHaveLength(0);
    expect(r.unavailable).toEqual([expect.objectContaining({ tourId, reason: "paused" })]);
    expect(JSON.stringify(r.unavailable)).not.toMatch(/"lat"\s*:\s*52\.381/);
    expect((await env.as(U.driverHannover1, "POST", `/v1/orgs/${org()}/tours/${tourId}/status`, { status: "in_progress" })).statusCode).toBe(200);
  });

  it("withdrawing the acknowledgement stops tracking at once and is audited", async () => {
    const w = await env.as(U.driverHannover1, "POST", `/v1/orgs/${org()}/tracking/notice/withdraw`);
    expect(w.statusCode).toBe(200);
    expect(w.json().withdrawn).toBeGreaterThanOrEqual(1);
    expect(await livePos()).toBeUndefined();
    expect((await env.as(U.driverHannover1, "GET", `/v1/orgs/${org()}/tracking/config`)).json().acknowledgedVersion).toBeNull();
    const refused = await env.as(U.driverHannover1, "POST", `/v1/orgs/${org()}/tours/${tourId}/locations`, { points: [fix(1)] });
    expect(refused.json().error.code).toBe("tracking_notice_required");
    const audit = (await env.superuser.query<{ action: string }>(`select action from audit_log where table_name = 'tracking_notice_acks' and record_id = $1 order by id`, [lena()])).rows.map((r) => r.action);
    expect(audit).toEqual(expect.arrayContaining(["acknowledge", "withdraw"]));
    // Another user cannot withdraw for Lena (only their own driver profiles).
    expect((await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/tracking/notice/withdraw`)).statusCode).toBe(403);
  });

  it("company notice (controller, contact, legal basis): a change requires a new acknowledgement", async () => {
    const before = (await env.as(U.driverHannover1, "GET", `/v1/orgs/${org()}/tracking/config`)).json().noticeVersion;
    const p = await env.as(U.jarbouOwner, "PATCH", `/v1/orgs/${org()}/tracking`, {
      notice: { controller: "JARBOU Logistik GmbH, Musterstraße 1, 30159 Hannover", contact: "datenschutz@jarbou.test", legalBasis: "§ 26 BDSG / Art. 6(1)(b) GDPR" },
    });
    expect(p.statusCode).toBe(200);
    expect(p.json().noticeVersion).toBe(before + 1);
    const cfg = (await env.as(U.driverHannover1, "GET", `/v1/orgs/${org()}/tracking/config`)).json();
    expect(cfg.notice).toMatchObject({ controller: expect.stringContaining("JARBOU"), contact: "datenschutz@jarbou.test", legalBasis: expect.stringContaining("26 BDSG"), text: null });
    // Unchanged texts do not bump the version again.
    expect((await env.as(U.jarbouOwner, "PATCH", `/v1/orgs/${org()}/tracking`, { notice: { contact: "datenschutz@jarbou.test" } })).json().noticeVersion).toBe(before + 1);
    // Acknowledging again restores tracking.
    expect((await env.as(U.driverHannover1, "POST", `/v1/orgs/${org()}/tracking/notice`)).json().acknowledgedVersion).toBe(before + 1);
    expect((await send(fix(1))).accepted).toBe(1);
    // Dispatchers cannot change the notice.
    expect((await env.as(U.dispatcherHannover, "PATCH", `/v1/orgs/${org()}/tracking`, { notice: { controller: "x" } })).statusCode).toBe(403);
  });

  it(`live-update streams are limited to ${MAX_EVENT_STREAMS_PER_USER} per user`, async () => {
    const base = await env.app.listen({ port: 0, host: "127.0.0.1" });
    const token = await env.login(U.dispatcherHannover);
    const ctrls: AbortController[] = [];
    try {
      for (let i = 0; i < MAX_EVENT_STREAMS_PER_USER; i++) {
        const c = new AbortController();
        ctrls.push(c);
        const r = await fetch(`${base}/v1/orgs/${org()}/events`, { headers: { authorization: `Bearer ${token}` }, signal: c.signal });
        expect(r.status).toBe(200);
      }
      const extra = await fetch(`${base}/v1/orgs/${org()}/events`, { headers: { authorization: `Bearer ${token}` } });
      expect(extra.status).toBe(429);
      // Closing a stream frees a slot.
      ctrls.pop()!.abort();
      await new Promise((r) => setTimeout(r, 200));
      const c = new AbortController();
      ctrls.push(c);
      expect((await fetch(`${base}/v1/orgs/${org()}/events`, { headers: { authorization: `Bearer ${token}` }, signal: c.signal })).status).toBe(200);
    } finally {
      ctrls.forEach((c) => c.abort());
    }
  });
});
