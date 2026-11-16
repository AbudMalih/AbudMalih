import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { toCsv, toXlsx, type Cell } from "@turvio/shared";
import { OrgParams, parse, type RouteCtx } from "../http";
import { ApiError, type Tx } from "../db";
import { rangeOf } from "./lifecycle";

/*
 * Analytics (Phase B): operational figures computed live from stored records only. Every number
 * comes with its definition (KPI_DEFINITIONS); a figure the data cannot support is not reported.
 *
 * Scope: tours dated in the period (tour_date, the company's calendar day), archived tours
 * included, in the locations the caller may access (RLS on tours and stops). Stops count on the
 * tour they are on; stops Dispatch returned to the unassigned pool are no longer on a tour.
 */

export const KPI_DEFINITIONS = {
  stops: "Stops on tours dated in the period (every status, including cancelled).",
  delivered: "Stops whose outcome is delivered (delivery stops).",
  pickedUp: "Stops whose outcome is picked up (pickup stops).",
  failed: "Stops with outcome failed.",
  attempted: "Stops with outcome attempted (delivery attempt, not delivered).",
  rescheduled: "Stops with outcome rescheduled.",
  returned: "Stops with outcome returned to sender.",
  skipped: "Stops the driver skipped.",
  cancelled: "Stops Dispatch cancelled (with a reason). Not counted as processed.",
  open: "Stops still pending or in progress (on past days: never resolved).",
  processed: "Stops with an outcome: delivered + picked up + failed + attempted + rescheduled + returned + skipped.",
  successRate: "(Delivered + picked up) ÷ processed stops. Open and cancelled stops are excluded.",
  tours: "Tours dated in the period (including archived ones).",
  toursStarted: "Tours that were started by the driver (a start time is recorded).",
  completionRate: "Completed tours ÷ started tours.",
  onTimeStartRate: "Started tours whose actual start was no later than the planned start time + 15 minutes ÷ started tours.",
  avgTourMinutes: "Average of (finish time − start time) over completed tours, pauses included.",
  activeHours: "Sum of (finish time − start time) over completed tours, pauses included.",
  stopsPerTour: "Processed stops ÷ tours that have at least one stop.",
  stopsPerActiveHour: "Processed stops on completed tours ÷ active hours of those tours.",
  avgIntervalMinutes:
    "Average time between two consecutive recorded outcomes on the same tour (driving, parking and handover together). This is not the service time at a stop, which is not recorded.",
  plannedDistanceKm:
    "Road distance of the route from the last optimization before the tour started, for tours where one exists (road network, single-tour optimization). Coverage is reported; actual driven distance is not recorded for all drivers and is not shown.",
  plannedMinutes: "Route duration from the same optimization, same coverage as plannedDistanceKm.",
} as const;

const Query = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
    depotId: z.string().uuid().optional(),
    driverId: z.string().uuid().optional(),
    granularity: z.enum(["day", "week", "month"]).optional(),
  })
  .refine((q) => [q.date, q.month, q.from ?? q.to].filter(Boolean).length <= 1, { message: "Give one of date, month or from/to" });
type Query = z.infer<typeof Query>;

/** On-time tolerance for tour starts (minutes). */
export const ON_TIME_TOLERANCE_MINUTES = 15;

// Tours of the period, filtered. $1 org, $2 from, $3 to, $4 depot, $5 driver.
const TOURS = `
  select t.*, o.time_zone
    from public.tours t join public.organizations o on o.id = t.organization_id
   where t.organization_id = $1 and t.tour_date between $2::date and $3::date
     and ($4::uuid is null or t.depot_id = $4) and ($5::uuid is null or t.driver_id = $5)`;

const STOP_COUNTS = `
  count(*)::int as stops,
  count(*) filter (where s.status = 'delivered')::int as delivered,
  count(*) filter (where s.status = 'picked_up')::int as picked_up,
  count(*) filter (where s.status = 'failed')::int as failed,
  count(*) filter (where s.status = 'attempted')::int as attempted,
  count(*) filter (where s.status = 'rescheduled')::int as rescheduled,
  count(*) filter (where s.status = 'returned')::int as returned,
  count(*) filter (where s.status = 'skipped')::int as skipped,
  count(*) filter (where s.status = 'cancelled')::int as cancelled,
  count(*) filter (where s.status in ('pending', 'in_progress'))::int as open`;

