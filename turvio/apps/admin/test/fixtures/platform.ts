import {
  SYNTHETIC_ORGANIZATIONS,
  createSyntheticDataset,
  findPlan,
  syntheticSubscriptions,
  type BillingInterval,
  type Organization,
  type Subscription,
} from "@turvio/shared";
import { toRow, type ActivityEvent, type TenantRecord, type TenantRow } from "../../lib/platform";

/**
 * TEST FIXTURE – synthetic demo tenants for unit tests only (the running app shows real API data).
 * All names are invented; no figures here are real customers, prices or revenue.
 */

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

export function tenantRows(now: Date = new Date()): TenantRow[] {
  return platformTenants(now).map((t) => toRow(t, now));
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
