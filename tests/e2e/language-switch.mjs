// Browser regression test for language switching (desktop and mobile).
// Usage: npm run test:e2e -- <base-url> [desktop|mobile] [rounds]
// Needs Playwright with Chromium (`playwright` or `playwright-core`); it is
// not a project dependency, so it runs where Playwright is installed.
// Checks after every switch: URL language prefix, <html lang/dir>, the active
// language (aria-current), a changed page heading, visible content in the
// viewport, the scroll position (kept on the same page, top on a fallback),
// browser back/forward, and no page or console errors.
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
let pw;
try { pw = require("playwright"); } catch { pw = require("playwright-core"); }
const BASE = process.argv[2] || "http://localhost:3100";
const MOBILE = process.argv[3] === "mobile";
const ROUNDS = Number(process.argv[4] || 2);
const DIR = { de: "ltr", en: "ltr", ar: "rtl" };
const PAGES = ["/", "/leistungen", "/import", "/marken", "/unternehmen", "/kontakt", "/angebot", "/impressum", "/datenschutz", "/wissen", "/wissen/import-aus-china-nach-deutschland"];
const SEQS = [["en", "de"], ["ar", "de"], ["en", "ar", "en", "de"]];

const browser = await pw.chromium.launch();
const ctx = await browser.newContext(MOBILE ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

const state = () => page.evaluate(() => {
  const inView = [...document.querySelectorAll("main h1, main h2, main p, main li")].filter((e) => {
    const r = e.getBoundingClientRect();
    if (!(r.bottom > 80 && r.top < innerHeight && r.height > 0)) return false;
    let o = 1, n = e;
    while (n && n !== document.body) { o *= +getComputedStyle(n).opacity; n = n.parentElement; }
    return o > 0.3;
  }).length;
  return {
    url: location.pathname, lang: document.documentElement.lang, dir: document.documentElement.dir,
    current: document.querySelector("a[aria-current='true'][hreflang]")?.getAttribute("hreflang"),
    h1: document.querySelector("h1")?.textContent?.trim().slice(0, 60), y: Math.round(scrollY), inView,
  };
});
async function choose(l) {
  if (MOBILE) {
    const btn = page.locator("header button[aria-expanded]").first();
    if ((await btn.getAttribute("aria-expanded")) !== "true") { await btn.click(); await page.waitForTimeout(450); }
    await page.locator(`a[hreflang='${l}']`).filter({ visible: true }).first().click();
  } else {
    await page.locator(`header a[hreflang='${l}']`).filter({ visible: true }).first().click();
  }
}

let total = 0, fails = 0;
const fail = (msg) => { fails++; console.log("FAIL", msg); };
for (let r = 0; r < ROUNDS; r++) {
  for (const start of PAGES) {
    for (const seq of SEQS) {
      await page.goto(BASE + start, { waitUntil: r ? "domcontentloaded" : "networkidle" });
      await page.waitForTimeout(r ? 200 : 1200);
      if (r && start !== "/") { // also switch from the middle of the page
        await page.evaluate(() => scrollTo(0, (document.documentElement.scrollHeight - innerHeight) * 0.4));
        await page.waitForTimeout(500);
      }
      let prev = await state();
      for (const l of seq) {
        total++;
        const href = await page.locator(`a[hreflang='${l}']`).first().getAttribute("href");
        try { await choose(l); } catch (e) { fail(`${start} -> ${l}: click ${e.message.split("\n")[0]}`); continue; }
        try { await page.waitForFunction(([l, before]) => document.documentElement.lang === l && location.pathname !== before, [l, prev.url], { timeout: 8000 }); }
        catch { fail(`${start} -> ${l}: no navigation (${JSON.stringify(await state())})`); continue; }
        await page.waitForTimeout(900);
        const s = await state();
        const prefixOk = l === "de" ? !/^\/(en|ar)(\/|$)/.test(s.url) : s.url === `/${l}` || s.url.startsWith(`/${l}/`);
        const problems = [];
        if (!prefixOk || s.url !== href) problems.push(`url ${s.url} (link ${href})`);
        if (s.dir !== DIR[l]) problems.push(`dir ${s.dir}`);
        if (s.current !== l) problems.push(`active ${s.current}`);
        if (!s.h1 || s.h1 === prev.h1) problems.push(`heading unchanged "${s.h1}"`);
        if (s.inView === 0) problems.push("no visible content in the viewport");
        // a fallback (another page than the current one) must open at the top
        const kind = (u) => /^(\/(en|ar))?\/(wissen|insights)\/.+/.test(u) ? "article" : /^(\/(en|ar))?\/(wissen|insights)$/.test(u) ? "listing" : /^\/(en|ar)?$/.test(u) ? "home" : "page";
        const fallback = (kind(prev.url) === "article" && kind(s.url) !== "article") || (kind(prev.url) === "listing" && kind(s.url) === "home");
        if (fallback && s.y > 0) problems.push(`fallback opened at y=${s.y}`);
        if (problems.length) fail(`${start} -> ${l}: ${problems.join("; ")}`);
        prev = s;
      }
    }
  }
}
// back / forward
await page.goto(BASE + "/leistungen", { waitUntil: "networkidle" });
await choose("en"); await page.waitForURL(/\/en\//);
await choose("ar"); await page.waitForURL(/\/ar\//);
const checks = [];
await page.goBack(); await page.waitForTimeout(1200); checks.push(await state());
await page.goBack(); await page.waitForTimeout(1200); checks.push(await state());
await page.goForward(); await page.waitForTimeout(1200); checks.push(await state());
const exp = [["en", "/en/services"], ["de", "/leistungen"], ["en", "/en/services"]];
checks.forEach((c, i) => { if (c.lang !== exp[i][0] || c.url !== exp[i][1] || c.current !== exp[i][0]) fail(`history step ${i}: ${JSON.stringify(c)}`); });
// reload keeps the language
await page.reload({ waitUntil: "networkidle" });
const rl = await state(); if (rl.lang !== "en" || rl.url !== "/en/services") fail(`reload: ${JSON.stringify(rl)}`);

console.log(`${MOBILE ? "mobile" : "desktop"} ${BASE}: ${total} switches, ${fails} failures; errors: ${errors.length ? [...new Set(errors)].join(" | ").slice(0, 600) : "none"}`);
await browser.close();
process.exit(fails || errors.length ? 1 : 0);
