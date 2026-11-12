// Staging smoke test with SYNTHETIC data: address search → geocode → tour → optimize (OSRM) →
// publish → driver works stops → dispatcher sees progress. Creates exactly one tour named
// "QA-SMOKE <time>" with fictional recipients at public OpenStreetMap addresses and TVOQA tracking
// numbers; it touches no other data and deletes nothing (worked tours are kept for the audit trail –
// it is closed at the end).
//
// Needs two staging accounts that only ever hold synthetic data: a dispatcher for the depot and a
// driver of that depot (invite them in Dispatch → Fleet & team). Dispatchers need no second factor.
//   QA_DISPATCH_EMAIL=… QA_DISPATCH_PASSWORD=… QA_DRIVER_EMAIL=… QA_DRIVER_PASSWORD=… node e2e/staging-smoke.mjs
//   optional: STAGING_API (default https://api.staging.turvio.online), QA_DEPOT (default Hannover)
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const API = (process.env.STAGING_API ?? "https://api.staging.turvio.online").replace(/\/$/, "");
const DEPOT = process.env.QA_DEPOT ?? "Hannover";
const need = (k) => process.env[k] ?? (console.error(`set ${k}`), process.exit(2));
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

// Public OpenStreetMap addresses (© OpenStreetMap contributors, ODbL); recipients are fictional.
const ADDRESSES = [
  ["Haltenhoffstraße", "41", "30167", "Hannover"], ["Asternstraße", "2", "30167", "Hannover"], ["Weißekreuzstraße", "26", "30161", "Hannover"],
  ["Sonderburger Straße", "10", "30165", "Hannover"], ["Rosenbergstraße", "19", "30163", "Hannover"], ["Bömelburgstraße", "31A", "30165", "Hannover"],
  ["Elfriede-Döler-Weg", "44", "30165", "Hannover"], ["Robertstraße", "3", "30161", "Hannover"], ["Sonderburger Straße", "3", "30165", "Hannover"],
  ["Heinrich-Kümmel-Straße", "2", "30169", "Hannover"], ["Roonstraße", "10A", "30163", "Hannover"], ["Möckernstraße", "16", "30163", "Hannover"],
  ["Jahnplatz", "11", "30165", "Hannover"], ["Rumannstraße", "10", "30161", "Hannover"], ["Rolandstraße", "15", "30161", "Hannover"],
  ["Linsingenstraße", "31", "30163", "Hannover"], ["Haltenhoffstraße", "9", "30167", "Hannover"], ["Scheelenkamp", "7", "30165", "Hannover"],
  ["Alte Döhrener Straße", "2", "30169", "Hannover"], ["Helmkestraße", "12", "30165", "Hannover"], ["Niedersachsenring", "35", "30163", "Hannover"],
  ["Bürgermeister-Fink-Straße", "21", "30169", "Hannover"], ["Kriegerstraße", "1F", "30161", "Hannover"], ["Apenrader Straße", "54", "30165", "Hannover"],
];

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`  ${ok ? "✓" : "✗"} ${name}${detail ? ` – ${detail}` : ""}`);
  if (!ok) process.exitCode = 1;
};

