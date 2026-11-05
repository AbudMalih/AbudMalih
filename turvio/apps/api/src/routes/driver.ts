import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { parse, type RouteCtx } from "../http";
import { ApiError } from "../db";
import { STOP_SELECT, toDepot, toStop, toTour, type DepotRow, type StopRow, type TourRow } from "../data/dispatch";

/**
 * Endpoints for TURVIO Driver. Visibility is enforced by RLS: a driver sees
 * only tours that are assigned to their driver profile AND published.
 */
export function registerDriverRoutes(app: FastifyInstance, { deps, guards }: RouteCtx) {
  const db = deps.db;

  app.get("/v1/me/tours", { preHandler: guards.authenticate }, async (req, reply) => {
    const q = parse(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }), req.query, reply);
    if (!q) return;
    return db.asUser(guards.claims(req), async (tx) => {
      const tours = (
        await tx.query<TourRow & { org_name: string; time_zone: string; vehicle_label: string | null; license_plate: string | null; driver_name: string; max_shift_minutes: number }>(
          `select t.*, o.name as org_name, o.time_zone, v.label as vehicle_label, v.license_plate, d.display_name as driver_name, d.max_shift_minutes
             from tours t
             join drivers d on d.id = t.driver_id and d.user_id = auth.uid()
             join organizations o on o.id = t.organization_id
             left join vehicles v on v.id = t.vehicle_id
            where t.published_at is not null
              and t.tour_date = coalesce($1::date, (now() at time zone o.time_zone)::date)
            order by t.planned_start_minute`,
          [q.date ?? null],
        )
      ).rows;
      const out = [];
      for (const t of tours) {
        const depot = (await tx.query<DepotRow>(`select * from depots where id = $1`, [t.depot_id])).rows[0];
        const stops = (await tx.query<StopRow>(`${STOP_SELECT} where s.tour_id = $1 order by s.sequence`, [t.id])).rows.map(toStop);
        out.push({
          tour: toTour(t),
          organization: { id: t.organization_id, name: t.org_name, timeZone: t.time_zone },
          depot: depot ? toDepot(depot) : null,
          driver: { id: t.driver_id, displayName: t.driver_name, maxShiftMinutes: t.max_shift_minutes },
          vehicle: t.vehicle_id ? { id: t.vehicle_id, label: t.vehicle_label, licensePlate: t.license_plate } : null,
          stops,
        });
      }
      return { tours: out };
    });
  });

  /** Lets the assigned driver re-order the remaining stops of a published tour. */
  app.post("/v1/me/tours/:id/sequence", { preHandler: guards.authenticate }, async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const b = parse(z.object({ stopIds: z.array(z.string().uuid()).min(1).max(1000) }), req.body, reply);
    if (!b) return;
    await db.asUser(guards.claims(req), async (tx) => {
      const r = await tx.query(`select set_tour_sequence($1, $2::uuid[])`, [id, b.stopIds]);
      if (!r.rowCount) throw new ApiError(404, "not_found", "Tour not found");
    });
    return reply.status(204).send();
  });
}