// Tour-level figures over a set "t" (with time_zone).
const TOUR_FIGURES = `
  count(*)::int as tours,
  count(*) filter (where t.status = 'planned')::int as planned,
  count(*) filter (where t.status in ('in_progress', 'paused'))::int as running,
  count(*) filter (where t.status = 'completed')::int as completed,
  count(*) filter (where t.status = 'cancelled')::int as cancelled_tours,
  count(*) filter (where t.archived_at is not null)::int as archived,
  count(*) filter (where t.started_at is not null)::int as started,
  count(*) filter (where t.status = 'completed' and t.started_at is not null)::int as completed_started,
  count(*) filter (where t.started_at is not null and t.started_at <= ((t.tour_date + make_interval(mins => t.planned_start_minute)) at time zone t.time_zone) + make_interval(mins => ${ON_TIME_TOLERANCE_MINUTES}))::int as on_time,
  avg(extract(epoch from t.finished_at - t.started_at) / 60) filter (where t.status = 'completed' and t.started_at is not null and t.finished_at > t.started_at) as avg_tour_minutes,
  coalesce(sum(extract(epoch from t.finished_at - t.started_at) / 3600) filter (where t.status = 'completed' and t.started_at is not null and t.finished_at > t.started_at), 0) as active_hours,
  count(*) filter (where ${plannedUsable("t")})::int as planned_covered,
  coalesce(sum((t.optimization ->> 'distanceMeters')::numeric / 1000) filter (where ${plannedUsable("t")}), 0) as planned_km,
  coalesce(sum((t.optimization ->> 'durationSeconds')::numeric / 60) filter (where ${plannedUsable("t")}), 0) as planned_minutes`;

/** Planned figures only from a road-network single-tour optimization made before the start. */
function plannedUsable(t: string) {
  return `(${t}.optimization ? 'distanceMeters' and coalesce(${t}.optimization ->> 'matrixSource', '') not in ('', 'haversine_estimate')
           and ${t}.optimization ->> 'plan' is null and (${t}.started_at is null or ${t}.optimized_at <= ${t}.started_at))`;
}

type Num = number | string | null;
const n = (v: Num) => (v === null ? null : Number(v));
const ratio = (a: number, b: number) => (b > 0 ? a / b : null);
const round = (v: number | null, d = 1) => (v === null ? null : Math.round(v * 10 ** d) / 10 ** d);

interface StopCountsRow {
  stops: number;
  delivered: number;
  picked_up: number;
  failed: number;
  attempted: number;
  rescheduled: number;
  returned: number;
  skipped: number;
  cancelled: number;
  open: number;
}
interface TourFiguresRow {
  tours: number;
  planned: number;
  running: number;
  completed: number;
  cancelled_tours: number;
  archived: number;
  started: number;
  completed_started: number;
  on_time: number;
  avg_tour_minutes: Num;
  active_hours: Num;
  planned_covered: number;
  planned_km: Num;
  planned_minutes: Num;
}

function stopFigures(r: StopCountsRow) {
  const success = r.delivered + r.picked_up;
  const processed = success + r.failed + r.attempted + r.rescheduled + r.returned + r.skipped;
  return {
    stops: r.stops,
    delivered: r.delivered,
    pickedUp: r.picked_up,
    failed: r.failed,
    attempted: r.attempted,
    rescheduled: r.rescheduled,
    returned: r.returned,
    skipped: r.skipped,
    cancelled: r.cancelled,
    open: r.open,
    processed,
    successRate: round(ratio(success, processed), 4),
  };
}