async function login(email, password) {
  const r = await fetch(`${API}/v1/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
  const b = await r.json().catch(() => ({}));
  assert.equal(r.status, 200, `login ${email}: HTTP ${r.status} ${JSON.stringify(b.error ?? b)}`);
  assert.ok(!b.mfaRequired, `${email} has two-step verification – use a dispatcher/driver QA account without it`);
  return async (method, path, body) => {
    const res = await fetch(`${API}${path}`, { method, headers: { authorization: `Bearer ${b.accessToken}`, ...(body ? { "content-type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  };
}

console.log(`TURVIO staging smoke → ${API} (${today}, synthetic data)`);
const health = await fetch(`${API}/health`);
check("API health", health.ok, `HTTP ${health.status}`);

const dispatcher = await login(need("QA_DISPATCH_EMAIL"), need("QA_DISPATCH_PASSWORD"));
const me = (await dispatcher("GET", "/v1/me")).body;
const org = me.memberships[0].organizationId;
const ds0 = (await dispatcher("GET", `/v1/orgs/${org}/dispatch`)).body;
const depot = ds0.depots.find((d) => d.name === DEPOT);
assert.ok(depot, `depot ${DEPOT} not visible to the QA dispatcher`);

// Address search (needs GEOCODER=postgres with loaded data).
const search = await dispatcher("GET", `/v1/geocode/search?q=${encodeURIComponent("Weißekreuzstraße 26, 30161 Hannover")}`);
const hit = search.body?.results?.[0];
check("address search: house-level hit", search.status === 200 && hit?.precision === "house", search.status === 200 ? `${hit?.label ?? "no result"} (${hit?.precision ?? "-"})` : `HTTP ${search.status} ${search.body?.error?.code ?? ""}`);

const batch = await dispatcher("POST", "/v1/geocode/batch", { addresses: ADDRESSES.map(([street, houseNumber, postalCode, city]) => ({ street, houseNumber, postalCode, city })) });
const geo = batch.status === 200 ? batch.body.results : [];
const houses = geo.filter((r) => r?.precision === "house").length;
check("batch geocoding of 24 public addresses", houses >= 22, `${houses}/24 at house level`);

// Tour with the QA driver.
const driverApi = await login(need("QA_DRIVER_EMAIL"), need("QA_DRIVER_PASSWORD"));
const driverMe = (await driverApi("GET", "/v1/me")).body;
const qaDriver = ds0.drivers.find((d) => d.userId === driverMe.userId);
assert.ok(qaDriver, "QA driver is not a driver of this company (link the account in Fleet & team)");
const created = await dispatcher("POST", `/v1/orgs/${org}/tours`, { depotId: depot.id, date: today, name: `QA-SMOKE ${new Date().toISOString().slice(11, 16)}`, plannedStartMinute: 480, driverId: qaDriver.id });
check("create tour", created.status === 201, created.status === 201 ? created.body.name : JSON.stringify(created.body));
const tourId = created.body.id;
const run = randomUUID().slice(0, 6).toUpperCase();
const stops = ADDRESSES.map(([street, houseNumber, postalCode, city], k) => ({
  type: "delivery",
  recipientName: `QA Testkunde ${k + 1}`,
  address: { street, houseNumber, postalCode, city },
  location: geo[k]?.precision === "house" ? geo[k].location : undefined,
  timeWindow: k === 5 ? { start: 600, end: 720 } : undefined,
  trackingNumbers: [`TVOQA${run}${String(k).padStart(3, "0")}`],
}));
const added = await dispatcher("POST", `/v1/orgs/${org}/stops`, { tourId, stops: stops.filter((s) => s.location) });
check("add stops", added.status === 201, `${stops.filter((s) => s.location).length} stops`);

const t0 = Date.now();
const opt = await dispatcher("POST", `/v1/orgs/${org}/tours/${tourId}/optimize`, {});
check("optimize on the road network", opt.status === 200 && opt.body.result.matrixSource === "osrm" && opt.body.result.unassignedStopIds.length === 0,
  opt.status === 200 ? `${Date.now() - t0} ms, ${opt.body.result.matrixSource}, ${opt.body.result.unassignedStopIds.length} unassigned` : JSON.stringify(opt.body));
const pub = await dispatcher("POST", `/v1/orgs/${org}/tours/${tourId}/publish`, { expectedVersion: opt.body.tour.version });
check("publish to the driver", pub.status === 200);

// Driver works three deliveries and one failed attempt.
const mine = (await driverApi("GET", "/v1/me/tours")).body;
const tour = mine.tours.find((t) => t.tour.id === tourId);
check("driver receives the tour", !!tour, tour ? `${tour.stops.length} stops; company day ${mine.today ?? "?"}` : "not in /v1/me/tours");
await driverApi("POST", `/v1/orgs/${org}/tours/${tourId}/status`, { status: "in_progress" });
for (const [k, s] of tour.stops.slice(0, 4).entries()) {
  const body = k === 3 ? { status: "failed", failureReason: "recipient_absent", notes: "QA smoke" } : { status: "delivered" };
  const r = await driverApi("POST", `/v1/orgs/${org}/stops/${s.id}/status`, { ...body, clientEventId: randomUUID(), occurredAt: new Date().toISOString() });
  assert.equal(r.status, 200, JSON.stringify(r.body));
}
const ds = (await dispatcher("GET", `/v1/orgs/${org}/dispatch?depotId=${depot.id}`)).body;
const own = ds.stops.filter((s) => s.tourId === tourId);
const done = own.filter((s) => !["pending", "in_progress"].includes(s.status));
check("dispatcher sees the driver's progress", done.length === 4 && own.some((s) => s.failureReason === "recipient_absent"), `${done.length}/${own.length} closed`);

// Close the synthetic tour (kept for the audit trail, clearly named QA-SMOKE).
const closeRest = tour.stops.slice(4).map((s) => driverApi("POST", `/v1/orgs/${org}/stops/${s.id}/status`, { status: "delivered", clientEventId: randomUUID(), occurredAt: new Date().toISOString() }));
await Promise.all(closeRest);
const fin = await driverApi("POST", `/v1/orgs/${org}/tours/${tourId}/status`, { status: "completed" });
check("tour completed", fin.status === 200);
console.log(`${results.filter(Boolean).length}/${results.length} checks passed`);
