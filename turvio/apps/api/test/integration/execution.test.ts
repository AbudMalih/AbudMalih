import { randomUUID } from "node:crypto";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { GeocodeResult, Geocoder } from "../../src/geocode";
import { SEED_USERS as U } from "../../src/seed";
import { processStorageDeletions } from "../../src/storage";
import { createTestEnv, postgresAvailable, type TestEnv } from "./helpers";

const available = await postgresAvailable();
let env: TestEnv;
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

// Smallest valid JPEG header + filler (content is checked by magic number only).
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 1)]).toString("base64");
const SIGNATURE = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 120" width="300" height="120"><path d="M10 60 L80 30 L150 90" fill="none" stroke="#0F172A" stroke-width="3"/></svg>').toString("base64");

class FakeGeocoder implements Geocoder {
  readonly name = "fake";
  calls = 0;
  async search(q: string): Promise<GeocodeResult[]> {
    this.calls++;
    return /lister/i.test(q)
      ? [{ label: "Lister Meile 42, 30161 Hannover", street: "Lister Meile", houseNumber: "42", postalCode: "30161", city: "Hannover", countryCode: "DE", location: { lat: 52.3826, lng: 9.7462 }, precision: "house", source: "fake" }]
      : [];
  }
  async reverse() {
    return null;
  }
}
const geocoder = new FakeGeocoder();

