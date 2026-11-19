import { describe, expect, it } from "vitest";
import { displayStatus } from "../lib/companyTable";
import { monthlyRecurringRevenueCents, platformKpis, toRow } from "../lib/platform";
import { activityFeed, platformTenants } from "./fixtures/platform";

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

  it("counts companies without a subscription in the company figures", () => {
    const created = [...records.map((r) => r.createdAt), new Date(now.getTime() - 86_400_000).toISOString()];
    const k = platformKpis(records, now, created);
    expect(k.companies).toBe(records.length + 1);
    expect(k.newLast30).toBe(platformKpis(records, now).newLast30 + 1);
    expect(k.activeSubscriptions).toBe(platformKpis(records, now).activeSubscriptions);
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

  it("a suspended company shows as suspended whatever its subscription says", () => {
    expect(displayStatus(rows.find((r) => r.id === "org_mainkinzig")!)).toBe("suspended");
    expect(displayStatus(rows.find((r) => r.id === "org_elbe")!)).toBe("active");
  });
});

describe("activity feed (fixture)", () => {
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
