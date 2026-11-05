import { NewStopInput, OptimizeRequest, isSubscriptionUsable, nowInZone, type OptimizeResponse } from "@turvio/shared";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { OrgParams, parse, problem, type RouteCtx } from "../http";
import { ApiError, type Tx } from "../db";
import { STOP_SELECT, orgTimeZone, toStop, toTour, toUnassigned, type StopRow, type TourRow } from "../data/dispatch";

const Uuid = z.string().uuid();
const IdParams = OrgParams.extend({ id: Uuid });
const Minute = z.number().int().min(0).max(1439);

const CreateTour = z.object({
  depotId: Uuid,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  name: z.string().trim().min(1).max(120).optional(),
  plannedStartMinute: Minute.default(480),
  driverId: Uuid.nullable().default(null),
  vehicleId: Uuid.nullable().default(null),
});

const UpdateTour = z.object({
  expectedVersion: z.number().int().min(1),
  name: z.string().trim().min(1).max(120).optional(),
  plannedStartMinute: Minute.optional(),
  driverId: Uuid.nullable().optional(),
  vehicleId: Uuid.nullable().optional(),
});

const CreateStops = z
  .object({
    tourId: Uuid.optional(),
    depotId: Uuid.optional(),
    stops: z.array(NewStopInput).min(1).max(500),
  })
  .refine((b) => !!b.tourId !== !!b.depotId, { message: "Give either tourId or depotId (unassigned stops)" });

const UpdateStop = z.object({
  priority: z.boolean().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
  recipientName: z.string().trim().max(120).nullable().optional(),
  timeWindow: z
    .object({ start: Minute, end: Minute })
    .refine((w) => w.end > w.start, { message: "Window end must be after start" })
    .nullable()
    .optional(),
  serviceSeconds: z.number().int().min(0).max(10800).optional(),
  location: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }).nullable().optional(),
});

/** Throws 409 if the driver/vehicle already works on another open tour that day. */
async function assertAvailable(tx: Tx, tourId: string | null, date: string, driverId?: string | null, vehicleId?: string | null) {
  if (driverId) {
    const { rows } = await tx.query<{ name: string }>(
      `select name from tours where driver_id = $1 and tour_date = $2 and status <> 'completed' and id is distinct from $3 limit 1`,
      [driverId, date, tourId],
    );
    if (rows[0]) throw new ApiError(409, "driver_busy", `This driver is already assigned to ${rows[0].name}`);
  }
  if (vehicleId) {
    const { rows } = await tx.query<{ name: string }>(
      `select name from tours where vehicle_id = $1 and tour_date = $2 and status <> 'completed' and id is distinct from $3 limit 1`,
      [vehicleId, date, tourId],
    );
    if (rows[0]) throw new ApiError(409, "vehicle_busy", `This vehicle is already assigned to ${rows[0].name}`);
  }
}

async function loadTour(tx: Tx, orgId: string, id: string): Promise<TourRow> {
  const { rows } = await tx.query<TourRow>(`select * from tours where id = $1 and organization_id = $2`, [id, orgId]);
  if (!rows[0]) throw new ApiError(404, "not_found", "Tour not found");
  return rows[0];
}

async function tourWithStops(tx: Tx, orgId: string, id: string) {
  const tour = await loadTour(tx, orgId, id);
  const stops = (await tx.query<StopRow>(`${STOP_SELECT} where s.tour_id = $1 order by s.sequence`, [id])).rows.map(toStop);
  return { tour: toTour(tour), stops };
}

async function insertStops(tx: Tx, orgId: string, target: { tourId?: string; depotId?: string }, stops: z.infer<typeof NewStopInput>[]) {
  let next = 0;
  if (target.tourId) {
    await loadTour(tx, orgId, target.tourId);
    next = (await tx.query<{ n: number }>(`select coalesce(max(sequence) + 1, 0)::int as n from stops where tour_id = $1`, [target.tourId])).rows[0]!.n;
  }
  const ids: string[] = [];
  for (const s of stops) {
    const { rows } = await tx.query<{ id: string }>(
      `insert into stops (organization_id, tour_id, depot_id, type, sequence, recipient_name, street, house_number, postal_code, city, country_code,
                          lat, lng, tw_start_minute, tw_end_minute, service_seconds, priority, notes)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) returning id`,
      [
        orgId,
        target.tourId ?? null,
        target.depotId ?? null,
        s.type,
        target.tourId ? next++ : 0,
        s.recipientName ?? null,
        s.address.street,
        s.address.houseNumber ?? null,
        s.address.postalCode,
        s.address.city,
        s.address.countryCode,
        s.location?.lat ?? null,
        s.location?.lng ?? null,
        s.timeWindow?.start ?? null,
        s.timeWindow?.end ?? null,
        s.serviceSeconds,
        s.priority,
        s.notes ?? null,
      ],
    );
    const id = rows[0]!.id;
    ids.push(id);
    for (const tn of s.trackingNumbers) {
      await tx.query(`insert into parcels (organization_id, stop_id, tracking_number, recipient_name) values ($1,$2,$3,$4)`, [orgId, id, tn, s.recipientName ?? null]);
    }
  }
  return ids;
}

