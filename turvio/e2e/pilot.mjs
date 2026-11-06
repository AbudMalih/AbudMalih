// Synthetic JARBOU pilot (Hannover): 1 dispatcher, 5 drivers, 5 vehicles, 5 simultaneous tours with
// 50–100 stops each, pickups with time windows, optimization, publishing, deliveries, failures,
// proof of delivery, an offline batch replayed with duplicates, and dispatcher monitoring.
// All data is synthetic (fictional recipients, generated coordinates in the Hannover area).
//
//   scripts/dev-stack.sh up --fresh --pilot
//   node e2e/pilot.mjs            (writes a JSON report to PILOT_REPORT or /tmp/turvio-pilot.json)
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";

const API = process.env.API_URL ?? "http://localhost:4000";
const PASSWORD = process.env.SEED_PASSWORD ?? "Turvio-Demo-2026";
const DRIVERS = ["lena.hoffmann@jarbou.test", "mihai.popescu@jarbou.test", "samir.haddad@jarbou.test", "jonas.becker@jarbou.test", "paula.schmidt@jarbou.test"];
const STOPS = [62, 75, 88, 96, 54];
const SIG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 80" width="200" height="80"><path d="M10 40 L60 20 L110 60 L180 30" fill="none" stroke="#0F172A" stroke-width="3"/></svg>').toString("base64");

let seed = 42;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const STREETS = ["Lister Meile", "Podbielskistraße", "Sallstraße", "Limmerstraße", "Engelbosteler Damm", "Hildesheimer Straße", "Vahrenwalder Straße", "Göttinger Chaussee", "Celler Straße", "Marienstraße"];

