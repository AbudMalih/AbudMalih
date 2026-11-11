// End-to-end: dispatcher → driver workflow across TURVIO Dispatch, TURVIO Driver (web build)
// and the API, on a real PostgreSQL database with the real OR-Tools optimizer.
//
//   scripts/dev-stack.sh up --fresh        (database reset + synthetic seed, all services)
//   SCREENSHOT_DIR=/tmp/turvio-e2e node e2e/workflow.mjs
//
// Synthetic scenario: JARBOU Logistik GmbH, depot Hannover, 25 stops.
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const DISPATCH = process.env.DISPATCH_URL ?? "http://localhost:3000";
const ADMIN = process.env.ADMIN_URL ?? "http://localhost:3001";
const DRIVER = process.env.DRIVER_URL ?? "http://localhost:8081";
const API = process.env.API_URL ?? "http://localhost:4000";
const PASSWORD = process.env.SEED_PASSWORD ?? "Turvio-Demo-2026";
const SHOTS = process.env.SCREENSHOT_DIR;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const results = [];
async function step(name, fn) {
  const t0 = Date.now();
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`  ✓ ${name} (${Date.now() - t0} ms)`);
  } catch (e) {
    results.push({ name, ok: false });
    console.log(`  ✗ ${name}\n    ${String(e?.message ?? e).split("\n").slice(0, 8).join("\n    ")}`);
    throw e;
  }
}
const shot = async (p, name) => SHOTS && p.screenshot({ path: `${SHOTS}/${name}.png` });

/** 25 synthetic Hannover stops (fictional recipients, approximate coordinates). */
function stopLines() {
  const streets = ["Lister Meile", "Podbielskistraße", "Sallstraße", "Limmerstraße", "Engelbosteler Damm", "Hildesheimer Straße", "Vahrenwalder Straße", "Göttinger Chaussee"];
  const lines = [];
  for (let i = 0; i < 25; i++) {
    const lat = (52.355 + (i % 5) * 0.009 + (i % 3) * 0.002).toFixed(5);
    const lng = (9.705 + Math.floor(i / 5) * 0.012 + (i % 2) * 0.003).toFixed(5);
    const pickup = i === 7 || i === 19;
    const window = pickup ? "13:00-16:00" : i === 4 ? "09:00-12:00" : "";
    lines.push([`Testkunde ${String(i + 1).padStart(2, "0")}`, streets[i % streets.length], String(10 + i), "30161", "Hannover", lat, lng, pickup ? "pickup" : "delivery", window, `TVOE2E${String(i).padStart(4, "0")}DE`].join("; "));
  }
  return lines.join("\n");
}

async function loginDispatch(page, email) {
  await page.goto(`${DISPATCH}/login`, { waitUntil: "networkidle" });
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 });
}

async function loginDriver(page, email) {
  await page.goto(DRIVER, { waitUntil: "networkidle" });
  await page.getByTestId("login-email").fill(email);
  await page.getByTestId("login-password").fill(PASSWORD);
  await page.getByTestId("login-submit").click();
}


/** Complete the open stop on the driver's stop screen (delivery without proof, or pickup). */
async function completeStop(driver) {
  const pickup = driver.getByTestId("mark-picked-up");
  await driver.getByTestId(/^mark-(delivered|picked-up)$/).waitFor();
  if (await pickup.isVisible()) {
    await pickup.click();
    await driver.getByTestId("stop-status").filter({ hasText: "Picked up" }).waitFor();
  } else {
    await driver.getByTestId("mark-delivered").click();
    await driver.getByTestId("pod-skip").click();
    await driver.getByTestId("stop-status").filter({ hasText: "Delivered" }).waitFor();
  }
  await driver.goBack();
}

const browser = await chromium.launch();
const errors = [];
const watch = (p, label) => {
  p.on("pageerror", (e) => errors.push(`${label}: ${e.message}`));
  p.on("console", (m) => m.type() === "error" && !/Failed to load resource|tile\.openstreetmap/.test(m.text()) && errors.push(`${label}: ${m.text().slice(0, 200)}`));
};

