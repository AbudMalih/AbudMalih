import { isOpen, tourStartPoint, type Stop } from "@turvio/shared";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { ApiError, type Tx } from "../db";
import { OrgParams, parse, problem, type RouteCtx } from "../http";
import { STOP_SELECT, loadDispatchDataset, toStop, tourStartOf, type StopRow, type TourRow } from "../data/dispatch";
import { loadDecisions, loadStoredChecks, saveChecks, type StopDecision } from "../data/locations";
import type { CheckGroup, CheckStop, LocationChecker, ReportedCheck } from "../location-check";

const IdParams = z.object({ orgId: z.string().uuid(), id: z.string().uuid() });
const Query = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), tourId: z.string().uuid().optional() });

/** A stop's check result with the human decisions that are valid for its current location. */
export type LocationReport = ReportedCheck & {
  confirmation: StopDecision["confirmation"];
  approach: StopDecision["approach"];
  /** Every warning of this result was confirmed by staff for this exact coordinate and address. */
  acknowledged: boolean;
};

const toCheck = (s: Pick<Stop, "id" | "location" | "address" | "addressVersion">): CheckStop => ({ id: s.id, location: s.location ?? null, address: s.address, addressVersion: s.addressVersion });

export function withDecision(c: ReportedCheck, d: StopDecision | undefined): LocationReport {
  const warnings = c.issues.filter((i) => i.severity === "warning").map((i) => i.code);
  // A warning is handled when staff confirmed it for this exact location – or, for a motorway
  // snap, when they chose a navigation approach for it (that is the decision the warning asks for).
  const handled = (w: string) => (d?.confirmation?.issueCodes.includes(w) ?? false) || (w === "motorway" && !!d?.approach);
  const acknowledged = c.status !== "pending" && warnings.length > 0 && warnings.every(handled);
  return { ...c, confirmation: d?.confirmation ?? null, approach: d?.approach ?? null, acknowledged };
}

/**
 * Check, reuse what is still current, persist new results, attach decisions. Reads run as the
 * user (RLS); results are stored by the API's own role.
 */
export async function runChecks(ctx: { db: RouteCtx["deps"]["db"]; claims: ReturnType<RouteCtx["guards"]["claims"]> }, checker: LocationChecker, groups: CheckGroup[], budgetMs?: number) {
  const ids = groups.flatMap((g) => g.stops.map((s) => s.id));
  const { stored, decisions } = await ctx.db.asUser(ctx.claims, async (tx) => ({
    stored: await loadStoredChecks(tx, ids),
    decisions: await loadDecisions(tx, groups.flatMap((g) => g.stops)),
  }));
  const { checks, toStore, report } = await checker.check(groups, budgetMs, { stored });
  const saved = await saveChecks(ctx.db, toStore).catch(() => 0);
  return { checks: checks.map((c) => withDecision(c, decisions.get(c.stopId))), report: { ...report, saved } };
}

/** The stop (RLS) and the point its road connection is checked from. */
async function stopContext(tx: Tx, orgId: string, id: string) {
  const { rows } = await tx.query<{
    id: string;
    tour_id: string | null;
    street: string;
    house_number: string | null;
    postal_code: string;
    city: string;
    country_code: string;
    lat: number | null;
    lng: number | null;
    location_source: string | null;
    location_precision: string;
    address_version: number;
    location_version: number;
    status: string;
    depot_lat: number;
    depot_lng: number;
    start_lat: number | null;
    start_lng: number | null;
    published_at: Date | null;
  }>(
    `select s.id, s.tour_id, s.street, s.house_number, s.postal_code, s.city, s.country_code, s.lat, s.lng, s.location_source, s.location_precision,
            s.address_version, s.location_version, s.status, d.lat as depot_lat, d.lng as depot_lng, t.start_lat, t.start_lng, t.published_at
       from stops s
       left join tours t on t.id = s.tour_id and t.organization_id = s.organization_id
       join depots d on d.id = coalesce(t.depot_id, s.depot_id) and d.organization_id = s.organization_id
      where s.id = $1 and s.organization_id = $2 and app.can_manage_stop(s.organization_id, s.id)`,
    [id, orgId],
  );
  const r = rows[0];
  if (!r) throw new ApiError(404, "not_found", "Stop not found");
  const location = r.lat != null && r.lng != null ? { lat: r.lat, lng: r.lng } : null;
  const depot = { lat: r.depot_lat, lng: r.depot_lng };
  const origin = r.tour_id ? tourStartPoint({ startLocation: r.start_lat != null && r.start_lng != null ? { lat: r.start_lat, lng: r.start_lng } : undefined }, depot) : depot;
  return {
    row: r,
    stop: { id: r.id, location, address: { street: r.street, houseNumber: r.house_number ?? undefined, postalCode: r.postal_code, city: r.city, countryCode: r.country_code.trim() }, addressVersion: r.address_version },
    origin,
  };
}

