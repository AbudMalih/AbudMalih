import { isOpen, minuteOfDay, nowInZone, projectTour, sortBySequence, type DispatchDataset } from "@turvio/shared";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { STOP_SELECT, orgTimeZone, toStop, toTour, type StopRow, type TourRow } from "../data/dispatch";
import { buildRoads } from "../data/roads";
import { ApiError } from "../db";
import { OrgParams, parse, problem, type RouteCtx } from "../http";
import { RoutingUnavailable } from "../routing";
import { FRESH_GPS_SECONDS } from "./tours";

const Uuid = z.string().uuid();
const IdParams = OrgParams.extend({ id: Uuid });

/** One GPS fix from the driver app. `id` is a client UUID (retries are idempotent). */
const Point = z.object({
  id: Uuid,
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracy: z.number().min(0).max(10_000).nullable().optional(),
  speed: z.number().min(0).max(100).nullable().optional(),
  heading: z.number().min(0).max(360).nullable().optional(),
  recordedAt: z.string().datetime({ offset: true }),
});

interface FleetRow {
  driver_id: string;
  driver_name: string;
  tour_id: string;
  tour_name: string;
  tour_status: string;
  depot_id: string;
  vehicle_id: string | null;
  vehicle_label: string | null;
  license_plate: string | null;
  lat: number;
  lng: number;
  accuracy_m: number | null;
  speed_mps: number | null;
  heading_deg: number | null;
  recorded_at: Date;
  received_at: Date;
  done: number;
  remaining: number;
  next_stop: { id: string; sequence: number; lat: number | null; lng: number | null; name: string | null; street: string; houseNumber: string | null; city: string; twEnd: number | null } | null;
}

/**
 * Live GPS tracking (docs/LIVE_TRACKING.md). The database enforces who may record and when
 * (driver_record_locations); these routes add input validation, rate limits by batch size and
 * read access for dispatch. Nothing here works while the company has tracking switched off.
 */
