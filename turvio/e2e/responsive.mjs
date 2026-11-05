// Responsive layout + page-error check for Dispatch, Admin and Driver (web build) on the
// running local stack, signed in with seed accounts. Optional SCREENSHOT_DIR.
//   scripts/dev-stack.sh up --fresh && node e2e/responsive.mjs
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";

const { chromium } = createRequire(import.meta.url)("playwright");
const DISPATCH = process.env.DISPATCH_URL ?? "http://localhost:3000";
const ADMIN = process.env.ADMIN_URL ?? "http://localhost:3001";
const DRIVER = process.env.DRIVER_URL ?? "http://localhost:8081";
const PASSWORD = process.env.SEED_PASSWORD ?? "Turvio-Demo-2026";
const SHOTS = process.env.SCREENSHOT_DIR;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const WIDTHS = [1920, 1440, 1100, 800, 390];

const browser = await chromium.launch();
let failures = 0;
async function check(app, base, email, paths, loginFn) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await loginFn(page, base, email);
  for (const w of WIDTHS) {
    await page.setViewportSize({ width: w, height: w < 500 ? 844 : 900 });
    for (const path of paths) {
      const errors = [];
      const onErr = (e) => errors.push(e.message);
      const onConsole = (m) => m.type() === "error" && !/Failed to load resource/.test(m.text()) && errors.push(m.text());
      page.on("pageerror", onErr);
      page.on("console", onConsole);
      await page.goto(base + path, { waitUntil: "networkidle" });
      await page.waitForTimeout(path === "/map" ? 700 : 200);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      page.off("pageerror", onErr);
      page.off("console", onConsole);
      const ok = overflow === 0 && errors.length === 0;
      if (!ok) failures++;
      console.log(`  ${ok ? "✓" : "✗"} ${app} ${path} @${w}px${overflow ? ` overflow ${overflow}px` : ""}${errors.length ? ` errors: ${errors.join(" | ").slice(0, 200)}` : ""}`);
      if (SHOTS && (w === 1440 || w === 390)) await page.screenshot({ path: `${SHOTS}/${app}${path.replace(/\//g, "-") || "-home"}-${w}.png` });
    }
  }
  await ctx.close();
}

const webLogin = async (page, base, email) => {
  await page.goto(`${base}/login`, { waitUntil: "networkidle" });
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
};
const driverLogin = async (page, base, email) => {
  await page.goto(base, { waitUntil: "networkidle" });
  await page.getByTestId("login-email").fill(email);
  await page.getByTestId("login-password").fill(PASSWORD);
  await page.getByTestId("login-submit").click();
  await page.getByText(/Today's tour|No tour published/).first().waitFor({ timeout: 20000 });
};

console.log("Responsive checks at " + WIDTHS.join("/") + " px");
await check("dispatch", DISPATCH, "owner@jarbou.test", ["/map", "/list", "/planning", "/pickups", "/fleet"], webLogin);
await check("admin", ADMIN, "ops@turvio.test", ["/", "/plans", "/system"], webLogin);
await check("driver", DRIVER, "aylin.demir@jarbou.test", ["/", "/stops", "/settings"], driverLogin);
await browser.close();
console.log(failures ? `\n${failures} failed` : "\nall passed");
assert.equal(failures, 0);
