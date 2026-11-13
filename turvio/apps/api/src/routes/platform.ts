import { PLAN_CATALOGUE, findPlan } from "@turvio/shared";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { parse, problem, type RouteCtx } from "../http";
import { newOpaqueToken } from "../auth/tokens";
import { ApiError } from "../db";
import { checkSystem } from "../system-status";

/**
 * Platform administration (TURVIO operator staff). Platform admins see
 * companies, subscriptions and aggregate counts – never tours, stops,
 * recipients or driver positions (enforced by RLS and security-definer
 * aggregates).
 */
export function registerPlatformRoutes(app: FastifyInstance, { deps, guards }: RouteCtx) {
  const db = deps.db;

  async function requirePlatformAdmin(req: FastifyRequest, reply: FastifyReply) {
    await guards.authenticate(req, reply);
    if (reply.sent) return;
    const ok = await db.asUser(guards.claims(req), async (tx) => (await tx.query<{ ok: boolean }>(`select app.is_platform_admin() as ok`)).rows[0]!.ok);
    if (!ok) return problem(reply, 403, "forbidden", "Platform administrators only");
    guards.requireAal2(req, reply);
  }

  app.get("/v1/platform/overview", { preHandler: requirePlatformAdmin }, async (req) => {
    return db.asUser(guards.claims(req), async (tx) => {
      const orgs = (await tx.query(`select o.*, s.plan_code, s.status as sub_status, s.billing_interval, s.seats, s.trial_ends_at, s.current_period_end, s.cancel_at_period_end, s.limit_overrides
                                       from organizations o left join subscriptions s on s.organization_id = o.id order by o.created_at`)).rows;
      const stats = new Map((await tx.query(`select * from platform_tenant_stats()`)).rows.map((r) => [r.organization_id, r]));
      return {
        organizations: orgs.map((o) => {
          const st = stats.get(o.id) ?? {};
          return {
            id: o.id,
            name: o.name,
            slug: o.slug,
            countryCode: String(o.country_code).trim(),
            status: o.status,
            createdAt: o.created_at,
            subscription: o.plan_code
              ? {
                  planCode: o.plan_code,
                  status: o.sub_status,
                  interval: o.billing_interval,
                  seats: o.seats,
                  trialEndsAt: o.trial_ends_at,
                  currentPeriodEnd: o.current_period_end,
                  cancelAtPeriodEnd: o.cancel_at_period_end,
                  limitOverrides: o.limit_overrides ?? {},
                }
              : null,
            activeDrivers: st.active_drivers ?? 0,
            vehicles: st.vehicles ?? 0,
            depots: st.depots ?? 0,
            members: st.members ?? 0,
            toursLast30d: st.tours_last_30d ?? 0,
          };
        }),
      };
    });
  });

  /** Live status of the platform's services (measured now) plus labelled configuration facts. No tenant data. */
  app.get("/v1/platform/system", { preHandler: requirePlatformAdmin }, async () => {
    return checkSystem(
      { db, optimizerUrl: deps.optimizerUrl, fetchImpl: deps.fetchImpl ?? fetch, routing: deps.routing, geocoder: deps.geocoder },
      deps.systemInfo ?? {
        authProvider: "unknown",
        adminMfaRequired: deps.requireAdminMfa ?? false,
        mailer: deps.mailer ? "outbox" : "none",
        proofStorage: deps.proofStore ? "local" : "none",
        geocoder: deps.geocoder?.name ?? "none",
        addressDataVersion: deps.locationDataVersions?.address ?? null,
        roadDataVersion: deps.locationDataVersions?.road ?? null,
        release: null,
      },
    );
  });

  app.get("/v1/platform/activity", { preHandler: requirePlatformAdmin }, async (req) => {
    return db.asUser(guards.claims(req), async (tx) => {
      const { rows } = await tx.query(
        `select a.id, a.action, a.table_name, a.record_id, a.changed_columns, a.created_at, a.organization_id, o.name as org_name
           from audit_log a left join organizations o on o.id = a.organization_id
          where a.table_name in ('organizations', 'subscriptions', 'memberships', 'invitations')
          order by a.id desc limit 50`,
      );
      return rows.map((r) => ({
        id: r.id,
        action: r.action,
        table: r.table_name,
        changedColumns: r.changed_columns,
        at: r.created_at,
        organizationId: r.organization_id,
        organizationName: r.org_name,
      }));
    });
  });

  /** Onboard a company: organization + trial subscription + owner invitation. */
  app.post("/v1/platform/organizations", { preHandler: requirePlatformAdmin }, async (req, reply) => {
    const b = parse(
      z.object({
        name: z.string().trim().min(2).max(160),
        slug: z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9-]{1,62}$/),
        countryCode: z.string().trim().length(2).default("DE"),
        planCode: z.enum(PLAN_CATALOGUE.map((p) => p.code) as [string, ...string[]]),
        seats: z.number().int().min(1).max(10000).default(1),
        ownerEmail: z.string().trim().toLowerCase().email(),
      }),
      req.body,
      reply,
    );
    if (!b) return;
    const plan = findPlan(b.planCode)!;
    const t = newOpaqueToken();
    const org = await db.asUser(guards.claims(req), async (tx) => {
      const exists = await tx.query(`select 1 from organizations where slug = $1`, [b.slug]);
      if (exists.rowCount) throw new ApiError(409, "duplicate", "This slug is already taken");
      const o = (await tx.query(`insert into organizations (name, slug, country_code, status) values ($1,$2,$3,'trialing') returning id, name`, [b.name, b.slug, b.countryCode.toUpperCase()])).rows[0];
      await tx.query(
        `insert into subscriptions (organization_id, plan_code, status, seats, trial_ends_at, current_period_end)
         values ($1, $2, 'trialing', $3, now() + make_interval(days => $4), now() + make_interval(days => $4))`,
        [o.id, plan.code, b.seats, plan.trialDays],
      );
      await tx.query(`insert into invitations (organization_id, email, role, token_hash) values ($1, $2, 'owner', $3)`, [o.id, b.ownerEmail, t.hash]);
      return o;
    });
    const link = `${deps.urls?.dispatch ?? "http://localhost:3000"}/invite?token=${encodeURIComponent(t.token)}`;
    await deps.mailer?.send({
      to: b.ownerEmail,
      subject: `${org.name} on TURVIO – set up your account`,
      text: `Your company ${org.name} has been set up on TURVIO (${plan.name}, ${plan.trialDays}-day trial).\n\nAccept the invitation to become the owner (valid for 7 days):\n${link}\n`,
    });
    return reply.status(201).send({ id: org.id, name: org.name, ownerInvited: b.ownerEmail });
  });
}
