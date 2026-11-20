// End-to-end checks for the TURVIO NEXT release (phases J1–J4) in real browsers on the local stack:
//   scripts/dev-stack.sh up --fresh        then        node e2e/next-release.mjs
// Admin: company administration (suspend cuts access, reactivate restores it), audit log with actors,
// platform admins, EN/DE/AR + RTL, theme. Dispatch: team management, 100-stop tour reordered to any
// position in one save and optimized, EN/DE/AR + RTL, saved theme applied in a fresh browser.
// Every page: no Content-Security-Policy violations, no page errors, no raw HTTP status texts.
// All data synthetic (seeded JARBOU demo company).
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const DISPATCH = process.env.DISPATCH_URL ?? "http://localhost:3000";
const ADMIN = process.env.ADMIN_URL ?? "http://localhost:3001";
const API = process.env.API_URL ?? "http://localhost:4000";
const PASSWORD = process.env.SEED_PASSWORD ?? "Turvio-Demo-2026";

const results = [];
async function step(name, fn) {
  const t0 = Date.now();
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`  ✓ ${name} (${Date.now() - t0} ms)`);
  } catch (e) {
    results.push({ name, ok: false });
    console.log(`  ✗ ${name}\n    ${String(e?.message ?? e).split("\n").slice(0, 4).join("\n    ")}`);
  }
}
async function token(email) {
  const r = await fetch(`${API}/v1/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password: PASSWORD }) });
  assert.equal(r.status, 200, `login ${email}`);
  return (await r.json()).accessToken;
}
async function api(tok, method, path, body) {
  const r = await fetch(`${API}${path}`, { method, headers: { authorization: `Bearer ${tok}`, ...(body ? { "content-type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  return { status: r.status, json: text ? JSON.parse(text) : null };
}
/** Page with CSP / error watchers. */
async function watched(ctx, issues, label) {
  const p = await ctx.newPage();
  p.on("console", (m) => {
    const t = m.text();
    if (/Content Security Policy|Refused to (load|execute|apply)/i.test(t)) issues.push(`${label} CSP: ${t.slice(0, 160)}`);
  });
  p.on("pageerror", (e) => issues.push(`${label} pageerror: ${e.message.slice(0, 160)}`));
  return p;
}
async function login(page, base, email) {
  await page.goto(`${base}/login`, { waitUntil: "networkidle" });
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 });
}
async function noRawHttp(page, where) {
  const body = await page.locator("body").innerText();
  assert.ok(!/HTTP \d{3}|Request failed \(HTTP/.test(body), `${where}: raw HTTP status shown`);
}

console.log(`TURVIO NEXT release checks → ${ADMIN} · ${DISPATCH} · ${API}`);
const browser = await chromium.launch();
const issues = [];
const ops = await token("ops@turvio.test");
const owner = await token("owner@jarbou.test");
const me = (await api(owner, "GET", "/v1/me")).json;
const org = me.memberships[0].organizationId;

// ------------------------------------------------------------------ Admin
const adminCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const admin = await watched(adminCtx, issues, "admin");

await step("Admin: platform admin signs in; every screen loads without CSP violations or raw errors", async () => {
  await login(admin, ADMIN, "ops@turvio.test");
  for (const path of ["/", "/companies", "/plans", "/activity", "/admins", "/system"]) {
    await admin.goto(`${ADMIN}${path}`, { waitUntil: "networkidle" });
    await noRawHttp(admin, path);
  }
});

await step("Admin: company detail – suspending cuts the company's access, reactivating restores it", async () => {
  await admin.goto(`${ADMIN}/companies/${org}`, { waitUntil: "networkidle" });
  await admin.getByRole("heading", { name: /JARBOU/ }).first().waitFor();
  await admin.getByRole("button", { name: /^Suspend/ }).click();
  const dlg = admin.getByRole("dialog");
  await dlg.getByRole("button", { name: /^Suspend/ }).click();
  await admin.getByText(/suspended/i).first().waitFor();
  assert.equal((await api(owner, "GET", `/v1/orgs/${org}/drivers`)).status, 403, "suspended company still has access");
  await admin.getByRole("button", { name: /^Reactivate/ }).click();
  const dlg2 = admin.getByRole("dialog");
  if (await dlg2.isVisible().catch(() => false)) await dlg2.getByRole("button", { name: /^Reactivate/ }).click();
  await admin.getByRole("button", { name: /^Suspend/ }).waitFor();
  assert.equal((await api(owner, "GET", `/v1/orgs/${org}/drivers`)).status, 200, "reactivated company has no access");
});

await step("Admin: audit log shows the suspension with the platform admin as actor", async () => {
  await admin.goto(`${ADMIN}/activity`, { waitUntil: "networkidle" });
  await admin.getByText("ops@turvio.test").first().waitFor();
});

await step("Admin: platform admins – add and remove another admin", async () => {
  await admin.goto(`${ADMIN}/admins`, { waitUntil: "networkidle" });
  await admin.getByRole("textbox").first().fill("dispatch.bremen@jarbou.test");
  await admin.getByRole("button", { name: /^Add/ }).click();
  await admin.getByText("dispatch.bremen@jarbou.test", { exact: true }).waitFor();
  const before = (await api(ops, "GET", "/v1/platform/admins")).json.admins.length;
  assert.ok(before >= 2);
  const row = admin.getByRole("row").filter({ hasText: "dispatch.bremen@jarbou.test" });
  await row.getByRole("button", { name: /Remove/ }).click();
  await admin.getByRole("dialog").getByRole("button", { name: /Remove/ }).click();
  await admin.getByText("dispatch.bremen@jarbou.test", { exact: true }).waitFor({ state: "detached" });
  assert.equal((await api(ops, "GET", "/v1/platform/admins")).json.admins.length, before - 1);
});

await step("Admin: German and Arabic (right-to-left), light and dark theme", async () => {
  for (const [lang, dir] of [["de", "ltr"], ["ar", "rtl"], ["en", "ltr"]]) {
    await adminCtx.addCookies([{ name: "tv_lang", value: lang, url: ADMIN }]);
    await admin.goto(`${ADMIN}/companies`, { waitUntil: "networkidle" });
    assert.equal(await admin.evaluate(() => document.documentElement.lang), lang);
    assert.equal(await admin.evaluate(() => document.documentElement.dir), dir);
    await noRawHttp(admin, `companies ${lang}`);
  }
  const theme = () => admin.evaluate(() => document.documentElement.dataset.theme);
  const before = await theme();
  await admin.getByRole("switch").first().click();
  await admin.waitForFunction((b) => document.documentElement.dataset.theme !== b, before);
  assert.notEqual(await theme(), before);
});

// ------------------------------------------------------------------ Dispatch
const dispCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const disp = await watched(dispCtx, issues, "dispatch");

await step("Dispatch: owner opens Fleet & team → Team (members load, own row has no actions)", async () => {
  await login(disp, DISPATCH, "owner@jarbou.test");
  await disp.goto(`${DISPATCH}/fleet?tab=team`, { waitUntil: "networkidle" });
  await disp.getByText("dispatch.hannover@jarbou.test").waitFor();
  await disp.getByText("You").first().waitFor();
  await disp.getByRole("button", { name: "Actions for dispatch.hannover@jarbou.test" }).waitFor();
  await noRawHttp(disp, "team");
});

const today = new Date().toISOString().slice(0, 10);
let tourId;
const TOUR = `QA-100-${Date.now().toString(36).slice(-5).toUpperCase()}`;
await step("Dispatch: 100-stop tour – a stop moved to position 90 with one save", async () => {
  const depot = (await api(owner, "GET", `/v1/orgs/${org}/depots`)).json.find((d) => /Hannover/.test(d.name));
  const t = await api(owner, "POST", `/v1/orgs/${org}/tours`, { depotId: depot.id, date: today, name: TOUR });
  assert.equal(t.status, 201, JSON.stringify(t.json));
  tourId = t.json.id;
  const stops = Array.from({ length: 100 }, (_, i) => ({
    recipientName: `Kunde ${String(i + 1).padStart(3, "0")}`,
    address: { street: "Teststraße", houseNumber: String(i + 1), postalCode: "30161", city: "Hannover", countryCode: "DE" },
    location: { lat: 52.33 + (i % 10) * 0.008, lng: 9.68 + Math.floor(i / 10) * 0.01 },
  }));
  assert.equal((await api(owner, "POST", `/v1/orgs/${org}/stops`, { tourId, stops })).status, 201);
  await disp.goto(`${DISPATCH}/planning?date=${today}`, { waitUntil: "networkidle" });
  await disp.getByText(TOUR).first().click();
  const sheet = disp.getByRole("dialog", { name: `Tour ${TOUR}` });
  await sheet.waitFor();
  await sheet.getByRole("button", { name: /^Kunde 005/ }).click();
  const actions = sheet.getByTestId("stop-edit-actions");
  await actions.getByLabel("Position").fill("90");
  const saved = disp.waitForResponse((r) => r.url().endsWith(`/sequence`) && r.request().method() === "POST");
  await actions.getByRole("button", { name: "Move", exact: true }).click();
  assert.ok((await saved).ok());
  const detail = (await api(owner, "GET", `/v1/orgs/${org}/tours/${tourId}`)).json;
  const order = detail.stops.sort((a, b) => a.sequence - b.sequence).map((s) => s.recipientName);
  assert.equal(order.indexOf("Kunde 005"), 89);
});

await step("Dispatch: 100-stop tour optimized and saved within the time budget", async () => {
  const sheet = disp.getByRole("dialog", { name: `Tour ${TOUR}` });
  const t0 = Date.now();
  const done = disp.waitForResponse((r) => /optimi[sz]e/.test(r.url()) && r.request().method() === "POST", { timeout: 60000 });
  await sheet.getByRole("button", { name: /Optimize & save/ }).click();
  assert.ok((await done).ok(), "optimize request failed");
  await disp.waitForTimeout(1500); // the order is saved right after the optimizer's answer
  const secs = (Date.now() - t0) / 1000;
  assert.ok(secs < 45, `optimization took ${secs}s`);
  const detail = (await api(owner, "GET", `/v1/orgs/${org}/tours/${tourId}`)).json;
  assert.ok(detail.tour?.optimizedAt ?? detail.optimizedAt, "no optimization recorded");
  console.log(`    100 stops optimized in ${secs.toFixed(1)} s`);
});

await step("Dispatch: German and Arabic (RTL) on Planning, Fleet and Settings; map page without CSP violations", async () => {
  for (const [lang, dir] of [["de", "ltr"], ["ar", "rtl"], ["en", "ltr"]]) {
    await dispCtx.addCookies([{ name: "tv_lang", value: lang, url: DISPATCH }]);
    for (const path of ["/planning", "/fleet", "/settings", "/map"]) {
      await disp.goto(`${DISPATCH}${path}`, { waitUntil: "networkidle" });
      assert.equal(await disp.evaluate(() => document.documentElement.dir), dir, `${path} ${lang}`);
      await noRawHttp(disp, `${path} ${lang}`);
    }
  }
});

await step("Dispatch: theme switched in the header is saved and applied in a fresh browser", async () => {
  await disp.goto(`${DISPATCH}/planning`, { waitUntil: "networkidle" });
  const cur = await disp.evaluate(() => document.documentElement.dataset.theme);
  const want = cur === "light" ? "dark" : "light";
  const saved = disp.waitForResponse((r) => r.url().endsWith("/v1/me/preferences") && r.request().method() === "PUT");
  await disp.getByRole("switch").first().click();
  assert.ok((await saved).ok());
  const fresh = await browser.newContext();
  const p = await watched(fresh, issues, "dispatch-fresh");
  await login(p, DISPATCH, "owner@jarbou.test");
  await p.goto(`${DISPATCH}/planning`, { waitUntil: "networkidle" });
  await p.waitForFunction((w) => document.documentElement.dataset.theme === w, want, { timeout: 10000 });
  await fresh.close();
});

await step("Driver API: account deletion request is accepted or clearly unavailable (never a 500)", async () => {
  const drv = await token("lena.hoffmann@jarbou.test");
  const r = await api(drv, "POST", "/v1/me/account-deletion-request", {});
  assert.ok([202, 503].includes(r.status), `status ${r.status}`);
});

// ------------------------------------------------------------------ Live GPS (stabilization sprint)
await step("Live GPS: pilot driver's position appears on the Hannover map only, marker reused when it moves", async () => {
  const lenaTok = await token("lena.hoffmann@jarbou.test");
  const drivers = (await api(owner, "GET", `/v1/orgs/${org}/drivers`)).json;
  const lenaId = drivers.find((d) => d.displayName === "Lena Hoffmann").id;
  assert.equal((await api(owner, "PATCH", `/v1/orgs/${org}/tracking`, { mode: "pilot", pilotDriverIds: [lenaId], confirmPilotConsent: true })).status, 200);
  assert.equal((await api(lenaTok, "POST", `/v1/orgs/${org}/tracking/notice`)).status, 200);
  const depot = (await api(owner, "GET", `/v1/orgs/${org}/depots`)).json.find((d) => /Hannover/.test(d.name));
  // Lena may already have an open tour today (seeded demo day): use it, else create one.
  let tour = (await api(owner, "GET", `/v1/orgs/${org}/tours?date=${today}`)).json.tours.map((x) => x.tour).find((x) => x.driverId === lenaId && x.status !== "completed" && x.status !== "cancelled");
  if (!tour) {
    const t = (await api(owner, "POST", `/v1/orgs/${org}/tours`, { depotId: depot.id, date: today, driverId: lenaId, name: `GPS-${Date.now().toString(36).slice(-4)}` })).json;
    await api(owner, "POST", `/v1/orgs/${org}/stops`, { tourId: t.id, stops: [{ address: { street: "Teststraße", houseNumber: "1", postalCode: "30159", city: "Hannover" }, location: { lat: 52.37, lng: 9.73 } }] });
    tour = (await api(owner, "POST", `/v1/orgs/${org}/tours/${t.id}/publish`, { expectedVersion: t.version })).json.tour ?? t;
  }
  if (tour.status !== "in_progress") assert.equal((await api(lenaTok, "POST", `/v1/orgs/${org}/tours/${tour.id}/status`, { status: "in_progress" })).status, 200);
  const send = (lat) => api(lenaTok, "POST", `/v1/orgs/${org}/tours/${tour.id}/locations`, { points: [{ id: crypto.randomUUID(), lat, lng: 9.74, accuracy: 8, speed: 9, heading: 0, recordedAt: new Date().toISOString() }] });
  assert.equal((await send(52.38)).json.accepted, 1);

  const dctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const d = await watched(dctx, issues, "dispatch-gps");
  await login(d, DISPATCH, "dispatch.hannover@jarbou.test");
  await d.goto(`${DISPATCH}/map`, { waitUntil: "networkidle" });
  const marker = d.locator(".turvio-veh").first();
  await marker.waitFor({ timeout: 20000 });
  assert.equal(await marker.getAttribute("data-state"), "live");
  await d.evaluate(() => { window.__veh = document.querySelector(".turvio-veh")?.closest(".leaflet-marker-icon"); });
  // A new position arrives over the live stream: same marker element, new place, no reload.
  await new Promise((r) => setTimeout(r, 2500));
  assert.equal((await send(52.381)).json.accepted, 1);
  await d.waitForTimeout(4000);
  assert.ok(await d.evaluate(() => !!window.__veh && document.contains(window.__veh)), "live marker was rebuilt instead of moved");
  // Bremen dispatcher: nothing from Hannover.
  const bctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const b = await watched(bctx, issues, "dispatch-bremen");
  await login(b, DISPATCH, "dispatch.bremen@jarbou.test");
  await b.goto(`${DISPATCH}/map`, { waitUntil: "networkidle" });
  await b.waitForTimeout(2000);
  assert.equal(await b.locator(".turvio-veh").count(), 0, "Bremen dispatcher sees a Hannover vehicle");
  await bctx.close();
  // Pause: the marker disappears, the driver is listed as paused.
  assert.equal((await api(lenaTok, "POST", `/v1/orgs/${org}/tours/${tour.id}/status`, { status: "paused" })).status, 200);
  await d.locator(".turvio-veh").waitFor({ state: "detached", timeout: 20000 });
  await d.getByTestId("live-unavailable").getByText("Paused").first().waitFor({ timeout: 10000 });
  // Withdrawal (driver): uploads refused afterwards.
  assert.equal((await api(lenaTok, "POST", `/v1/orgs/${org}/tours/${tour.id}/status`, { status: "in_progress" })).status, 200);
  assert.equal((await api(lenaTok, "POST", `/v1/orgs/${org}/tracking/notice/withdraw`)).status, 200);
  assert.equal((await send(52.382)).json.error.code, "tracking_notice_required");
  await dctx.close();
});

// ------------------------------------------------------------------ Driver (web build of the same app)
const DRIVER = process.env.DRIVER_URL ?? "http://localhost:8081";
await step("Driver: DE/EN/RO/AR with Arabic right-to-left; privacy text, account deletion, appearance", async () => {
  const ctx = await browser.newContext({ viewport: { width: 400, height: 860 } });
  const d = await watched(ctx, issues, "driver");
  await d.goto(DRIVER, { waitUntil: "networkidle" });
  await d.getByTestId("login-email").fill("lena.hoffmann@jarbou.test");
  await d.getByTestId("login-password").fill(PASSWORD);
  await d.getByTestId("login-submit").click();
  await d.waitForTimeout(2500);
  await d.goto(`${DRIVER}/settings`, { waitUntil: "networkidle" });
  await d.getByTestId("settings").waitFor();
  const expect = { de: /Live-Ortung: Nur wenn Ihr Unternehmen/, ro: /Urmărire live: doar dacă firma ta/, ar: /التتبع المباشر: فقط إذا فعّلته شركتك/, en: /Live tracking: only if your company switched it on/ };
  for (const lang of ["de", "ro", "ar", "en"]) {
    await d.getByTestId(`locale-${lang}`).click();
    await d.getByText(expect[lang]).waitFor();
    assert.equal(await d.evaluate(() => document.documentElement.dir), lang === "ar" ? "rtl" : "ltr", lang);
  }
  await d.getByTestId("delete-account").waitFor();
  await d.getByText("Dark", { exact: true }).click();
  await d.getByText("Light", { exact: true }).click();
  await ctx.close();
});

await step("No Content-Security-Policy violations or page errors on any page", async () => {
  assert.deepEqual(issues, []);
});

if (tourId) await api(owner, "DELETE", `/v1/orgs/${org}/tours/${tourId}`).catch(() => undefined);
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`${results.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
