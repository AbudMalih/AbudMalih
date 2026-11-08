import {
  SYNTHETIC_MEMBERSHIPS,
  SYNTHETIC_ORGANIZATIONS,
  findPlan,
  syntheticSubscriptions,
  type Membership,
  type Organization,
  type Plan,
  type Subscription,
} from "@turvio/shared";
import type { Db } from "./db";

/** Data access needed for authorization decisions. */
export interface TenancyRepository {
  getMembership(userId: string, organizationId: string): Promise<Membership | null>;
  listMemberships(userId: string): Promise<(Membership & { organizationName?: string })[]>;
  getOrganization(organizationId: string, userId?: string): Promise<Organization | null>;
  getSubscription(organizationId: string, userId?: string): Promise<{ subscription: Subscription; plan: Plan } | null>;
}

export class InMemoryTenancyRepository implements TenancyRepository {
  constructor(private readonly data: { organizations: Organization[]; memberships: Membership[]; subscriptions: Subscription[] }) {}
  async getMembership(userId: string, organizationId: string) {
    return this.data.memberships.find((m) => m.userId === userId && m.organizationId === organizationId && m.active) ?? null;
  }
  async listMemberships(userId: string) {
    return this.data.memberships.filter((m) => m.userId === userId && m.active);
  }
  async getOrganization(organizationId: string) {
    return this.data.organizations.find((o) => o.id === organizationId) ?? null;
  }
  async getSubscription(organizationId: string) {
    const subscription = this.data.subscriptions.find((s) => s.organizationId === organizationId);
    const plan = subscription && findPlan(subscription.planCode);
    return subscription && plan ? { subscription, plan } : null;
  }
}

/** Synthetic tenants for unit tests and AUTH_PROVIDER=dev. */
export function syntheticTenancy(now: Date = new Date()): InMemoryTenancyRepository {
  return new InMemoryTenancyRepository({ organizations: SYNTHETIC_ORGANIZATIONS, memberships: SYNTHETIC_MEMBERSHIPS, subscriptions: syntheticSubscriptions(now) });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Reads tenancy data from Postgres AS THE USER (RLS applies): a user can only
 * ever resolve their own memberships and the organizations they belong to.
 */
export class PgTenancyRepository implements TenancyRepository {
  constructor(private readonly db: Db) {}

  async getMembership(userId: string, organizationId: string): Promise<Membership | null> {
    if (!UUID.test(organizationId)) return null;
    return this.db.asUser({ sub: userId }, async (tx) => {
      const { rows } = await tx.query<{ role: Membership["role"]; active: boolean; all_locations: boolean; depot_ids: string[] | null }>(
        `select m.role, m.active, m.all_locations, (select array_agg(md.depot_id) from public.membership_depots md where md.membership_id = m.id) as depot_ids
           from public.memberships m where m.user_id = $1 and m.organization_id = $2 and m.active`,
        [userId, organizationId],
      );
      const r = rows[0];
      return r ? { organizationId, userId, role: r.role, active: r.active, depotIds: r.depot_ids, allLocations: r.all_locations } : null;
    });
  }

  async listMemberships(userId: string) {
    return this.db.asUser({ sub: userId }, async (tx) => {
      const { rows } = await tx.query<{ organization_id: string; name: string; role: Membership["role"]; depot_ids: string[] | null; all_locations: boolean; status: string }>(
        `select m.organization_id, o.name, m.role, o.status, m.all_locations,
                (select array_agg(md.depot_id) from public.membership_depots md where md.membership_id = m.id) as depot_ids
           from public.memberships m join public.organizations o on o.id = m.organization_id
          where m.user_id = $1 and m.active order by o.name`,
        [userId],
      );
      return rows.map((r) => ({ organizationId: r.organization_id, organizationName: r.name, userId, role: r.role, active: true, depotIds: r.depot_ids, allLocations: r.all_locations }));
    });
  }

  async getOrganization(organizationId: string, userId?: string): Promise<Organization | null> {
    if (!userId || !UUID.test(organizationId)) return null;
    return this.db.asUser({ sub: userId }, async (tx) => {
      const { rows } = await tx.query<Record<string, unknown>>(`select * from public.organizations where id = $1`, [organizationId]);
      const r = rows[0];
      if (!r) return null;
      return {
        id: String(r.id),
        name: String(r.name),
        slug: String(r.slug),
        countryCode: String(r.country_code).trim(),
        status: r.status as Organization["status"],
        defaultLocale: r.default_locale as Organization["defaultLocale"],
        locationRetentionDays: Number(r.location_retention_days),
        proofRetentionDays: Number(r.proof_retention_days),
      };
    });
  }

  async getSubscription(organizationId: string, userId?: string) {
    if (!userId) return null;
    return this.db.asUser({ sub: userId }, async (tx) => {
      const { rows } = await tx.query<Record<string, unknown>>(`select * from public.subscription_summary($1)`, [organizationId]);
      const r = rows[0];
      const plan = r && findPlan(String(r.plan_code));
      if (!r || !plan) return null;
      return {
        plan,
        subscription: {
          organizationId,
          planCode: plan.code,
          status: r.status as Subscription["status"],
          interval: r.billing_interval as Subscription["interval"],
          seats: Number(r.seats),
          trialEndsAt: r.trial_ends_at ? (r.trial_ends_at as Date).toISOString() : null,
          currentPeriodEnd: (r.current_period_end as Date).toISOString(),
          cancelAtPeriodEnd: Boolean(r.cancel_at_period_end),
          limitOverrides: (r.limit_overrides ?? {}) as Subscription["limitOverrides"],
        },
      };
    });
  }
}
