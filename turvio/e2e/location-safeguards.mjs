// End-to-end check of the stop-location safeguards (P0-3.6) on a local dev stack with real
// OSRM (Region Hannover), the optimizer and the OSM address data:
//
//   TURVIO_OSRM_URL=http://127.0.0.1:5000 TURVIO_ROUTING_REQUIRED=true TURVIO_GEOCODER=postgres \
//   TURVIO_ROUTING_DATA_VERSION=… scripts/dev-stack.sh up --fresh      (+ geo.addresses loaded)
//   node e2e/location-safeguards.mjs           (SCREENSHOT_DIR for Dispatch / Driver screenshots)
//
// Database → API → optimizer → Dispatch → Driver: import with provenance, checks (motorway,
// pedestrian zone, swapped coordinates, coordinates far from their address), explicit approach,
// optimization (error excluded, approach routed), publication, driver payload / checks / route,
// a stale driver edit refused (409), history, then Dispatch and the Driver web build in a browser,
// including the driver going offline and syncing. All data synthetic or public OSM addresses.
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const API = process.env.API_URL ?? "http://localhost:4000";
const DISPATCH = process.env.DISPATCH_URL ?? "http://localhost:3000";
const DRIVER = process.env.DRIVER_URL ?? "http://localhost:8081";
const PASSWORD = process.env.SEED_PASSWORD ?? "Turvio-Demo-2026";
const SHOTS = process.env.SCREENSHOT_DIR ?? "/tmp/turvio-location-e2e";
mkdirSync(SHOTS, { recursive: true });
const report = { steps: [] };
const step = (name, data = {}) => {
  report.steps.push({ name, ...data });
  console.log(`✓ ${name}`, Object.keys(data).length ? JSON.stringify(data) : "");
};