console.log(`TURVIO end-to-end workflow → ${DISPATCH} · ${DRIVER} · ${API}`);
let failed = false;
try {
  const dispatcher = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  watch(dispatcher, "dispatch");
  const driver = await browser.newPage({ viewport: { width: 390, height: 844 } });
  watch(driver, "driver");

  await step("unauthenticated visitors are sent to sign-in; wrong passwords are rejected", async () => {
    await dispatcher.goto(`${DISPATCH}/planning`, { waitUntil: "networkidle" });
    assert.match(dispatcher.url(), /\/login\?next=%2Fplanning/);
    await dispatcher.getByLabel("Email").fill("dispatch.hannover@jarbou.test");
    await dispatcher.getByLabel("Password", { exact: true }).fill("not-the-password-1");
    await dispatcher.getByRole("button", { name: "Sign in" }).click();
    await dispatcher.getByText("Email or password is incorrect").waitFor();
    await shot(dispatcher, "01-login-error");
  });

  await step("Hannover dispatcher signs in and only sees the Hannover depot", async () => {
    await loginDispatch(dispatcher, "dispatch.hannover@jarbou.test");
    await dispatcher.goto(`${DISPATCH}/planning`, { waitUntil: "networkidle" });
    const depotButton = dispatcher.getByRole("button", { name: /^Depot:/ }).first();
    assert.equal(await depotButton.getAttribute("aria-label"), "Depot: Hannover");
    await dispatcher.getByText(/No tours planned for/).waitFor();
    await shot(dispatcher, "02-planning-empty");
  });

  await step("creates a tour with driver and vehicle", async () => {
    await dispatcher.getByRole("button", { name: "New tour" }).first().click();
    const dlg = dispatcher.getByRole("dialog");
    await dlg.getByLabel("Driver").selectOption({ label: "Lena Hoffmann" });
    await dlg.getByLabel("Vehicle").selectOption({ label: "Sprinter 1 · H-JL 100" });
    await dlg.getByRole("button", { name: "Create tour" }).click();
    await dispatcher.getByText("Tour HAN-01 created").waitFor();
    await dispatcher.getByRole("dialog", { name: "Tour HAN-01" }).waitFor();
  });

  await step("adds 25 stops (paste list)", async () => {
    const sheet = dispatcher.getByRole("dialog", { name: "Tour HAN-01" });
    await sheet.getByRole("button", { name: "Add stops" }).click();
    const dlg = dispatcher.getByRole("dialog", { name: /Add stops · HAN-01/ });
    await dlg.getByRole("tab", { name: "Paste list" }).click();
    await dlg.getByLabel("Stop list").fill(stopLines());
    await dlg.getByText("25 valid · 0 with errors").waitFor();
    await dlg.getByRole("button", { name: "Add 25 stops" }).click();
    await dispatcher.getByText("25 stops added to HAN-01").waitFor();
    await sheet.getByTestId("tour-progress").filter({ hasText: "0 of 25 stops done" }).waitFor();
  });

  await step("optimizes with the OR-Tools service and saves the order", async () => {
    const sheet = dispatcher.getByRole("dialog", { name: "Tour HAN-01" });
    await sheet.getByRole("button", { name: /Optimize & save/ }).click();
    await dispatcher.getByText("Route optimized and saved").waitFor({ timeout: 60000 });
    await sheet.getByText(/Last optimized/).waitFor();
    await shot(dispatcher, "03-tour-optimized");
  });

  await step("publishes the tour to the driver", async () => {
    const sheet = dispatcher.getByRole("dialog", { name: "Tour HAN-01" });
    await sheet.getByRole("button", { name: "Publish to driver" }).click();
    const confirm = dispatcher.getByRole("dialog", { name: "Publish HAN-01?" });
    await confirm.getByRole("button", { name: "Publish" }).click();
    await dispatcher.getByText("HAN-01 published to Lena Hoffmann").waitFor();
    await sheet.getByText("Published", { exact: true }).waitFor();
  });

  await step("driver signs in to TURVIO Driver and receives the tour with 25 stops", async () => {
    await loginDriver(driver, "lena.hoffmann@jarbou.test");
    await driver.getByText("HAN-01").first().waitFor({ timeout: 20000 });
    await driver.getByTestId("progress-text").filter({ hasText: "0 of 25 stops done" }).waitFor();
    await shot(driver, "04-driver-home");
  });

  await step("driver scans parcels continuously (manual entry on the web build), duplicates are flagged", async () => {
    await driver.getByTestId("hero-scan").click();
    await driver.getByTestId("scanner").waitFor();
    for (const code of ["TVOE2E0000DE", "TVOE2E0001DE", "TVOE2E0002DE", "TVOE2E0001DE", "TVONEW99999"]) {
      await driver.getByTestId("scan-manual-input").fill(code);
      await driver.getByTestId("scan-manual-add").click();
    }
    await driver.getByTestId("scan-count").filter({ hasText: "4 scanned" }).waitFor();
    await driver.getByText("3 on route · 1 new").waitFor();
    await shot(driver, "08-driver-scanner");
    await driver.getByTestId("scan-finish").click();
    await driver.getByText("3/25 parcels loaded").waitFor({ timeout: 10000 });
  });

  await step("driver starts the tour and works five stops: proof of delivery, outcomes, notes", async () => {
    await driver.getByTestId("start-tour").click();
    // Stop 1: arrive, deliver with signature + name (proof of delivery).
    await driver.getByTestId("open-next-stop").click();
    await driver.getByTestId("arrived").click();
    await driver.getByTestId("stop-status").filter({ hasText: "Arrived" }).waitFor();
    await shot(driver, "09-driver-stop-detail");
    await driver.getByTestId("mark-delivered").click();
    const pad = driver.getByTestId("signature-pad");
    await pad.waitFor();
    const box = await pad.boundingBox();
    await driver.mouse.move(box.x + 30, box.y + 110);
    await driver.mouse.down();
    for (const [dx, dy] of [[60, 60], [100, 120], [150, 50], [200, 130], [260, 70]]) await driver.mouse.move(box.x + dx, box.y + dy, { steps: 6 });
    await driver.mouse.up();
    await driver.getByTestId("pod-name").fill("E. Beispiel");
    await shot(driver, "10-driver-proof-of-delivery");
    await driver.getByTestId("pod-complete").click();
    await driver.getByTestId("stop-proofs").waitFor();
    await driver.goBack();
    await driver.getByTestId("progress-text").filter({ hasText: "1 of 25 stops done" }).waitFor({ timeout: 15000 });
    // Stops 2–4: delivered without proof.
    for (let i = 2; i <= 4; i++) {
      await driver.getByTestId("open-next-stop").click();
      await completeStop(driver);
      await driver.getByTestId("progress-text").filter({ hasText: `${i} of 25 stops done` }).waitFor({ timeout: 15000 });
    }
    // Stop 5: not delivered – attempted, recipient absent, with a note.
    await driver.getByTestId("open-next-stop").click();
    await driver.getByTestId("mark-not-delivered").click();
    await driver.getByTestId("outcome-attempted").click();
    await driver.getByTestId("reason-recipient_absent").click();
    await driver.getByTestId("outcome-note").fill("Karte eingeworfen");
    await shot(driver, "11-driver-not-delivered");
    await driver.getByTestId("outcome-save").click();
    await driver.getByTestId("stop-status").filter({ hasText: "Attempted" }).waitFor();
    await driver.goBack();
    await driver.getByTestId("progress-text").filter({ hasText: "5 of 25 stops done" }).waitFor({ timeout: 15000 });
    // A note on the next stop.
    await driver.getByTestId("open-next-stop").click();
    await driver.getByTestId("add-note").click();
    await driver.getByTestId("note-input").fill("Hinterhof, 2. Tür links");
    await driver.getByTestId("save-note").click();
    await driver.goBack();
    // Wait until the outbox is empty (all changes and the signature confirmed by the server).
    await driver.getByText(/^Updated /).waitFor({ timeout: 30000 });
    await shot(driver, "05-driver-five-done");
  });

  await step("works offline: changes are queued and sent when the connection returns", async () => {
    await driver.context().setOffline(true);
    await driver.getByTestId("open-next-stop").click();
    await completeStop(driver);
    await driver.getByTestId("progress-text").filter({ hasText: "6 of 25 stops done" }).waitFor();
    await driver.getByTestId("sync-pill").filter({ hasText: /Offline|waiting/ }).waitFor({ timeout: 15000 });
    await shot(driver, "12-driver-offline");
    await driver.context().setOffline(false);
    await driver.getByTestId("sync-pill").click();
    await driver.getByText(/^Updated /).waitFor({ timeout: 30000 });
  });

  await step("driver optimizes the remaining stops on the server (OR-Tools, labelled estimate)", async () => {
    await driver.getByTestId("hero-optimize").click();
    await driver.getByTestId("optimize-run").click();
    await driver.getByTestId("optimize-result").getByText(/Optimized with OR-Tools – travel times: (straight-line estimate|road network)/).waitFor({ timeout: 30000 });
    await shot(driver, "13-driver-optimize");
    await driver.getByTestId("optimize-done").click();
  });

  await step("dispatcher sees progress, outcome, note, scans and the signature – live", async () => {
    const sheet = dispatcher.getByRole("dialog", { name: "Tour HAN-01" });
    await sheet.getByTestId("tour-progress").filter({ hasText: "6 of 25 stops done" }).waitFor({ timeout: 20000 });
    await sheet.getByText("Driver started the tour").waitFor({ timeout: 10000 });
    await sheet.getByText(/Delivery attempted \(Recipient not at home\)/).first().waitFor({ timeout: 10000 });
    await sheet.getByText(/Signature captured/).first().waitFor();
    await sheet.getByText(/Driver note/).first().waitFor();
    // Open the stop with the signature and view it through the authenticated proxy.
    const rows = sheet.locator("li button[aria-expanded]");
    let opened = false;
    for (let i = 0; i < (await rows.count()) && !opened; i++) {
      await rows.nth(i).click();
      if (await sheet.getByTestId("proof-signature").isVisible().catch(() => false)) opened = true;
      else await rows.nth(i).click();
    }
    assert.ok(opened, "stop with signature found");
    await sheet.getByTestId("proof-signature").click();
    const img = dispatcher.getByTestId("proof-image");
    await img.waitFor();
    await dispatcher.waitForFunction(() => {
      const el = document.querySelector('[data-testid="proof-image"]');
      return el instanceof HTMLImageElement && el.complete && el.naturalWidth > 0;
    }, null, { timeout: 10000 });
    await shot(dispatcher, "06-dispatch-live-progress");
    await dispatcher.keyboard.press("Escape");
    // The file is not reachable without a session.
    const anon = await fetch(`${API}/v1/orgs/x/proofs/00000000-0000-4000-8000-000000000000/file`);
    assert.equal(anon.status, 401);
  });

  await step("data persists after refreshing both apps", async () => {
    await dispatcher.reload({ waitUntil: "networkidle" });
    await dispatcher.goto(`${DISPATCH}/list`, { waitUntil: "networkidle" });
    const row = dispatcher.getByRole("table").getByRole("row").filter({ hasText: "HAN-01" });
    await row.waitFor();
    assert.match(await row.textContent(), /Lena Hoffmann/);
    const cells = await row.getByRole("cell").allTextContents();
    assert.equal(cells[4], "25"); // total stops
    assert.match(cells[5], /^6/); // completed
    await driver.reload({ waitUntil: "networkidle" });
    await driver.getByTestId("progress-text").filter({ hasText: "6 of 25 stops done" }).waitFor({ timeout: 20000 });
  });

  await step("data persists after signing out and in again", async () => {
    await dispatcher.getByRole("button", { name: /^Account:/ }).click();
    await dispatcher.getByRole("menuitem", { name: "Sign out" }).click();
    await dispatcher.waitForURL(/\/login/);
    await loginDispatch(dispatcher, "dispatch.hannover@jarbou.test");
    await dispatcher.goto(`${DISPATCH}/list`, { waitUntil: "networkidle" });
    await dispatcher.getByRole("table").getByRole("row").filter({ hasText: "HAN-01" }).waitFor();
  });

  await step("driver creates a personal route and imports pasted stops (grouped by address)", async () => {
    await driver.getByTestId("quick-route").click();
    await driver.getByTestId("route-name").fill("Nachmittag Extra");
    await driver.getByTestId("route-create").click();
    await driver.getByText("Nachmittag Extra").first().waitFor();
    await driver.getByTestId("quick-import").click();
    await driver.getByTestId("import-text").fill(["Lister Meile 4, 30161 Hannover TVOIMP000001 52.3822, 9.7471", "Lister Meile 4, 30161 Hannover TVOIMP000002", "Am Markt 1, 28195 Bremen TVOIMP000003", "kaputte Zeile"].join("\n"));
    await driver.getByTestId("import-preview").click();
    await driver.getByText("2 stops · 3 parcels · 1 rows with errors").waitFor();
    await shot(driver, "14-driver-import-preview");
    await driver.getByTestId("import-run").click();
    await driver.getByTestId("progress-text").filter({ hasText: "0 of 2 stops done" }).waitFor({ timeout: 15000 });
    await driver.getByText(/^Updated /).waitFor({ timeout: 30000 });
    // Dispatch (Hannover) sees the driver's own route.
    await dispatcher.goto(`${DISPATCH}/list`, { waitUntil: "networkidle" });
    await dispatcher.getByRole("table").getByRole("row").filter({ hasText: "Nachmittag Extra" }).waitFor({ timeout: 20000 });
  });

  await step("another depot's dispatcher (Bremen) cannot see the Hannover tour", async () => {
    const p = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await loginDispatch(p, "dispatch.bremen@jarbou.test");
    await p.goto(`${DISPATCH}/list`, { waitUntil: "networkidle" });
    assert.equal(await p.getByRole("button", { name: /^Depot:/ }).first().getAttribute("aria-label"), "Depot: Bremen");
    assert.equal(await p.getByText("HAN-01").count(), 0);
    await p.close();
  });

  await step("another company (Muster Kurier) cannot see or reach JARBOU data", async () => {
    const p = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await loginDispatch(p, "owner@muster.test");
    await p.goto(`${DISPATCH}/list`, { waitUntil: "networkidle" });
    assert.equal(await p.getByText("HAN-01").count(), 0);
    await p.getByText("LEI-01").first().waitFor();
    // Direct API request for JARBOU through Muster's session is refused.
    const me = await p.evaluate(async () => (await fetch("/api/turvio/v1/me")).json());
    assert.equal(me.memberships.length, 1);
    const jarbouId = await (async () => {
      const r = await fetch(`${API}/v1/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "owner@jarbou.test", password: PASSWORD }) });
      const t = (await r.json()).accessToken;
      return (await (await fetch(`${API}/v1/me`, { headers: { authorization: `Bearer ${t}` } })).json()).memberships[0].organizationId;
    })();
    const status = await p.evaluate(async (id) => (await fetch(`/api/turvio/v1/orgs/${id}/dispatch`)).status, jarbouId);
    assert.equal(status, 403);
    await p.close();
  });

  await step("a different driver of the same company does not receive the tour", async () => {
    const p = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await loginDriver(p, "mihai.popescu@jarbou.test");
    await p.getByText("No routes yet").waitFor({ timeout: 20000 });
    await p.close();
  });

  await step("drivers cannot use Dispatch; platform admins cannot read delivery data", async () => {
    const p = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await loginDispatch(p, "lena.hoffmann@jarbou.test");
    await p.getByText("No Dispatch access").waitFor();
    await p.close();
    const a = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await a.goto(`${ADMIN}/login`, { waitUntil: "networkidle" });
    await a.getByLabel("Email").fill("ops@turvio.test");
    await a.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await a.getByRole("button", { name: "Sign in" }).click();
    await a.getByRole("heading", { name: "Platform overview" }).waitFor({ timeout: 20000 });
    await a.getByText("JARBOU Logistik GmbH").first().waitFor();
    await shot(a, "07-admin-overview");
    const jarbou = await a.evaluate(async () => (await (await fetch("/api/turvio/v1/platform/overview")).json()).organizations.find((o) => o.slug === "jarbou").id);
    assert.equal(await a.evaluate(async (id) => (await fetch(`/api/turvio/v1/orgs/${id}/dispatch`)).status, jarbou), 403);
    await a.close();
  });

  assert.deepEqual(errors, [], "browser errors");
} catch {
  failed = true;
} finally {
  await browser.close();
}
const bad = results.filter((r) => !r.ok).length;
if (errors.length) console.log("Browser errors:\n  " + errors.join("\n  "));
console.log(`\n${results.length - bad} passed, ${bad} failed${failed && !bad ? " (browser errors)" : ""}`);
process.exit(failed ? 1 : 0);
