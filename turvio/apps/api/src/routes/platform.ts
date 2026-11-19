import { PLAN_CATALOGUE, findPlan } from "@turvio/shared";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { parse, problem, type RouteCtx } from "../http";
import { newOpaqueToken } from "../auth/tokens";
import { ApiError } from "../db";
import { checkSystem } from "../system-status";
import { invitationMail, mailLocale } from "../mail-templates";
import { AuditQuery, auditEntry, emailsFor } from "./org";

const Uuid = z.string().uuid();
const OrgStatus = z.enum(["trialing", "active", "past_due", "suspended", "cancelled"]);
/** Limits a platform admin may override per company (null = back to the plan's limit). */
const LIMIT_KEYS = ["max_drivers", "max_dispatchers", "max_depots", "max_vehicles", "max_stops_per_month"] as const;
const LimitOverrides = z
  .object(Object.fromEntries(LIMIT_KEYS.map((k) => [k, z.number().int().min(1).max(1_000_000).nullable().optional()])) as Record<(typeof LIMIT_KEYS)[number], z.ZodOptional<z.ZodNullable<z.ZodNumber>>>)
  .strict();

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

  // ---------------------------------------------------------------- company administration

  /** Companies with plan, status and usage – also those without a subscription. Search, filter, paging. */
  app.get("/v1/platform/organizations", { preHandler: requirePlatformAdmin }, async (req, reply) => {
    const q = parse(
      z.object({ q: z.string().trim().max(160).optional(), status: OrgStatus.optional(), limit: z.coerce.number().int().min(1).max(200).default(50), offset: z.coerce.number().int().min(0).default(0) }),
      req.query,
      reply,
    );
    if (!q) return;
    return db.asUser(guards.claims(req), async (tx) => {
      const where = `where ($1::text is null or o.name ilike '%' || $1 || '%' or o.slug ilike '%' || $1 || '%') and ($2::public.org_status is null or o.status = $2)`;
      const total = Number((await tx.query<{ n: string }>(`select count(*) as n from organizations o ${where}`, [q.q || null, q.status ?? null])).rows[0]!.n);
      const rows = (
        await tx.query(
          `select o.id, o.name, o.slug, o.country_code, o.status, o.created_at, s.plan_code, s.status as sub_status, s.seats, s.trial_ends_at
             from organizations o left join subscriptions s on s.organization_id = o.id ${where}
            order by o.created_at desc, o.id limit $3 offset $4`,
          [q.q || null, q.status ?? null, q.limit, q.offset],
        )
      ).rows;
      const stats = new Map((await tx.query(`select * from platform_tenant_stats()`)).rows.map((r) => [r.organization_id, r]));
      return {
        total,
        organizations: rows.map((o) => ({
          id: o.id,
          name: o.name,
          slug: o.slug,
          countryCode: String(o.country_code).trim(),
          status: o.status,
          createdAt: o.created_at,
          subscription: o.plan_code ? { planCode: o.plan_code, status: o.sub_status, seats: o.seats, trialEndsAt: o.trial_ends_at } : null,
          members: stats.get(o.id)?.members ?? 0,
          activeDrivers: stats.get(o.id)?.active_drivers ?? 0,
        })),
      };
    });
  });

  async function organizationDetail(req: FastifyRequest, id: string) {
    return db.asUser(guards.claims(req), async (tx) => {
      const o = (
        await tx.query(
          `select o.*, s.plan_code, s.status as sub_status, s.billing_interval, s.seats, s.trial_ends_at, s.current_period_end, s.cancel_at_period_end, s.limit_overrides
             from organizations o left join subscriptions s on s.organization_id = o.id where o.id = $1`,
          [id],
        )
      ).rows[0];
      if (!o) throw new ApiError(404, "not_found", "Company not found");
      const st = (await tx.query(`select * from platform_tenant_stats() where organization_id = $1`, [id])).rows[0] ?? {};
      const members = (await tx.query(`select id, user_id, role, active, created_at from memberships where organization_id = $1 order by created_at`, [id])).rows;
      const invitations = (
        await tx.query(`select id, email, role, created_at, expires_at from invitations where organization_id = $1 and accepted_at is null and revoked_at is null order by created_at desc`, [id])
      ).rows;
      return { o, st, members, invitations };
    });
  }

  /** One company: plan, limits and usage, members (e-mail, role, state), pending invitations. No operational data. */
  app.get("/v1/platform/organizations/:id", { preHandler: requirePlatformAdmin }, async (req) => {
    const { id } = z.object({ id: Uuid }).parse(req.params);
    const { o, st, members, invitations } = await organizationDetail(req, id);
    const emails = await emailsFor(db, members.map((m) => m.user_id));
    const plan = o.plan_code ? findPlan(o.plan_code) : undefined;
    return {
      id: o.id,
      name: o.name,
      slug: o.slug,
      countryCode: String(o.country_code).trim(),
      defaultLocale: o.default_locale,
      status: o.status,
      createdAt: o.created_at,
      subscription: o.plan_code
        ? {
            planCode: o.plan_code,
            planName: plan?.name ?? o.plan_code,
            status: o.sub_status,
            interval: o.billing_interval,
            seats: o.seats,
            trialEndsAt: o.trial_ends_at,
            currentPeriodEnd: o.current_period_end,
            cancelAtPeriodEnd: o.cancel_at_period_end,
            limitOverrides: o.limit_overrides ?? {},
          }
        : null,
      usage: { members: st.members ?? 0, activeDrivers: st.active_drivers ?? 0, vehicles: st.vehicles ?? 0, depots: st.depots ?? 0, toursLast30d: st.tours_last_30d ?? 0 },
      members: members.map((m) => ({ membershipId: m.id, userId: m.user_id, email: emails.get(m.user_id) ?? null, role: m.role, active: m.active, since: m.created_at })),
      invitations: invitations.map((i) => ({ id: i.id, email: i.email, role: i.role, createdAt: i.created_at, expiresAt: i.expires_at })),
    };
  });

  /** Suspend / reactivate, change plan, seats, limit overrides, trial end. Every change lands in the audit log (triggers). */
  app.patch("/v1/platform/organizations/:id", { preHandler: requirePlatformAdmin }, async (req, reply) => {
    const { id } = z.object({ id: Uuid }).parse(req.params);
    const b = parse(
      z
        .object({
          status: OrgStatus.optional(),
          planCode: z.enum(PLAN_CATALOGUE.map((p) => p.code) as [string, ...string[]]).optional(),
          seats: z.number().int().min(1).max(10000).optional(),
          limitOverrides: LimitOverrides.optional(),
          trialEndsAt: z.iso.datetime().nullable().optional(),
        })
        .refine((x) => Object.keys(x).length > 0, "Nothing to change"),
      req.body,
      reply,
    );
    if (!b) return;
    await db.asUser(guards.claims(req), async (tx) => {
      const cur = (await tx.query<{ id: string; plan_code: string | null; limit_overrides: Record<string, number> | null }>(
        `select o.id, s.plan_code, s.limit_overrides from organizations o left join subscriptions s on s.organization_id = o.id where o.id = $1 for update of o`,
        [id],
      )).rows[0];
      if (!cur) throw new ApiError(404, "not_found", "Company not found");
      if (b.status) await tx.query(`update organizations set status = $2 where id = $1`, [id, b.status]);
      const subChange = b.planCode !== undefined || b.seats !== undefined || b.limitOverrides !== undefined || b.trialEndsAt !== undefined;
      if (!subChange) return;
      let overrides: Record<string, number> | undefined;
      if (b.limitOverrides) {
        overrides = { ...(cur.limit_overrides ?? {}) };
        for (const [k, v] of Object.entries(b.limitOverrides)) {
          if (v === null) delete overrides[k];
          else if (v !== undefined) overrides[k] = v;
        }
      }
      if (!cur.plan_code) {
        if (!b.planCode) throw new ApiError(422, "plan_required", "This company has no subscription yet – choose a plan");
        await tx.query(
          `insert into subscriptions (organization_id, plan_code, status, seats, limit_overrides, trial_ends_at) values ($1, $2, 'active', $3, $4, $5)`,
          [id, b.planCode, b.seats ?? 1, JSON.stringify(overrides ?? {}), b.trialEndsAt ?? null],
        );
        return;
      }
      await tx.query(
        `update subscriptions set plan_code = coalesce($2, plan_code), seats = coalesce($3, seats),
                limit_overrides = coalesce($4::jsonb, limit_overrides),
                trial_ends_at = case when $5::boolean then $6::timestamptz else trial_ends_at end
          where organization_id = $1`,
        [id, b.planCode ?? null, b.seats ?? null, overrides ? JSON.stringify(overrides) : null, b.trialEndsAt !== undefined, b.trialEndsAt ?? null],
      );
    });
    return reply.status(204).send();
  });

  /** Renew a pending invitation of a company (e.g. the owner never accepted): new link, 7 more days. */
  app.post("/v1/platform/organizations/:id/invitations/:invitationId/resend", { preHandler: requirePlatformAdmin }, async (req) => {
    const { id, invitationId } = z.object({ id: Uuid, invitationId: Uuid }).parse(req.params);
    const t = newOpaqueToken();
    const inv = await db.asUser(guards.claims(req), async (tx) => {
      const row = (
        await tx.query<{ email: string; role: string; expires_at: Date }>(
          `update invitations set token_hash = $3, expires_at = now() + interval '7 days'
            where id = $2 and organization_id = $1 and accepted_at is null and revoked_at is null returning email, role, expires_at`,
          [id, invitationId, t.hash],
        )
      ).rows[0];
      if (!row) throw new ApiError(404, "not_found", "Invitation not found");
      const org = (await tx.query<{ name: string; default_locale: string }>(`select name, default_locale from organizations where id = $1`, [id])).rows[0]!;
      return { ...row, orgName: org.name, locale: org.default_locale };
    });
    const link = `${deps.urls?.dispatch ?? "http://localhost:3000"}/invite?token=${encodeURIComponent(t.token)}`;
    await deps.mailer?.send({ to: inv.email, ...invitationMail({ locale: mailLocale(inv.locale), orgName: inv.orgName, role: inv.role, link, reminder: true }) });
    return { id: invitationId, email: inv.email, role: inv.role, expiresAt: inv.expires_at, emailSent: !!deps.mailer };
  });

  /** Audit log across companies: who changed what (no record contents), filters and paging by id. */
  app.get("/v1/platform/audit", { preHandler: requirePlatformAdmin }, async (req, reply) => {
    const q = parse(AuditQuery.extend({ organizationId: Uuid.optional() }), req.query, reply);
    if (!q) return;
    const rows = await db.asUser(guards.claims(req), async (tx) =>
      (
        await tx.query(
          `select a.id, a.action, a.table_name, a.record_id, a.changed_columns, a.created_at, a.actor_user_id, a.organization_id, o.name as org_name
             from audit_log a left join organizations o on o.id = a.organization_id
            where ($1::bigint is null or a.id < $1) and ($2::text is null or a.table_name = $2) and ($3::uuid is null or a.organization_id = $3)
            order by a.id desc limit $4`,
          [q.before ?? null, q.table ?? null, q.organizationId ?? null, q.limit + 1],
        )
      ).rows,
    );
    const page = rows.slice(0, q.limit);
    const emails = await emailsFor(db, page.map((r) => r.actor_user_id));
    return { entries: page.map((r) => auditEntry(r, emails)), nextBefore: rows.length > q.limit ? Number(page[page.length - 1]!.id) : null };
  });

  // ---------------------------------------------------------------- platform administrators

  app.get("/v1/platform/admins", { preHandler: requirePlatformAdmin }, async (req) => {
    const rows = await db.asUser(guards.claims(req), async (tx) => (await tx.query<{ user_id: string; created_at: Date }>(`select user_id, created_at from platform_admins order by created_at`)).rows);
    const emails = await emailsFor(db, rows.map((r) => r.user_id));
    return { admins: rows.map((r) => ({ userId: r.user_id, email: emails.get(r.user_id) ?? null, since: r.created_at, you: r.user_id === req.user!.userId })) };
  });

  app.post("/v1/platform/admins", { preHandler: requirePlatformAdmin }, async (req, reply) => {
    const b = parse(z.object({ email: z.string().trim().toLowerCase().email().max(254) }), req.body, reply);
    if (!b) return;
    const userId = await db.asUser(guards.claims(req), async (tx) => (await tx.query<{ id: string }>(`select platform_add_admin($1) as id`, [b.email])).rows[0]!.id);
    return reply.status(201).send({ userId, email: b.email });
  });

  app.delete("/v1/platform/admins/:userId", { preHandler: requirePlatformAdmin }, async (req, reply) => {
    const { userId } = z.object({ userId: Uuid }).parse(req.params);
    await db.asUser(guards.claims(req), (tx) => tx.query(`select platform_remove_admin($1)`, [userId]));
    return reply.status(204).send();
  });
}
