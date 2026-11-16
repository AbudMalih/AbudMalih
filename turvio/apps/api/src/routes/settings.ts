import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { ROLE_PERMISSIONS, can } from "@turvio/shared";
import { OrgParams, parse, problem, type RouteCtx } from "../http";
import { ApiError } from "../db";
import { driverSettingsOf } from "./execution";

/*
 * Settings (Phase B).
 * - Personal preferences (/v1/me/preferences): every user, own row only (RLS).
 * - Company settings overview (/v1/orgs/:orgId/settings): staff read it; each section says whether
 *   the caller may change it. Company profile and tracking changes are company-admin only
 *   (org.settings.manage, which also requires the second factor – ADMIN_MFA_PERMISSIONS).
 * - Live tracking administration: per-driver status (who is tracked, and why not) and bulk pilot
 *   switching. Reuses tracking_mode / tracking_pilot / notice acknowledgements – no second system.
 */

const Uuid = z.string().uuid();

/** Pilot mode is for a few named people – same cap as PATCH /tracking (pilotDriverIds max 20). */
export const PILOT_MAX = 20;

const OrgDefaults = z.object({
  defaultDepotId: Uuid.nullable().optional(),
  toursView: z.enum(["day", "all", "archived"]).optional(),
});

const Preferences = z.object({
  language: z.enum(["en", "de", "ar", "ro"]).nullable().optional(),
  theme: z.enum(["system", "dark", "light"]).optional(),
  dateFormat: z.enum(["dmy", "ymd", "mdy"]).optional(),
  /** Per company (key: organization id). Only companies the user belongs to. */
  orgDefaults: z.record(Uuid, OrgDefaults).optional(),
});

const CompanyProfile = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  contactEmail: z.string().trim().email().max(254).nullable().optional(),
  contactPhone: z.string().trim().max(40).regex(/^[0-9 +()/-]*$/).nullable().optional(),
  addressStreet: z.string().trim().max(200).nullable().optional(),
  addressPostalCode: z.string().trim().max(12).nullable().optional(),
  addressCity: z.string().trim().max(100).nullable().optional(),
  addressCountry: z.string().trim().regex(/^[A-Z]{2}$/).optional(),
  website: z.string().trim().max(200).regex(/^https:\/\//).nullable().optional(),
});

/** Live tracking state of one driver, in the order the reasons apply. */
export type DriverTrackingState =
  | "disabled" // company mode off
  | "pilot_not_enabled" // pilot mode, this driver is not a pilot
  | "no_app_login" // the driver profile has no app account – nothing can be tracked
  | "awaiting_acknowledgement" // the current notice version is not acknowledged
  | "no_active_tour" // nothing running today
  | "tour_paused" // the tour is paused: no positions are recorded while paused
  | "no_recent_position" // running, but the last position is missing or too old
  | "live";

interface DriverRow {
  id: string;
  display_name: string;
  depot_id: string | null;
  depot_name: string | null;
  active: boolean;
  has_login: boolean;
  tracking_pilot: boolean;
  ack_version: number | null;
  ack_at: Date | null;
  tour_id: string | null;
  tour_name: string | null;
  tour_status: string | null;
  position_at: Date | null;
  position_age: number | null;
}

export function trackingState(
  o: { mode: string; noticeVersion: number; staleSeconds: number },
  d: Pick<DriverRow, "tracking_pilot" | "has_login" | "ack_version" | "tour_id" | "tour_status" | "position_age">,
): DriverTrackingState {
  if (o.mode === "off") return "disabled";
  if (o.mode === "pilot" && !d.tracking_pilot) return "pilot_not_enabled";
  if (!d.has_login) return "no_app_login";
  if (d.ack_version !== o.noticeVersion) return "awaiting_acknowledgement";
  if (!d.tour_id) return "no_active_tour";
  if (d.tour_status === "paused") return "tour_paused";
  if (d.position_age === null || d.position_age > o.staleSeconds) return "no_recent_position";
  return "live";
}