function tourFigures(r: TourFiguresRow, processedOnCompleted: number, toursWithStops: number, processed: number) {
  const activeHours = n(r.active_hours) ?? 0;
  return {
    tours: r.tours,
    byStatus: { planned: r.planned, running: r.running, completed: r.completed, cancelled: r.cancelled_tours },
    archived: r.archived,
    toursStarted: r.started,
    completionRate: round(ratio(r.completed_started, r.started), 4),
    onTimeStartRate: round(ratio(r.on_time, r.started), 4),
    avgTourMinutes: round(n(r.avg_tour_minutes)),
    activeHours: round(activeHours, 2),
    stopsPerTour: round(ratio(processed, toursWithStops), 2),
    stopsPerActiveHour: round(ratio(processedOnCompleted, activeHours), 2),
    planned: { coveredTours: r.planned_covered, plannedDistanceKm: r.planned_covered ? round(n(r.planned_km)) : null, plannedMinutes: r.planned_covered ? round(n(r.planned_minutes)) : null },
  };
}

/** Days between two ISO dates, inclusive. */
const spanDays = (from: string, to: string) => (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000 + 1;
const shift = (d: string, days: number) => new Date(Date.parse(`${d}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

type Period = { cur: boolean };
/**
 * Everything the summary shows, for the period and the previous period of the same length, in
 * ONE statement: the visible tours and their stops are read once (materialized) – row-level
 * security is evaluated once instead of once per figure.
 * $1 org, $2 previous-period start, $3 end, $4 depot, $5 driver, $6 current-period start.
 */
async function summaryData(tx: Tx, p: unknown[], granularity: "day" | "week" | "month") {
  const { rows } = await tx.query<{
    tours: (TourFiguresRow & Period)[] | null;
    stops: (StopCountsRow & Period)[] | null;
    extra: ({ on_completed: number; tours_with_stops: number } & Period)[] | null;
    gaps: ({ avg_interval: Num } & Period)[] | null;
    trend: (StopCountsRow & { bucket: string; tours: number; completed: number })[] | null;
    reasons: { reason: string | null; status: string; count: number }[] | null;
  }>(
    `with t as materialized (${TOURS}),
          s as materialized (
            select s.id, s.tour_id, s.status, s.completed_at, s.failure_reason, t.status as tour_status, t.tour_date >= $6::date as cur
              from t join public.stops s on s.tour_id = t.id)
     select
       (select json_agg(x) from (select t.tour_date >= $6::date as cur, ${TOUR_FIGURES} from t group by 1) x) as tours,
       (select json_agg(x) from (select s.cur, ${STOP_COUNTS} from s group by 1) x) as stops,
       (select json_agg(x) from (
          select s.cur,
                 count(*) filter (where s.tour_status = 'completed' and s.status not in ('pending', 'in_progress', 'cancelled'))::int as on_completed,
                 count(distinct s.tour_id)::int as tours_with_stops
            from s group by 1) x) as extra,
       (select json_agg(x) from (
          select g.cur, avg(g.gap) as avg_interval from (
            select s.cur, extract(epoch from s.completed_at - lag(s.completed_at) over (partition by s.tour_id order by s.completed_at)) / 60 as gap
              from s where s.completed_at is not null and s.status not in ('pending', 'in_progress', 'cancelled')) g
           where g.gap is not null group by 1) x) as gaps,
       (select json_agg(x order by x.bucket) from (
          select b.bucket, count(distinct b.id)::int as tours, count(distinct b.id) filter (where b.status = 'completed')::int as completed,
                 ${STOP_COUNTS.replace(/count\(\*\)/g, "count(s.id)")}
            from (select t.id, t.status, to_char(date_trunc('${granularity}', t.tour_date::timestamp), 'YYYY-MM-DD') as bucket from t where t.tour_date >= $6::date) b
            left join s on s.tour_id = b.id
           group by b.bucket) x) as trend,
       (select json_agg(x order by x.count desc, x.reason) from (
          select s.failure_reason as reason, s.status::text as status, count(*)::int as count
            from s where s.cur and s.status in ('failed', 'attempted', 'rescheduled', 'returned') group by 1, 2) x) as reasons`,
    p,
  );
  const r = rows[0]!;
  const ZERO_STOPS: StopCountsRow = { stops: 0, delivered: 0, picked_up: 0, failed: 0, attempted: 0, rescheduled: 0, returned: 0, skipped: 0, cancelled: 0, open: 0 };
  const ZERO_TOURS: TourFiguresRow = { tours: 0, planned: 0, running: 0, completed: 0, cancelled_tours: 0, archived: 0, started: 0, completed_started: 0, on_time: 0, avg_tour_minutes: null, active_hours: 0, planned_covered: 0, planned_km: 0, planned_minutes: 0 };
  const period = (cur: boolean) => {
    const st = r.stops?.find((x) => x.cur === cur) ?? ZERO_STOPS;
    const tf = r.tours?.find((x) => x.cur === cur) ?? ZERO_TOURS;
    const ex = r.extra?.find((x) => x.cur === cur) ?? { on_completed: 0, tours_with_stops: 0 };
    const sf = stopFigures(st);
    return {
      stops: sf,
      tours: tourFigures(tf, ex.on_completed, ex.tours_with_stops, sf.processed),
      avgIntervalMinutes: round(n(r.gaps?.find((x) => x.cur === cur)?.avg_interval ?? null)),
    };
  };
  return {
    current: period(true),
    previous: period(false),
    trend: (r.trend ?? []).map((x) => ({ bucket: x.bucket, tours: x.tours, toursCompleted: x.completed, ...stopFigures(x) })),
    failureReasons: r.reasons ?? [],
  };
}

async function analyticsContext(tx: Tx, orgId: string, q: Query) {
  const today = (await tx.query<{ d: string; tz: string }>(`select to_char((now() at time zone time_zone)::date, 'YYYY-MM-DD') as d, time_zone as tz from public.organizations where id = $1`, [orgId])).rows[0];
  if (!today) throw new ApiError(404, "not_found", "Organization not found");
  const range = rangeOf(q, today.d);
  const days = spanDays(range.from, range.to);
  const granularity = q.granularity ?? (days <= 31 ? "day" : days <= 120 ? "week" : "month");
  return { range, days, granularity, timeZone: today.tz, params: [orgId, range.from, range.to, q.depotId ?? null, q.driverId ?? null] as unknown[] };
}

async function driverTable(tx: Tx, p: unknown[]) {
  const { rows } = await tx.query<StopCountsRow & TourFiguresRow & { driver_id: string | null; name: string | null; on_completed: number; tours_with_stops: number }>(
    `with t as materialized (${TOURS}),
          st as (select t.driver_id, ${STOP_COUNTS},
                        count(*) filter (where t.status = 'completed' and s.status not in ('pending', 'in_progress', 'cancelled'))::int as on_completed,
                        count(distinct s.tour_id)::int as tours_with_stops
                   from t join public.stops s on s.tour_id = t.id group by t.driver_id),
          tf as (select t.driver_id, ${TOUR_FIGURES} from t group by t.driver_id)
     select tf.*, coalesce(st.stops, 0) as stops, coalesce(st.delivered, 0) as delivered, coalesce(st.picked_up, 0) as picked_up,
            coalesce(st.failed, 0) as failed, coalesce(st.attempted, 0) as attempted, coalesce(st.rescheduled, 0) as rescheduled,
            coalesce(st.returned, 0) as returned, coalesce(st.skipped, 0) as skipped, coalesce(st.cancelled, 0) as cancelled,
            coalesce(st.open, 0) as open, coalesce(st.on_completed, 0) as on_completed, coalesce(st.tours_with_stops, 0) as tours_with_stops,
            d.display_name as name
       from tf left join st on st.driver_id is not distinct from tf.driver_id
       left join public.drivers d on d.id = tf.driver_id
      order by d.display_name nulls last`,
    p,
  );
  return rows.map((r) => {
    const sf = stopFigures(r);
    return { driverId: r.driver_id, name: r.name, ...sf, ...tourFigures(r, r.on_completed, r.tours_with_stops, sf.processed) };
  });
}

async function depotTable(tx: Tx, p: unknown[]) {
  const { rows } = await tx.query<StopCountsRow & TourFiguresRow & { depot_id: string; name: string; on_completed: number; tours_with_stops: number; drivers: number }>(
    `with t as materialized (${TOURS}),
          st as (select t.depot_id, ${STOP_COUNTS},
                        count(*) filter (where t.status = 'completed' and s.status not in ('pending', 'in_progress', 'cancelled'))::int as on_completed,
                        count(distinct s.tour_id)::int as tours_with_stops
                   from t join public.stops s on s.tour_id = t.id group by t.depot_id),
          tf as (select t.depot_id, count(distinct t.driver_id)::int as drivers, ${TOUR_FIGURES} from t group by t.depot_id)
     select tf.*, coalesce(st.stops, 0) as stops, coalesce(st.delivered, 0) as delivered, coalesce(st.picked_up, 0) as picked_up,
            coalesce(st.failed, 0) as failed, coalesce(st.attempted, 0) as attempted, coalesce(st.rescheduled, 0) as rescheduled,
            coalesce(st.returned, 0) as returned, coalesce(st.skipped, 0) as skipped, coalesce(st.cancelled, 0) as cancelled,
            coalesce(st.open, 0) as open, coalesce(st.on_completed, 0) as on_completed, coalesce(st.tours_with_stops, 0) as tours_with_stops,
            dp.name
       from tf left join st on st.depot_id = tf.depot_id
       join public.depots dp on dp.id = tf.depot_id
      order by dp.name`,
    p,
  );
  return rows.map((r) => {
    const sf = stopFigures(r);
    return { depotId: r.depot_id, name: r.name, drivers: r.drivers, ...sf, ...tourFigures(r, r.on_completed, r.tours_with_stops, sf.processed) };
  });
}

async function tourTable(tx: Tx, p: unknown[]) {
  const { rows } = await tx.query<StopCountsRow & { id: string; name: string; tour_date: string; status: string; archived: boolean; depot: string; driver: string | null; started_at: Date | null; finished_at: Date | null; minutes: Num; planned_km: Num; planned_minutes: Num }>(
    `with t as materialized (${TOURS})
     select t.id, t.name, to_char(t.tour_date, 'YYYY-MM-DD') as tour_date, t.status::text as status, t.archived_at is not null as archived,
            dp.name as depot, d.display_name as driver, t.started_at, t.finished_at,
            case when t.status = 'completed' and t.started_at is not null then extract(epoch from t.finished_at - t.started_at) / 60 end as minutes,
            case when ${plannedUsable("t")} then (t.optimization ->> 'distanceMeters')::numeric / 1000 end as planned_km,
            case when ${plannedUsable("t")} then (t.optimization ->> 'durationSeconds')::numeric / 60 end as planned_minutes,
            ${STOP_COUNTS.replace(/count\(\*\)/g, "count(s.id)")}
       from t join public.depots dp on dp.id = t.depot_id
       left join public.drivers d on d.id = t.driver_id
       left join public.stops s on s.tour_id = t.id
      group by t.id, t.name, t.tour_date, t.status, t.archived_at, dp.name, d.display_name, t.started_at, t.finished_at, t.optimization, t.optimized_at
      order by t.tour_date, t.name
      limit 5001`,
    p,
  );
  if (rows.length > 5000) throw new ApiError(422, "too_many_rows", "More than 5,000 tours in this period – narrow the filter");
  return rows.map((r) => ({
    tourId: r.id,
    name: r.name,
    date: r.tour_date,
    status: r.status,
    archived: r.archived,
    depot: r.depot,
    driver: r.driver,
    startedAt: r.started_at?.toISOString() ?? null,
    finishedAt: r.finished_at?.toISOString() ?? null,
    minutes: round(n(r.minutes)),
    plannedDistanceKm: round(n(r.planned_km)),
    plannedMinutes: round(n(r.planned_minutes)),
    ...stopFigures(r),
  }));
}

async function trend(tx: Tx, p: unknown[], granularity: "day" | "week" | "month") {
  const { rows } = await tx.query<StopCountsRow & { bucket: string; tours: number; completed: number }>(
    `with t as materialized (${TOURS}),
          b as (select t.id, to_char(date_trunc('${granularity}', t.tour_date::timestamp), 'YYYY-MM-DD') as bucket, t.status from t)
     select b.bucket, count(distinct b.id)::int as tours, count(distinct b.id) filter (where b.status = 'completed')::int as completed,
            ${STOP_COUNTS.replace(/count\(\*\)/g, "count(s.id)")}
       from b left join public.stops s on s.tour_id = b.id
      group by b.bucket order by b.bucket`,
    p,
  );
  return rows.map((r) => ({ bucket: r.bucket, tours: r.tours, toursCompleted: r.completed, ...stopFigures(r) }));
}

const EXPORT_VIEWS = ["drivers", "depots", "tours", "trend"] as const;

export function registerAnalyticsRoutes(app: FastifyInstance, { deps, guards }: RouteCtx) {
  const db = deps.db;
  const claims = (req: FastifyRequest) => guards.claims(req);

  app.get("/v1/orgs/:orgId/analytics/summary", { preHandler: guards.requireTenant("reports.view") }, async (req, reply) => {
    const { orgId } = OrgParams.parse(req.params);
    const q = parse(Query, req.query, reply);
    if (!q) return;
    return db.asUser(claims(req), async (tx) => {
      const ctx = await analyticsContext(tx, orgId, q);
      const prevTo = shift(ctx.range.from, -1);
      const prevFrom = shift(ctx.range.from, -ctx.days);
      const data = await summaryData(tx, [orgId, prevFrom, ctx.range.to, q.depotId ?? null, q.driverId ?? null, ctx.range.from], ctx.granularity);
      return {
        range: ctx.range,
        previousRange: { from: prevFrom, to: prevTo },
        timeZone: ctx.timeZone,
        granularity: ctx.granularity,
        filters: { depotId: q.depotId ?? null, driverId: q.driverId ?? null },
        onTimeToleranceMinutes: ON_TIME_TOLERANCE_MINUTES,
        current: data.current,
        previous: data.previous,
        trend: data.trend,
        failureReasons: data.failureReasons,
        definitions: KPI_DEFINITIONS,
      };
    });
  });

  app.get("/v1/orgs/:orgId/analytics/drivers", { preHandler: guards.requireTenant("reports.view") }, async (req, reply) => {
    const { orgId } = OrgParams.parse(req.params);
    const q = parse(Query, req.query, reply);
    if (!q) return;
    return db.asUser(claims(req), async (tx) => {
      const ctx = await analyticsContext(tx, orgId, q);
      return { range: ctx.range, drivers: await driverTable(tx, ctx.params), definitions: KPI_DEFINITIONS };
    });
  });

  app.get("/v1/orgs/:orgId/analytics/depots", { preHandler: guards.requireTenant("reports.view") }, async (req, reply) => {
    const { orgId } = OrgParams.parse(req.params);
    const q = parse(Query, req.query, reply);
    if (!q) return;
    return db.asUser(claims(req), async (tx) => {
      const ctx = await analyticsContext(tx, orgId, q);
      return { range: ctx.range, depots: await depotTable(tx, ctx.params), definitions: KPI_DEFINITIONS };
    });
  });

  app.get("/v1/orgs/:orgId/analytics/tours", { preHandler: guards.requireTenant("reports.view") }, async (req, reply) => {
    const { orgId } = OrgParams.parse(req.params);
    const q = parse(Query, req.query, reply);
    if (!q) return;
    return db.asUser(claims(req), async (tx) => {
      const ctx = await analyticsContext(tx, orgId, q);
      return { range: ctx.range, tours: await tourTable(tx, ctx.params), definitions: KPI_DEFINITIONS };
    });
  });

  /** CSV / Excel of one view, same filters. Logged (who exported what, when). */
  app.get("/v1/orgs/:orgId/analytics/export", { preHandler: guards.requireTenant("reports.export") }, async (req, reply) => {
    const { orgId } = OrgParams.parse(req.params);
    const q = parse(Query.and(z.object({ view: z.enum(EXPORT_VIEWS), format: z.enum(["csv", "xlsx"]).default("csv") })), req.query, reply);
    if (!q) return;
    const table = await db.asUser(claims(req), async (tx) => {
      const ctx = await analyticsContext(tx, orgId, q);
      const rows = await exportRows(tx, q.view, ctx.params, ctx.granularity);
      return { ctx, rows };
    });
    await db.asService((tx) => tx.query(`select app.log_read($1, $2, 'analytics_export', $3)`, [orgId, req.user!.userId, `${q.view}:${table.ctx.range.from}..${table.ctx.range.to}`]));
    return sendTable(reply, table.rows, `turvio-${q.view}-${table.ctx.range.from}_${table.ctx.range.to}`, q.format);
  });
}

const pct = (v: number | null) => (v === null ? null : Math.round(v * 1000) / 10);

async function exportRows(tx: Tx, view: (typeof EXPORT_VIEWS)[number], p: unknown[], granularity: "day" | "week" | "month"): Promise<Cell[][]> {
  const stopHead = ["Stops", "Delivered", "Picked up", "Failed", "Attempted", "Rescheduled", "Returned", "Skipped", "Cancelled", "Open", "Processed", "Success rate %"];
  const stopCells = (r: ReturnType<typeof stopFigures>): Cell[] => [r.stops, r.delivered, r.pickedUp, r.failed, r.attempted, r.rescheduled, r.returned, r.skipped, r.cancelled, r.open, r.processed, pct(r.successRate)];
  const tourHead = ["Tours", "Started", "Completed", "Cancelled tours", "Completion rate %", "On-time start rate %", "Avg tour minutes", "Active hours", "Stops per tour", "Stops per active hour"];
  const tourCells = (r: ReturnType<typeof tourFigures>): Cell[] => [r.tours, r.toursStarted, r.byStatus.completed, r.byStatus.cancelled, pct(r.completionRate), pct(r.onTimeStartRate), r.avgTourMinutes, r.activeHours, r.stopsPerTour, r.stopsPerActiveHour];
  switch (view) {
    case "drivers": {
      const rows = await driverTable(tx, p);
      return [["Driver", ...stopHead, ...tourHead], ...rows.map((r) => [r.name ?? "(no driver)", ...stopCells(r), ...tourCells(r)])];
    }
    case "depots": {
      const rows = await depotTable(tx, p);
      return [["Location", "Drivers", ...stopHead, ...tourHead], ...rows.map((r) => [r.name, r.drivers, ...stopCells(r), ...tourCells(r)])];
    }
    case "tours": {
      const rows = await tourTable(tx, p);
      return [
        ["Date", "Tour", "Status", "Archived", "Location", "Driver", "Started", "Finished", "Minutes", "Planned km", "Planned minutes", ...stopHead],
        ...rows.map((r) => [r.date, r.name, r.status, r.archived, r.depot, r.driver, r.startedAt, r.finishedAt, r.minutes, r.plannedDistanceKm, r.plannedMinutes, ...stopCells(r)]),
      ];
    }
    case "trend": {
      const rows = await trend(tx, p, granularity);
      return [[`Period (${granularity})`, "Tours", "Tours completed", ...stopHead], ...rows.map((r) => [r.bucket, r.tours, r.toursCompleted, ...stopCells(r)])];
    }
  }
}

export function sendTable(reply: FastifyReply, rows: Cell[][], baseName: string, format: "csv" | "xlsx") {
  const safe = baseName.replace(/[^A-Za-z0-9._-]/g, "_");
  if (format === "xlsx") {
    return reply
      .header("content-type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
      .header("content-disposition", `attachment; filename="${safe}.xlsx"`)
      .send(Buffer.from(toXlsx(rows, baseName.slice(7, 38))));
  }
  return reply.header("content-type", "text/csv; charset=utf-8").header("content-disposition", `attachment; filename="${safe}.csv"`).send(toCsv(rows));
}
