/**
 * Staging stand-in for the release rehearsal (deploy/staging/test/release-rehearsal.sh).
 * Copied into a worktree of the PREVIOUS (deployed) release and run there with its own test harness,
 * so the database holds what that release writes: the seed (synthetic data only) plus draft,
 * published and running tours, deliveries, a failed attempt, a note, a driver address correction.
 * The database is left in place (not dropped); its name is written to $STANDIN_OUT.
 */
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SEED_USERS as U } from "../../src/seed";
import { createTestEnv } from "./helpers";

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

describe("staging stand-in (previous release)", () => {
  it("seeds a realistic database and keeps it", async () => {
    const env = await createTestEnv("standin");
    const org = env.data.orgs.jarbou;
    const mk = async (driverIdx: number, n: number, publish: boolean) => {
      const t = (await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org}/tours`, { depotId: env.data.depots.hannover, date: today(), driverId: env.data.drivers.hannover![driverIdx] })).json();
      const r = await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org}/stops`, {
        tourId: t.id,
        stops: Array.from({ length: n }, (_, i) => ({ address: { street: "Teststraße", houseNumber: String(i + 1), postalCode: "30159", city: "Hannover" }, location: { lat: 52.37 + i * 0.001, lng: 9.73 + (i % 5) * 0.002 }, trackingNumbers: [`TVOST${driverIdx}${String(i).padStart(3, "0")}0000`] })),
      });
      expect(r.statusCode, r.body).toBeLessThan(300);
      if (publish) expect((await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org}/tours/${t.id}/publish`, { expectedVersion: t.version })).statusCode).toBe(200);
      return t.id as string;
    };
    await mk(0, 12, true); // published, then run by driver 1 below
    await mk(1, 8, true); // published, untouched
    const drivers = env.data.drivers.hannover!;
    if (drivers.length > 2) await mk(2, 5, false);
    else {
      // a draft tour without a driver
      const t = (await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org}/tours`, { depotId: env.data.depots.hannover, date: today() })).json();
      await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org}/stops`, { tourId: t.id, stops: [{ address: { street: "Entwurfweg", houseNumber: "1", postalCode: "30159", city: "Hannover" }, location: { lat: 52.375, lng: 9.735 }, trackingNumbers: ["TVOSTDRAFT00001"] }] });
    }

    const stops = (await env.as(U.driverHannover1, "GET", "/v1/me/tours")).json().tours[0].stops as { id: string }[];
    const st = (id: string, body: object) => env.as(U.driverHannover1, "POST", `/v1/orgs/${org}/stops/${id}/status`, { clientEventId: randomUUID(), ...body });
    for (const s of stops.slice(0, 3)) expect((await st(s.id, { status: "delivered" })).statusCode).toBe(200);
    expect((await st(stops[3]!.id, { status: "attempted", failureReason: "recipient_absent", notes: "Karte eingeworfen" })).statusCode).toBe(200);
    expect((await env.as(U.driverHannover1, "POST", `/v1/orgs/${org}/stops/${stops[4]!.id}/note`, { note: "Hinterhof", clientEventId: randomUUID() })).statusCode).toBe(204);
    const edit = await env.as(U.driverHannover1, "POST", `/v1/orgs/${org}/stops/${stops[5]!.id}/edit`, { address: { street: "Lister Meile", houseNumber: "42", postalCode: "30161", city: "Hannover" }, location: { lat: 52.3826, lng: 9.7462 }, locationSource: "manual_pin" });
    expect(edit.statusCode, edit.body).toBe(200);

    const dbName = (await env.superuser.query<{ d: string }>("select current_database() d")).rows[0]!.d;
    await env.app.close();
    await env.events.stop();
    await env.db.close();
    await env.superuser.end();
    writeFileSync(process.env.STANDIN_OUT ?? "standin-db.txt", dbName);
  }, 180_000);
});
