import { effectiveLimit, findPlan, isSubscriptionUsable, type BillingInterval, type Organization, type Plan, type Subscription } from "@turvio/shared";

/**
 * Platform KPI and table model, computed from real API data (mapped in lib/remote.ts). Nothing here is
 * invented: every figure is derived from the companies and subscriptions the API returned.
 */

export interface TenantRecord {
  org: Organization;
  createdAt: string;
  subscription: Subscription;
  activeDrivers: number;
}

export interface TenantRow {
  id: string;
  name: string;
  slug: string;
  countryCode: string;
  orgStatus: Organization["status"];
  subscriptionStatus: Subscription["status"];
  planCode: string;
  planName: string;
  audience: Plan["audience"];
  interval: BillingInterval;
  seats: number;
  activeDrivers: number;
  driverLimit: number | null;
  usable: boolean;
  createdAt: string;
  /** Next renewal (period end) or trial end. */
  renewsAt: string;
  renewalKind: "renewal" | "trial_end" | "ends";
  cancelAtPeriodEnd: boolean;
}

const DAY = 86_400_000;

export function toRow(t: TenantRecord, now: Date = new Date()): TenantRow {
  const plan = findPlan(t.subscription.planCode);
  const s = t.subscription;
  return {
    id: t.org.id,
    name: t.org.name,
    slug: t.org.slug,
    countryCode: t.org.countryCode,
    orgStatus: t.org.status,
    subscriptionStatus: s.status,
    planCode: s.planCode,
    planName: plan?.name ?? s.planCode,
    audience: plan?.audience ?? "company",
    interval: s.interval,
    seats: s.seats,
    activeDrivers: t.activeDrivers,
    driverLimit: plan ? effectiveLimit(plan, s, "max_drivers") : null,
    usable: t.org.status !== "suspended" && t.org.status !== "cancelled" && isSubscriptionUsable(s, now),
    createdAt: t.createdAt,
    renewsAt: s.status === "trialing" && s.trialEndsAt ? s.trialEndsAt : s.currentPeriodEnd,
    renewalKind: s.status === "trialing" ? "trial_end" : s.cancelAtPeriodEnd || s.status === "cancelled" ? "ends" : "renewal",
    cancelAtPeriodEnd: s.cancelAtPeriodEnd,
  };
}

// ---------------------------------------------------------------------------
// KPIs
// ---------------------------------------------------------------------------

/**
 * Monthly recurring revenue in cents, or null when it cannot be computed
 * honestly (any paying subscription on a plan without a configured price).
 */
export function monthlyRecurringRevenueCents(records: TenantRecord[]): number | null {
  let total = 0;
  for (const t of records) {
    if (t.subscription.status !== "active" && t.subscription.status !== "past_due") continue;
    const plan = findPlan(t.subscription.planCode);
    if (!plan) return null;
    const amount = t.subscription.interval === "month" ? plan.monthlyAmountCents : plan.annualAmountCents / 12;
    if (amount === 0) return null; // price not configured
    total += plan.pricingModel === "per_driver" ? amount * t.subscription.seats : amount;
  }
  return Math.round(total);
}

export interface PlatformKpis {
  companies: number;
  activeSubscriptions: number;
  pastDue: number;
  trials: number;
  trialsEndingSoon: number;
  mrrCents: number | null;
  activeDrivers: number;
  newLast30: number;
  newPrev30: number;
  /** Cumulative company count at the end of each of the last 6 months (oldest first). */
  companiesByMonth: number[];
}

/**
 * `createdAt`: creation times of ALL companies (also those without a subscription) – company counts and
 * growth use them; subscription figures use `records`.
 */
export function platformKpis(records: TenantRecord[], now: Date = new Date(), createdAt: string[] = records.map((r) => r.createdAt)): PlatformKpis {
  const rows = records.map((r) => toRow(r, now));
  const age = (d: string) => (now.getTime() - new Date(d).getTime()) / DAY;
  const companiesByMonth = Array.from({ length: 6 }, (_, i) => {
    const cutoff = (5 - i) * 30;
    return createdAt.filter((c) => age(c) >= cutoff).length;
  });
  return {
    companies: createdAt.length,
    activeSubscriptions: records.filter((r) => r.subscription.status === "active").length,
    pastDue: records.filter((r) => r.subscription.status === "past_due").length,
    trials: records.filter((r) => r.subscription.status === "trialing").length,
    trialsEndingSoon: rows.filter((r) => r.subscriptionStatus === "trialing" && (new Date(r.renewsAt).getTime() - now.getTime()) / DAY <= 7).length,
    mrrCents: monthlyRecurringRevenueCents(records),
    activeDrivers: rows.filter((r) => r.usable).reduce((n, r) => n + r.activeDrivers, 0),
    newLast30: createdAt.filter((c) => age(c) < 30).length,
    newPrev30: createdAt.filter((c) => age(c) >= 30 && age(c) < 60).length,
    companiesByMonth,
  };
}

// ---------------------------------------------------------------------------
// Activity feed
// ---------------------------------------------------------------------------

export type ActivityKind = "registration" | "plan_change" | "trial_ending" | "trial_expired" | "invitation" | "payment_failed" | "cancellation";

export interface ActivityEvent {
  id: string;
  kind: ActivityKind;
  at: string;
  orgId: string;
  orgName: string;
  detail: string;
}