async function login(email) {
  const r = await fetch(`${API}/v1/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password: PASSWORD }) });
  assert.equal(r.status, 200, `login ${email}`);
  const token = (await r.json()).accessToken;
  return async (method, path, body) => {
    const res = await fetch(`${API}${path}`, { method, headers: { authorization: `Bearer ${token}`, ...(body ? { "content-type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  };
}

const t0 = Date.now();
const report = { date: today, synthetic: true, tours: [], checks: [] };
const check = (name, ok, detail) => {
  report.checks.push({ name, ok, detail });
  console.log(`  ${ok ? "✓" : "✗"} ${name}${detail ? ` – ${detail}` : ""}`);
  if (!ok) process.exitCode = 1;
};

console.log(`TURVIO pilot simulation → ${API} (${today})`);
const dispatcher = await login("dispatch.hannover@jarbou.test");
const me = (await dispatcher("GET", "/v1/me")).body;
const org = me.memberships[0].organizationId;
const ds0 = (await dispatcher("GET", `/v1/orgs/${org}/dispatch`)).body;
const hannover = ds0.depots.find((d) => d.name === "Hannover");
const drivers = ds0.drivers.filter((d) => d.depotId === hannover.id);
const vehicles = ds0.vehicles.filter((v) => v.depotId === hannover.id);
check("pilot setup: 5 drivers and 5 vehicles in Hannover", drivers.length >= 5 && vehicles.length >= 5, `${drivers.length} drivers, ${vehicles.length} vehicles`);
const names = ["Lena Hoffmann", "Mihai Popescu", "Samir Haddad", "Jonas Becker", "Paula Schmidt"];

// 1. Dispatcher plans five tours.
const tours = [];
for (let i = 0; i < 5; i++) {
  const driver = drivers.find((d) => d.displayName === names[i]);
  const created = await dispatcher("POST", `/v1/orgs/${org}/tours`, { depotId: hannover.id, date: today, plannedStartMinute: 450 + i * 10, driverId: driver.id, vehicleId: vehicles[i].id });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const stops = Array.from({ length: STOPS[i] }, (_, k) => {
    const pickup = k % 12 === 7;
    const start = 600 + Math.floor(rnd() * 6) * 30;
    return {
      type: pickup ? "pickup" : "delivery",
      recipientName: `Pilotkunde ${i + 1}-${String(k + 1).padStart(3, "0")}`,
      address: { street: STREETS[Math.floor(rnd() * STREETS.length)], houseNumber: String(1 + Math.floor(rnd() * 120)), postalCode: "30161", city: "Hannover" },
      location: { lat: 52.33 + rnd() * 0.1, lng: 9.66 + rnd() * 0.16 },
      timeWindow: pickup ? { start, end: start + 120 } : k % 15 === 3 ? { start: 540, end: 720 } : undefined,
      priority: k % 23 === 5,
      trackingNumbers: pickup ? [] : Array.from({ length: 1 + (k % 4 === 0 ? 1 : 0) }, (_, p) => `TVOPIL${i}${String(k).padStart(3, "0")}${p}`),
    };
  });
  const added = await dispatcher("POST", `/v1/orgs/${org}/stops`, { tourId: created.body.id, stops });
  assert.equal(added.status, 201);
  const opt0 = Date.now();
  const opt = await dispatcher("POST", `/v1/orgs/${org}/tours/${created.body.id}/optimize`, {});
  assert.equal(opt.status, 200, JSON.stringify(opt.body));
  const pub = await dispatcher("POST", `/v1/orgs/${org}/tours/${created.body.id}/publish`, { expectedVersion: opt.body.tour.version });
  assert.equal(pub.status, 200, JSON.stringify(pub.body));
  tours.push({ id: created.body.id, name: created.body.name, driver: DRIVERS[i], stops: STOPS[i] });
  report.tours.push({ name: created.body.name, driver: names[i], stops: STOPS[i], pickups: stops.filter((s) => s.type === "pickup").length, optimizeMs: Date.now() - opt0, matrixSource: opt.body.result.matrixSource, unassigned: opt.body.result.unassignedStopIds.length });
}
check("5 tours planned, optimized and published", tours.length === 5, report.tours.map((t) => `${t.name}:${t.stops} stops/${t.optimizeMs} ms/${t.matrixSource}`).join(", "));

// 2. Drivers work simultaneously.
const expected = { closed: 0, failed: 0, proofs: 0 };
await Promise.all(
  tours.map(async (t, i) => {
    const api = await login(t.driver);
    const mine = (await api("GET", "/v1/me/tours")).body.tours;
    assert.equal(mine.length, 1, `${t.driver} sees exactly the own tour`);
    assert.equal(mine[0].stops.length, t.stops);
    await api("POST", `/v1/orgs/${org}/tours/${t.id}/status`, { status: "in_progress" });
    const work = Math.round(t.stops * (0.3 + i * 0.1));
    const offlineBatch = [];
    for (const [k, s] of mine[0].stops.slice(0, work).entries()) {
      const failed = k % 13 === 6;
      const status = failed ? (k % 2 ? "attempted" : "failed") : s.type === "pickup" ? "picked_up" : "delivered";
      const body = { status, failureReason: failed ? "recipient_absent" : undefined, notes: failed ? "Synthetischer Testfall" : undefined, clientEventId: randomUUID(), occurredAt: new Date().toISOString() };
      // Driver 3 works through a dead zone: changes are queued and replayed later (twice).
      if (i === 2 && k >= 5 && k < 25) offlineBatch.push([s.id, body]);
      else {
        const r = await api("POST", `/v1/orgs/${org}/stops/${s.id}/status`, body);
        assert.equal(r.status, 200, JSON.stringify(r.body));
      }
      expected.closed++;
      if (failed) expected.failed++;
      if (status === "delivered" && k % 5 === 0) {
        const proof = { id: randomUUID(), kind: "signature", contentType: "image/svg+xml", dataBase64: SIG, capturedAt: new Date().toISOString(), recipientName: "Synthetische Unterschrift" };
        const r = await api("POST", `/v1/orgs/${org}/stops/${s.id}/proofs`, proof);
        assert.equal(r.status, 201);
        await api("POST", `/v1/orgs/${org}/stops/${s.id}/proofs`, proof); // retry after a lost response
        expected.proofs++;
      }
    }
    for (let pass = 0; pass < 2; pass++) for (const [id, body] of offlineBatch) assert.equal((await api("POST", `/v1/orgs/${org}/stops/${id}/status`, body)).status, 200);
    t.worked = work;
  }),
);

// 3. Dispatcher monitors.
const ds = (await dispatcher("GET", `/v1/orgs/${org}/dispatch?depotId=${hannover.id}`)).body;
const pilotStops = ds.stops.filter((s) => tours.some((t) => t.id === s.tourId));
const closed = pilotStops.filter((s) => !["pending", "in_progress"].includes(s.status));
const failed = pilotStops.filter((s) => ["failed", "attempted"].includes(s.status));
const proofs = pilotStops.reduce((n, s) => n + (s.proofs?.length ?? 0), 0);
check("dispatcher sees every completed stop (incl. the replayed offline batch)", closed.length === expected.closed, `${closed.length}/${expected.closed}`);
check("failed deliveries carry a reason", failed.length === expected.failed && failed.every((s) => s.failureReason === "recipient_absent"), `${failed.length} failed/attempted`);
check("each proof stored exactly once despite retries", proofs === expected.proofs, `${proofs} proofs`);
check("all five tours in progress", ds.tours.filter((t) => tours.some((x) => x.id === t.id)).every((t) => t.status === "in_progress"));
for (const t of tours) {
  const own = pilotStops.filter((s) => s.tourId === t.id);
  report.tours.find((x) => x.name === t.name).progress = `${own.filter((s) => !["pending", "in_progress"].includes(s.status)).length}/${own.length}`;
}
// 4. Isolation inside the pilot: a driver cannot read another driver's tour route.
const lena = await login(DRIVERS[0]);
check("drivers cannot read other drivers' tours", (await lena("GET", `/v1/orgs/${org}/tours/${tours[1].id}/route`)).status === 404);
report.durationMs = Date.now() - t0;
writeFileSync(process.env.PILOT_REPORT ?? "/tmp/turvio-pilot.json", JSON.stringify(report, null, 2));
console.table(report.tours);
console.log(`${report.checks.filter((c) => c.ok).length}/${report.checks.length} checks passed in ${(report.durationMs / 1000).toFixed(1)} s`);
