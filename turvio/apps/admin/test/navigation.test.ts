import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { GROUPS } from "../components/AdminShell";
import { attention } from "../lib/attention";
import { platformTenants, toRow } from "../lib/platform";

const APP = join(__dirname, "..", "app", "(app)");

describe("Admin navigation", () => {
  const items = GROUPS.flatMap((g) => g.items);

  it("every sidebar entry is a real route (no in-page anchors), unique, with a page file", () => {
    const hrefs = items.map((i) => i.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    for (const href of hrefs) {
      expect(href).not.toContain("#");
      const dir = href === "/" ? APP : join(APP, href.slice(1));
      expect(statSync(join(dir, "page.tsx")).isFile()).toBe(true);
    }
  });

  it("every page under (app) is reachable from the sidebar", () => {
    const pages = readdirSync(APP).filter((d) => statSync(join(APP, d)).isDirectory()).map((d) => `/${d}`);
    for (const p of pages) expect(items.map((i) => i.href)).toContain(p);
  });

  it("shortcuts 1–5 are unique", () => {
    const keys = items.map((i) => i.shortcut).filter(Boolean);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("needs attention", () => {
  it("lists only real subscription and seat states, most urgent first", () => {
    const now = new Date("2026-11-13T10:00:00Z");
    const rows = platformTenants(now).map((t) => toRow(t, now));
    const items = attention(rows, now);
    // Past-due and suspended companies come before trials that end soon.
    const firstTrial = items.findIndex((x) => x.title.includes("trial ends"));
    const lastCoral = items.map((x) => x.tone).lastIndexOf("coral");
    if (firstTrial >= 0 && lastCoral >= 0) expect(lastCoral).toBeLessThan(firstTrial);
    expect(items.some((x) => x.title.includes("past due"))).toBe(true);
    expect(items.some((x) => x.title.includes("suspended"))).toBe(true);
    for (const x of items) expect(x.title).not.toMatch(/stop|tour|deliver/i);
  });

  it("is empty for healthy companies", () => {
    const now = new Date();
    const rows = platformTenants(now)
      .map((t) => toRow(t, now))
      .filter((r) => r.subscriptionStatus === "active" && r.orgStatus === "active" && !r.cancelAtPeriodEnd && (r.driverLimit ?? r.seats) > r.activeDrivers);
    expect(attention(rows, now)).toEqual([]);
  });
});
