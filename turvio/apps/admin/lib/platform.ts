import {
  SYNTHETIC_ORGANIZATIONS,
  createSyntheticDataset,
  effectiveLimit,
  findPlan,
  isSubscriptionUsable,
  syntheticSubscriptions,
  type BillingInterval,
  type Organization,
  type Plan,
  type Subscription,
} from "@turvio/shared";

/**
 * Platform KPI/table model. The demo tenant generator below is a TEST FIXTURE
 * (used by unit tests); the running app maps real API data (lib/remote.ts).
 *
 * SYNTHETIC DEMO DATA for the platform admin console.
 *
 * Until the Admin app reads from Supabase (as a platform admin), it shows the
 * two synthetic tenants used across TURVIO plus additional fictional
 * companies so that search, filters and pagination can be exercised. All
 * names are invented; no figures here are real customers, prices or revenue.
 * Every derived number (KPIs, trends, activity) is computed from these
 * records – nothing is hard-coded for display.
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
const iso = (now: Date, days: number) => new Date(now.getTime() + days * DAY).toISOString();

type Seed = [
  id: string,
  name: string,
  country: string,
  createdDaysAgo: number,
  plan: string,
  status: Subscription["status"],
  interval: BillingInterval,
  seats: number,
  drivers: number,
  periodEndInDays: number,
  extra?: { orgStatus?: Organization["status"]; cancelAtPeriodEnd?: boolean },
];

// Fictional companies (synthetic). Days are relative to "now".
const DEMO_TENANTS: Seed[] = [
  ["org_elbe", "Elbe Express Logistik GmbH", "DE", 172, "business", "active", "year", 24, 21, 193],
  ["org_rheinland", "Rheinland Paketdienst GmbH", "DE", 141, "team", "active", "month", 8, 8, 19],
  ["org_nordsee", "Nordsee Cargo GmbH", "DE", 118, "team", "past_due", "month", 6, 5, -3],
  ["org_bavaria", "Bavaria City Kurier GmbH", "DE", 96, "business", "active", "month", 15, 12, 4],
  ["org_transcarpatia", "Transcarpatia Curierat SRL", "RO", 77, "team", "active", "year", 5, 4, 288],
  ["org_alpen", "Alpen Last-Mile GmbH", "AT", 61, "team", "cancelled", "month", 4, 0, -12, { orgStatus: "cancelled" }],
  ["org_hanse", "Hansefracht GmbH", "DE", 44, "business", "active", "month", 30, 27, 16, { cancelAtPeriodEnd: true }],
  ["org_saxonia", "Saxonia Zustellservice UG", "DE", 33, "team", "trialing", "month", 3, 2, 3],
  ["org_spree", "Spree Delivery GmbH", "DE", 21, "team", "trialing", "month", 4, 3, 9],
  ["org_desert", "Desert Route Logistics LLC", "AE", 12, "business", "trialing", "year", 10, 6, 2],
  ["org_weser", "Weser Bote KG", "DE", 6, "team", "trialing", "month", 2, 1, 8],
  ["org_solo_nowak", "T. Nowak Kurier (Solo)", "DE", 4, "driver_solo", "trialing", "month", 1, 1, 10],
  ["org_mainkinzig", "Main-Kinzig Kurierdienst GmbH", "DE", 52, "team", "active", "month", 3, 3, 23, { orgStatus: "suspended" }],
];

export function platformTenants(now: Date = new Date()): TenantRecord[] {
  const ops = createSyntheticDataset(now);
  const subs = syntheticSubscriptions(now);
  const base: TenantRecord[] = SYNTHETIC_ORGANIZATIONS.map((org, i) => ({
    org,
    createdAt: iso(now, i === 0 ? -210 : -20),
    subscription: subs.find((s) => s.organizationId === org.id)!,
    activeDrivers: ops.drivers.filter((d) => d.organizationId === org.id && d.active).length,
  }));
  const demo: TenantRecord[] = DEMO_TENANTS.map(([id, name, country, created, plan, status, interval, seats, drivers, periodEnd, extra]) => ({
    org: {
      id,
      name,
      slug: id.replace(/^org_/, "").replace(/_/g, "-"),
      countryCode: country,
      status: extra?.orgStatus ?? (status === "past_due" ? "past_due" : status === "trialing" ? "trialing" : status === "cancelled" ? "cancelled" : "active"),
      defaultLocale: country === "RO" ? "ro" : country === "AE" ? "ar" : "de",
      locationRetentionDays: 30,
      proofRetentionDays: 90,
    },
    createdAt: iso(now, -created),
    activeDrivers: drivers,
    subscription: {
      organizationId: id,
      planCode: plan,
      status,
      interval,
      seats,
      trialEndsAt: status === "trialing" ? iso(now, periodEnd) : null,
      currentPeriodEnd: iso(now, periodEnd),
      cancelAtPeriodEnd: extra?.cancelAtPeriodEnd ?? false,
      limitOverrides: {},
    },
  }));
  return [...base, ...demo];
}

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

export function tenantRows(now: Date = new Date()): TenantRow[] {
  return platformTenants(now).map((t) => toRow(t, now));
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

export function platformKpis(records: TenantRecord[], now: Date = new Date()): PlatformKpis {
  const rows = records.map((r) => toRow(r, now));
  const age = (d: string) => (now.getTime() - new Date(d).getTime()) / DAY;
  const companiesByMonth = Array.from({ length: 6 }, (_, i) => {
    const cutoff = (5 - i) * 30;
    return records.filter((r) => age(r.createdAt) >= cutoff).length;
  });
  return {
    companies: records.length,
    activeSubscriptions: records.filter((r) => r.subscription.status === "active").length,
    pastDue: records.filter((r) => r.subscription.status === "past_due").length,
    trials: records.filter((r) => r.subscription.status === "trialing").length,
    trialsEndingSoon: rows.filter((r) => r.subscriptionStatus === "trialing" && (new Date(r.renewsAt).getTime() - now.getTime()) / DAY <= 7).length,
    mrrCents: monthlyRecurringRevenueCents(records),
    activeDrivers: rows.filter((r) => r.usable).reduce((n, r) => n + r.activeDrivers, 0),
    newLast30: records.filter((r) => age(r.createdAt) < 30).length,
    newPrev30: records.filter((r) => age(r.createdAt) >= 30 && age(r.createdAt) < 60).length,
    companiesByMonth,
  };
}

// ---------------------------------------------------------------------------
// Activity feed (derived from the records above + a few demo change events)
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

const DEMO_CHANGES: { orgId: string; kind: "plan_change" | "invitation"; daysAgo: number; detail: string }[] = [
  { orgId: "org_bavaria", kind: "plan_change", daysAgo: 2, detail: "Upgraded Team → Business" },
  { orgId: "org_hanse", kind: "plan_change", daysAgo: 5, detail: "Seats 26 → 30" },
  { orgId: "org_spree", kind: "invitation", daysAgo: 1, detail: "Invited 2 drivers" },
  { orgId: "org_desert", kind: "invitation", daysAgo: 3, detail: "Invited a dispatcher" },
];

export function activityFeed(records: TenantRecord[], now: Date = new Date(), limit = 8): ActivityEvent[] {
  const byId = new Map(records.map((r) => [r.org.id, r]));
  const events: ActivityEvent[] = [];
  for (const r of records) {
    const since = (now.getTime() - new Date(r.createdAt).getTime()) / DAY;
    if (since <= 45) {
      events.push({ id: `reg-${r.org.id}`, kind: "registration", at: r.createdAt, orgId: r.org.id, orgName: r.org.name, detail: `Started ${findPlan(r.subscription.planCode)?.name ?? ""} trial` });
    }
    const s = r.subscription;
    if (s.status === "trialing" && s.trialEndsAt) {
      const left = (new Date(s.trialEndsAt).getTime() - now.getTime()) / DAY;
      if (left <= 7) {
        events.push({ id: `trial-${r.org.id}`, kind: left < 0 ? "trial_expired" : "trial_ending", at: now.toISOString(), orgId: r.org.id, orgName: r.org.name, detail: left < 0 ? "Trial expired" : `Trial ends in ${Math.max(1, Math.ceil(left))} days` });
      }
    }
    if (s.status === "past_due") {
      events.push({ id: `due-${r.org.id}`, kind: "payment_failed", at: new Date(s.currentPeriodEnd).toISOString(), orgId: r.org.id, orgName: r.org.name, detail: "Subscription past due" });
    }
    if (s.status === "cancelled" || s.cancelAtPeriodEnd) {
      events.push({ id: `cancel-${r.org.id}`, kind: "cancellation", at: iso(now, -1), orgId: r.org.id, orgName: r.org.name, detail: s.cancelAtPeriodEnd ? "Cancels at period end" : "Subscription cancelled" });
    }
  }
  for (const c of DEMO_CHANGES) {
    const r = byId.get(c.orgId);
    if (r) events.push({ id: `${c.kind}-${c.orgId}-${c.daysAgo}`, kind: c.kind, at: iso(now, -c.daysAgo), orgId: c.orgId, orgName: r.org.name, detail: c.detail });
  }
  return events.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}

export function formatRelative(at: string, now: Date = new Date()): string {
  const diff = now.getTime() - new Date(at).getTime();
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (abs < 3600_000) return "just now";
  if (abs < DAY) return rtf.format(-Math.round(diff / 3600_000), "hour");
  return rtf.format(-Math.round(diff / DAY), "day");
}