export function registerTrackingRoutes(app: FastifyInstance, { deps, guards }: RouteCtx) {
  const db = deps.db;
  const claims = guards.claims;

  /** Tracking settings as the driver app needs them (mode, interval, notice state). */
  app.get("/v1/orgs/:orgId/tracking/config", { preHandler: guards.requireTenant("tours.view_own") }, async (req) => {
    const { orgId } = OrgParams.parse(req.params);
    return db.asUser(claims(req), async (tx) => {
      const o = (
        await tx.query<{ tracking_mode: string; tracking_interval_seconds: number; tracking_notice_version: number; location_retention_days: number }>(
          `select tracking_mode, tracking_interval_seconds, tracking_notice_version, location_retention_days from organizations where id = $1`,
          [orgId],
        )
      ).rows[0];
      if (!o) throw new ApiError(404, "not_found", "Organization not found");
      const ack = (
        await tx.query<{ notice_version: number }>(
          `select notice_version from tracking_notice_acks a where a.organization_id = $1 and a.driver_id in (select app.my_driver_ids()) order by notice_version desc limit 1`,
          [orgId],
        )
      ).rows[0];
      // Effective for THIS driver: in pilot mode only named pilot drivers are tracked.
      const enabled = (
        await tx.query<{ on: boolean }>(
          `select coalesce(bool_or(app.tracking_enabled_for($1, d.id)), false) as on from drivers d where d.organization_id = $1 and d.id in (select app.my_driver_ids())`,
          [orgId],
        )
      ).rows[0]?.on;
      return {
        mode: (enabled ? "active_tours" : "off") as "off" | "active_tours",
        companyMode: o.tracking_mode as "off" | "pilot" | "active_tours",
        intervalSeconds: o.tracking_interval_seconds,
        noticeVersion: o.tracking_notice_version,
        acknowledgedVersion: ack?.notice_version ?? null,
        retentionDays: o.location_retention_days,
      };
    });
  });

  /** The driver confirms having read the tracking notice (current version). */
  app.post("/v1/orgs/:orgId/tracking/notice", { preHandler: guards.requireTenant("tours.view_own") }, async (req) => {
    const { orgId } = OrgParams.parse(req.params);
    const version = await db.asUser(claims(req), async (tx) => (await tx.query<{ v: number }>(`select driver_ack_tracking_notice($1) as v`, [orgId])).rows[0]!.v);
    return { acknowledgedVersion: version };
  });

  /** Batch upload of positions for one tour (offline buffers are sent in batches of ≤ 500). */
  app.post("/v1/orgs/:orgId/tours/:id/locations", { preHandler: guards.requireTenant("stops.update_status_own") }, async (req, reply) => {
    const { id } = IdParams.parse(req.params);
    const b = parse(z.object({ points: z.array(Point).min(1).max(500) }), req.body, reply);
    if (!b) return;
    const r = await db.asUser(claims(req), async (tx) =>
      (await tx.query<{ r: { accepted: number; duplicates: number; rejected: { id: string; reason: string }[] } }>(`select driver_record_locations($1, $2::jsonb) as r`, [id, JSON.stringify(b.points)])).rows[0]!.r,
    );
    return r;
  });

  /** Live fleet: latest position of every driver on a tour the caller may see (depot scope via RLS). */
  app.get("/v1/orgs/:orgId/fleet/live", { preHandler: guards.requireTenant("tracking.view_live") }, async (req) => {
    const { orgId } = OrgParams.parse(req.params);
    const rows = await db.asUser(claims(req), async (tx) =>
      (
        await tx.query<FleetRow>(
          `select dp.driver_id, d.display_name as driver_name, t.id as tour_id, t.name as tour_name, t.status as tour_status, t.depot_id,
                  coalesce(dp.vehicle_id, t.vehicle_id) as vehicle_id, v.label as vehicle_label, v.license_plate,
                  dp.lat, dp.lng, dp.accuracy_m, dp.speed_mps, dp.heading_deg, dp.recorded_at, dp.received_at,
                  (select count(*)::int from stops s where s.tour_id = t.id and s.status not in ('pending', 'in_progress')) as done,
                  (select count(*)::int from stops s where s.tour_id = t.id and s.status in ('pending', 'in_progress')) as remaining,
                  (select json_build_object('id', s.id, 'sequence', s.sequence, 'lat', s.lat, 'lng', s.lng, 'name', s.recipient_name,
                                            'street', s.street, 'houseNumber', s.house_number, 'city', s.city, 'twEnd', s.tw_end_minute)
                     from stops s where s.tour_id = t.id and s.status in ('pending', 'in_progress') order by s.sequence limit 1) as next_stop
             from driver_positions dp
             join tours t on t.id = dp.tour_id
             join drivers d on d.id = dp.driver_id
             left join vehicles v on v.id = coalesce(dp.vehicle_id, t.vehicle_id)
            where dp.organization_id = $1
            order by d.display_name`,
          [orgId],
        )
      ).rows,
    );
    return {
      // Clients compute freshness against the server clock, not the device clock.
      serverTime: new Date().toISOString(),
      vehicles: rows.map((r) => ({
        driverId: r.driver_id,
        driverName: r.driver_name,
        tourId: r.tour_id,
        tourName: r.tour_name,
        tourStatus: r.tour_status,
        depotId: r.depot_id,
        vehicle: r.vehicle_id ? { id: r.vehicle_id, label: r.vehicle_label, licensePlate: r.license_plate } : null,
        position: { lat: r.lat, lng: r.lng, accuracyMeters: r.accuracy_m, speedMps: r.speed_mps, headingDeg: r.heading_deg },
        recordedAt: r.recorded_at.toISOString(),
        receivedAt: r.received_at.toISOString(),
        progress: { done: r.done, remaining: r.remaining },
        nextStop: r.next_stop,
      })),
    };
  });

  /** Recorded track of one tour (history review). Every read is written to the audit log. */
  app.get("/v1/orgs/:orgId/tours/:id/track", { preHandler: guards.requireTenant("tracking.view_live") }, async (req, reply) => {
    const { orgId, id } = IdParams.parse(req.params);
    const data = await db.asUser(claims(req), async (tx) => {
      const tour = (await tx.query<{ id: string }>(`select id from tours where id = $1 and organization_id = $2`, [id, orgId])).rows[0];
      if (!tour) return null;
      const points = (
        await tx.query<{ lat: number; lng: number; accuracy_m: number | null; speed_mps: number | null; recorded_at: Date }>(
          `select lat, lng, accuracy_m, speed_mps, recorded_at from location_pings where tour_id = $1 and organization_id = $2 order by recorded_at limit 20000`,
          [id, orgId],
        )
      ).rows;
      const events = (
        await tx.query<{ kind: string; created_at: Date }>(`select kind, created_at from tour_events where tour_id = $1 and kind in ('started', 'paused', 'resumed', 'completed') order by created_at`, [id])
      ).rows;
      const stops = (
        await tx.query<{ id: string; status: string; completed_at: Date | null }>(`select id, status, completed_at from stops where tour_id = $1 and completed_at is not null order by completed_at`, [id])
      ).rows;
      return { points, events, stops };
    });
    if (!data) return problem(reply, 404, "not_found", "Tour not found");
    // Accountability: who looked at which driver's movements, and when.
    await db.asService((tx) => tx.query(`select app.log_read($1, $2, 'location_pings', $3)`, [orgId, req.user!.userId, id]));
    // Gaps: consecutive fixes more than 2 minutes apart while the tour was being driven.
    const gaps: { from: string; to: string; minutes: number }[] = [];
    for (let i = 1; i < data.points.length; i++) {
      const a = data.points[i - 1]!.recorded_at.getTime();
      const b = data.points[i]!.recorded_at.getTime();
      if (b - a > 120_000) gaps.push({ from: new Date(a).toISOString(), to: new Date(b).toISOString(), minutes: Math.round((b - a) / 60_000) });
    }
    return {
      points: data.points.map((p) => ({ lat: p.lat, lng: p.lng, accuracyMeters: p.accuracy_m, speedMps: p.speed_mps, recordedAt: p.recorded_at.toISOString() })),
      events: data.events.map((e) => ({ kind: e.kind, at: e.created_at.toISOString() })),
      completedStops: data.stops.map((s) => ({ stopId: s.id, status: s.status, at: s.completed_at!.toISOString() })),
      gaps,
    };
  });

  /**
   * Live ETA of a tour on the road: road route from the vehicle's CURRENT position (fresh GPS
   * only) through the open stops in their planned order. Reports deadline risks and suggests –
   * never applies – a re-optimization. Stale or missing GPS -> no live ETA (said explicitly).
   */
  app.get("/v1/orgs/:orgId/tours/:id/eta", { preHandler: guards.requireTenant("tracking.view_live") }, async (req, reply) => {
    const { orgId, id } = IdParams.parse(req.params);
    const data = await db.asUser(claims(req), async (tx) => {
      const tour = (await tx.query<TourRow>(`select * from tours where id = $1 and organization_id = $2`, [id, orgId])).rows[0];
      if (!tour) return null;
      const pos = (
        await tx.query<{ lat: number; lng: number; recorded_at: Date; age: number }>(
          `select lat, lng, recorded_at, extract(epoch from now() - recorded_at)::int as age from driver_positions where tour_id = $1`,
          [id],
        )
      ).rows[0];
      const depot = (await tx.query<{ lat: number; lng: number }>(`select lat, lng from depots where id = $1`, [tour.depot_id])).rows[0]!;
      const stops = (await tx.query<StopRow>(`${STOP_SELECT} where s.tour_id = $1 order by s.sequence`, [id])).rows.map(toStop);
      const tz = await orgTimeZone(tx, orgId);
      const now = nowInZone(tz).minute;
      const maxShift = tour.driver_id ? ((await tx.query<{ max_shift_minutes: number }>(`select max_shift_minutes from drivers where id = $1`, [tour.driver_id])).rows[0]?.max_shift_minutes ?? 480) : 480;
      return { tour, pos, depot, stops, now, tz, maxShift };
    });
    if (!data) return problem(reply, 404, "not_found", "Tour not found");
    const paused = data.tour.status === "paused";
    if (data.tour.status !== "in_progress" && !paused) return { source: "none", reason: "tour_not_in_progress" };
    if (!data.pos) return { source: "none", reason: "no_live_position" };
    if (data.pos.age > FRESH_GPS_SECONDS) return { source: "none", reason: "position_stale", positionAgeSeconds: data.pos.age };
    if (!deps.routing) return { source: "none", reason: "no_routing" };
    // Same road data and projection as the dispatch dataset (data/roads.ts + shared projectTour).
    const tour = toTour(data.tour);
    const mini: DispatchDataset = {
      organizationId: orgId,
      date: tour.date,
      asOfMinute: data.now,
      isToday: true,
      timeZone: data.tz,
      depots: [{ id: tour.depotId, organizationId: orgId, name: "", address: { street: "", houseNumber: "", postalCode: "", city: "", countryCode: "DE" }, location: data.depot }],
      drivers: [],
      vehicles: [],
      tours: [tour],
      stops: data.stops,
      unassigned: [],
    };
    const { roads } = await buildRoads(mini, deps.routing, new Map([[tour.id, { lat: data.pos.lat, lng: data.pos.lng, ageSeconds: data.pos.age }]]), { budgetMs: 8000 });
    const road = roads[tour.id];
    if (road?.source !== "osrm" || !road.gps?.firstLeg) return { source: "none", reason: "routing_unavailable" };
    const p = projectTour({ tour, stops: data.stops, depotLocation: data.depot, maxShiftMinutes: data.maxShift, nowMinute: data.now, isToday: true, road, minuteOf: (iso) => minuteOfDay(iso, data.tz) });
    const stops = sortBySequence(data.stops)
      .filter((s) => isOpen(s.status) && s.type !== "break" && s.location)
      .map((s) => {
        const x = p.stops.get(s.id)!;
        return { stopId: s.id, etaMinute: Math.round(x.etaMinute), deadlineMinute: x.deadlineMinute, lateMinutes: Math.round(x.lateMinutes), priority: s.priority, state: x.state };
      });
    const atRisk = stops.filter((x) => x.state === "projected_late" || x.state === "deadline_missed");
    return {
      source: "osrm",
      from: p.origin,
      condition: p.condition,
      positionAgeSeconds: data.pos.age,
      computedAtMinute: data.now,
      complete: p.complete,
      unlocatedStopIds: p.unlocatedStopIds,
      stops,
      remainingMeters: Math.round(p.remainingMeters),
      remainingDriveSeconds: Math.round(p.remainingDriveSeconds),
      remainingServiceSeconds: Math.round(p.remainingServiceSeconds),
      finishMinute: Math.round(p.finishMinute),
      endsAtLastStop: p.endsAtLastStop,
      atRiskStopIds: atRisk.map((x) => x.stopId),
      // A suggestion for the dispatcher/driver – the order is never changed automatically.
      suggestReoptimize: atRisk.length > 0,
    };
  });

  /**
   * Company switch (admin, second factor). Switching tracking ON requires confirming that the
   * legal prerequisites are in place; the switch is audited (who, when).
   */
  app.patch("/v1/orgs/:orgId/tracking", { preHandler: guards.requireTenant("org.settings.manage") }, async (req, reply) => {
    const { orgId } = OrgParams.parse(req.params);
    if (!guards.requireAal2(req, reply)) return;
    const b = parse(
      z.object({
        mode: z.enum(["off", "pilot", "active_tours"]).optional(),
        /** Pilot mode: the only drivers that are tracked (e.g. the owner's own test account). */
        pilotDriverIds: z.array(Uuid).max(20).optional(),
        /** Pilot mode: each pilot driver agreed to be tracked for testing and read the notice. */
        confirmPilotConsent: z.literal(true).optional(),
        intervalSeconds: z.number().int().min(5).max(60).optional(),
        retentionDays: z.number().int().min(1).max(365).optional(),
        /** Bump when the notice text changes: every driver must acknowledge again. */
        newNoticeVersion: z.boolean().default(false),
        /** Required to switch on: DPIA done, works council agreed (§87(1) Nr. 6 BetrVG), drivers informed. */
        confirmPrerequisites: z.literal(true).optional(),
      }),
      req.body,
      reply,
    );
    if (!b) return;
    if (b.mode === "active_tours" && !b.confirmPrerequisites)
      return problem(reply, 422, "prerequisites_not_confirmed", "Confirm that the privacy impact assessment, the works-council agreement and the driver information are in place");
    if (b.mode === "pilot" && (!b.pilotDriverIds?.length || !b.confirmPilotConsent))
      return problem(reply, 422, "pilot_not_confirmed", "Name the pilot drivers and confirm that each of them agreed to be tracked for testing");
    const row = await db.asUser(claims(req), async (tx) => {
      if (b.pilotDriverIds) {
        // Exactly these drivers are pilots (others are switched back); RLS limits to this org.
        await tx.query(`update drivers set tracking_pilot = (id = any($2::uuid[])) where organization_id = $1`, [orgId, b.pilotDriverIds]);
        const n = (await tx.query<{ n: number }>(`select count(*)::int as n from drivers where organization_id = $1 and tracking_pilot`, [orgId])).rows[0]!.n;
        if (n !== b.pilotDriverIds.length) throw new ApiError(422, "invalid_reference", "A pilot driver does not belong to this company");
      }
      return (
        await tx.query<{ tracking_mode: string; tracking_interval_seconds: number; tracking_notice_version: number; location_retention_days: number }>(
          `update organizations set
             tracking_mode = coalesce($2, tracking_mode),
             tracking_interval_seconds = coalesce($3, tracking_interval_seconds),
             location_retention_days = coalesce($4, location_retention_days),
             tracking_notice_version = tracking_notice_version + case when $5 then 1 else 0 end,
             tracking_enabled_at = case when $2 in ('active_tours', 'pilot') and tracking_mode is distinct from $2 then now() when $2 = 'off' then null else tracking_enabled_at end,
             tracking_enabled_by = case when $2 in ('active_tours', 'pilot') and tracking_mode is distinct from $2 then auth.uid() when $2 = 'off' then null else tracking_enabled_by end
           where id = $1
           returning tracking_mode, tracking_interval_seconds, tracking_notice_version, location_retention_days`,
          [orgId, b.mode ?? null, b.intervalSeconds ?? null, b.retentionDays ?? null, b.newNoticeVersion],
        )
      ).rows[0];
    });
    if (!row) return problem(reply, 404, "not_found", "Organization not found");
    return { mode: row.tracking_mode, intervalSeconds: row.tracking_interval_seconds, noticeVersion: row.tracking_notice_version, retentionDays: row.location_retention_days };
  });
}
