import {
  PLAN_CATALOGUE,
  SYNTHETIC_ORGANIZATIONS,
  createSyntheticDataset,
  effectiveLimit,
  findPlan,
  isSubscriptionUsable,
  syntheticSubscriptions,
  type Organization,
  type Plan,
  type Subscription,
} from "@turvio/shared";

/**
 * DEVELOPMENT DATA SOURCE for the platform admin console. In production this
 * reads organizations/subscriptions through the API as a platform admin
 * (public.platform_admins); operational tenant data (stops, parcels) is
 * intentionally NOT visible here.
 */
export interface TenantRow {
  org: Organization;
  subscription: Subscription | null;
  plan: Plan | null;
  usable: boolean;
  activeDrivers: number;
  driverLimit: number | null;
}

export function listTenants(now: Date = new Date()): TenantRow[] {
  const subs = syntheticSubscriptions(now);
  const ops = createSyntheticDataset(now);
  return SYNTHETIC_ORGANIZATIONS.map((org) => {
    const subscription = subs.find((s) => s.organizationId === org.id) ?? null;
    const plan = subscription ? findPlan(subscription.planCode) ?? null : null;
    return {
      org,
      subscription,
      plan,
      usable: subscription ? isSubscriptionUsable(subscription, now) : false,
      // Aggregate counts only – no personal data in the admin console.
      activeDrivers: ops.drivers.filter((d) => d.organizationId === org.id && d.active).length,
      driverLimit: subscription && plan ? effectiveLimit(plan, subscription, "max_drivers") : null,
    };
  });
}

export const plans = PLAN_CATALOGUE;
