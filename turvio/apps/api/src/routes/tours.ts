import { NewStopInput, OptimizeRequest, StopStatus, TourPlace, haversineMeters, isSubscriptionUsable, nowInZone, type OptimizeResponse } from "@turvio/shared";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { OrgParams, parse, problem, type RouteCtx } from "../http";
import { ApiError, type Tx } from "../db";
import { STOP_SELECT, orgTimeZone, toStop, toTour, toUnassigned, tourEndOf, tourStartOf, type StopRow, type TourRow } from "../data/dispatch";

const Uuid = z.string().uuid();
const IdParams = OrgParams.extend({ id: Uuid });
const Minute = z.number().int().min(0).max(1439);

/** Where the tour ends: its depot (default), a chosen address, or its last stop (no return trip). */
const TourEnd = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("depot") }),
  z.object({ mode: z.literal("last_stop") }),
  TourPlace.extend({ mode: z.literal("address") }),
]);
type TourEnd = z.infer<typeof TourEnd>;

const CreateTour = z.object({
  depotId: Uuid,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  name: z.string().trim().min(1).max(120).optional(),
  plannedStartMinute: Minute.default(480),
  driverId: Uuid.nullable().default(null),
  vehicleId: Uuid.nullable().default(null),
  /** Own start address instead of the depot (null/absent = depot). */
  start: TourPlace.nullable().optional(),
  end: TourEnd.optional(),
});

const UpdateTour = z.object({
  expectedVersion: z.number().int().min(1),
  name: z.string().trim().min(1).max(120).optional(),
  plannedStartMinute: Minute.optional(),
  driverId: Uuid.nullable().optional(),
  vehicleId: Uuid.nullable().optional(),
  /** null = back to the depot; absent = unchanged. */
  start: TourPlace.nullable().optional(),
  end: TourEnd.optional(),
});

/** Farther than this from the tour's depot is almost always a typo or swapped latitude/longitude. */
const MAX_PLACE_KM = 1000;

type Place = { lat: number; lng: number };

/** Rejects start/end points that cannot be meant (0,0 or far away from the depot). */
async function assertPlaces(tx: Tx, orgId: string, depotId: string, places: { what: "start" | "end"; p: Place | null | undefined }[]) {
  const given = places.filter((x): x is { what: "start" | "end"; p: Place } => !!x.p);
  if (!given.length) return;
  const depot = (await tx.query<Place>(`select lat, lng from depots where id = $1 and organization_id = $2`, [depotId, orgId])).rows[0];
  if (!depot) throw new ApiError(404, "not_found", "Depot not found");
  for (const { what, p } of given) {
    if (p.lat === 0 && p.lng === 0) throw new ApiError(422, "invalid_location", `The ${what} address has no real position (0, 0)`);
    if (haversineMeters(depot, p) > MAX_PLACE_KM * 1000)
      throw new ApiError(422, "invalid_location", `The ${what} address is more than ${MAX_PLACE_KM} km from the depot – check the address (latitude and longitude swapped?)`);
  }
}