async function login(email) {
  const r = await fetch(`${API}/v1/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password: PASSWORD }) });
  assert.equal(r.status, 200, `login ${email}`);
  const token = (await r.json()).accessToken;
  const call = async (method, path, body) => {
    const res = await fetch(`${API}${path}`, { method, headers: { authorization: `Bearer ${token}`, ...(body ? { "content-type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  };
  return call;
}
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

// ------------------------------------------------------------------ API: dispatcher
const disp = await login("dispatch.hannover@jarbou.test");
const org = (await disp("GET", "/v1/me")).body.memberships[0].organizationId;
const ds = (await disp("GET", `/v1/orgs/${org}/dispatch`)).body;
const depot = ds.depots.find((d) => d.name === "Hannover");
// A Hannover driver with a login and no open tour today (demo data may occupy one).
const busy = new Set(ds.tours.filter((t) => t.status !== "completed" && t.driverId).map((t) => t.driverId));
const candidates = [
  { email: "lena.hoffmann@jarbou.test", name: "Lena Hoffmann" },
  { email: "mihai.popescu@jarbou.test", name: "Mihai Popescu" },
];
const pick = candidates.map((c) => ({ ...c, id: ds.drivers.find((d) => d.displayName === c.name)?.id })).find((c) => c.id && !busy.has(c.id));
const date = pick ? today : new Date(Date.now() + 36 * 3600_000).toISOString().slice(0, 10);
const driverInfo = pick ?? { ...candidates[0], id: ds.drivers.find((d) => d.displayName === candidates[0].name).id };
const t = (await disp("POST", `/v1/orgs/${org}/tours`, { depotId: depot.id, date, name: "E2E-LOC", plannedStartMinute: 15 * 60, driverId: driverInfo.id })).body;
assert.ok(t.id, JSON.stringify(t));
step("tour created", { date, driver: driverInfo.name, driverUiCheck: !!pick });

const A = (name, street, no, pc, lat, lng) => ({ recipientName: name, address: { street, houseNumber: no, postalCode: pc, city: "Hannover" }, location: { lat, lng }, locationSource: "import" });
const add = await disp("POST", `/v1/orgs/${org}/stops`, {
  tourId: t.id,
  provenance: "import_file",
  stops: [
    A("Normal", "Borkumer Straße", "31", "30163", 52.397376, 9.74687),
    A("Autobahn", "Klusriede", "1", "30419", 52.427361, 9.741878),
    A("Fussgaengerzone", "Bahnhofstraße", "13", "30159", 52.375038, 9.7388577),
    A("Vertauscht", "Lister Meile", "1", "30161", 9.7462, 52.3826),
    A("Verschoben", "Borkumer Straße", "33", "30163", 52.40045, 9.74702),
  ],
});
assert.equal(add.status, 201, JSON.stringify(add.body));
const [sNormal, sMotorway, sPedestrian, sSwapped, sMoved] = add.body.ids;

let checks;
for (let i = 0; i < 10; i++) {
  checks = (await disp("GET", `/v1/orgs/${org}/location-checks?tourId=${t.id}`)).body;
  if (!checks.pending) break;
  await new Promise((r) => setTimeout(r, 1000));
}
assert.equal(checks.pending, false);
const by = Object.fromEntries(checks.checks.map((c) => [c.stopId, c]));
const codes = (id) => by[id].issues.map((i) => `${i.severity}:${i.code}`);
assert.deepEqual(codes(sNormal), []);
assert.equal(by[sNormal].status, "checked");
assert.ok(codes(sMotorway).includes("warning:motorway"));
assert.ok(codes(sPedestrian).every((c) => c.startsWith("info:")));
assert.deepEqual(codes(sSwapped), ["error:outside_country"]);
assert.ok(codes(sMoved).includes("warning:address_mismatch"), codes(sMoved).join());
const suggestion = by[sMotorway].issues.find((i) => i.suggestion).suggestion;
step("checks (real OSRM + OSM addresses)", { normal: codes(sNormal), motorway: codes(sMotorway), pedestrian: codes(sPedestrian), swapped: codes(sSwapped), moved: codes(sMoved), suggestion: `${suggestion.roadName || "unnamed"} ${suggestion.distanceMeters} m`, versions: checks.versions });

// Stored and reused while current.
const again = (await disp("GET", `/v1/orgs/${org}/location-checks?tourId=${t.id}`)).body;
assert.ok(again.checks.filter((c) => c.status !== "no_location").every((c) => c.source === "stored"));
step("check results stored and reused");

// Explicit approach from the suggestion; a motorway point itself is refused.
const motor = (await disp("GET", `/v1/orgs/${org}/stops/${sMotorway}/location`)).body;
const exp = { expectedLat: motor.current.location.lat, expectedLng: motor.current.location.lng, expectedAddressVersion: motor.current.addressVersion };
assert.equal((await disp("POST", `/v1/orgs/${org}/stops/${sMotorway}/location/approach`, { ...exp, lat: 52.427361, lng: 9.741878 })).body?.error?.code, "approach_on_motorway");
assert.equal((await disp("POST", `/v1/orgs/${org}/stops/${sMotorway}/location/approach`, { ...exp, lat: suggestion.location.lat, lng: suggestion.location.lng })).status, 204);
assert.equal(motor.original.kind, "original");
assert.equal(motor.original.provenance, "import_file");
step("approach accepted explicitly (motorway point refused)");

// Optimize with the real optimizer on real roads.
const opt = (await disp("POST", `/v1/orgs/${org}/tours/${t.id}/optimize`, {})).body;
assert.equal(opt.result.matrixSource, "osrm");
assert.deepEqual(opt.result.locationErrors, [{ stopId: sSwapped, codes: ["outside_country"] }]);
assert.deepEqual(opt.result.approachStopIds, [sMotorway]);
assert.equal(opt.stops.at(-1).id, sSwapped);
step("optimized on roads: swapped stop excluded and reported, approach routed", { driveMin: Math.round((opt.result.driveSeconds ?? 0) / 60), km: Math.round(opt.result.distanceMeters / 100) / 10 });

// Dispatch projection: the swapped stop is "no usable map position", the rest on road times.
const ds2 = (await disp("GET", `/v1/orgs/${org}/dispatch?date=${date}`)).body;
assert.equal(ds2.roads[t.id].source, "osrm");
step("dispatch dataset: road times for the tour", { roads: ds2.roads[t.id].source });

const tour = ds2.tours.find((x) => x.id === t.id);
assert.equal((await disp("POST", `/v1/orgs/${org}/tours/${t.id}/publish`, { expectedVersion: tour.version })).status, 200);
// After publication a pin move needs a reason.
const npRes = await disp("PATCH", `/v1/orgs/${org}/stops/${sMoved}`, { location: { lat: 52.39745, lng: 9.74702 } });
assert.equal(npRes.status, 422);
assert.equal((await disp("PATCH", `/v1/orgs/${org}/stops/${sMoved}`, { location: { lat: 52.39745, lng: 9.74702 }, reason: "Pin back on the house (E2E)", locationPrecision: "house", expectedLocationVersion: 1 })).status, 200);
step("published; pin move without reason refused, with reason saved");

// ------------------------------------------------------------------ API: driver
const drv = await login(driverInfo.email);
const me = (await drv("GET", `/v1/me/tours?date=${date}`)).body;
const myTour = me.tours.find((x) => x.tour.id === t.id);
assert.ok(myTour, "driver sees the published tour");
const motorStop = myTour.stops.find((s) => s.id === sMotorway);
assert.deepEqual({ lat: motorStop.approach.lat, lng: motorStop.approach.lng }, suggestion.location);
const dChecks = (await drv("GET", `/v1/orgs/${org}/tours/${t.id}/location-checks`)).body;
assert.ok(dChecks.checks.find((c) => c.stopId === sMotorway).issues.find((i) => i.code === "motorway").details);
const route = (await drv("GET", `/v1/orgs/${org}/tours/${t.id}/route`)).body;
assert.equal(route.source, "osrm");
assert.ok(!route.waypointStopIds.includes(sSwapped));
step("driver: approach in the payload, checks with details, road route without the wrong stop");

// Offline driver edit made against an old version, after the dispatcher moved the same pin.
const pedestrian = myTour.stops.find((s) => s.id === sPedestrian);
assert.equal((await disp("PATCH", `/v1/orgs/${org}/stops/${sPedestrian}`, { location: { lat: 52.37508, lng: 9.73889 }, reason: "Dispatcher correction (E2E)", expectedLocationVersion: pedestrian.locationVersion })).status, 200);
const stale = await drv("POST", `/v1/orgs/${org}/stops/${sPedestrian}/driver-update`, { location: { lat: 52.3751, lng: 9.7389 }, locationSource: "manual_pin", expectedLocationVersion: pedestrian.locationVersion });
assert.equal(stale.status, 409);
assert.equal(stale.body.error.code, "version_conflict");
step("stale driver edit refused with 409 – dispatcher change kept");

// Driver moves the motorway stop's pin: approach invalidated, history attributes it to the driver.
const ms = (await drv("GET", `/v1/me/tours?date=${date}`)).body.tours.find((x) => x.tour.id === t.id).stops.find((s) => s.id === sMotorway);
assert.equal((await drv("POST", `/v1/orgs/${org}/stops/${sMotorway}/driver-update`, { location: { lat: 52.4277, lng: 9.7423 }, locationSource: "manual_pin", expectedLocationVersion: ms.locationVersion, reason: "Gate at Klusriede" })).status, 204);
const hist = (await disp("GET", `/v1/orgs/${org}/stops/${sMotorway}/location/history`)).body.events.map((e) => `${e.action}:${e.actor.role}`);
assert.deepEqual(hist.slice(0, 3), ["approach_invalidated:driver", "location_changed:driver", "approach_accepted:dispatcher"]);
const after = (await drv("GET", `/v1/me/tours?date=${date}`)).body.tours.find((x) => x.tour.id === t.id).stops.find((s) => s.id === sMotorway);
assert.equal(after.approach, undefined);
step("driver pin move: approach invalidated and audited", { history: hist.slice(0, 4) });

// Isolation: other company, other location.
const other = await login("owner@muster.test");
assert.equal((await other("GET", `/v1/orgs/${org}/stops/${sMotorway}/location`)).status, 403);
const bremen = await login("dispatch.bremen@jarbou.test");
assert.equal((await bremen("GET", `/v1/orgs/${org}/stops/${sMotorway}/location`)).status, 404);
assert.equal((await drv("GET", `/v1/orgs/${org}/stops/${sMotorway}/location/history`)).status, 403);
step("isolation: other company 403, other location 404, driver no history");

// ------------------------------------------------------------------ Browser: Dispatch
const { chromium } = require("playwright");
const browser = await chromium.launch();
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
  await page.goto(`${DISPATCH}/login`);
  await page.fill('input[type="email"]', "dispatch.hannover@jarbou.test");
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 });
  if (date !== today) await page.goto(`${DISPATCH}/map?date=${date}`);
  else await page.goto(`${DISPATCH}/map`);
  await page.waitForTimeout(3000);
  await page.getByText("E2E-LOC").first().click();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${SHOTS}/dispatch-tour.png` });
  const banner = await page.getByTestId("location-review-banner").textContent();
  const finish = await page.getByTestId("tour-finish").textContent();
  const basis = await page.getByTestId("projection-basis").textContent();
  assert.match(finish, /^≥ \d\d:\d\d$/); // the swapped stop makes it incomplete – no 16,000 km estimate
  assert.doesNotMatch(basis, /Straight-line/);
  step("dispatch: banner, finish ≥ (incomplete), road times", { banner, finish, basis });
  await page.getByText("Vertauscht", { exact: true }).first().click();
  await page.waitForTimeout(600);
  await page.getByTestId("location-review").first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${SHOTS}/dispatch-swapped.png` });
  await page.getByText("Normal", { exact: true }).first().click();
  await page.waitForTimeout(600);
  const panel = page.getByTestId("location-review").first();
  await panel.getByTestId("choose-approach").click();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${SHOTS}/dispatch-approach-dialog.png` });
  await page.keyboard.press("Escape");
  await panel.getByRole("button", { name: /Move pin/ }).click();
  await page.waitForTimeout(2500);
  const map = page.getByTestId("location-picker-map");
  const box = await map.boundingBox();
  await page.mouse.click(box.x + box.width / 2 + 40, box.y + box.height / 2 - 20);
  await page.waitForTimeout(400);
  const summary = await page.getByTestId("move-pin-summary").textContent();
  await page.screenshot({ path: `${SHOTS}/dispatch-move-pin.png` });
  assert.match(summary, /m from the current pin/);
  step("dispatch: map pin placement picks a point (not saved without confirmation)", { summary });
  await page.keyboard.press("Escape");
  const unchanged = (await disp("GET", `/v1/orgs/${org}/stops/${sNormal}/location`)).body.current.location;
  assert.deepEqual(unchanged, { lat: 52.397376, lng: 9.74687 });
  await page.close();
}

