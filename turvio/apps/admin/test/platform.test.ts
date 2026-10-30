import { describe, expect, it } from "vitest";
import { DEFAULT_QUERY, applyQuery, displayStatus, toCsv } from "../lib/companyTable";
import { activityFeed, monthlyRecurringRevenueCents, platformKpis, platformTenants, toRow } from "../lib/platform";

const now = new Date("2026-10-30T12:00:00Z");
const records = platformTenants(now);
const rows = records.map((r) => toRow(r, now));

describe("platform KPIs", () => {
  it("counts companies, subscriptions and trials from records", () => {
    const k = platformKpis(records, now);
    expect(k.companies).toBe(records.length);
    expect(k.trials).toBe(records.filter((r) => r.subscription.status === "trialing").length);
    expect(k.pastDue).toBe(1);
    expect(k.companiesByMonth).toHaveLength(6);
    expect(k.companiesByMonth.at(-1)).toBe(k.companies);
    expect([...k.companiesByMonth].sort((a, b) => a - b)).toEqual(k.companiesByMonth); // cumulative
  });

  it("does not invent revenue when prices are not configured", () => {
    expect(monthlyRecurringRevenueCents(records)).toBeNull();
    expect(platformKpis(records, now).mrrCents).toBeNull();
  });

  it("excludes drivers of suspended/cancelled/blocked companies from active drivers", () => {
    const k = platformKpis(records, now);
    const usableDrivers = rows.filter((r) => r.usable).reduce((n, r) => n + r.activeDrivers, 0);
    expect(k.activeDrivers).toBe(usableDrivers);
    expect(rows.find((r) => r.id === "org_mainkinzig")!.usable).toBe(false);
  });

  it("keeps the pilot tenant consistent with the shared synthetic dataset", () => {
    const jarbou = rows.find((r) => r.id === "org_jarbou")!;
    expect(jarbou.planCode).toBe("business");
    expect(jarbou.activeDrivers).toBe(3);
    expect(jarbou.driverLimit).toBe(5);
  });
});

describe("activity feed", () => {
  it("is sorted newest first, limited, and derived from records", () => {
    const events = activityFeed(records, now, 8);
    expect(events.length).toBeLessThanOrEqual(8);
    expect([...events].sort((a, b) => b.at.localeCompare(a.at))).toEqual(events);
    const ids = new Set(records.map((r) => r.org.id));
    expect(events.every((e) => ids.has(e.orgId))).toBe(true);
  });
  it("flags trials ending within 7 days", () => {
    const events = activityFeed(records, now, 100);
    expect(events.some((e) => e.kind === "trial_ending" && e.orgId === "org_desert")).toBe(true);
  });
});

describe("company table query", () => {
  it("searches name, slug, country and plan", () => {
    expect(applyQuery(rows, { ...DEFAULT_QUERY, search: "elbe" }).all.map((r) => r.id)).toEqual(["org_elbe"]);
    expect(applyQuery(rows, { ...DEFAULT_QUERY, search: "RO" }).all.some((r) => r.id === "org_transcarpatia")).toBe(true);
  });
  it("filters by status (suspended overrides subscription) and plan", () => {
    const suspended = applyQuery(rows, { ...DEFAULT_QUERY, statuses: ["suspended"] }).all;
    expect(suspended.map((r) => r.id)).toEqual(["org_mainkinzig"]);
    const active = applyQuery(rows, { ...DEFAULT_QUERY, statuses: ["active"] }).all;
    expect(active.every((r) => displayStatus(r) === "active")).toBe(true);
    const solo = applyQuery(rows, { ...DEFAULT_QUERY, plans: ["driver_solo"] }).all;
    expect(solo.map((r) => r.id)).toEqual(["org_solo_nowak"]);
  });
  it("sorts and paginates", () => {
    const byDrivers = applyQuery(rows, { ...DEFAULT_QUERY, sort: "drivers", dir: "desc", pageSize: 100 }).rows;
    expect(byDrivers[0]!.id).toBe("org_hanse");
    const p = applyQuery(rows, { ...DEFAULT_QUERY, pageSize: 5, page: 99 });
    expect(p.page).toBe(p.pageCount - 1);
    expect(p.rows.length).toBe(rows.length - 5 * (p.pageCount - 1));
  });
  it("exports CSV with escaping", () => {
    const csv = toCsv([{ ...rows[0]!, name: 'A, "B" GmbH' }]);
    expect(csv.split("\n")[0]).toContain("active_drivers");
    expect(csv).toContain('"A, ""B"" GmbH"');
  });
});
