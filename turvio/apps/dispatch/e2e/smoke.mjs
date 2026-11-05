// Browser tests for TURVIO Dispatch against a running server.
//   pnpm --filter @turvio/dispatch build && pnpm --filter @turvio/dispatch start
//   BASE_URL=http://localhost:3000 SCREENSHOT_DIR=./shots pnpm --filter @turvio/dispatch e2e
// Uses the Playwright library (pre-installed Chromium) with node:assert.
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const SHOTS = process.env.SCREENSHOT_DIR;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const results = [];
async function test(name, fn) {
  const t0 = Date.now();
  try {
    await fn();
    results.push({ name, ok: true, ms: Date.now() - t0 });
    console.log(`  ✓ ${name} (${Date.now() - t0} ms)`);
  } catch (e) {
    results.push({ name, ok: false });
    console.log(`  ✗ ${name}\n    ${String(e?.message ?? e).split("\n").slice(0, 6).join("\n    ")}`);
  }
}

const browser = await chromium.launch();
async function page(width = 1440, height = 900) {
  const p = await browser.newPage({ viewport: { width, height } });
  p.errors = [];
  p.on("pageerror", (e) => p.errors.push(e.message));
  // Tile requests fail in offline sandboxes; that is handled by the UI and not an app error.
  p.on("console", (m) => m.type() === "error" && !/Failed to load resource/.test(m.text()) && p.errors.push(m.text()));
  return p;
}
const shot = async (p, name, full = false) => SHOTS && (await p.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: full }));
const overflow = (p) => p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const tourItems = (p) => p.getByRole("list", { name: "Tours" }).getByRole("listitem");
/** Poll until fn() returns the expected value (UI updates are async). */
async function eventually(fn, expected, timeout = 5000) {
  const end = Date.now() + timeout;
  let last;
  while (Date.now() < end) {
    last = await fn();
    if (last === expected) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  assert.equal(last, expected);
}

console.log(`TURVIO Dispatch browser tests → ${BASE}`);

await test("map workspace loads with navigation, summary and map", async () => {
  const p = await page();
  await p.goto(`${BASE}/`, { waitUntil: "networkidle" });
  assert.match(p.url(), /\/map$/);
  for (const v of ["Map", "List", "Planning", "Pickups"]) assert.equal(await p.getByRole("link", { name: v, exact: true }).first().isVisible(), true, v);
  assert.equal(await p.getByRole("region", { name: "Operations summary" }).isVisible(), true);
  await p.getByRole("region", { name: "Route map" }).waitFor();
  await p.locator(".leaflet-marker-icon").first().waitFor();
  assert.ok((await tourItems(p).count()) >= 10);
  assert.equal(await p.getByAltText("TURVIO").first().isVisible(), true, "logo visible");
  await shot(p, "dispatch-map-1440");
  assert.deepEqual(p.errors, []);
  await p.close();
});

await test("tour filters, search and selection drive map and details", async () => {
  const p = await page();
  await p.goto(`${BASE}/map`, { waitUntil: "networkidle" });
  await p.getByRole("tab", { name: /Delayed/ }).click();
  await eventually(() => tourItems(p).count(), 1);
  await p.getByRole("tab", { name: /^All/ }).click();
  await p.getByRole("searchbox", { name: "Search tours and drivers" }).fill("Kassel");
  await eventually(() => tourItems(p).count(), 2);
  await p.getByRole("searchbox", { name: "Search tours and drivers" }).fill("");
  await p.getByRole("button", { name: /HAN-02/ }).first().click();
  await p.getByRole("heading", { name: "Tour HAN-02" }).waitFor();
  assert.equal(await p.getByText(/time windows? will be missed/).first().isVisible(), true);
  // Numbered markers appear for the selected route only.
  await p.locator(".leaflet-marker-icon[title^='1. ']").first().waitFor();
  await p.waitForTimeout(500);
  await shot(p, "dispatch-map-selected-1440");
  // Expand a stop in the detail list.
  await p.getByRole("region", { name: "Stops in order" }).getByRole("button").nth(20).click();
  assert.ok((await p.getByText(/parcel/).count()) > 0);
  await p.getByRole("button", { name: "Clear" }).click();
  await p.getByRole("heading", { name: "Operations overview" }).waitFor();
  assert.deepEqual(p.errors, []);
  await p.close();
});

await test("map controls: zoom, fit, layers and tile fallback", async () => {
  const p = await page();
  await p.goto(`${BASE}/map`, { waitUntil: "networkidle" });
  await p.locator(".leaflet-marker-icon").first().waitFor();
  const zoom = () => p.evaluate(() => Number(getComputedStyle(document.querySelector(".leaflet-map-pane")).transform.split(",")[0].replace("matrix(", "")) || 0);
  const scaleBefore = await p.evaluate(() => document.querySelector(".leaflet-proxy")?.getAttribute("style") ?? "");
  await p.getByRole("button", { name: "Zoom in" }).click();
  await p.waitForTimeout(400);
  const scaleAfter = await p.evaluate(() => document.querySelector(".leaflet-proxy")?.getAttribute("style") ?? "");
  assert.notEqual(scaleBefore, scaleAfter, "zoom changed");
  await zoom();
  await p.getByRole("button", { name: "Fit all routes" }).click();
  await p.getByRole("button", { name: "Map layers" }).click();
  const before = await p.locator(".leaflet-overlay-pane path").count();
  await p.getByLabel("Completed stops").uncheck();
  await p.waitForTimeout(200);
  assert.ok((await p.locator(".leaflet-overlay-pane path").count()) < before, "completed layer hidden");
  // Sandbox/offline: tiles fail -> explicit notice instead of a blank map.
  const tilesFailed = await p.getByText(/Base map tiles are unavailable/).isVisible().catch(() => false);
  console.log(`    (tile fallback notice ${tilesFailed ? "shown – tiles blocked in this environment" : "not needed – tiles loaded"})`);
  await p.close();
});

await test("depot switching scopes every view", async () => {
  const p = await page();
  await p.goto(`${BASE}/map`, { waitUntil: "networkidle" });
  await p.getByRole("button", { name: /^Depot:/ }).first().click();
  await p.getByRole("menuitem", { name: /^Bremen/ }).click();
  await eventually(() => tourItems(p).count(), 3);
  for (const t of await tourItems(p).allTextContents()) assert.match(t, /Bremen/);
  const summary = await p.getByRole("region", { name: "Operations summary" }).textContent();
  assert.match(summary, /Completed stops\d+of 80/); // Bremen stops only (32 + 18 + 30)
  await p.getByRole("link", { name: "List", exact: true }).first().click();
  await p.waitForURL(/\/list/);
  await eventually(() => p.getByRole("table").getByRole("row").count(), 4);
  await p.getByRole("button", { name: /^Depot:/ }).first().click();
  await p.getByRole("menuitem", { name: /^All depots/ }).click();
  await eventually(() => p.getByRole("table").getByRole("row").count(), 9);
  await p.close();
});

await test("list view: keyboard navigation, sorting, status deep link and drawer", async () => {
  const p = await page();
  await p.goto(`${BASE}/map`, { waitUntil: "networkidle" });
  await p.keyboard.press("2");
  await p.waitForURL(/\/list/);
  const left = p.getByRole("columnheader", { name: /Left/ });
  await left.getByRole("button").click();
  assert.equal(await left.getAttribute("aria-sort"), "ascending");
  await p.goto(`${BASE}/list?status=delayed`, { waitUntil: "networkidle" });
  assert.equal(await p.getByRole("table").getByRole("row").count(), 2);
  await p.getByRole("table").getByRole("button", { name: /HAN-02/ }).click();
  const dialog = p.getByRole("dialog");
  await dialog.getByText("Tour HAN-02").waitFor();
  await p.waitForTimeout(400);
  await shot(p, "dispatch-list-drawer-1440");
  await p.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });
  await p.close();
});