// ------------------------------------------------------------------ Browser: Driver web build
if (pick) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(DRIVER, { waitUntil: "networkidle" });
  await page.getByTestId("login-email").fill(driverInfo.email);
  await page.getByTestId("login-password").fill(PASSWORD);
  await page.getByTestId("login-submit").click();
  await page.getByTestId("home").waitFor();
  await page.waitForTimeout(2500);
  const e2e = page.getByText("E2E-LOC").first();
  if (await e2e.isVisible()) await e2e.click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SHOTS}/driver-home.png` });
  // Stop list: the swapped stop carries the "Location problem" pill.
  await page.getByTestId("tab-stops").click();
  await page.waitForTimeout(800);
  const pills = await page.getByTestId("stop-location-pill").allTextContents();
  assert.ok(pills.includes("Location problem"), `pills: ${pills.join(",")}`);
  await page.screenshot({ path: `${SHOTS}/driver-stops.png` });
  // Stop screen in German and Arabic: the issue is worded in the driver's language.
  for (const [loc, expect] of [
    ["de", "Die Koordinaten liegen außerhalb Deutschlands – Breiten- und Längengrad scheinen vertauscht."],
    ["ar", "الإحداثيات خارج ألمانيا – يبدو أن خطي العرض والطول مقلوبان."],
  ]) {
    await page.getByTestId("tab-settings").click();
    await page.getByTestId(`locale-${loc}`).click();
    await page.waitForTimeout(500);
    await page.getByTestId("tab-stops").click();
    await page.waitForTimeout(500);
    await page.getByText("Vertauscht").first().click();
    await page.getByTestId("stop-detail").waitFor();
    await page.waitForTimeout(500);
    const body = await page.textContent("body");
    assert.ok(body.includes(expect), `${loc}: issue text missing`);
    await page.screenshot({ path: `${SHOTS}/driver-stop-${loc}.png` });
    await page.goBack();
    await page.waitForTimeout(500);
  }
  await page.getByTestId("tab-settings").click();
  await page.getByTestId("locale-en").click();
  await page.getByTestId("tab-today").click();
  await page.waitForTimeout(500);
  // Offline: start the tour; it waits in the outbox and is sent when back online.
  await ctx.setOffline(true);
  await page.getByTestId("start-tour").click();
  await page.waitForTimeout(1000);
  const pendingPill = await page.getByTestId("sync-pill").getAttribute("aria-label");
  await page.screenshot({ path: `${SHOTS}/driver-offline.png` });
  const before = (await disp("GET", `/v1/orgs/${org}/dispatch?date=${date}`)).body.tours.find((x) => x.id === t.id).status;
  assert.equal(before, "planned");
  await ctx.setOffline(false);
  await page.getByTestId("sync-pill").click();
  let status = before;
  for (let i = 0; i < 15 && status === "planned"; i++) {
    await page.waitForTimeout(1000);
    status = (await disp("GET", `/v1/orgs/${org}/dispatch?date=${date}`)).body.tours.find((x) => x.id === t.id).status;
  }
  assert.equal(status, "in_progress");
  await page.screenshot({ path: `${SHOTS}/driver-online.png` });
  step("driver web: pills, issue texts in German and Arabic, offline start queued and synced", { pills, offlinePill: pendingPill, synced: status });
  await ctx.close();
}
await browser.close();
writeFileSync(`${SHOTS}/report.json`, JSON.stringify(report, null, 2));
console.log(`\nAll location E2E checks passed. Report and screenshots: ${SHOTS}`);