export function registerLocationRoutes(app: FastifyInstance, { deps, guards }: RouteCtx, checker: LocationChecker) {
  const db = deps.db;
  const claims = (req: FastifyRequest) => guards.claims(req);

  /** All open stops of an operating day (or one tour): errors / warnings / information, pending while running. */
  app.get("/v1/orgs/:orgId/location-checks", { preHandler: guards.requireTenant("tours.view_all") }, async (req, reply) => {
    const { orgId } = OrgParams.parse(req.params);
    const q = parse(Query, req.query, reply);
    if (!q) return;
    const data = await db.asUser(claims(req), (tx) => loadDispatchDataset(tx, orgId, q.date));
    const depots = new Map(data.depots.map((d) => [d.id, d]));
    const groups: CheckGroup[] = [];
    for (const t of data.tours) {
      if ((q.tourId && t.id !== q.tourId) || t.status === "completed") continue;
      const depot = depots.get(t.depotId);
      const stops = data.stops.filter((s) => s.tourId === t.id && isOpen(s.status));
      if (stops.length) groups.push({ origin: depot ? tourStartPoint(t, depot.location) : null, stops: stops.map(toCheck) });
    }
    if (!q.tourId)
      for (const d of data.depots) {
        const stops = data.unassigned.filter((u) => u.depotId === d.id && isOpen(u.status));
        if (stops.length) groups.push({ origin: d.location, stops: stops.map(toCheck) });
      }
    const { checks, report } = await runChecks({ db, claims: claims(req) }, checker, groups);
    req.log.info({ orgId, locationChecks: report }, "location checks");
    return {
      date: data.date,
      pending: report.pending > 0,
      thresholds: checker.thresholds,
      versions: checker.dataVersions,
      checks,
      summary: {
        stops: checks.length,
        errors: checks.filter((c) => c.severity === "error").length,
        warnings: checks.filter((c) => c.severity === "warning" && !c.acknowledged).length,
        acknowledged: checks.filter((c) => c.acknowledged).length,
        pending: report.pending,
        noLocation: checks.filter((c) => c.status === "no_location").length,
      },
    };
  });

  /**
   * The checks of one tour, for its driver (P0-3.5) or staff: RLS limits drivers to their own
   * published tour. Drivers get what matters on the road – no originals, no history.
   */
  app.get("/v1/orgs/:orgId/tours/:id/location-checks", { preHandler: guards.requireTenant("tours.view_own") }, async (req) => {
    const { orgId, id } = IdParams.parse(req.params);
    const { tour, depot, stops } = await db.asUser(claims(req), async (tx) => {
      const tour = (await tx.query<TourRow>(`select * from tours where id = $1 and organization_id = $2`, [id, orgId])).rows[0];
      if (!tour) throw new ApiError(404, "not_found", "Tour not found");
      const depot = (await tx.query<{ lat: number; lng: number }>(`select lat, lng from depots where id = $1`, [tour.depot_id])).rows[0];
      const stops = (await tx.query<StopRow>(`${STOP_SELECT} where s.tour_id = $1 and s.status in ('pending', 'in_progress') order by s.sequence`, [id])).rows.map(toStop);
      return { tour, depot, stops };
    });
    const origin = depot ? tourStartOf(tour, depot) : null;
    const { checks, report } = await runChecks({ db, claims: claims(req) }, checker, [{ origin, stops: stops.map(toCheck) }]);
    return {
      tourId: id,
      pending: report.pending > 0,
      checks: checks.map((c) => ({
        stopId: c.stopId,
        status: c.status,
        severity: c.severity,
        // Details let the app word the issue in the driver's language (P0-3.6).
        issues: c.issues.map((i) => ({ code: i.code, severity: i.severity, message: i.message, ...(i.details ? { details: i.details } : {}) })),
        acknowledged: c.acknowledged,
      })),
    };
  });

  /** One stop: original (or earliest recorded) vs current, check result, valid decisions. Staff of the stop's depot. */
  app.get("/v1/orgs/:orgId/stops/:id/location", { preHandler: guards.requireTenant("stops.manage") }, async (req) => {
    const { orgId, id } = IdParams.parse(req.params);
    const { ctx, original } = await db.asUser(claims(req), async (tx) => {
      const ctx = await stopContext(tx, orgId, id);
      const o = (await tx.query(`select * from public.stop_location_origins where stop_id = $1`, [id])).rows[0] as Record<string, unknown> | undefined;
      return { ctx, original: o };
    });
    const { checks } = await runChecks({ db, claims: claims(req) }, checker, [{ origin: ctx.origin, stops: [ctx.stop] }]);
    const r = ctx.row;
    return {
      stopId: id,
      current: {
        address: ctx.stop.address,
        location: ctx.stop.location,
        locationSource: r.location_source,
        locationPrecision: r.location_precision,
        addressVersion: r.address_version,
        locationVersion: r.location_version,
      },
      original: original
        ? {
            kind: original.kind,
            // A baseline is the earliest state TURVIO recorded – never presented as the imported original.
            label: original.kind === "original" ? "Original (as created)" : "Earliest recorded state – original import not recorded",
            provenance: original.provenance,
            address: { street: original.street, houseNumber: original.house_number ?? undefined, postalCode: original.postal_code, city: original.city, countryCode: String(original.country_code).trim() },
            location: original.lat != null ? { lat: original.lat, lng: original.lng } : null,
            locationSource: original.location_source,
            locationPrecision: original.location_precision,
            capturedAt: new Date(original.captured_at as string).toISOString(),
            capturedBy: original.captured_by,
          }
        : null,
      tourPublished: !!r.published_at,
      check: checks[0],
    };
  });

  /** Audit trail of one stop (also after the stop was deleted: company admins). */
  app.get("/v1/orgs/:orgId/stops/:id/location/history", { preHandler: guards.requireTenant("stops.manage") }, async (req) => {
    const { orgId, id } = IdParams.parse(req.params);
    const rows = await db.asUser(claims(req), async (tx) =>
      (
        await tx.query(
          `select e.id, e.occurred_at, e.actor_user_id, e.actor_role, e.action, e.reason, e.previous, e.new
             from public.stop_location_events e
            where e.organization_id = $1 and e.stop_id = $2 order by e.occurred_at desc, e.id desc limit 200`,
          [orgId, id],
        )
      ).rows,
    );
    return {
      events: rows.map((r) => ({
        id: String(r.id),
        at: new Date(r.occurred_at).toISOString(),
        // User id + role at the time; Dispatch resolves names from the member list it may see.
        actor: { userId: r.actor_user_id ?? null, role: r.actor_role },
        action: r.action,
        reason: r.reason,
        previous: r.previous,
        new: r.new,
      })),
    };
  });

  const Expected = { expectedLat: z.number().min(-90).max(90), expectedLng: z.number().min(-180).max(180), expectedAddressVersion: z.number().int().min(1) };

  /** "I checked this location": tied to the exact coordinate and address version shown. */
  app.post("/v1/orgs/:orgId/stops/:id/location/confirm", { preHandler: guards.requireTenant("stops.manage") }, async (req, reply) => {
    const { id } = IdParams.parse(req.params);
    const b = parse(z.object({ ...Expected, issueCodes: z.array(z.string().max(40)).max(20).default([]), note: z.string().trim().max(500).optional() }), req.body, reply);
    if (!b) return;
    await db.asUser(claims(req), (tx) =>
      tx.query(`select public.confirm_stop_location($1, $2, $3, $4, $5::text[], $6)`, [id, b.expectedLat, b.expectedLng, b.expectedAddressVersion, b.issueCodes, b.note ?? null]),
    );
    return reply.status(204).send();
  });

  /**
   * Accept a navigation approach point (a suggestion or a point the dispatcher picked, ≤ 300 m from
   * the stop). The point must snap to a non-motorway road close by; nothing is applied otherwise.
   */
  app.post("/v1/orgs/:orgId/stops/:id/location/approach", { preHandler: guards.requireTenant("stops.manage") }, async (req, reply) => {
    const { id } = IdParams.parse(req.params);
    const b = parse(z.object({ ...Expected, lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180), reason: z.string().trim().max(500).optional() }), req.body, reply);
    if (!b) return;
    const routing = deps.routing;
    if (!routing?.snapPoints) return problem(reply, 422, "approach_unverifiable", "Road routing is not configured – an approach point cannot be checked for road access");
    let snap;
    try {
      [snap] = await routing.snapPoints([{ lat: b.lat, lng: b.lng }]);
    } catch {
      return problem(reply, 503, "routing_unavailable", "Road routing is unavailable – try again later");
    }
    if (!snap || snap.distanceMeters > 30) return problem(reply, 422, "approach_not_on_road", `The point is ${Math.round(snap?.distanceMeters ?? 0)} m from the nearest drivable road – pick a point on the road`);
    if (snap.classes?.includes("motorway")) return problem(reply, 422, "approach_on_motorway", "The point is on a motorway – pick a normal road");
    if (snap.classes === null) return problem(reply, 422, "approach_unverifiable", "The road type at this point could not be determined");
    await db.asUser(claims(req), (tx) =>
      tx.query(`select public.accept_stop_approach($1, $2, $3, $4, null, $5, $6, $7, $8)`, [id, b.lat, b.lng, snap.roadName || snap.roadRef || null, b.expectedLat, b.expectedLng, b.expectedAddressVersion, b.reason ?? null]),
    );
    return reply.status(204).send();
  });

  app.delete("/v1/orgs/:orgId/stops/:id/location/approach", { preHandler: guards.requireTenant("stops.manage") }, async (req, reply) => {
    const { id } = IdParams.parse(req.params);
    const reason = typeof (req.query as Record<string, unknown>)?.reason === "string" ? String((req.query as Record<string, string>).reason).slice(0, 500) : null;
    await db.asUser(claims(req), (tx) => tx.query(`select public.clear_stop_approach($1, $2)`, [id, reason]));
    return reply.status(204).send();
  });
}