await test("planning: create tour, assign driver and stops, optimize, discard", async () => {
  const p = await page();
  await p.goto(`${BASE}/planning`, { waitUntil: "networkidle" });
  await p.getByRole("button", { name: /New tour/ }).click();
  await p.getByRole("dialog").getByRole("button", { name: "Create tour" }).click();
  await p.getByText("Tour HAN-04 created").waitFor();
  const card = p.getByRole("group", { name: "Tour HAN-04" });
  await card.getByRole("button", { name: /^Driver:/ }).click();
  await p.locator('[role="menuitem"]:not([data-disabled])').first().click();
  await p.getByText(/assigned to HAN-04/).waitFor();
  await p.getByRole("checkbox", { name: /^Select / }).first().click();
  await p.getByRole("button", { name: /Assign$/ }).click();
  await p.getByRole("menuitem", { name: /HAN-04/ }).click();
  await p.getByText(/assigned to HAN-04/).last().waitFor();
  await p.getByText(/Local planning draft · \d+ change/).waitFor();
  await shot(p, "dispatch-planning-1440");
  // Draft survives switching views (client navigation) and shows up in the list.
  await p.getByRole("link", { name: "List", exact: true }).first().click();
  await p.waitForURL(/\/list/);
  await p.getByRole("searchbox", { name: "Search tours" }).fill("HAN-04");
  assert.equal(await p.getByRole("table").getByRole("row").count(), 2);
  await p.getByRole("link", { name: "Planning", exact: true }).first().click();
  await p.getByRole("button", { name: /Discard draft/ }).click();
  assert.equal(await p.getByRole("button", { name: "HAN-04", exact: true }).count(), 0);
  // Optimize an in-progress tour (local heuristic without API) -> toast.
  await p.getByRole("button", { name: "Optimize", exact: true }).first().click();
  await p.getByText(/stops re-ordered \(draft\)/).waitFor();
  assert.deepEqual(p.errors, []);
  await p.close();
});