interface VehicleInputRow {
  tour: TourRow;
  depot: { lat: number; lng: number };
  maxShift: number;
  capacity: number | null;
  start: { lat: number; lng: number };
  shiftStart: number;
}

/** Build optimizer vehicles for saved tours (current position = last completed stop; no GPS). */
async function vehicleFor(tx: Tx, tour: TourRow, nowMinute: number): Promise<VehicleInputRow> {
  const depot = (await tx.query<{ lat: number; lng: number }>(`select lat, lng from depots where id = $1`, [tour.depot_id])).rows[0]!;
  const driver = tour.driver_id ? (await tx.query<{ max_shift_minutes: number }>(`select max_shift_minutes from drivers where id = $1`, [tour.driver_id])).rows[0] : undefined;
  const vehicle = tour.vehicle_id ? (await tx.query<{ capacity_parcels: number | null }>(`select capacity_parcels from vehicles where id = $1`, [tour.vehicle_id])).rows[0] : undefined;
  const last = (
    await tx.query<{ lat: number; lng: number }>(`select lat, lng from stops where tour_id = $1 and status <> 'pending' and lat is not null order by sequence desc limit 1`, [tour.id])
  ).rows[0];
  const running = tour.status === "in_progress" || tour.status === "paused";
  return {
    tour,
    depot,
    maxShift: driver?.max_shift_minutes ?? 480,
    capacity: vehicle?.capacity_parcels ?? null,
    start: running && last ? last : tour.start_lat != null && tour.start_lng != null ? { lat: tour.start_lat, lng: tour.start_lng } : depot,
    shiftStart: running ? Math.max(nowMinute, tour.planned_start_minute) : tour.planned_start_minute,
  };
}

