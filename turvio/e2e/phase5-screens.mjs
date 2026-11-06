// Screenshots for Phase 5 docs: road route (OSRM) in Dispatch and Driver, self-hosted address search.
// Run after `scripts/dev-stack.sh up --fresh --pilot` (with TURVIO_OSRM_URL / TURVIO_GEOCODER=postgres) and e2e/pilot.mjs.
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const OUT = process.env.SCREENSHOT_DIR ?? "/tmp/turvio-phase5";
mkdirSync(OUT, { recursive: true });
const PASSWORD = process.env.SEED_PASSWORD ?? "Turvio-Demo-2026";
const b = await chromium.launch();

const d = await b.newPage({ viewport: { width: 1440, height: 900 } });
await d.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
await d.getByLabel("Email").fill("dispatch.hannover@jarbou.test");
await d.getByLabel("Password", { exact: true }).fill(PASSWORD);
await d.getByRole("button", { name: "Sign in" }).click();
await d.waitForURL((u) => !u.pathname.startsWith("/login"));
await d.goto("http://localhost:3000/map", { waitUntil: "networkidle" });
await d.getByText("HAN-01").first().click();
await d.getByText(/Road distance/).waitFor({ timeout: 20000 });
await d.waitForTimeout(1200);
await d.screenshot({ path: `${OUT}/p5-dispatch-road-route.png` });
await d.goto("http://localhost:3000/list", { waitUntil: "networkidle" });
await d.waitForTimeout(800);
await d.screenshot({ path: `${OUT}/p5-dispatch-pilot-list.png` });

const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await p.goto("http://localhost:8081", { waitUntil: "networkidle" });
await p.getByTestId("login-email").fill("samir.haddad@jarbou.test");
await p.getByTestId("login-password").fill(PASSWORD);
await p.getByTestId("login-submit").click();
await p.getByTestId("home").waitFor();
await p.getByText("road network").first().waitFor({ timeout: 30000 });
await p.screenshot({ path: `${OUT}/p5-driver-home-road.png` });
await p.getByTestId("tab-map").click();
await p.waitForTimeout(1200);
await p.screenshot({ path: `${OUT}/p5-driver-map-road.png` });
await p.getByTestId("tab-stops").click();
await p.getByTestId("reorder-toggle").click();
await p.waitForTimeout(500);
await p.screenshot({ path: `${OUT}/p5-driver-drag-reorder.png` });
await p.getByTestId("reorder-toggle").click();
await p.getByTestId("tab-today").click();
await p.getByTestId("quick-add").click();
await p.getByTestId("address-search").fill("Podbielskistr. 11");
await p.getByText("Podbielskistraße 11, 30163 Hannover").waitFor({ timeout: 15000 });
await p.screenshot({ path: `${OUT}/p5-driver-address-search.png` });
await b.close();
console.log(`screenshots in ${OUT}`);