await test("pickups: attention filter, deadline view and assignment", async () => {
  const p = await page();
  await p.goto(`${BASE}/pickups`, { waitUntil: "networkidle" });
  const rows = () => p.getByRole("table").getByRole("row");
  const attention = (await rows().count()) - 1;
  assert.ok(attention > 0);
  await shot(p, "dispatch-pickups-1440");
  await p.getByRole("tab", { name: /Unassigned/ }).click();
  const unassigned = (await rows().count()) - 1;
  await rows().nth(1).getByRole("button", { name: /Assign/ }).click();
  await p.getByRole("menuitem").first().click();
  await p.getByText(/Pickup added to/).waitFor();
  assert.equal((await rows().count()) - 1, unassigned - 1);
  await p.close();
});

await test("date without data shows a clear empty state", async () => {
  const p = await page();
  await p.goto(`${BASE}/planning`, { waitUntil: "networkidle" });
  await p.getByLabel("Operating date").first().fill("2026-12-24");
  await p.getByText(/No plan for 2026-12-24/).waitFor();
  await p.getByRole("button", { name: /Go to/ }).click();
  await p.getByRole("heading", { name: "Planning" }).waitFor();
  await p.close();
});

const WIDTHS = [1920, 1440, 1100, 800, 390];
await test(`responsive: no horizontal overflow at ${WIDTHS.join("/")} px on all views`, async () => {
  for (const w of WIDTHS) {
    const p = await page(w, w < 500 ? 844 : 900);
    for (const view of ["map", "list", "planning", "pickups"]) {
      await p.goto(`${BASE}/${view}`, { waitUntil: "networkidle" });
      await p.waitForTimeout(view === "map" ? 600 : 150);
      const o = await overflow(p);
      assert.equal(o, 0, `${view} @${w}px overflows by ${o}px`);
      if (w === 1920 || w === 1100 || w === 800 || w === 390) await shot(p, `dispatch-${view}-${w}`);
    }
    if (w === 390) {
      // Phone: tours pane, then pick a tour -> map + details drawer.
      await p.goto(`${BASE}/map`, { waitUntil: "networkidle" });
      await p.getByRole("tab", { name: "Tours" }).click();
      await shot(p, "dispatch-map-390-tours");
      await p.getByRole("button", { name: /BRE-01/ }).first().click();
      await p.getByRole("dialog").getByText("Tour BRE-01").waitFor();
      await p.waitForTimeout(450); // let the drawer finish sliding in
      // The drawer must be on top of the map (no Leaflet layer above it).
      const onTop = await p.evaluate(() => {
        const d = document.querySelector('[role="dialog"]').getBoundingClientRect();
        const el = document.elementFromPoint(d.left + d.width / 2, d.top + d.height / 2);
        return !!el?.closest('[role="dialog"]');
      });
      assert.equal(onTop, true, "details drawer is covered by the map");
      await shot(p, "dispatch-map-390-detail");
    }
    assert.deepEqual(p.errors, [], `page errors at ${w}px`);
    await p.close();
  }
});

await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