describe.runIf(available)("driver execution API", () => {
  beforeAll(async () => {
    env = await createTestEnv("exec", { geocoder });
  }, 120_000);
  afterAll(async () => {
    await env?.close();
  });

  const org = () => env.data.orgs.jarbou;
  let tourId = "";
  let stops: { id: string; type: string; status: string; parcels: { trackingNumber: string }[] }[] = [];

  it("dispatch prepares a published tour for Lena", async () => {
    const t = (await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/tours`, { depotId: env.data.depots.hannover, date: today(), driverId: env.data.drivers.hannover![0] })).json();
    tourId = t.id;
    const r = await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/stops`, {
      tourId,
      stops: Array.from({ length: 4 }, (_, i) => ({
        recipientName: `Kunde ${i}`,
        address: { street: "Teststraße", houseNumber: String(i + 1), postalCode: "30159", city: "Hannover" },
        location: { lat: 52.37 + i * 0.004, lng: 9.73 },
        trackingNumbers: [`TVOEX${i}000000`],
      })),
    });
    expect(r.statusCode).toBe(201);
    expect((await env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/tours/${tourId}/publish`, { expectedVersion: t.version + 0 })).statusCode).toBe(200);
    stops = (await env.as(U.driverHannover1, "GET", "/v1/me/tours")).json().tours[0].stops;
    expect(stops).toHaveLength(4);
  });

  it("exposes failure reasons and settings; admins configure them", async () => {
    const mine = (await env.as(U.driverHannover1, "GET", "/v1/me/tours")).json().tours[0];
    expect(mine.organization.driverSettings.failureReasons.map((r: { code: string }) => r.code)).toContain("recipient_absent");
    expect(mine.organization.driverSettings.podLocation).toBe(false);
    expect((await env.as(U.dispatcherHannover, "PUT", `/v1/orgs/${org()}/settings/driver`, { podLocation: true })).statusCode).toBe(403);
    const put = await env.as(U.jarbouOwner, "PUT", `/v1/orgs/${org()}/settings/driver`, { podLocation: false, failureReasons: [{ code: "recipient_absent" }, { code: "refused" }, { code: "other", requiresNote: true }] });
    expect(put.statusCode).toBe(200);
    expect(put.json().customFailureReasons).toBe(true);
  });

  it("records arrival and outcomes idempotently (offline retries) and rejects missing reasons", async () => {
    const s = stops[0]!;
    const url = `/v1/orgs/${org()}/stops/${s.id}/status`;
    expect((await env.as(U.driverHannover1, "POST", url, { status: "in_progress" })).json().stop.status).toBe("in_progress");
    expect((await env.as(U.driverHannover1, "POST", url, { status: "attempted" })).statusCode).toBe(422);
    const eventId = randomUUID();
    const body = { status: "attempted", failureReason: "recipient_absent", notes: "Karte eingeworfen", clientEventId: eventId, occurredAt: new Date().toISOString() };
    const first = await env.as(U.driverHannover1, "POST", url, body);
    expect(first.statusCode).toBe(200);
    expect(first.json().stop).toMatchObject({ status: "attempted", failureReason: "recipient_absent", driverNotes: "Karte eingeworfen" });
    const retry = await env.as(U.driverHannover1, "POST", url, body); // interrupted upload retried
    expect(retry.statusCode).toBe(200);
    const n = (await env.superuser.query(`select count(*)::int n from stop_events where stop_id = $1`, [s.id])).rows[0].n;
    expect(n).toBe(2); // in_progress + attempted, not three
  });

  it("stores driver notes and parcel scans; dispatch sees them", async () => {
    const s = stops[1]!;
    expect((await env.as(U.driverHannover1, "POST", `/v1/orgs/${org()}/stops/${s.id}/note`, { note: "Hinterhof, 2. Tür", clientEventId: randomUUID() })).statusCode).toBe(204);
    const scans = await env.as(U.driverHannover1, "POST", `/v1/orgs/${org()}/tours/${tourId}/scans`, { scans: [{ code: s.parcels[0]!.trackingNumber }, { code: "TVOUNKNOWN0001" }] });
    expect(scans.json()).toEqual({ matched: [s.parcels[0]!.trackingNumber], unknown: ["TVOUNKNOWN0001"] });
    const ds = (await env.as(U.dispatcherHannover, "GET", `/v1/orgs/${org()}/dispatch`)).json();
    const seen = ds.stops.find((x: { id: string }) => x.id === s.id);
    expect(seen.driverNotes).toBe("Hinterhof, 2. Tür");
    expect(seen.parcels[0].loadedAt).toBeTruthy();
    // Other company / other driver cannot scan into this tour.
    expect((await env.as(U.driverHannover2, "POST", `/v1/orgs/${org()}/tours/${tourId}/scans`, { scans: [{ code: "TVOEX10000000" }] })).statusCode).toBe(404);
    expect((await env.as(U.musterDriver, "POST", `/v1/orgs/${org()}/tours/${tourId}/scans`, { scans: [{ code: "TVOEX10000000" }] })).statusCode).toBe(403);
  });

  it("uploads proof of delivery once, even when retried, and serves it only to permitted users", async () => {
    const s = stops[2]!;
    await env.as(U.driverHannover1, "POST", `/v1/orgs/${org()}/stops/${s.id}/status`, { status: "delivered", clientEventId: randomUUID() });
    const photo = { id: randomUUID(), kind: "photo", contentType: "image/jpeg", dataBase64: JPEG, capturedAt: new Date().toISOString(), location: { lat: 52.38, lng: 9.73 } };
    const sig = { id: randomUUID(), kind: "signature", contentType: "image/svg+xml", dataBase64: SIGNATURE, capturedAt: new Date().toISOString(), recipientName: "E. Beispiel" };
    const url = `/v1/orgs/${org()}/stops/${s.id}/proofs`;
    const p1 = await env.as(U.driverHannover1, "POST", url, photo);
    expect(p1.statusCode).toBe(201);
    expect(p1.json().locationStored).toBe(false); // company has not enabled PoD location
    expect((await env.as(U.driverHannover1, "POST", url, photo)).statusCode).toBe(200); // retry: no duplicate
    expect((await env.as(U.driverHannover1, "POST", url, { ...photo, dataBase64: SIGNATURE, contentType: "image/png" })).statusCode).toBe(422);
    expect((await env.as(U.driverHannover1, "POST", url, sig)).statusCode).toBe(201);
    // Scripted SVG is refused.
    const evil = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>').toString("base64");
    expect((await env.as(U.driverHannover1, "POST", url, { ...sig, id: randomUUID(), dataBase64: evil })).statusCode).toBe(422);
    // Another driver cannot attach proofs to Lena's stop.
    expect((await env.as(U.driverHannover2, "POST", url, { ...photo, id: randomUUID() })).statusCode).toBeGreaterThanOrEqual(403);

    const list = (await env.as(U.dispatcherHannover, "GET", url)).json().proofs;
    expect(list.map((p: { kind: string }) => p.kind).sort()).toEqual(["photo", "signature"]);
    const file = await env.as(U.dispatcherHannover, "GET", `/v1/orgs/${org()}/proofs/${photo.id}/file`);
    expect(file.statusCode).toBe(200);
    expect(file.headers["content-type"]).toBe("image/jpeg");
    expect(file.headers["cache-control"]).toBe("private, no-store");
    const logged = (await env.superuser.query(`select action, actor_user_id from audit_log where table_name = 'proofs' and record_id = $1 and action = 'read'`, [photo.id])).rows;
    expect(logged).toEqual([{ action: "read", actor_user_id: env.data.users.dispatcherHannover }]);
    expect(file.rawPayload.subarray(0, 3)).toEqual(Buffer.from([0xff, 0xd8, 0xff]));
    // Not for another depot's dispatcher, another company, or an anonymous caller.
    expect((await env.as(U.dispatcherBremen, "GET", `/v1/orgs/${org()}/proofs/${photo.id}/file`)).statusCode).toBe(404);
    expect((await env.as(U.musterOwner, "GET", `/v1/orgs/${org()}/proofs/${photo.id}/file`)).statusCode).toBe(403);
    expect((await env.app.inject({ method: "GET", url: `/v1/orgs/${org()}/proofs/${photo.id}/file` })).statusCode).toBe(401);
    // Dispatch dataset carries the proof summaries.
    const ds = (await env.as(U.dispatcherHannover, "GET", `/v1/orgs/${org()}/dispatch`)).json();
    expect(ds.stops.find((x: { id: string }) => x.id === s.id).proofs).toHaveLength(2);

    // Deletion: dispatchers cannot, admins can; the file is removed by the worker.
    expect((await env.as(U.dispatcherHannover, "DELETE", `/v1/orgs/${org()}/proofs/${photo.id}`)).statusCode).toBe(403);
    expect((await env.as(U.jarbouOwner, "DELETE", `/v1/orgs/${org()}/proofs/${photo.id}`)).statusCode).toBe(204);
    const dir = join(env.proofDir, org(), s.id);
    expect(readdirSync(dir)).toHaveLength(2);
    const { LocalProofStore } = await import("../../src/storage");
    expect(await processStorageDeletions(env.db, new LocalProofStore(env.proofDir), () => undefined)).toBe(1);
    expect(existsSync(join(dir, `${photo.id}.jpg`))).toBe(false);
    expect(existsSync(join(dir, `${sig.id}.svg`))).toBe(true);
  });

  it("stores PoD location only when the company enabled it", async () => {
    await env.as(U.jarbouOwner, "PUT", `/v1/orgs/${org()}/settings/driver`, { podLocation: true });
    const r = await env.as(U.driverHannover1, "POST", `/v1/orgs/${org()}/stops/${stops[2]!.id}/proofs`, {
      id: randomUUID(),
      kind: "photo",
      contentType: "image/jpeg",
      dataBase64: JPEG,
      capturedAt: new Date().toISOString(),
      location: { lat: 52.38, lng: 9.73 },
    });
    expect(r.json().locationStored).toBe(true);
  });

  it("lets drivers lock stops, set a map pin and optimize with options; locked stops keep their slot", async () => {
    const open = (await env.as(U.driverHannover1, "GET", "/v1/me/tours")).json().tours[0].stops.filter((s: { status: string }) => s.status === "pending" || s.status === "in_progress");
    expect(open.length).toBeGreaterThanOrEqual(1);
    const first = open[0];
    expect((await env.as(U.driverHannover1, "POST", `/v1/orgs/${org()}/stops/${first.id}/driver-update`, { locked: true, location: { lat: 52.375, lng: 9.735 } })).statusCode).toBe(204);
    const r = await env.as(U.driverHannover1, "POST", `/v1/orgs/${org()}/tours/${tourId}/optimize`, { start: { lat: 52.36, lng: 9.72 }, end: "none" });
    expect(r.statusCode).toBe(200);
    expect(r.json().result.lockedStopIds).toEqual([first.id]);
    expect(r.json().result.startSource).toBe("device");
    const after = r.json().stops.filter((s: { status: string }) => s.status === "pending" || s.status === "in_progress");
    expect(after[0].id).toBe(first.id);
    expect(after[0].locationSource).toBe("manual_pin");
    expect((await env.as(U.driverHannover2, "POST", `/v1/orgs/${org()}/stops/${first.id}/driver-update`, { locked: false })).statusCode).toBe(404);
  });

  it("creates a personal route and stops idempotently (client ids)", async () => {
    const id = randomUUID();
    const r1 = await env.as(U.driverHannover2, "POST", "/v1/me/tours", { id, name: "Meine Runde", date: today() });
    expect(r1.statusCode).toBe(201);
    expect(r1.json().tour.origin).toBe("driver");
    expect((await env.as(U.driverHannover2, "POST", "/v1/me/tours", { id, name: "Meine Runde", date: today() })).statusCode).toBe(201);
    const stopId = randomUUID();
    const body = { tourId: id, stops: [{ id: stopId, address: { street: "Lister Meile", houseNumber: "42", postalCode: "30161", city: "Hannover" }, trackingNumbers: ["TVOPERS0000001"] }] };
    expect((await env.as(U.driverHannover2, "POST", `/v1/orgs/${org()}/stops`, body)).json().ids).toEqual([stopId]);
    expect((await env.as(U.driverHannover2, "POST", `/v1/orgs/${org()}/stops`, body)).json().ids).toEqual([stopId]);
    // A second parcel for the same address is added to the existing stop (no duplicate parcel on retry).
    const more = { tourId: id, stops: [{ ...body.stops[0], trackingNumbers: ["TVOPERS0000001", "TVOPERS0000002"] }] };
    await env.as(U.driverHannover2, "POST", `/v1/orgs/${org()}/stops`, more);
    await env.as(U.driverHannover2, "POST", `/v1/orgs/${org()}/stops`, more);
    const mine = (await env.as(U.driverHannover2, "GET", "/v1/me/tours")).json().tours.find((t: { tour: { id: string } }) => t.tour.id === id);
    expect(mine.stops).toHaveLength(1);
    expect(mine.stops[0].parcels.map((p: { trackingNumber: string }) => p.trackingNumber)).toEqual(["TVOPERS0000001", "TVOPERS0000002"]);
    expect(mine.stops[0]).toMatchObject({ location: null, locationSource: null }); // no coordinates invented
    // The Hannover dispatcher sees the personal route; Bremen does not.
    const ds = (await env.as(U.dispatcherHannover, "GET", `/v1/orgs/${org()}/dispatch`)).json();
    expect(ds.tours.find((t: { id: string }) => t.id === id).origin).toBe("driver");
    const bremen = (await env.as(U.dispatcherBremen, "GET", `/v1/orgs/${org()}/dispatch?depotId=${env.data.depots.hannover}`)).json();
    expect((bremen.tours ?? []).find((t: { id: string }) => t.id === id)).toBeUndefined();
  });

  it("searches addresses through the configured provider, with authentication and rate limit", async () => {
    expect((await env.app.inject({ method: "GET", url: "/v1/geocode/search?q=Lister%20Meile%2042" })).statusCode).toBe(401);
    const r = await env.as(U.driverHannover1, "GET", "/v1/geocode/search?q=Lister%20Meile%2042%20Hannover&country=DE");
    expect(r.statusCode).toBe(200);
    expect(r.json().results[0]).toMatchObject({ postalCode: "30161", precision: "house" });
    let limited = false;
    for (let i = 0; i < 10; i++) limited ||= (await env.as(U.driverHannover1, "GET", "/v1/geocode/search?q=Lister%20Meile")).statusCode === 429;
    expect(limited).toBe(true);
  });

  it("blocks simultaneous double-booking at the database level", async () => {
    const make = () => env.as(U.dispatcherHannover, "POST", `/v1/orgs/${org()}/tours`, { depotId: env.data.depots.hannover, date: today() });
    const [a, b] = [(await make()).json(), (await make()).json()];
    const driver = env.data.drivers.hannover![2]!;
    // Both requests pass the API pre-check at the same time; the unique index decides.
    const results = await Promise.all([
      env.as(U.dispatcherHannover, "PATCH", `/v1/orgs/${org()}/tours/${a.id}`, { expectedVersion: a.version, driverId: driver }),
      env.as(U.dispatcherHannover, "PATCH", `/v1/orgs/${org()}/tours/${b.id}`, { expectedVersion: b.version, driverId: driver }),
    ]);
    const codes = results.map((r) => r.statusCode).sort();
    expect(codes).toEqual([200, 409]);
    expect(results.find((r) => r.statusCode === 409)!.json().error.code).toBe("driver_busy");
  });
});

describe.runIf(available)("address search without a provider", () => {
  let bare: TestEnv;
  beforeAll(async () => {
    bare = await createTestEnv("nogeo");
  }, 120_000);
  afterAll(async () => {
    await bare?.close();
  });
  it("answers 503 geocoder_unavailable instead of inventing coordinates", async () => {
    const r = await bare.as(U.driverHannover1, "GET", "/v1/geocode/search?q=Lister%20Meile%2042");
    expect(r.statusCode).toBe(503);
    expect(r.json().error.code).toBe("geocoder_unavailable");
  });
});