export function registerTourRoutes(app: FastifyInstance, { deps, guards }: RouteCtx) {
  const db = deps.db;
  const claims = (req: FastifyRequest) => guards.claims(req);

  async function requireOptimizationPlan(req: FastifyRequest, orgId: string) {
    const sub = await deps.tenancy.getSubscription(orgId, req.user!.userId);
    if (!sub || !isSubscriptionUsable(sub.subscription)) throw new ApiError(402, "subscription_inactive", "Subscription is not active");
    if (!sub.plan.features.optimization) throw new ApiError(403, "feature_not_in_plan", "Optimization is not included in this plan");
  }

  // ---------------------------------------------------------------- tours
  app.post("/v1/orgs/:orgId/tours", { preHandler: guards.requireTenant("tours.manage") }, async (req, reply) => {
    const { orgId } = OrgParams.parse(req.params);
    const b = parse(CreateTour, req.body, reply);
    if (!b) return;
    const row = await db.asUser(claims(req), async (tx) => {
      await assertAvailable(tx, null, b.date, b.driverId, b.vehicleId);
      let name = b.name;
      if (!name) {
        const depot = (await tx.query<{ name: string }>(`select name from depots where id = $1 and organization_id = $2`, [b.depotId, orgId])).rows[0];
        if (!depot) throw new ApiError(404, "not_found", "Depot not found");
        const prefix = depot.name.replace(/[^A-Za-zÄÖÜäöü]/g, "").slice(0, 3).toUpperCase() || "TOUR";
        const n = (await tx.query<{ n: number }>(`select count(*)::int as n from tours where depot_id = $1 and tour_date = $2`, [b.depotId, b.date])).rows[0]!.n;
        name = `${prefix}-${String(n + 1).padStart(2, "0")}`;
      }
      return (
        await tx.query<TourRow>(
          `insert into tours (organization_id, depot_id, name, tour_date, planned_start_minute, driver_id, vehicle_id) values ($1,$2,$3,$4,$5,$6,$7) returning *`,
          [orgId, b.depotId, name, b.date, b.plannedStartMinute, b.driverId, b.vehicleId],
        )
      ).rows[0]!;
    });
    return reply.status(201).send(toTour(row));
  });

  app.get("/v1/orgs/:orgId/tours/:id", { preHandler: guards.requireTenant("tours.view_all") }, async (req) => {
    const { orgId, id } = IdParams.parse(req.params);
    return db.asUser(claims(req), (tx) => tourWithStops(tx, orgId, id));
  });

  app.patch("/v1/orgs/:orgId/tours/:id", { preHandler: guards.requireTenant("tours.manage") }, async (req, reply) => {
    const { orgId, id } = IdParams.parse(req.params);
    const b = parse(UpdateTour, req.body, reply);
    if (!b) return;
    const row = await db.asUser(claims(req), async (tx) => {
      const cur = await loadTour(tx, orgId, id);
      if (cur.status === "completed") throw new ApiError(422, "invalid_operation", "Completed tours cannot be changed");
      await assertAvailable(tx, id, cur.tour_date, b.driverId, b.vehicleId);
      const { rows } = await tx.query<TourRow>(
        `update tours set
           name = coalesce($4, name),
           planned_start_minute = coalesce($5, planned_start_minute),
           driver_id = case when $6 then $7::uuid else driver_id end,
           vehicle_id = case when $8 then $9::uuid else vehicle_id end
         where id = $1 and organization_id = $2 and version = $3 returning *`,
        [id, orgId, b.expectedVersion, b.name ?? null, b.plannedStartMinute ?? null, b.driverId !== undefined, b.driverId ?? null, b.vehicleId !== undefined, b.vehicleId ?? null],
      );
      if (!rows[0]) throw new ApiError(409, "version_conflict", "The tour was changed by someone else. Reload and try again.");
      return rows[0];
    });
    return toTour(row);
  });

  app.delete("/v1/orgs/:orgId/tours/:id", { preHandler: guards.requireTenant("tours.manage") }, async (req, reply) => {
    const { orgId, id } = IdParams.parse(req.params);
    const q = parse(z.object({ expectedVersion: z.coerce.number().int().min(1) }), req.query, reply);
    if (!q) return;
    await db.asUser(claims(req), async (tx) => {
      const cur = await loadTour(tx, orgId, id);
      if (cur.version !== q.expectedVersion) throw new ApiError(409, "version_conflict", "The tour was changed by someone else. Reload and try again.");
      if (cur.status !== "planned" || cur.published_at) throw new ApiError(422, "invalid_operation", "Only unpublished, planned tours can be deleted");
      // Stops go back to the depot's unassigned list instead of being lost.
      await tx.query(`update stops set tour_id = null, depot_id = $2, sequence = 0 where tour_id = $1`, [id, cur.depot_id]);
      await tx.query(`delete from tours where id = $1`, [id]);
    });
    return reply.status(204).send();
  });

  app.post("/v1/orgs/:orgId/tours/:id/publish", { preHandler: guards.requireTenant("tours.manage") }, async (req, reply) => {
    const { orgId, id } = IdParams.parse(req.params);
    const b = parse(z.object({ expectedVersion: z.number().int().min(1) }), req.body, reply);
    if (!b) return;
    return db.asUser(claims(req), async (tx) => {
      await loadTour(tx, orgId, id);
      await tx.query(`select publish_tour($1, $2)`, [id, b.expectedVersion]);
      return tourWithStops(tx, orgId, id);
    });
  });

  app.post("/v1/orgs/:orgId/tours/:id/unpublish", { preHandler: guards.requireTenant("tours.manage") }, async (req, reply) => {
    const { orgId, id } = IdParams.parse(req.params);
    const b = parse(z.object({ expectedVersion: z.number().int().min(1) }), req.body, reply);
    if (!b) return;
    return db.asUser(claims(req), async (tx) => {
      await loadTour(tx, orgId, id);
      await tx.query(`select unpublish_tour($1, $2)`, [id, b.expectedVersion]);
      return tourWithStops(tx, orgId, id);
    });
  });

  /** Status changes by staff or the assigned driver (state machine in the database). */
  app.post("/v1/orgs/:orgId/tours/:id/status", { preHandler: guards.requireTenant("stops.update_status_own") }, async (req, reply) => {
    const { id } = IdParams.parse(req.params);
    const b = parse(z.object({ status: z.enum(["in_progress", "paused", "completed"]) }), req.body, reply);
    if (!b) return;
    const row = await db.asUser(claims(req), async (tx) => (await tx.query<TourRow>(`select * from driver_set_tour_status($1, $2)`, [id, b.status])).rows[0]!);
    return toTour(row);
  });

  app.get("/v1/orgs/:orgId/tours/:id/events", { preHandler: guards.requireTenant("tours.view_own") }, async (req) => {
    const { orgId, id } = IdParams.parse(req.params);
    return db.asUser(claims(req), async (tx) => {
      await loadTour(tx, orgId, id);
      const { rows } = await tx.query(
        `select 'tour' as source, kind, detail, created_at from tour_events where tour_id = $1
         union all
         select 'stop' as source, e.status::text as kind, jsonb_build_object('stopId', e.stop_id, 'notes', e.notes), e.created_at
           from stop_events e join stops s on s.id = e.stop_id where s.tour_id = $1
         order by created_at desc limit 200`,
        [id],
      );
      return rows.map((r) => ({ source: r.source, kind: r.kind, detail: r.detail, at: r.created_at }));
    });
  });

  // ---------------------------------------------------------------- stops
  app.post("/v1/orgs/:orgId/stops", { preHandler: guards.requireTenant("stops.add_own") }, async (req, reply) => {
    const { orgId } = OrgParams.parse(req.params);
    const b = parse(CreateStops, req.body, reply);
    if (!b) return;
    if (b.depotId && req.membership!.role === "driver") return problem(reply, 403, "forbidden", "Drivers can only add stops to their own tour");
    const ids = await db.asUser(claims(req), (tx) => insertStops(tx, orgId, b, b.stops));
    return reply.status(201).send({ ids });
  });

  app.patch("/v1/orgs/:orgId/stops/:id", { preHandler: guards.requireTenant("stops.manage") }, async (req, reply) => {
    const { orgId, id } = IdParams.parse(req.params);
    const b = parse(UpdateStop, req.body, reply);
    if (!b) return;
    const row = await db.asUser(claims(req), async (tx) => {
      const sets: string[] = [];
      const vals: unknown[] = [id, orgId];
      const add = (sql: string, v: unknown) => {
        vals.push(v);
        sets.push(sql.replace("?", `$${vals.length}`));
      };
      if (b.priority !== undefined) add("priority = ?", b.priority);
      if (b.notes !== undefined) add("notes = ?", b.notes);
      if (b.recipientName !== undefined) add("recipient_name = ?", b.recipientName);
      if (b.serviceSeconds !== undefined) add("service_seconds = ?", b.serviceSeconds);
      if (b.timeWindow !== undefined) {
        add("tw_start_minute = ?", b.timeWindow?.start ?? null);
        add("tw_end_minute = ?", b.timeWindow?.end ?? null);
      }
      if (b.location !== undefined) {
        add("lat = ?", b.location?.lat ?? null);
        add("lng = ?", b.location?.lng ?? null);
      }
      if (!sets.length) throw new ApiError(400, "validation_failed", "Nothing to update");
      const { rows } = await tx.query<{ id: string }>(`update stops set ${sets.join(", ")} where id = $1 and organization_id = $2 returning id`, vals);
      if (!rows[0]) throw new ApiError(404, "not_found", "Stop not found");
      return (await tx.query<StopRow>(`${STOP_SELECT} where s.id = $1`, [id])).rows[0]!;
    });
    return row.tour_id ? toStop(row) : toUnassigned(row);
  });

  app.delete("/v1/orgs/:orgId/stops/:id", { preHandler: guards.requireTenant("stops.manage") }, async (req, reply) => {
    const { orgId, id } = IdParams.parse(req.params);
    const n = await db.asUser(claims(req), async (tx) => (await tx.query(`delete from stops where id = $1 and organization_id = $2 and status = 'pending'`, [id, orgId])).rowCount);
    if (!n) return problem(reply, 404, "not_found", "Open stop not found");
    return reply.status(204).send();
  });

  /** Move stops to a tour (from the unassigned list or another tour), or back to unassigned (tourId null). */
  app.post("/v1/orgs/:orgId/stops/assign", { preHandler: guards.requireTenant("stops.manage") }, async (req, reply) => {
    const { orgId } = OrgParams.parse(req.params);
    const b = parse(z.object({ stopIds: z.array(Uuid).min(1).max(500), tourId: Uuid.nullable() }), req.body, reply);
    if (!b) return;
    await db.asUser(claims(req), async (tx) => {
      let depotId: string | null = null;
      let next = 0;
      if (b.tourId) {
        const t = await loadTour(tx, orgId, b.tourId);
        if (t.status === "completed") throw new ApiError(422, "invalid_operation", "Cannot add stops to a completed tour");
        depotId = t.depot_id;
        next = (await tx.query<{ n: number }>(`select coalesce(max(sequence) + 1, 0)::int as n from stops where tour_id = $1`, [b.tourId])).rows[0]!.n;
      }
      for (const sid of b.stopIds) {
        const cur = (await tx.query<{ tour_id: string | null; depot_id: string | null; status: string; tour_depot: string | null }>(
          `select s.tour_id, s.depot_id, s.status, t.depot_id as tour_depot from stops s left join tours t on t.id = s.tour_id where s.id = $1 and s.organization_id = $2`,
          [sid, orgId],
        )).rows[0];
        if (!cur) throw new ApiError(404, "not_found", "Stop not found");
        if (cur.status !== "pending") throw new ApiError(422, "invalid_operation", "Only open stops can be moved");
        const fromDepot = cur.tour_depot ?? cur.depot_id;
        if (b.tourId && fromDepot && fromDepot !== depotId) throw new ApiError(422, "invalid_operation", "Stops can only be assigned to tours of the same depot");
        const upd = await tx.query(`update stops set tour_id = $2, depot_id = $3, sequence = $4 where id = $1`, [sid, b.tourId, b.tourId ? null : fromDepot, b.tourId ? next++ : 0]);
        if (!upd.rowCount) throw new ApiError(403, "forbidden", "You are not allowed to change this stop");
      }
    });
    return reply.status(204).send();
  });

  /** Status update by the assigned driver (or staff). */
  app.post("/v1/orgs/:orgId/stops/:id/status", { preHandler: guards.requireTenant("stops.update_status_own") }, async (req, reply) => {
    const { id } = IdParams.parse(req.params);
    const b = parse(z.object({ status: z.enum(["pending", "delivered", "picked_up", "failed", "skipped"]), notes: z.string().trim().max(1000).optional() }), req.body, reply);
    if (!b) return;
    const row = await db.asUser(claims(req), async (tx) => (await tx.query(`select (driver_set_stop_status($1, $2, $3)).id`, [id, b.status, b.notes ?? null])).rows[0]);
    return { id: row.id, status: b.status };
  });

  // ---------------------------------------------------------------- optimization
  app.post("/v1/orgs/:orgId/tours/:id/optimize", { preHandler: guards.requireTenant("tours.optimize") }, async (req, reply) => {
    const { orgId, id } = IdParams.parse(req.params);
    await requireOptimizationPlan(req, orgId);
    const input = await db.asUser(claims(req), async (tx) => {
      const tour = await loadTour(tx, orgId, id);
      if (tour.status === "completed") throw new ApiError(422, "invalid_operation", "Completed tours cannot be optimized");
      const tz = await orgTimeZone(tx, orgId);
      const v = await vehicleFor(tx, tour, nowInZone(tz).minute);
      const stops = (await tx.query<StopRow>(`${STOP_SELECT} where s.tour_id = $1 and s.status = 'pending' order by s.sequence`, [id])).rows;
      return { v, stops };
    });
    const located = input.stops.filter((s) => s.lat != null && s.lng != null);
    if (located.length === 0) return problem(reply, 422, "nothing_to_optimize", "This tour has no open stops with a map position");
    const request = OptimizeRequest.parse({
      vehicles: [
        {
          id,
          start: input.v.start,
          end: input.v.tour.end_lat != null && input.v.tour.end_lng != null ? { lat: input.v.tour.end_lat, lng: input.v.tour.end_lng } : input.v.depot,
          shiftStart: input.v.shiftStart,
          maxShiftMinutes: input.v.maxShift,
          capacity: input.v.capacity ?? undefined,
        },
      ],
      stops: located.map((s) => ({
        id: s.id,
        location: { lat: s.lat!, lng: s.lng! },
        serviceSeconds: s.service_seconds,
        timeWindow: s.tw_start_minute != null && s.tw_end_minute != null ? { start: s.tw_start_minute, end: s.tw_end_minute } : undefined,
        priority: s.priority,
        demand: Math.max(1, s.parcels?.length ?? 1),
      })),
      timeLimitSeconds: located.length > 60 ? 10 : 5,
    });
    const result: OptimizeResponse = await guards.callOptimizer(request, request.timeLimitSeconds ?? 5);
    const ordered = result.routes[0]?.visits.map((x) => x.stopId) ?? [];
    const meta = {
      engine: result.engine,
      matrixSource: result.matrixSource,
      unassignedStopIds: result.unassignedStopIds,
      unlocatedStopIds: input.stops.filter((s) => s.lat == null).map((s) => s.id),
      distanceMeters: result.routes[0]?.distanceMeters ?? 0,
      durationSeconds: result.routes[0]?.durationSeconds ?? 0,
    };
    const saved = await db.asUser(claims(req), async (tx) => {
      await tx.query(`select set_tour_sequence($1, $2::uuid[], $3::jsonb)`, [id, ordered, JSON.stringify(meta)]);
      return tourWithStops(tx, orgId, id);
    });
    return { ...saved, result: meta };
  });

  /**
   * Multi-vehicle planning: distribute the open stops of several tours (and
   * optionally the depot's unassigned stops) across those tours.
   */
  app.post("/v1/orgs/:orgId/plans/optimize", { preHandler: guards.requireTenant("tours.manage") }, async (req, reply) => {
    const { orgId } = OrgParams.parse(req.params);
    const b = parse(z.object({ tourIds: z.array(Uuid).min(1).max(50), includeUnassigned: z.boolean().default(true) }), req.body, reply);
    if (!b) return;
    await requireOptimizationPlan(req, orgId);
    const input = await db.asUser(claims(req), async (tx) => {
      const tz = await orgTimeZone(tx, orgId);
      const minute = nowInZone(tz).minute;
      const tours = [];
      for (const tid of b.tourIds) {
        const t = await loadTour(tx, orgId, tid);
        if (t.status === "completed") throw new ApiError(422, "invalid_operation", `${t.name} is completed`);
        tours.push(await vehicleFor(tx, t, minute));
      }
      const depots = new Set(tours.map((t) => t.tour.depot_id));
      if (depots.size > 1) throw new ApiError(422, "invalid_operation", "Plan optimization works on tours of one depot");
      const [depotId] = [...depots];
      const stops = (
        await tx.query<StopRow>(
          `${STOP_SELECT} where s.status = 'pending' and (s.tour_id = any($1::uuid[]) or ($2 and s.tour_id is null and s.depot_id = $3))`,
          [b.tourIds, b.includeUnassigned, depotId],
        )
      ).rows;
      return { tours, stops };
    });
    const located = input.stops.filter((s) => s.lat != null && s.lng != null);
    if (!located.length) return problem(reply, 422, "nothing_to_optimize", "No open stops with a map position");
    const request = OptimizeRequest.parse({
      vehicles: input.tours.map((v) => ({
        id: v.tour.id,
        start: v.start,
        end: v.depot,
        shiftStart: v.shiftStart,
        maxShiftMinutes: v.maxShift,
        capacity: v.capacity ?? undefined,
      })),
      stops: located.map((s) => ({
        id: s.id,
        location: { lat: s.lat!, lng: s.lng! },
        serviceSeconds: s.service_seconds,
        timeWindow: s.tw_start_minute != null && s.tw_end_minute != null ? { start: s.tw_start_minute, end: s.tw_end_minute } : undefined,
        priority: s.priority,
        demand: Math.max(1, s.parcels?.length ?? 1),
      })),
      timeLimitSeconds: 10,
    });
    const result = await guards.callOptimizer(request, 10);
    await db.asUser(claims(req), async (tx) => {
      for (const route of result.routes) {
        let seq = 1000;
        for (const v of route.visits) {
          await tx.query(`update stops set tour_id = $2, depot_id = null, sequence = $3 where id = $1 and (tour_id is distinct from $2)`, [v.stopId, route.vehicleId, seq++]);
        }
      }
      for (const route of result.routes) {
        await tx.query(`select set_tour_sequence($1, $2::uuid[], $3::jsonb)`, [
          route.vehicleId,
          route.visits.map((v) => v.stopId),
          JSON.stringify({ engine: result.engine, matrixSource: result.matrixSource, unassignedStopIds: result.unassignedStopIds, plan: true }),
        ]);
      }
    });
    return {
      routes: result.routes.map((r) => ({ tourId: r.vehicleId, stops: r.visits.length, distanceMeters: r.distanceMeters, durationSeconds: r.durationSeconds })),
      unassignedStopIds: result.unassignedStopIds,
      matrixSource: result.matrixSource,
    };
  });
}
