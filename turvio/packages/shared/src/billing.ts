import { z } from "zod";

/**
 * Subscription plans and limits. Payments are NOT active: this module only
 * models plans, quotes and limit checks. Stripe Billing will be the system of
 * record for payments once enabled (see docs/BILLING.md). Prices here are
 * development placeholders, not an offer.
 */

export const BillingInterval = z.enum(["month", "year"]);
export type BillingInterval = z.infer<typeof BillingInterval>;

export const SubscriptionStatus = z.enum(["trialing", "active", "past_due", "cancelled", "incomplete"]);
export type SubscriptionStatus = z.infer<typeof SubscriptionStatus>;

export const LimitName = z.enum(["max_drivers", "max_dispatchers", "max_depots", "max_vehicles", "max_stops_per_month"]);
export type LimitName = z.infer<typeof LimitName>;

export const Plan = z.object({
  code: z.string().regex(/^[a-z0-9_]{2,40}$/),
  name: z.string(),
  audience: z.enum(["individual_driver", "company"]),
  pricingModel: z.enum(["flat", "per_driver"]),
  monthlyAmountCents: z.number().int().min(0),
  annualAmountCents: z.number().int().min(0),
  currency: z.string().length(3),
  trialDays: z.number().int().min(0).max(90),
  limits: z.record(LimitName, z.number().int().positive().nullable()),
  features: z.record(z.string(), z.boolean()),
  active: z.boolean(),
});
export type Plan = z.infer<typeof Plan>;

export const Subscription = z.object({
  organizationId: z.string(),
  planCode: z.string(),
  status: SubscriptionStatus,
  interval: BillingInterval,
  seats: z.number().int().min(1),
  trialEndsAt: z.iso.datetime().nullable(),
  currentPeriodEnd: z.iso.datetime(),
  cancelAtPeriodEnd: z.boolean(),
  limitOverrides: z.partialRecord(LimitName, z.number().int().positive()),
});
export type Subscription = z.infer<typeof Subscription>;

export type Usage = Record<LimitName, number>;

// Mirrors the seed in supabase/migrations/*_billing.sql. Prices: TBD (0 = not set).
export const PLAN_CATALOGUE: Plan[] = [
  {
    code: "driver_solo",
    name: "Driver Solo",
    audience: "individual_driver",
    pricingModel: "flat",
    monthlyAmountCents: 0,
    annualAmountCents: 0,
    currency: "EUR",
    trialDays: 14,
    limits: { max_drivers: 1, max_dispatchers: null, max_depots: 1, max_vehicles: 1, max_stops_per_month: 3000 },
    features: { optimization: true, scanning: true, dispatch: false },
    active: true,
  },
  {
    code: "team",
    name: "Team",
    audience: "company",
    pricingModel: "per_driver",
    monthlyAmountCents: 0,
    annualAmountCents: 0,
    currency: "EUR",
    trialDays: 14,
    limits: { max_drivers: null, max_dispatchers: 3, max_depots: 2, max_vehicles: null, max_stops_per_month: null },
    features: { optimization: true, scanning: true, dispatch: true, reports: true },
    active: true,
  },
  {
    code: "business",
    name: "Business",
    audience: "company",
    pricingModel: "per_driver",
    monthlyAmountCents: 0,
    annualAmountCents: 0,
    currency: "EUR",
    trialDays: 14,
    limits: { max_drivers: null, max_dispatchers: null, max_depots: null, max_vehicles: null, max_stops_per_month: null },
    features: { optimization: true, scanning: true, dispatch: true, reports: true, api: true, multi_depot: true },
    active: true,
  },
];

export function findPlan(code: string, catalogue: Plan[] = PLAN_CATALOGUE): Plan | undefined {
  return catalogue.find((p) => p.code === code);
}

/** Effective limit: tenant override > purchased seats (per-driver plans) > plan value. null = unlimited. */
export function effectiveLimit(plan: Plan, sub: Pick<Subscription, "seats" | "limitOverrides">, name: LimitName): number | null {
  const override = sub.limitOverrides[name];
  if (override !== undefined) return override;
  if (name === "max_drivers" && plan.pricingModel === "per_driver") return sub.seats;
  return plan.limits[name] ?? null;
}

export function isSubscriptionUsable(sub: Pick<Subscription, "status" | "trialEndsAt">, now: Date = new Date()): boolean {
  switch (sub.status) {
    case "active":
    case "past_due": // grace period while payment is retried
      return true;
    case "trialing":
      return sub.trialEndsAt === null || new Date(sub.trialEndsAt) > now;
    default:
      return false;
  }
}

export type LimitCheck = { allowed: true } | { allowed: false; reason: "subscription_inactive" | "plan_limit_reached"; limit?: number };

/** Can the tenant add `amount` more of a resource? */
export function checkLimit(
  plan: Plan,
  sub: Subscription,
  usage: Usage,
  name: LimitName,
  amount = 1,
  now: Date = new Date(),
): LimitCheck {
  if (!isSubscriptionUsable(sub, now)) return { allowed: false, reason: "subscription_inactive" };
  const limit = effectiveLimit(plan, sub, name);
  if (limit !== null && usage[name] + amount > limit) return { allowed: false, reason: "plan_limit_reached", limit };
  return { allowed: true };
}

/** Price per billing period in minor units. */
export function quote(plan: Plan, interval: BillingInterval, seats: number): number {
  const unit = interval === "month" ? plan.monthlyAmountCents : plan.annualAmountCents;
  return plan.pricingModel === "per_driver" ? unit * Math.max(1, seats) : unit;
}

export type PlanChangeCheck = { ok: true; direction: "upgrade" | "downgrade" | "same" } | { ok: false; violations: LimitName[] };

/**
 * Validate an upgrade/downgrade. A downgrade is refused while current usage
 * exceeds the target plan's limits (the customer must first deactivate e.g.
 * drivers), so no data becomes inaccessible silently.
 */
export function checkPlanChange(current: Plan, target: Plan, targetSeats: number, usage: Usage, catalogue: Plan[] = PLAN_CATALOGUE): PlanChangeCheck {
  const violations = LimitName.options.filter((name) => {
    const limit = effectiveLimit(target, { seats: targetSeats, limitOverrides: {} }, name);
    return limit !== null && usage[name] > limit;
  });
  if (violations.length) return { ok: false, violations };
  const rank = (p: Plan) => catalogue.findIndex((c) => c.code === p.code);
  const direction = rank(target) > rank(current) ? "upgrade" : rank(target) < rank(current) ? "downgrade" : "same";
  return { ok: true, direction };
}

export function trialEnd(plan: Plan, start: Date = new Date()): Date | null {
  if (plan.trialDays === 0) return null;
  return new Date(start.getTime() + plan.trialDays * 24 * 3600 * 1000);
}