const endColumns = (e: TourEnd) =>
  e.mode === "address" ? { mode: "address", lat: e.lat, lng: e.lng, label: e.label ?? null } : { mode: e.mode, lat: null, lng: null, label: null };

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
  address: z
    .object({ street: z.string().trim().min(1).max(200), houseNumber: z.string().trim().max(20).nullable().optional(), postalCode: z.string().trim().regex(/^[0-9A-Za-z -]{3,10}$/), city: z.string().trim().min(1).max(100) })
    .optional(),
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
    if (s.id) {
      // Offline retry of a stop the client already created: no duplicate.
      const existing = (await tx.query<{ tour_id: string | null }>(`select tour_id from stops where id = $1`, [s.id])).rows[0];
      if (existing) {
        if (existing.tour_id !== (target.tourId ?? null)) throw new ApiError(409, "conflict", "A different stop with this id already exists");
        // Same stop again: add parcels that are not there yet (parcels grouped onto an existing address).
        for (const tn of s.trackingNumbers) {
          await tx.query(
            `insert into parcels (organization_id, stop_id, tracking_number, recipient_name)
             select $1, $2, $3, $4 where not exists (select 1 from parcels where stop_id = $2 and upper(tracking_number) = upper($3))`,
            [orgId, s.id, tn, s.recipientName ?? null],
          );
        }
        ids.push(s.id);
        continue;
      }
    }
    const { rows } = await tx.query<{ id: string }>(
      `insert into stops (id, organization_id, tour_id, depot_id, type, sequence, recipient_name, street, house_number, postal_code, city, country_code,
                          lat, lng, tw_start_minute, tw_end_minute, service_seconds, priority, notes, location_source, recipient_phone)
       values (coalesce($19::uuid, gen_random_uuid()), $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$20,$21) returning id`,
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
        s.id ?? null,
        s.location ? (s.locationSource ?? "manual_pin") : null,
        s.recipientPhone ?? null,
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
  /** Where `start` comes from: live GPS (fresh), last completed stop, tour start or depot. */
  startSource: "gps" | "last_stop" | "tour" | "depot";
  shiftStart: number;
}

/** Solver time budget: 5 s up to 60 stops, 10 s up to 150, 15 s above (large tours gain from it). */
export function optimizeSeconds(stops: number): number {
  return stops > 150 ? 15 : stops > 60 ? 10 : 5;
}

/** A live position younger than this is used as the origin of the remaining route. */
export const FRESH_GPS_SECONDS = 120;