export function registerSettingsRoutes(app: FastifyInstance, { deps, guards }: RouteCtx) {
  const db = deps.db;
  const claims = (req: FastifyRequest) => guards.claims(req);

  // ---------------------------------------------------------------- personal preferences
  app.get("/v1/me/preferences", { preHandler: guards.authenticate }, async (req) => {
    const row = await db.asUser(claims(req), async (tx) =>
      (await tx.query<{ language: string | null; theme: string; date_format: string; org_defaults: Record<string, unknown>; updated_at: Date }>(
        `select language, theme, date_format, org_defaults, updated_at from user_preferences where user_id = auth.uid()`,
      )).rows[0],
    );
    return {
      language: row?.language ?? null,
      theme: row?.theme ?? "system",
      dateFormat: row?.date_format ?? "dmy",
      orgDefaults: row?.org_defaults ?? {},
      updatedAt: row?.updated_at?.toISOString() ?? null,
    };
  });

  app.put("/v1/me/preferences", { preHandler: guards.authenticate }, async (req, reply) => {
    const b = parse(Preferences, req.body, reply);
    if (!b) return;
    return db.asUser(claims(req), async (tx) => {
      const cur = (await tx.query<{ org_defaults: Record<string, z.infer<typeof OrgDefaults>> }>(`select org_defaults from user_preferences where user_id = auth.uid()`)).rows[0];
      const orgDefaults = { ...(cur?.org_defaults ?? {}) };
      for (const [orgId, d] of Object.entries(b.orgDefaults ?? {})) {
        // Only companies the user belongs to, and a location they may work in.
        const member = (await tx.query(`select 1 from memberships where organization_id = $1 and user_id = auth.uid() and active`, [orgId])).rowCount;
        if (!member) throw new ApiError(422, "invalid_reference", "Not a member of that company");
        if (d.defaultDepotId) {
          const ok = (await tx.query(`select 1 from depots where id = $1 and organization_id = $2 and app.can_access_depot(organization_id, id)`, [d.defaultDepotId, orgId])).rowCount;
          if (!ok) throw new ApiError(422, "invalid_reference", "Location not found");
        }
        orgDefaults[orgId] = { ...(orgDefaults[orgId] ?? {}), ...d };
      }
      const row = (
        await tx.query<{ language: string | null; theme: string; date_format: string; org_defaults: Record<string, unknown>; updated_at: Date }>(
          `insert into user_preferences (user_id, language, theme, date_format, org_defaults)
           values (auth.uid(), $1, coalesce($2, 'system'), coalesce($3, 'dmy'), $4::jsonb)
           on conflict (user_id) do update set
             language = case when $5 then excluded.language else user_preferences.language end,
             theme = coalesce($2, user_preferences.theme),
             date_format = coalesce($3, user_preferences.date_format),
             org_defaults = excluded.org_defaults
           returning language, theme, date_format, org_defaults, updated_at`,
          [b.language ?? null, b.theme ?? null, b.dateFormat ?? null, JSON.stringify(orgDefaults), b.language !== undefined],
        )
      ).rows[0]!;
      return { language: row.language, theme: row.theme, dateFormat: row.date_format, orgDefaults: row.org_defaults, updatedAt: row.updated_at.toISOString() };
    });
  });

  // ---------------------------------------------------------------- company settings overview
  app.get("/v1/orgs/:orgId/settings", { preHandler: guards.requireTenant("settings.view_company") }, async (req) => {
    const { orgId } = OrgParams.parse(req.params);
    const role = req.membership!.role;
    const data = await db.asUser(claims(req), async (tx) => {
      const o = (
        await tx.query<{
          id: string; name: string; slug: string; time_zone: string; contact_email: string | null; contact_phone: string | null;
          address_street: string | null; address_postal_code: string | null; address_city: string | null; address_country: string; website: string | null;
          tracking_mode: string; tracking_interval_seconds: number; tracking_notice_version: number; location_retention_days: number; tracking_enabled_at: Date | null;
          proof_retention_days: number;
        }>(`select * from organizations where id = $1`, [orgId])
      ).rows[0];
      if (!o) throw new ApiError(404, "not_found", "Organization not found");
      const counts = (
        await tx.query<{ drivers: number; pilots: number; acknowledged: number }>(
          `select count(*)::int as drivers,
                  count(*) filter (where d.tracking_pilot)::int as pilots,
                  count(*) filter (where exists (select 1 from tracking_notice_acks a where a.organization_id = d.organization_id and a.driver_id = d.id and a.notice_version = $2))::int as acknowledged
             from drivers d where d.organization_id = $1 and d.active`,
          [orgId, o.tracking_notice_version],
        )
      ).rows[0]!;
      return { o, counts, driverRules: await driverSettingsOf(tx, orgId) };
    });
    const sub = can(role, "org.billing.view") ? await deps.tenancy.getSubscription(orgId, req.user!.userId) : null;
    const admin = can(role, "org.settings.manage");
    return {
      company: {
        id: data.o.id,
        name: data.o.name,
        slug: data.o.slug,
        timeZone: data.o.time_zone,
        contactEmail: data.o.contact_email,
        contactPhone: data.o.contact_phone,
        address: { street: data.o.address_street, postalCode: data.o.address_postal_code, city: data.o.address_city, country: data.o.address_country },
        website: data.o.website,
      },
      tracking: {
        mode: data.o.tracking_mode,
        intervalSeconds: data.o.tracking_interval_seconds,
        noticeVersion: data.o.tracking_notice_version,
        retentionDays: data.o.location_retention_days,
        enabledAt: data.o.tracking_enabled_at?.toISOString() ?? null,
        activeDrivers: data.counts.drivers,
        pilots: data.counts.pilots,
        pilotLimit: PILOT_MAX,
        acknowledgedCurrentNotice: data.counts.acknowledged,
      },
      proofRetentionDays: data.o.proof_retention_days,
      driverRules: data.driverRules,
      subscription: sub ? { plan: sub.plan.name, planCode: sub.plan.code, status: sub.subscription.status } : null,
      yourRole: role,
      // What the caller may change; the API enforces the same rules on every write.
      canEdit: {
        company: admin,
        tracking: admin,
        driverRules: admin,
        team: can(role, "org.members.manage"),
        locations: can(role, "depots.manage"),
      },
      roles: Object.fromEntries(Object.entries(ROLE_PERMISSIONS).map(([r, perms]) => [r, [...perms].sort()])),
    };
  });

  app.patch("/v1/orgs/:orgId/settings/company", { preHandler: guards.requireTenant("org.settings.manage") }, async (req, reply) => {
    const { orgId } = OrgParams.parse(req.params);
    const b = parse(CompanyProfile, req.body, reply);
    if (!b) return;
    const set: [string, unknown][] = [];
    const map: Record<keyof z.infer<typeof CompanyProfile>, string> = {
      name: "name",
      contactEmail: "contact_email",
      contactPhone: "contact_phone",
      addressStreet: "address_street",
      addressPostalCode: "address_postal_code",
      addressCity: "address_city",
      addressCountry: "address_country",
      website: "website",
    };
    for (const [k, col] of Object.entries(map) as [keyof typeof map, string][]) if (b[k] !== undefined) set.push([col, b[k] === "" ? null : b[k]]);
    if (!set.length) return problem(reply, 400, "validation_failed", "Nothing to change");
    const n = await db.asUser(claims(req), async (tx) =>
      (await tx.query(`update organizations set ${set.map(([c], i) => `${c} = $${i + 2}`).join(", ")} where id = $1`, [orgId, ...set.map(([, v]) => v)])).rowCount,
    );
    if (!n) return problem(reply, 404, "not_found", "Organization not found");
    return reply.status(204).send();
  });

  // ---------------------------------------------------------------- live tracking administration
  /** Every active driver with the reason they are (not) tracked right now. Never coordinates. */
  app.get("/v1/orgs/:orgId/tracking/drivers", { preHandler: guards.requireTenant("tracking.view_live") }, async (req) => {
    const { orgId } = OrgParams.parse(req.params);
    const { o, rows } = await db.asUser(claims(req), async (tx) => {
      const o = (await tx.query<{ tracking_mode: string; tracking_interval_seconds: number; tracking_notice_version: number }>(
        `select tracking_mode, tracking_interval_seconds, tracking_notice_version from organizations where id = $1`, [orgId])).rows[0];
      if (!o) throw new ApiError(404, "not_found", "Organization not found");
      const rows = (
        await tx.query<DriverRow>(
          `select d.id, d.display_name, d.depot_id, dp.name as depot_name, d.active, d.user_id is not null as has_login, d.tracking_pilot,
                  a.notice_version as ack_version, a.acknowledged_at as ack_at,
                  t.id as tour_id, t.name as tour_name, t.status::text as tour_status,
                  pos.recorded_at as position_at, extract(epoch from now() - pos.recorded_at)::int as position_age
             from drivers d
             left join depots dp on dp.id = d.depot_id
             left join lateral (select x.notice_version, x.acknowledged_at from tracking_notice_acks x
                                 where x.organization_id = d.organization_id and x.driver_id = d.id order by x.notice_version desc limit 1) a on true
             left join lateral (select t.id, t.name, t.status from tours t
                                 where t.driver_id = d.id and t.status in ('in_progress', 'paused') and t.archived_at is null
                                 order by t.started_at desc nulls last limit 1) t on true
             left join driver_positions pos on pos.organization_id = d.organization_id and pos.driver_id = d.id and pos.tour_id = t.id
            where d.organization_id = $1 and d.active
            order by d.display_name`,
          [orgId],
        )
      ).rows;
      return { o, rows };
    });
    // A position counts as current for three intervals (at least two minutes) – never older.
    const staleSeconds = Math.max(120, o.tracking_interval_seconds * 3);
    const cfg = { mode: o.tracking_mode, noticeVersion: o.tracking_notice_version, staleSeconds };
    const drivers = rows.map((d) => ({
      driverId: d.id,
      name: d.display_name,
      depotId: d.depot_id,
      depotName: d.depot_name,
      pilot: d.tracking_pilot,
      hasAppLogin: d.has_login,
      effective: o.tracking_mode === "active_tours" || (o.tracking_mode === "pilot" && d.tracking_pilot),
      acknowledgedVersion: d.ack_version,
      acknowledgedAt: d.ack_at?.toISOString() ?? null,
      acknowledgedCurrent: d.ack_version === o.tracking_notice_version,
      currentTour: d.tour_id ? { id: d.tour_id, name: d.tour_name, status: d.tour_status } : null,
      lastPositionAt: d.position_at?.toISOString() ?? null,
      positionAgeSeconds: d.position_age,
      // The installed app does not report its location permission: unknown, never guessed.
      permission: "unknown" as const,
      state: trackingState(cfg, d),
    }));
    const byState: Record<string, number> = {};
    for (const d of drivers) byState[d.state] = (byState[d.state] ?? 0) + 1;
    return { serverTime: new Date().toISOString(), mode: o.tracking_mode, noticeVersion: o.tracking_notice_version, staleAfterSeconds: staleSeconds, pilotLimit: PILOT_MAX, summary: byState, drivers };
  });

  /** Switch pilot tracking on or off for several drivers (company admin, second factor). */
  app.post("/v1/orgs/:orgId/tracking/pilots", { preHandler: guards.requireTenant("org.settings.manage") }, async (req, reply) => {
    const { orgId } = OrgParams.parse(req.params);
    const b = parse(
      z.object({
        driverIds: z.array(Uuid).min(1).max(PILOT_MAX),
        enabled: z.boolean(),
        /** Required when switching on: each driver agreed to be tracked for testing and read the notice. */
        confirmPilotConsent: z.literal(true).optional(),
      }),
      req.body,
      reply,
    );
    if (!b) return;
    if (b.enabled && !b.confirmPilotConsent) return problem(reply, 422, "pilot_not_confirmed", "Confirm that each pilot driver agreed to be tracked for testing");
    const ids = [...new Set(b.driverIds)];
    return db.asUser(claims(req), async (tx) => {
      const n = (await tx.query(`update drivers set tracking_pilot = $3 where organization_id = $1 and id = any($2::uuid[]) and tracking_pilot is distinct from $3`, [orgId, ids, b.enabled])).rowCount ?? 0;
      const known = (await tx.query<{ n: number }>(`select count(*)::int as n from drivers where organization_id = $1 and id = any($2::uuid[])`, [orgId, ids])).rows[0]!.n;
      if (known !== ids.length) throw new ApiError(422, "invalid_reference", "A driver does not belong to this company");
      const pilots = (await tx.query<{ n: number }>(`select count(*)::int as n from drivers where organization_id = $1 and tracking_pilot`, [orgId])).rows[0]!.n;
      if (pilots > PILOT_MAX) throw new ApiError(422, "pilot_limit", `Pilot mode is limited to ${PILOT_MAX} drivers – switch to tracking for all eligible drivers instead`);
      return { changed: n, pilots };
    });
  });
}
