import { randomUUID } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SEED_USERS as U } from "../../src/seed";
import { LocalProofStore, type ProofStore } from "../../src/storage";
import { createTestEnv, postgresAvailable, type TestEnv } from "./helpers";

const available = await postgresAvailable();
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(32, 7)]).toString("base64");

/** Storage that fails the first `n` writes (simulates an interrupted evidence upload). */
class FlakyStore implements ProofStore {
  readonly kind = "flaky";
  failures: number;
  inner = new LocalProofStore(mkdtempSync(join(tmpdir(), "flaky-")));
  constructor(n: number) {
    this.failures = n;
  }
  async put(path: string, bytes: Buffer, type: string) {
    void type;
    if (this.failures-- > 0) throw new Error("storage temporarily unavailable");
    return this.inner.put(path, bytes);
  }
  get(path: string) {
    return this.inner.get(path);
  }
  delete(path: string) {
    return this.inner.delete(path);
  }
}

describe.runIf(available)("route editing, concurrency and retries", () => {
  let env: TestEnv;
  const store = new FlakyStore(0);
  const org = () => env.data.orgs.jarbou;
  let tourA = "";
  let tourB = "";
  let stops: { id: string; status: string; parcels: { trackingNumber: string }[] }[] = [];

  beforeAll(async () => {
    env = await createTestEnv("edit", { proofStore: store });
    const mk = async (driverIdx: number) => {
      const t = (await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/tours`, { depotId: env.data.depots.hannover, date: today(), driverId: env.data.drivers.hannover![driverIdx] })).json();
      await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/stops`, {
        tourId: t.id,
        stops: [0, 1, 2, 3].map((i) => ({ address: { street: "Weg", houseNumber: String(i + 1), postalCode: "30159", city: "Hannover" }, location: { lat: 52.37 + i * 0.002, lng: 9.73 }, trackingNumbers: [`TVOED${driverIdx}${i}00000`] })),
      });
      await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/tours/${t.id}/publish`, { expectedVersion: t.version });
      return t.id as string;
    };
    tourA = await mk(0);
    tourB = await mk(1);
    stops = (await env.as(U.driverHannover1, "GET", "/v1/me/tours")).json().tours[0].stops;
  }, 120_000);
  afterAll(async () => {
    await env?.close();
  });

  it("driver corrects an address: old coordinates are dropped unless a new pin is set", async () => {
    const r = await env.as(U.driverHannover1, "POST", `/v1/orgs/${org()}/stops/${stops[0]!.id}/edit`, { recipientName: "Erika B.", address: { street: "Lister Meile", houseNumber: "42", postalCode: "30161", city: "Hannover" } });
    expect(r.json().stop).toMatchObject({ recipientName: "Erika B.", location: null, locationSource: null });
    const r2 = await env.as(U.driverHannover1, "POST", `/v1/orgs/${org()}/stops/${stops[0]!.id}/edit`, { address: { street: "Lister Meile", houseNumber: "42", postalCode: "30161", city: "Hannover" }, location: { lat: 52.3826, lng: 9.7462 }, locationSource: "geocoder" });
    expect(r2.json().stop).toMatchObject({ location: { lat: 52.3826, lng: 9.7462 }, locationSource: "geocoder" });
    // Another driver cannot edit it.
    expect((await env.as(U.driverHannover2, "POST", `/v1/orgs/${org()}/stops/${stops[0]!.id}/edit`, { address: { street: "X", postalCode: "30161", city: "Hannover" } })).statusCode).toBe(404);
  });

  it("merging two stops keeps all tracking numbers", async () => {
    const r = await env.as(U.driverHannover1, "POST", `/v1/orgs/${org()}/stops/${stops[3]!.id}/merge`, { intoStopId: stops[2]!.id });
    expect(r.statusCode).toBe(200);
    expect(r.json().stop.parcels.map((p: { trackingNumber: string }) => p.trackingNumber).sort()).toEqual([stops[2]!.parcels[0]!.trackingNumber, stops[3]!.parcels[0]!.trackingNumber].sort());
    // Drivers may not remove stops from dispatch tours.
    expect((await env.as(U.driverHannover1, "POST", `/v1/orgs/${org()}/stops/${stops[1]!.id}/remove`)).statusCode).toBe(403);
  });

  it("dispatcher moves a stop to another tour; the drivers' lists follow", async () => {
    expect((await env.as(U.driverHannover1, "POST", `/v1/orgs/${org()}/stops/assign`, { stopIds: [stops[1]!.id], tourId: tourB })).statusCode).toBe(403);
    expect((await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/stops/assign`, { stopIds: [stops[1]!.id], tourId: tourB })).statusCode).toBe(204);
    const lena = (await env.as(U.driverHannover1, "GET", "/v1/me/tours")).json().tours[0].stops.map((s: { id: string }) => s.id);
    const mihai = (await env.as(U.driverHannover2, "GET", "/v1/me/tours")).json().tours[0].stops.map((s: { id: string }) => s.id);
    expect(lena).not.toContain(stops[1]!.id);
    expect(mihai).toContain(stops[1]!.id);
    // A status the driver queued offline for the moved stop is refused (no longer their stop) – the app shows it as rejected.
    expect((await env.as(U.driverHannover1, "POST", `/v1/orgs/${org()}/stops/${stops[1]!.id}/status`, { status: "delivered", clientEventId: randomUUID() })).statusCode).toBe(404);
  });

  it("duplicate parallel submissions of the same offline event create one event", async () => {
    const eventId = randomUUID();
    const body = { status: "delivered", clientEventId: eventId, occurredAt: new Date().toISOString() };
    const res = await Promise.all([1, 2, 3].map(() => env.as(U.driverHannover1, "POST", `/v1/orgs/${org()}/stops/${stops[0]!.id}/status`, body)));
    expect(res.map((r) => r.statusCode)).toEqual([200, 200, 200]);
    const n = (await env.superuser.query(`select count(*)::int n from stop_events where client_event_id = $1`, [eventId])).rows[0].n;
    expect(n).toBe(1);
  });

  it("a proof upload that fails in storage leaves no record and succeeds on retry", async () => {
    store.failures = 1;
    const proof = { id: randomUUID(), kind: "photo", contentType: "image/jpeg", dataBase64: JPEG, capturedAt: new Date().toISOString() };
    const first = await env.as(U.driverHannover1, "POST", `/v1/orgs/${org()}/stops/${stops[0]!.id}/proofs`, proof);
    expect(first.statusCode).toBe(500); // transient for the app -> stays in the outbox
    expect((await env.superuser.query(`select count(*)::int n from proofs where id = $1`, [proof.id])).rows[0].n).toBe(0);
    const retry = await env.as(U.driverHannover1, "POST", `/v1/orgs/${org()}/stops/${stops[0]!.id}/proofs`, proof);
    expect(retry.statusCode).toBe(201);
    expect((await env.as(U.dispatcherHannover, "GET", `/v1/orgs/${org()}/proofs/${proof.id}/file`)).statusCode).toBe(200);
  });

  it("dispatcher reorders while the driver completes stops: both changes survive", async () => {
    const open = (await env.as(U.driverHannover1, "GET", "/v1/me/tours")).json().tours[0].stops.filter((s: { status: string }) => s.status === "pending");
    const ids = open.map((s: { id: string }) => s.id);
    const t = (await env.as(U.dispatcherHannover, "GET", `/v1/orgs/${org()}/tours/${tourA}`)).json();
    const [reorder, deliver] = await Promise.all([
      env.as(U.dispatcherHannover, "POST", `/v1/me/tours/${tourA}/sequence`, { stopIds: [...ids].reverse() }),
      env.as(U.driverHannover1, "POST", `/v1/orgs/${org()}/stops/${ids[0]}/status`, { status: "delivered", clientEventId: randomUUID() }),
    ]);
    expect(deliver.statusCode).toBe(200);
    expect([204, 422]).toContain(reorder.statusCode); // 422 if the delivered stop was already closed when the reorder ran
    const after = (await env.as(U.dispatcherHannover, "GET", `/v1/orgs/${org()}/tours/${tourA}`)).json();
    expect(after.stops.find((s: { id: string }) => s.id === ids[0]).status).toBe("delivered");
    expect(after.tour.version).toBeGreaterThanOrEqual(t.tour.version);
  });
});
