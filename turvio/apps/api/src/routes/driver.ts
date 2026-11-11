import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { parse, type RouteCtx } from "../http";
import { ApiError } from "../db";
import { STOP_SELECT, toDepot, toStop, toTour, type DepotRow, type StopRow, type TourRow } from "../data/dispatch";
import { driverSettingsOf } from "./execution";

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
      const settingsByOrg = new Map<string, Awaited<ReturnType<typeof driverSettingsOf>>>();
      for (const t of tours) {
        if (!settingsByOrg.has(t.organization_id)) settingsByOrg.set(t.organization_id, await driverSettingsOf(tx, t.organization_id));
        const settings = settingsByOrg.get(t.organization_id)!;
        const depot = (await tx.query<DepotRow>(`select * from depots where id = $1`, [t.depot_id])).rows[0];
        const stops = (await tx.query<StopRow>(`${STOP_SELECT} where s.tour_id = $1 order by s.sequence`, [t.id])).rows
          .map(toStop)
          // Recipient phone numbers only when the company shares them with drivers.
          .map((st) => (settings.showRecipientPhone ? st : { ...st, recipientPhone: undefined }));
        out.push({
          tour: toTour(t),
          organization: { id: t.organization_id, name: t.org_name, timeZone: t.time_zone, driverSettings: settings },
          depot: depot ? toDepot(depot) : null,
          driver: { id: t.driver_id, displayName: t.driver_name, maxShiftMinutes: t.max_shift_minutes },
          vehicle: t.vehicle_id ? { id: t.vehicle_id, label: t.vehicle_label, licensePlate: t.license_plate } : null,
          stops,
        });
      }
      // The company's calendar day: new personal routes must use it, not the phone's time zone
      // (otherwise a route created near midnight, or on a phone set to another zone, is dated a
      // day off and vanishes from this list).
      const org = (
        await tx.query<{ time_zone: string; today: string }>(
          `select o.time_zone, to_char((now() at time zone o.time_zone)::date, 'YYYY-MM-DD') as today
             from drivers d join organizations o on o.id = d.organization_id
            where d.user_id = auth.uid() and d.active
            order by d.created_at limit 1`,
        )
      ).rows[0];
      return { tours: out, timeZone: org?.time_zone ?? null, today: org?.today ?? null };
    });
  });

  /** Personal route: the driver creates their own tour (idempotent by client id). */
  app.post("/v1/me/tours", { preHandler: guards.authenticate }, async (req, reply) => {
    const b = parse(z.object({ id: z.string().uuid(), name: z.string().trim().min(1).max(120), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }), req.body, reply);
    if (!b) return;
    const tour = await db.asUser(guards.claims(req), async (tx) => (await tx.query<TourRow>(`select (driver_create_tour($1, $2, $3::date)).*`, [b.id, b.name, b.date])).rows[0]!);
    return reply.status(201).send({ tour: toTour(tour) });
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
