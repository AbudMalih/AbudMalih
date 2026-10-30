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

/**
 * Data access needed for authorization. The production implementation reads
 * from Supabase (PostgREST) with the service-role key; the in-memory one serves
 * tests and local development with synthetic tenants.
 */
export interface TenancyRepository {
  getMembership(userId: string, organizationId: string): Promise<Membership | null>;
  listMemberships(userId: string): Promise<Membership[]>;
  getOrganization(organizationId: string): Promise<Organization | null>;
  getSubscription(organizationId: string): Promise<{ subscription: Subscription; plan: Plan } | null>;
}

export class InMemoryTenancyRepository implements TenancyRepository {
  constructor(
    private readonly data: {
      organizations: Organization[];
      memberships: Membership[];
      subscriptions: Subscription[];
    },
  ) {}

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

export function syntheticTenancy(now: Date = new Date()): InMemoryTenancyRepository {
  return new InMemoryTenancyRepository({
    organizations: SYNTHETIC_ORGANIZATIONS,
    memberships: SYNTHETIC_MEMBERSHIPS,
    subscriptions: syntheticSubscriptions(now),
  });
}

/** Reads tenancy data from Supabase's REST API using the service-role key (server-side only). */
export class SupabaseTenancyRepository implements TenancyRepository {
  constructor(
    private readonly url: string,
    private readonly serviceKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private async get<T>(path: string): Promise<T[]> {
    const res = await this.fetchImpl(`${this.url.replace(/\/$/, "")}/rest/v1/${path}`, {
      headers: { apikey: this.serviceKey, Authorization: `Bearer ${this.serviceKey}` },
    });
    if (!res.ok) throw new Error(`Supabase query failed: HTTP ${res.status}`);
    return (await res.json()) as T[];
  }

  async getMembership(userId: string, organizationId: string) {
    const rows = await this.get<{ organization_id: string; user_id: string; role: Membership["role"]; active: boolean }>(
      `memberships?select=organization_id,user_id,role,active&user_id=eq.${encodeURIComponent(userId)}&organization_id=eq.${encodeURIComponent(organizationId)}&active=is.true`,
    );
    const r = rows[0];
    return r ? { organizationId: r.organization_id, userId: r.user_id, role: r.role, active: r.active } : null;
  }

  async listMemberships(userId: string) {
    const rows = await this.get<{ organization_id: string; user_id: string; role: Membership["role"]; active: boolean }>(
      `memberships?select=organization_id,user_id,role,active&user_id=eq.${encodeURIComponent(userId)}&active=is.true`,
    );
    return rows.map((r) => ({ organizationId: r.organization_id, userId: r.user_id, role: r.role, active: r.active }));
  }

  async getOrganization(organizationId: string) {
    const rows = await this.get<Record<string, unknown>>(`organizations?id=eq.${encodeURIComponent(organizationId)}`);
    const r = rows[0];
    if (!r) return null;
    return {
      id: String(r.id),
      name: String(r.name),
      slug: String(r.slug),
      countryCode: String(r.country_code),
      status: r.status as Organization["status"],
      defaultLocale: r.default_locale as Organization["defaultLocale"],
      locationRetentionDays: Number(r.location_retention_days),
      proofRetentionDays: Number(r.proof_retention_days),
    };
  }

  async getSubscription(organizationId: string) {
    const rows = await this.get<Record<string, unknown>>(`subscriptions?organization_id=eq.${encodeURIComponent(organizationId)}`);
    const r = rows[0];
    if (!r) return null;
    // TODO(billing): read limits from public.plans instead of the bundled catalogue
    // once plans are edited in the Admin app.
    const plan = findPlan(String(r.plan_code));
    if (!plan) return null;
    return {
      plan,
      subscription: {
        organizationId,
        planCode: plan.code,
        status: r.status as Subscription["status"],
        interval: r.billing_interval as Subscription["interval"],
        seats: Number(r.seats),
        trialEndsAt: r.trial_ends_at ? new Date(String(r.trial_ends_at)).toISOString() : null,
        currentPeriodEnd: new Date(String(r.current_period_end)).toISOString(),
        cancelAtPeriodEnd: Boolean(r.cancel_at_period_end),
        limitOverrides: (r.limit_overrides ?? {}) as Subscription["limitOverrides"],
      },
    };
  }
}
