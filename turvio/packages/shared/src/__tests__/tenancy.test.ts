import { describe, expect, it } from "vitest";
import { can, canAssignRole } from "../permissions";
import { checkLimit, checkPlanChange, effectiveLimit, findPlan, isSubscriptionUsable, quote, trialEnd, type Subscription, type Usage } from "../billing";
import { createSyntheticDataset, SYNTHETIC_ORGANIZATIONS } from "../synthetic";

const team = findPlan("team")!;
const solo = findPlan("driver_solo")!;
const business = findPlan("business")!;
const usage = (o: Partial<Usage> = {}): Usage => ({ max_drivers: 0, max_dispatchers: 0, max_depots: 0, max_vehicles: 0, max_stops_per_month: 0, ...o });
const sub = (o: Partial<Subscription> = {}): Subscription => ({
  organizationId: "org_jarbou",
  planCode: "team",
  status: "active",
  interval: "month",
  seats: 3,
  trialEndsAt: null,
  currentPeriodEnd: "2026-11-30T00:00:00.000Z",
  cancelAtPeriodEnd: false,
  limitOverrides: {},
  ...o,
});

describe("permissions", () => {
  it("drivers cannot see all tours, manage members or billing", () => {
    expect(can("driver", "tours.view_own")).toBe(true);
    expect(can("driver", "tours.view_all")).toBe(false);
    expect(can("driver", "org.members.manage")).toBe(false);
    expect(can("driver", "org.billing.view")).toBe(false);
  });
  it("dispatchers run operations but not settings or audit", () => {
    expect(can("dispatcher", "tours.manage")).toBe(true);
    expect(can("dispatcher", "reports.export")).toBe(true);
    expect(can("dispatcher", "depots.manage")).toBe(false);
    expect(can("dispatcher", "audit.view")).toBe(false);
  });
  it("only owners assign the owner role", () => {
    expect(canAssignRole("owner", "owner")).toBe(true);
    expect(canAssignRole("admin", "owner")).toBe(false);
    expect(canAssignRole("admin", "dispatcher")).toBe(true);
    expect(canAssignRole("dispatcher", "driver")).toBe(false);
    expect(can(null, "depots.view")).toBe(false);
  });
});

describe("billing", () => {
  it("per-driver plans use seats as the driver limit; overrides win", () => {
    expect(effectiveLimit(team, sub(), "max_drivers")).toBe(3);
    expect(effectiveLimit(team, sub({ limitOverrides: { max_drivers: 10 } }), "max_drivers")).toBe(10);
    expect(effectiveLimit(team, sub(), "max_depots")).toBe(2);
    expect(effectiveLimit(business, sub(), "max_depots")).toBeNull();
  });
  it("checks limits and subscription state", () => {
    expect(checkLimit(team, sub(), usage({ max_drivers: 2 }), "max_drivers")).toEqual({ allowed: true });
    expect(checkLimit(team, sub(), usage({ max_drivers: 3 }), "max_drivers")).toEqual({ allowed: false, reason: "plan_limit_reached", limit: 3 });
    const now = new Date("2026-10-30T00:00:00Z");
    expect(checkLimit(team, sub({ status: "trialing", trialEndsAt: "2026-10-01T00:00:00.000Z" }), usage(), "max_drivers", 1, now)).toEqual({
      allowed: false,
      reason: "subscription_inactive",
    });
    expect(isSubscriptionUsable({ status: "cancelled", trialEndsAt: null })).toBe(false);
    expect(isSubscriptionUsable({ status: "past_due", trialEndsAt: null })).toBe(true);
  });
  it("refuses downgrades that would exceed limits", () => {
    expect(checkPlanChange(business, team, 5, usage({ max_depots: 3 }))).toEqual({ ok: false, violations: ["max_depots"] });
    expect(checkPlanChange(business, team, 5, usage({ max_depots: 2, max_drivers: 5 }))).toEqual({ ok: true, direction: "downgrade" });
    expect(checkPlanChange(solo, team, 2, usage({ max_drivers: 1 }))).toEqual({ ok: true, direction: "upgrade" });
  });
  it("quotes per-driver and flat prices and computes trial end", () => {
    const priced = { ...team, monthlyAmountCents: 1500, annualAmountCents: 15000 };
    expect(quote(priced, "month", 4)).toBe(6000);
    expect(quote(priced, "year", 4)).toBe(60000);
    expect(quote({ ...solo, monthlyAmountCents: 999 }, "month", 7)).toBe(999);
    expect(trialEnd(team, new Date("2026-10-30T00:00:00Z"))!.toISOString()).toBe("2026-11-13T00:00:00.000Z");
  });
});

describe("synthetic tenants", () => {
  it("scopes every synthetic entity to the pilot tenant", () => {
    const d = createSyntheticDataset();
    const all = [...d.depots, ...d.drivers, ...d.vehicles, ...d.tours, ...d.stops];
    expect(all.every((e) => e.organizationId === "org_jarbou")).toBe(true);
    expect(SYNTHETIC_ORGANIZATIONS.map((o) => o.id)).toContain("org_muster");
  });
});
