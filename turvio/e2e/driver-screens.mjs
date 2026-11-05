// Screenshots of the TURVIO Driver web build (used for docs). Run after e2e/workflow.mjs on the
// same stack, so the synthetic tour HAN-01 is in progress:
//   SCREENSHOT_DIR=docs/screenshots/phase4 node e2e/driver-screens.mjs
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const DRIVER = process.env.DRIVER_URL ?? "http://localhost:8081";
const PASSWORD = process.env.SEED_PASSWORD ?? "Turvio-Demo-2026";
const SHOTS = process.env.SCREENSHOT_DIR ?? "/tmp/turvio-driver-screens";
mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const shot = (name) => page.screenshot({ path: `${SHOTS}/${name}.png` });
const tab = async (id) => {
  await page.getByTestId(id).click();
  await page.waitForTimeout(500);
};

await page.goto(DRIVER, { waitUntil: "networkidle" });
await shot("d00-login");
await page.getByTestId("login-email").fill("lena.hoffmann@jarbou.test");
await page.getByTestId("login-password").fill(PASSWORD);
await page.getByTestId("login-submit").click();
await page.getByTestId("home").waitFor();
// Make the dispatch tour the active route.
const han = page.getByText("HAN-01").first();
if (await han.isVisible()) await han.click();
await page.getByText("HAN-01").first().waitFor();
await page.waitForTimeout(600);
await shot("d01-home");

await tab("tab-stops");
await shot("d02-stops");
await page.getByTestId("reorder-toggle").click();
await shot("d03-stops-reorder");
await page.getByTestId("reorder-toggle").click();
await page.getByText("Done", { exact: true }).first().click();
await page.waitForTimeout(400);
await page.getByTestId("stop-0").click();
await page.getByTestId("stop-detail").waitFor();
await page.waitForTimeout(400);
await shot("d04-stop-with-proof");
await page.goBack();

await tab("tab-map");
await page.waitForTimeout(800);
await shot("d05-map");

await tab("tab-today");
await page.getByTestId("quick-add").click();
await page.getByTestId("add-stop").waitFor();
await page.getByTestId("address-search").fill("Lister Meile 42 Hannover");
await page.waitForTimeout(1500);
await page.getByTestId("field-recipient").fill("Erika Beispiel");
await page.getByTestId("field-street").fill("Lister Meile");
await page.getByTestId("field-house").fill("42");
await page.getByTestId("field-postal").fill("30161");
await shot("d06-add-stop-no-geocoder");
await page.goBack();

await page.goto(`${DRIVER}/label?codes=TVONEW99999`, { waitUntil: "networkidle" });
await page.getByTestId("label").waitFor();
await shot("d07-label-review");

await page.goto(DRIVER, { waitUntil: "networkidle" });
await page.getByTestId("home").waitFor();
await tab("tab-settings");
await shot("d08-settings");
await page.getByText("Dark", { exact: true }).click();
await tab("tab-today");
await page.waitForTimeout(500);
await shot("d09-home-dark");
await tab("tab-settings");
await page.getByText("Light", { exact: true }).click();
await page.getByTestId("locale-ar").click();
await page.reload({ waitUntil: "networkidle" });
await page.getByTestId("tab-today").click();
await page.getByTestId("home").waitFor();
await page.waitForTimeout(800);
await shot("d10-home-arabic");
await tab("tab-settings");
await page.getByTestId("locale-en").click();
await browser.close();
console.log(`screenshots in ${SHOTS}`);