/** Build optimizer vehicles for saved tours (current position = last completed stop; no GPS). */
async function vehicleFor(tx: Tx, tour: TourRow, nowMinute: number): Promise<VehicleInputRow> {
  const depot = (await tx.query<{ lat: number; lng: number }>(`select lat, lng from depots where id = $1`, [tour.depot_id])).rows[0]!;
  const driver = tour.driver_id ? (await tx.query<{ max_shift_minutes: number }>(`select max_shift_minutes from drivers where id = $1`, [tour.driver_id])).rows[0] : undefined;
  const vehicle = tour.vehicle_id ? (await tx.query<{ capacity_parcels: number | null }>(`select capacity_parcels from vehicles where id = $1`, [tour.vehicle_id])).rows[0] : undefined;
  const last = (
    await tx.query<{ lat: number; lng: number }>(`select lat, lng from stops where tour_id = $1 and status not in ('pending', 'in_progress') and lat is not null order by sequence desc limit 1`, [tour.id])
  ).rows[0];
  const running = tour.status === "in_progress" || tour.status === "paused";
  // Live tracking (if switched on): the vehicle's real position is the best origin.
  const gps = tour.status === "in_progress"
    ? (
        await tx.query<{ lat: number; lng: number }>(
          `select lat, lng from driver_positions where tour_id = $1 and recorded_at > now() - make_interval(secs => $2)`,
          [tour.id, FRESH_GPS_SECONDS],
        )
      ).rows[0]
    : undefined;
  const tourStart = tour.start_lat != null && tour.start_lng != null ? tourStartOf(tour, depot) : null;
  return {
    tour,
    depot,
    maxShift: driver?.max_shift_minutes ?? 480,
    capacity: vehicle?.capacity_parcels ?? null,
    start: gps ?? (running && last ? last : (tourStart ?? depot)),
    startSource: gps ? "gps" : running && last ? "last_stop" : tourStart ? "tour" : "depot",
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
      await assertPlaces(tx, orgId, b.depotId, [{ what: "start", p: b.start }, { what: "end", p: b.end?.mode === "address" ? b.end : null }]);
      const end = endColumns(b.end ?? { mode: "depot" });
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
          `insert into tours (organization_id, depot_id, name, tour_date, planned_start_minute, driver_id, vehicle_id,
                              start_lat, start_lng, start_label, end_mode, end_lat, end_lng, end_label)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) returning *`,
          [orgId, b.depotId, name, b.date, b.plannedStartMinute, b.driverId, b.vehicleId, b.start?.lat ?? null, b.start?.lng ?? null, b.start?.label ?? null, end.mode, end.lat, end.lng, end.label],
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
      await assertPlaces(tx, orgId, cur.depot_id, [{ what: "start", p: b.start }, { what: "end", p: b.end?.mode === "address" ? b.end : null }]);
      const end = b.end ? endColumns(b.end) : null;
      const { rows } = await tx.query<TourRow>(
        `update tours set
           name = coalesce($4, name),
           planned_start_minute = coalesce($5, planned_start_minute),
           driver_id = case when $6 then $7::uuid else driver_id end,
           vehicle_id = case when $8 then $9::uuid else vehicle_id end,
           start_lat = case when $10 then $11::float8 else start_lat end,
           start_lng = case when $10 then $12::float8 else start_lng end,
           start_label = case when $10 then $13::text else start_label end,
           end_mode = coalesce($14::text, end_mode),
           end_lat = case when $14::text is not null then $15::float8 else end_lat end,
           end_lng = case when $14::text is not null then $16::float8 else end_lng end,
           end_label = case when $14::text is not null then $17::text else end_label end
         where id = $1 and organization_id = $2 and version = $3 returning *`,
        [
          id, orgId, b.expectedVersion, b.name ?? null, b.plannedStartMinute ?? null, b.driverId !== undefined, b.driverId ?? null, b.vehicleId !== undefined, b.vehicleId ?? null,
          b.start !== undefined, b.start?.lat ?? null, b.start?.lng ?? null, b.start?.label ?? null,
          end?.mode ?? null, end?.lat ?? null, end?.lng ?? null, end?.label ?? null,
        ],
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
         select 'stop' as source, case when e.kind = 'note' then 'note' else e.status::text end as kind,
                jsonb_build_object('stopId', e.stop_id, 'notes', e.notes, 'failureReason', e.failure_reason, 'applied', e.applied), e.created_at
           from stop_events e join stops s on s.id = e.stop_id where s.tour_id = $1
         union all
         select 'stop' as source, 'proof_' || f.kind::text as kind, jsonb_build_object('stopId', f.stop_id, 'recipientName', f.recipient_name), f.created_at
           from proofs f join stops s on s.id = f.stop_id where s.tour_id = $1
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
      if (b.address) {
        // A changed address without new coordinates loses the old ones (trigger stops_address_guard).
        add("street = ?", b.address.street);
        add("house_number = ?", b.address.houseNumber ?? null);
        add("postal_code = ?", b.address.postalCode);
        add("city = ?", b.address.city);
      }
      if (b.location !== undefined) {
        add("lat = ?", b.location?.lat ?? null);
        add("lng = ?", b.location?.lng ?? null);
        add("location_source = ?", b.location ? "dispatch" : null);
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
        if (cur.status !== "pending" && cur.status !== "in_progress") throw new ApiError(422, "invalid_operation", "Only open stops can be moved");
        const fromDepot = cur.tour_depot ?? cur.depot_id;
        if (b.tourId && fromDepot && fromDepot !== depotId) throw new ApiError(422, "invalid_operation", "Stops can only be assigned to tours of the same depot");
        const upd = await tx.query(`update stops set tour_id = $2, depot_id = $3, sequence = $4 where id = $1`, [sid, b.tourId, b.tourId ? null : fromDepot, b.tourId ? next++ : 0]);
        if (!upd.rowCount) throw new ApiError(403, "forbidden", "You are not allowed to change this stop");
      }
    });
    return reply.status(204).send();
  });

  /** Status update by the assigned driver (or staff). Idempotent via clientEventId; stale offline updates are recorded but not applied. */
  app.post("/v1/orgs/:orgId/stops/:id/status", { preHandler: guards.requireTenant("stops.update_status_own") }, async (req, reply) => {
    const { id } = IdParams.parse(req.params);
    const b = parse(
      z.object({
        status: StopStatus,
        notes: z.string().trim().max(1000).optional(),
        failureReason: z.string().regex(/^[a-z0-9_]{2,40}$/).optional(),
        clientEventId: Uuid.optional(),
        occurredAt: z.iso.datetime().optional(),
      }),
      req.body,
      reply,
    );
    if (!b) return;
    const row = await db.asUser(claims(req), async (tx) => {
      await tx.query(`select driver_set_stop_status($1, $2, $3, $4, $5, $6)`, [id, b.status, b.notes ?? null, b.failureReason ?? null, b.clientEventId ?? null, b.occurredAt ?? null]);
      return (await tx.query<StopRow>(`${STOP_SELECT} where s.id = $1`, [id])).rows[0]!;
    });
    return { id: row.id, status: row.status, applied: row.status === b.status, stop: toStop(row) };
  });

  // ---------------------------------------------------------------- optimization
  /**
   * Optimize the open stops of a saved tour.
   * Options (driver app): start = current device position (only if the driver chose to use it),
   * end = "depot" | "none" | point; locked stops keep their position in the order.
   */
  app.post("/v1/orgs/:orgId/tours/:id/optimize", { preHandler: guards.requireTenant("tours.optimize") }, async (req, reply) => {
    const { orgId, id } = IdParams.parse(req.params);
    const opts = parse(
      z
        .object({
          start: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }).optional(),
          end: z.union([z.enum(["depot", "none"]), z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) })]).optional(),
          respectLocks: z.boolean().default(true),
          /** false: return the proposed order and figures without changing the tour (preview). */
          apply: z.boolean().default(true),
          /** Reject with 409 when the tour changed since the caller looked at it. */
          expectedVersion: z.number().int().min(0).optional(),
          /**
           * A tour that is already being driven is only re-sequenced with explicit confirmation
           * (the driver's own Optimize button, or a dispatcher who confirmed the preview).
           */
          confirmActive: z.boolean().default(false),
        })
        .default({ respectLocks: true, apply: true, confirmActive: false }),
      req.body ?? {},
      reply,
    );
    if (!opts) return;
    await requireOptimizationPlan(req, orgId);
    const isDriver = req.membership!.role === "driver";
    const input = await db.asUser(claims(req), async (tx) => {
      const tour = await loadTour(tx, orgId, id);
      if (tour.status === "completed") throw new ApiError(422, "invalid_operation", "Completed tours cannot be optimized");
      if (opts.expectedVersion != null && tour.version !== opts.expectedVersion)
        throw new ApiError(409, "version_conflict", "The tour was changed by someone else. Reload and try again.");
      // The assigned driver pressing Optimize is the confirmation; anyone else must confirm explicitly.
      if (opts.apply && !isDriver && !opts.confirmActive && (tour.status === "in_progress" || tour.status === "paused"))
        throw new ApiError(409, "active_tour_confirmation_required", "This tour is being driven. Preview the new order and confirm it before it is applied.");
      const tz = await orgTimeZone(tx, orgId);
      const v = await vehicleFor(tx, tour, nowInZone(tz).minute);
      const stops = (await tx.query<StopRow>(`${STOP_SELECT} where s.tour_id = $1 and s.status in ('pending', 'in_progress') order by s.sequence`, [id])).rows;
      return { v, stops };
    });
    const locked = opts.respectLocks ? input.stops.filter((s) => s.locked) : [];
    const located = input.stops.filter((s) => s.lat != null && s.lng != null && !locked.includes(s));
    if (located.length === 0) return problem(reply, 422, "nothing_to_optimize", "This tour has no open, unlocked stops with a map position");
    // Explicit choice in the request, else what the tour is planned with (undefined = last stop).
    const end = opts.end === "none" ? undefined : opts.end === "depot" ? input.v.depot : opts.end ? opts.end : tourEndOf(input.v.tour, input.v.depot);
    const request = OptimizeRequest.parse({
      vehicles: [
        {
          id,
          start: opts.start ?? input.v.start,
          end,
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
      // Solver budget by size (measured, docs/ROUTE_OPTIMIZATION.md); the HTTP call allows +30 s.
      timeLimitSeconds: optimizeSeconds(located.length),
      // One driver's own tour: every parcel stays on the route; overtime and late deadlines are
      // reported instead of stops silently dropping off (1 min overtime ≈ 10 min driving).
      overtimePenaltyPerMinute: 600,
    });
    const result: OptimizeResponse = await guards.callOptimizer(request, request.timeLimitSeconds ?? 5);
    const optimized = result.routes[0]?.visits.map((x) => x.stopId) ?? [];
    // Locked stops keep their slot among the open stops; the optimized order fills the other slots.
    const free = [...optimized, ...input.stops.filter((s) => !locked.includes(s) && !optimized.includes(s.id)).map((s) => s.id)];
    const ordered = input.stops.map((s) => (locked.includes(s) ? s.id : free.shift()!)).filter(Boolean);
    const meta = {
      engine: result.engine,
      lockedStopIds: locked.map((s) => s.id),
      startSource: opts.start ? "device" : input.v.startSource,
      matrixSource: result.matrixSource,
      unassignedStopIds: result.unassignedStopIds,
      unlocatedStopIds: input.stops.filter((s) => s.lat == null).map((s) => s.id),
      distanceMeters: result.routes[0]?.distanceMeters ?? 0,
      durationSeconds: result.routes[0]?.durationSeconds ?? 0,
      driveSeconds: result.routes[0]?.driveSeconds ?? null,
      waitSeconds: result.routes[0]?.waitSeconds ?? null,
      endMinute: result.routes[0]?.endMinute ?? null,
      overtimeMinutes: result.routes[0]?.overtimeMinutes ?? 0,
      /** Every deadline missed, overtime and stop that could not be routed – never hidden. */
      violations: result.violations ?? [],
      solveSeconds: result.solveSeconds ?? null,
      optimizedAt: new Date().toISOString(),
    };
    if (!opts.apply) {
      const current = await db.asUser(claims(req), async (tx) => tourWithStops(tx, orgId, id));
      return { ...current, preview: true, proposedStopIds: ordered, result: meta };
    }
    const saved = await db.asUser(claims(req), async (tx) => {
      if (opts.expectedVersion != null) {
        // Re-check inside the writing transaction (set_tour_sequence locks the tour row).
        const v = (await tx.query<{ version: number }>(`select version from tours where id = $1 for update`, [id])).rows[0];
        if (v && v.version !== opts.expectedVersion) throw new ApiError(409, "version_conflict", "The tour was changed by someone else. Reload and try again.");
      }
      await tx.query(`select set_tour_sequence($1, $2::uuid[], $3::jsonb)`, [id, ordered, JSON.stringify(meta)]);
      // An explicit end choice is kept for the tour, so its road route and live ETA end there too.
      if (opts.end) {
        const e = opts.end === "none" ? { mode: "last_stop", lat: null, lng: null } : opts.end === "depot" ? { mode: "depot", lat: null, lng: null } : { mode: "address", ...opts.end };
        await tx.query(`select set_tour_end($1, $2, $3, $4)`, [id, e.mode, e.lat, e.lng]);
      }
      return tourWithStops(tx, orgId, id);
    });
    return { ...saved, preview: false, result: meta };
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
          `${STOP_SELECT} where s.status in ('pending', 'in_progress') and (s.tour_id = any($1::uuid[]) or ($2 and s.tour_id is null and s.depot_id = $3))`,
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
        end: tourEndOf(v.tour, v.depot),
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
      timeLimitSeconds: optimizeSeconds(located.length),
    });
    const result = await guards.callOptimizer(request, request.timeLimitSeconds ?? 10);
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
