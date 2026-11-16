import { EXPORT_LANGS, localizeHeadings } from "../export-i18n";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { can, type Permission } from "@turvio/shared";
import { OrgParams, parse, problem, type RouteCtx } from "../http";
import { ApiError, mapPgError, type Tx } from "../db";
import { STOP_SELECT, toStop, toTour, type StopRow, type TourRow } from "../data/dispatch";
import type { Cell } from "@turvio/shared";
import { sendTable } from "./analytics";

/*
 * Tour lifecycle for Dispatch (Phase B): list with filters, calendar counts, finish / cancel,
 * archive / restore, safe delete, duplicate, stop cancel and bulk actions with a preview.
 *
 * The database enforces every rule (20261119000200_tour_lifecycle): RLS for company and location
 * scope, the lifecycle guard trigger (archive rules, closed tours never reopen, archived tours are
 * read-only), close_tour / delete_tour / cancel_stop for the transitions. This module adds request
 * validation, role checks, previews and per-tour results for bulk work.
 */

const Uuid = z.string().uuid();
const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const IdParams = OrgParams.extend({ id: Uuid });
const Reason = z.string().trim().min(3).max(500);
const TOUR_STATUSES = ["planned", "in_progress", "paused", "completed", "cancelled"] as const;
/** Upper bound of one bulk request (and of "all matching" id lists). */
export const BULK_MAX = 1000;
const MAX_RANGE_DAYS = 366;

const ListQuery = z
  .object({
    date: IsoDate.optional(),
    from: IsoDate.optional(),
    to: IsoDate.optional(),
    month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
    driverId: Uuid.optional(),
    depotId: Uuid.optional(),
    status: z
      .string()
      .transform((s) => s.split(",").filter(Boolean))
      .pipe(z.array(z.enum(TOUR_STATUSES)).max(5))
      .optional(),
    /** exclude (default): active views; only: the Archived Tours view; all. */
    archived: z.enum(["exclude", "only", "all"]).default("exclude"),
    published: z.enum(["true", "false"]).optional(),
    /** true: tours without stops (daily cleanup). */
    empty: z.enum(["true", "false"]).optional(),
    q: z.string().trim().min(1).max(80).optional(),
    limit: z.coerce.number().int().min(1).max(200).default(50),
    offset: z.coerce.number().int().min(0).max(100_000).default(0),
    /** ids=1: only the ids of all matching tours (for "select all matching"), up to BULK_MAX. */
    ids: z.enum(["0", "1"]).default("0"),
  })
  .refine((q) => [q.date, q.month, q.from ?? q.to].filter(Boolean).length <= 1, { message: "Give one of date, month or from/to" });
type ListQuery = z.infer<typeof ListQuery>;

/** Inclusive date range of a list query (default: the company's today is decided by the caller). */
export function rangeOf(q: Pick<ListQuery, "date" | "from" | "to" | "month">, today: string): { from: string; to: string } {
  if (q.date) return { from: q.date, to: q.date };
  if (q.month) {
    const [y, m] = q.month.split("-").map(Number) as [number, number];
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return { from: `${q.month}-01`, to: `${q.month}-${String(last).padStart(2, "0")}` };
  }
  const from = q.from ?? q.to ?? today;
  const to = q.to ?? q.from ?? today;
  if (from > to) throw new ApiError(400, "validation_failed", "from must not be after to");
  const days = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000;
  if (days >= MAX_RANGE_DAYS) throw new ApiError(400, "validation_failed", `A range covers at most ${MAX_RANGE_DAYS} days`);
  return { from, to };
}

type ListedRow = TourRow & {
  depot_name: string;
  driver_name: string | null;
  vehicle_label: string | null;
  stops_total: number;
  stops_open: number;
  stops_done: number;
  stops_not_done: number;
  stops_cancelled: number;
  stops_skipped: number;
  total_count: number;
};

const STOP_COUNTS = `
  left join lateral (
    select count(*)::int as total,
           count(*) filter (where s.status in ('pending', 'in_progress'))::int as open,
           count(*) filter (where s.status in ('delivered', 'picked_up'))::int as done,
           count(*) filter (where s.status in ('failed', 'attempted', 'rescheduled', 'returned'))::int as not_done,
           count(*) filter (where s.status = 'cancelled')::int as cancelled,
           count(*) filter (where s.status = 'skipped')::int as skipped
      from public.stops s where s.tour_id = t.id
  ) c on true`;

/** Filtered tour list (RLS: only locations the caller may access). */
async function listTours(tx: Tx, orgId: string, q: ListQuery, range: { from: string; to: string }, page: { limit: number; offset: number }) {
  const { rows } = await tx.query<ListedRow>(
    `select t.*, d.name as depot_name, dr.display_name as driver_name, v.label as vehicle_label,
            c.total as stops_total, c.open as stops_open, c.done as stops_done, c.not_done as stops_not_done,
            c.cancelled as stops_cancelled, c.skipped as stops_skipped,
            count(*) over ()::int as total_count
       from public.tours t
       join public.depots d on d.id = t.depot_id
       left join public.drivers dr on dr.id = t.driver_id
       left join public.vehicles v on v.id = t.vehicle_id
       ${STOP_COUNTS}
      where t.organization_id = $1 and t.tour_date between $2::date and $3::date
        and ($4::uuid is null or t.driver_id = $4)
        and ($5::uuid is null or t.depot_id = $5)
        and ($6::text[] is null or t.status::text = any($6))
        and case $7 when 'exclude' then t.archived_at is null when 'only' then t.archived_at is not null else true end
        and ($8::boolean is null or (t.published_at is not null) = $8)
        and ($9::boolean is null or (c.total = 0) = $9)
        and ($10::text is null or t.name ilike '%' || $10 || '%' or dr.display_name ilike '%' || $10 || '%')
      order by t.tour_date desc, t.name, t.id
      limit $11 offset $12`,
    [
      orgId, range.from, range.to, q.driverId ?? null, q.depotId ?? null, q.status?.length ? q.status : null, q.archived,
      q.published === undefined ? null : q.published === "true", q.empty === undefined ? null : q.empty === "true",
      q.q ? q.q.replace(/[\\%_]/g, (m) => `\\${m}`) : null, page.limit, page.offset,
    ],
  );
  return rows;
}

const listed = (r: ListedRow) => ({
  tour: toTour(r),
  depotName: r.depot_name,
  driverName: r.driver_name,
  vehicleLabel: r.vehicle_label,
  stops: { total: r.stops_total, open: r.stops_open, delivered: r.stops_done, notDelivered: r.stops_not_done, cancelled: r.stops_cancelled, skipped: r.stops_skipped },
});

async function companyToday(tx: Tx, orgId: string): Promise<string> {
  return (await tx.query<{ d: string }>(`select to_char((now() at time zone time_zone)::date, 'YYYY-MM-DD') as d from public.organizations where id = $1`, [orgId])).rows[0]?.d ?? new Date().toISOString().slice(0, 10);
}

async function loadTour(tx: Tx, orgId: string, id: string): Promise<TourRow> {
  const { rows } = await tx.query<TourRow>(`select * from public.tours where id = $1 and organization_id = $2`, [id, orgId]);
  if (!rows[0]) throw new ApiError(404, "not_found", "Tour not found");
  return rows[0];
}

// ---------------------------------------------------------------- bulk
const BULK_ACTIONS = ["archive", "restore", "delete", "finish", "cancel", "withdraw"] as const;
type BulkAction = (typeof BULK_ACTIONS)[number];
const PERMISSION: Record<BulkAction, Permission> = {
  archive: "tours.archive",
  restore: "tours.archive",
  delete: "tours.delete",
  finish: "tours.close",
  cancel: "tours.close",
  withdraw: "tours.manage",
};

const Selection = z.union([
  z.object({ tourIds: z.array(Uuid).min(1).max(BULK_MAX) }),
  // "All matching": resolved on the server at the moment of the request (same filters as the list).
  z.object({
    filter: z.object({
      date: IsoDate.optional(),
      from: IsoDate.optional(),
      to: IsoDate.optional(),
      month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
      driverId: Uuid.optional(),
      depotId: Uuid.optional(),
      status: z.array(z.enum(TOUR_STATUSES)).max(5).optional(),
      archived: z.enum(["exclude", "only", "all"]).default("exclude"),
      published: z.boolean().optional(),
      empty: z.boolean().optional(),
      q: z.string().trim().min(1).max(80).optional(),
    }),
  }),
]);

const BulkRequest = z.object({
  action: z.enum(BULK_ACTIONS),
  selection: Selection,
  /** Versions the dispatcher saw (stale ones fail with version_conflict for that tour only). */
  versions: z.record(Uuid, z.number().int().min(1)).optional(),
  reason: Reason.optional(),
  /** finish / cancel: what happens to open stops (default: back to the unassigned pool). */
  openStops: z.enum(["return", "cancel"]).default("return"),
  /** delete: also delete the (unprocessed) stops instead of returning them to the pool. */
  deleteStops: z.boolean().default(false),
});

interface PreviewRow {
  id: string;
  name: string;
  date: string;
  status: TourRow["status"];
  published: boolean;
  archived: boolean;
  driverName: string | null;
  stops: number;
  completedDeliveries: number;
  openStops: number;
  /** Will the action change this tour? */
  eligible: boolean;
  /** Already in the target state (e.g. archiving an archived tour). */
  unchanged: boolean;
  /** Why not (stable codes). */
  reasons: string[];
  version: number;
}

async function resolveSelection(tx: Tx, orgId: string, sel: z.infer<typeof Selection>): Promise<string[]> {
  if ("tourIds" in sel) return [...new Set(sel.tourIds)];
  const f = sel.filter;
  const q: ListQuery = {
    ...f,
    status: f.status,
    published: f.published === undefined ? undefined : f.published ? "true" : "false",
    empty: f.empty === undefined ? undefined : f.empty ? "true" : "false",
    limit: BULK_MAX,
    offset: 0,
    ids: "1",
  } as ListQuery;
  const rows = await listTours(tx, orgId, q, rangeOf(q, await companyToday(tx, orgId)), { limit: BULK_MAX + 1, offset: 0 });
  if (rows.length > BULK_MAX) throw new ApiError(422, "too_many_tours", `More than ${BULK_MAX} tours match – narrow the filter`);
  return rows.map((r) => r.id);
}

async function previewRows(tx: Tx, orgId: string, action: BulkAction, ids: string[]): Promise<PreviewRow[]> {
  const { rows } = await tx.query<ListedRow>(
    `select t.*, d.name as depot_name, dr.display_name as driver_name, null as vehicle_label,
            c.total as stops_total, c.open as stops_open, c.done as stops_done, c.not_done as stops_not_done,
            c.cancelled as stops_cancelled, c.skipped as stops_skipped, 0 as total_count
       from public.tours t
       join public.depots d on d.id = t.depot_id
       left join public.drivers dr on dr.id = t.driver_id
       ${STOP_COUNTS}
      where t.organization_id = $1 and t.id = any($2::uuid[])
      order by t.tour_date desc, t.name`,
    [orgId, ids],
  );
  const found = new Set(rows.map((r) => r.id));
  const out: PreviewRow[] = [];
  for (const r of rows) {
    const closed = r.status === "completed" || r.status === "cancelled";
    const reasons: string[] = [];
    let unchanged = false;
    switch (action) {
      case "archive":
        if (r.archived_at) unchanged = true;
        else if (!(closed || (r.status === "planned" && !r.published_at))) reasons.push(r.status === "planned" ? "published" : "active");
        break;
      case "restore":
        if (!r.archived_at) unchanged = true;
        break;
      case "delete": {
        const e = (await tx.query<{ e: { eligible: boolean; reasons: string[] } }>(`select public.tour_delete_eligibility($1) as e`, [r.id])).rows[0]!.e;
        reasons.push(...e.reasons);
        break;
      }
      case "finish":
        if (r.status === "completed") unchanged = true;
        else if (r.archived_at) reasons.push("archived");
        else if (r.status !== "in_progress" && r.status !== "paused") reasons.push(r.status === "cancelled" ? "status_cancelled" : "not_started");
        break;
      case "cancel":
        if (r.status === "cancelled") unchanged = true;
        else if (r.archived_at) reasons.push("archived");
        else if (closed) reasons.push(`status_${r.status}`);
        break;
      case "withdraw":
        if (!r.published_at && r.status === "planned") unchanged = true;
        else if (r.archived_at) reasons.push("archived");
        else if (r.status !== "planned") reasons.push("started");
        break;
    }
    out.push({
      id: r.id,
      name: r.name,
      date: typeof r.tour_date === "string" ? r.tour_date : new Date(r.tour_date as unknown as Date).toISOString().slice(0, 10),
      status: r.status,
      published: !!r.published_at,
      archived: !!r.archived_at,
      driverName: r.driver_name,
      stops: r.stops_total,
      completedDeliveries: r.stops_done,
      openStops: r.stops_open,
      eligible: !unchanged && reasons.length === 0,
      unchanged,
      reasons,
      version: r.version,
    });
  }
  // Ids the caller cannot see (other company / location) are reported, never acted on.
  for (const id of ids) if (!found.has(id)) out.push({ id, name: "", date: "", status: "planned", published: false, archived: false, driverName: null, stops: 0, completedDeliveries: 0, openStops: 0, eligible: false, unchanged: false, reasons: ["not_found"], version: 0 });
  return out;
}

function summarize(action: BulkAction, rows: PreviewRow[]) {
  const eligible = rows.filter((r) => r.eligible);
  return {
    action,
    selected: rows.length,
    eligible: eligible.length,
    /** Tours the action may not touch (protected history, wrong state, not visible). */
    protected: rows.filter((r) => !r.eligible && !r.unchanged).length,
    unchanged: rows.filter((r) => r.unchanged).length,
    /** Stops affected on eligible tours (finish / cancel: the open stops; others: all stops). */
    affectedStops: eligible.reduce((n, r) => n + (action === "finish" || action === "cancel" ? r.openStops : r.stops), 0),
    completedDeliveries: rows.reduce((n, r) => n + r.completedDeliveries, 0),
  };
}

export function registerLifecycleRoutes(app: FastifyInstance, { deps, guards }: RouteCtx) {
  const db = deps.db;
  const claims = (req: FastifyRequest) => guards.claims(req);

  // ---------------------------------------------------------------- list, calendar
  app.get("/v1/orgs/:orgId/tours", { preHandler: guards.requireTenant("tours.view_all") }, async (req, reply) => {
    const { orgId } = OrgParams.parse(req.params);
    const q = parse(ListQuery, req.query, reply);
    if (!q) return;
    return db.asUser(claims(req), async (tx) => {
      const range = rangeOf(q, await companyToday(tx, orgId));
      if (q.ids === "1") {
        const rows = await listTours(tx, orgId, q, range, { limit: BULK_MAX + 1, offset: 0 });
        return { range, total: rows[0]?.total_count ?? 0, ids: rows.slice(0, BULK_MAX).map((r) => r.id), truncated: rows.length > BULK_MAX };
      }
      const rows = await listTours(tx, orgId, q, range, { limit: q.limit, offset: q.offset });
      return { range, total: rows[0]?.total_count ?? 0, limit: q.limit, offset: q.offset, tours: rows.map(listed) };
    });
  });

  /** CSV / Excel of the filtered tour list (e.g. the Archived Tours view). Logged. */
  app.get("/v1/orgs/:orgId/tours/export", { preHandler: guards.requireTenant("reports.export") }, async (req, reply) => {
    const { orgId } = OrgParams.parse(req.params);
    const q = parse(ListQuery.and(z.object({ format: z.enum(["csv", "xlsx"]).default("csv"), lang: z.enum(EXPORT_LANGS).default("en") })), req.query, reply);
    if (!q) return;
    const out = await db.asUser(claims(req), async (tx) => {
      const range = rangeOf(q, await companyToday(tx, orgId));
      const rows = await listTours(tx, orgId, q, range, { limit: 5001, offset: 0 });
      if (rows.length > 5000) throw new ApiError(422, "too_many_rows", "More than 5,000 tours match – narrow the filter");
      return { range, rows };
    });
    await db.asService((tx) => tx.query(`select app.log_read($1, $2, 'tours_export', $3)`, [orgId, req.user!.userId, `${q.archived}:${out.range.from}..${out.range.to}`]));
    const table: Cell[][] = [
      ["Date", "Tour", "Status", "Published", "Archived at", "Closed at", "Closed by Dispatch", "Close reason", "Location", "Driver", "Vehicle", "Stops", "Open", "Delivered / picked up", "Not delivered", "Cancelled", "Skipped"],
      ...out.rows.map((r) => {
        const t = toTour(r);
        return [t.date, t.name, t.status, !!t.publishedAt, t.archivedAt ?? null, t.closedAt ?? null, !!t.closedRemotely, t.closeReason ?? null, r.depot_name, r.driver_name, r.vehicle_label,
          r.stops_total, r.stops_open, r.stops_done, r.stops_not_done, r.stops_cancelled, r.stops_skipped];
      }),
    ];
    return sendTable(reply, localizeHeadings(table, q.lang), `turvio-tours-${q.archived}-${out.range.from}_${out.range.to}`, q.format);
  });

  /** Per-day counts for the calendar jump (month view). */
  app.get("/v1/orgs/:orgId/tours/calendar", { preHandler: guards.requireTenant("tours.view_all") }, async (req, reply) => {
    const { orgId } = OrgParams.parse(req.params);
    const q = parse(z.object({ month: z.string().regex(/^\d{4}-\d{2}$/), depotId: Uuid.optional() }), req.query, reply);
    if (!q) return;
    const range = rangeOf({ month: q.month }, q.month + "-01");
    return db.asUser(claims(req), async (tx) => {
      const { rows } = await tx.query<{ day: string; tours: number; archived: number; cancelled: number; completed: number; active: number; empty: number }>(
        `select to_char(t.tour_date, 'YYYY-MM-DD') as day,
                count(*) filter (where t.archived_at is null)::int as tours,
                count(*) filter (where t.archived_at is not null)::int as archived,
                count(*) filter (where t.status = 'cancelled' and t.archived_at is null)::int as cancelled,
                count(*) filter (where t.status = 'completed' and t.archived_at is null)::int as completed,
                count(*) filter (where t.status in ('in_progress', 'paused'))::int as active,
                count(*) filter (where t.archived_at is null and not exists (select 1 from public.stops s where s.tour_id = t.id))::int as empty
           from public.tours t
          where t.organization_id = $1 and t.tour_date between $2::date and $3::date and ($4::uuid is null or t.depot_id = $4)
          group by t.tour_date order by t.tour_date`,
        [orgId, range.from, range.to, q.depotId ?? null],
      );
      return { month: q.month, days: rows };
    });
  });

  // ---------------------------------------------------------------- finish / cancel
  app.post("/v1/orgs/:orgId/tours/:id/close", { preHandler: guards.requireTenant("tours.close") }, async (req, reply) => {
    const { orgId, id } = IdParams.parse(req.params);
    const b = parse(
      z.object({
        status: z.enum(["completed", "cancelled"]),
        expectedVersion: z.number().int().min(1),
        reason: Reason,
        openStops: z.enum(["return", "cancel"]).default("return"),
      }),
      req.body,
      reply,
    );
    if (!b) return;
    return db.asUser(claims(req), async (tx) => {
      await loadTour(tx, orgId, id);
      const open = (await tx.query<{ n: number }>(`select count(*)::int as n from stops where tour_id = $1 and status in ('pending', 'in_progress')`, [id])).rows[0]!.n;
      const row = (await tx.query<TourRow>(`select * from close_tour($1, $2, $3, $4, $5)`, [id, b.expectedVersion, b.status, b.reason, b.openStops])).rows[0]!;
      return { tour: toTour(row), openStops: { count: open, action: open ? (b.openStops === "return" ? "returned_to_pool" : "cancelled") : "none" } };
    });
  });

  // ---------------------------------------------------------------- archive / restore
  for (const action of ["archive", "restore"] as const) {
    app.post(`/v1/orgs/:orgId/tours/:id/${action}`, { preHandler: guards.requireTenant("tours.archive") }, async (req, reply) => {
      const { orgId, id } = IdParams.parse(req.params);
      const b = parse(z.object({ expectedVersion: z.number().int().min(1) }), req.body, reply);
      if (!b) return;
      return db.asUser(claims(req), async (tx) => toTour(await setArchived(tx, orgId, id, action === "archive", b.expectedVersion)));
    });
  }

  // ---------------------------------------------------------------- delete preview
  app.get("/v1/orgs/:orgId/tours/:id/delete-eligibility", { preHandler: guards.requireTenant("tours.view_all") }, async (req) => {
    const { orgId, id } = IdParams.parse(req.params);
    return db.asUser(claims(req), async (tx) => {
      const [p] = await previewRows(tx, orgId, "delete", [id]);
      if (!p || p.reasons.includes("not_found")) throw new ApiError(404, "not_found", "Tour not found");
      const e = (await tx.query<{ e: Record<string, unknown> }>(`select public.tour_delete_eligibility($1) as e`, [id])).rows[0]!.e;
      return { tour: { id: p.id, name: p.name, date: p.date, status: p.status, driverName: p.driverName, version: p.version }, ...e, completedDeliveries: p.completedDeliveries };
    });
  });

  // ---------------------------------------------------------------- duplicate
  app.post("/v1/orgs/:orgId/tours/:id/duplicate", { preHandler: guards.requireTenant("tours.manage") }, async (req, reply) => {
    const { orgId, id } = IdParams.parse(req.params);
    const b = parse(
      z.object({
        date: IsoDate,
        name: z.string().trim().min(1).max(120).optional(),
        driverId: Uuid.nullable().default(null),
        vehicleId: Uuid.nullable().default(null),
        /** Copy the stops as new, open stops (addresses, windows, notes – no parcels, no history). */
        includeStops: z.boolean().default(true),
      }),
      req.body,
      reply,
    );
    if (!b) return;
    const out = await db.asUser(claims(req), async (tx) => {
      const src = await loadTour(tx, orgId, id);
      for (const [col, val, code] of [["driver_id", b.driverId, "driver_busy"], ["vehicle_id", b.vehicleId, "vehicle_busy"]] as const) {
        if (!val) continue;
        const busy = (await tx.query<{ name: string }>(
          `select name from tours where ${col} = $1 and tour_date = $2 and status not in ('completed', 'cancelled') and archived_at is null limit 1`, [val, b.date])).rows[0];
        if (busy) throw new ApiError(409, code, `Already assigned to ${busy.name} that day`);
      }
      await tx.query(`select set_config('turvio.tour_created_detail', $1, true)`, [JSON.stringify({ duplicatedFrom: src.id })]);
      const row = (
        await tx.query<TourRow>(
          `insert into tours (organization_id, depot_id, name, tour_date, planned_start_minute, driver_id, vehicle_id,
                              start_lat, start_lng, start_label, end_mode, end_lat, end_lng, end_label)
           select organization_id, depot_id, $3, $4, planned_start_minute, $5, $6, start_lat, start_lng, start_label, end_mode, end_lat, end_lng, end_label
             from tours where id = $1 and organization_id = $2
           returning *`,
          [src.id, orgId, b.name ?? `${src.name} (copy)`.slice(0, 120), b.date, b.driverId, b.vehicleId],
        )
      ).rows[0]!;
      await tx.query(`select set_config('turvio.tour_created_detail', '', true)`);
      let stops = 0;
      if (b.includeStops) {
        await tx.query(`select set_config('turvio.change_reason', $1, true), set_config('turvio.origin_provenance', 'dispatch_manual', true)`, [`Duplicated from tour ${src.name}`]);
        stops = (
          await tx.query(
            `insert into stops (organization_id, tour_id, type, sequence, recipient_name, street, house_number, postal_code, city, country_code,
                                lat, lng, tw_start_minute, tw_end_minute, service_seconds, priority, notes, location_source, recipient_phone, location_precision)
             select organization_id, $2, type, row_number() over (order by sequence) - 1, recipient_name, street, house_number, postal_code, city, country_code,
                    lat, lng, tw_start_minute, tw_end_minute, service_seconds, priority, notes, location_source, recipient_phone, location_precision
               from stops where tour_id = $1 and status <> 'cancelled' order by sequence`,
            [src.id, row.id],
          )
        ).rowCount ?? 0;
      }
      return { tour: toTour(row), stops };
    });
    return reply.status(201).send(out);
  });

  // ---------------------------------------------------------------- stop cancel
  app.post("/v1/orgs/:orgId/stops/:id/cancel", { preHandler: guards.requireTenant("stops.manage") }, async (req, reply) => {
    const { orgId, id } = IdParams.parse(req.params);
    const b = parse(z.object({ reason: Reason }), req.body, reply);
    if (!b) return;
    return db.asUser(claims(req), async (tx) => {
      const visible = (await tx.query(`select 1 from stops where id = $1 and organization_id = $2`, [id, orgId])).rowCount;
      if (!visible) throw new ApiError(404, "not_found", "Stop not found");
      await tx.query(`select cancel_stop($1, $2)`, [id, b.reason]);
      const row = (await tx.query<StopRow>(`${STOP_SELECT} where s.id = $1`, [id])).rows[0]!;
      return row.tour_id ? { stop: toStop(row) } : { stop: { id: row.id, status: row.status, cancelReason: row.cancel_reason, depotId: row.depot_id } };
    });
  });

  // ---------------------------------------------------------------- bulk
  app.post("/v1/orgs/:orgId/tours/bulk/preview", { preHandler: guards.requireTenant("tours.view_all") }, async (req, reply) => {
    const { orgId } = OrgParams.parse(req.params);
    const b = parse(BulkRequest.pick({ action: true, selection: true }), req.body, reply);
    if (!b) return;
    return db.asUser(claims(req), async (tx) => {
      const ids = await resolveSelection(tx, orgId, b.selection);
      const rows = ids.length ? await previewRows(tx, orgId, b.action, ids) : [];
      return { summary: summarize(b.action, rows), tours: rows };
    });
  });

  app.post("/v1/orgs/:orgId/tours/bulk", { preHandler: guards.requireTenant("tours.view_all") }, async (req, reply) => {
    const { orgId } = OrgParams.parse(req.params);
    const b = parse(BulkRequest, req.body, reply);
    if (!b) return;
    if (!can(req.membership!.role, PERMISSION[b.action])) return problem(reply, 403, "forbidden", "Your role may not do this");
    if ((b.action === "finish" || b.action === "cancel") && !b.reason) return problem(reply, 400, "validation_failed", "A reason is required to finish or cancel tours");
    return db.asUser(claims(req), async (tx) => {
      const ids = await resolveSelection(tx, orgId, b.selection);
      const rows = ids.length ? await previewRows(tx, orgId, b.action, ids) : [];
      const results: { id: string; name: string; result: "done" | "unchanged" | "skipped" | "failed"; code?: string; message?: string }[] = [];
      for (const r of rows) {
        if (r.unchanged) {
          results.push({ id: r.id, name: r.name, result: "unchanged" });
          continue;
        }
        if (!r.eligible) {
          results.push({ id: r.id, name: r.name, result: "skipped", code: r.reasons[0] ?? "not_eligible" });
          continue;
        }
        const version = b.versions?.[r.id] ?? r.version;
        // One savepoint per tour: a refusal (changed meanwhile, protected) leaves the others intact.
        await tx.query("savepoint bulk_item");
        try {
          switch (b.action) {
            case "archive":
            case "restore":
              await setArchived(tx, orgId, r.id, b.action === "archive", version);
              break;
            case "delete":
              await tx.query(`select delete_tour($1, $2, $3)`, [r.id, version, b.deleteStops]);
              break;
            case "finish":
            case "cancel":
              await tx.query(`select close_tour($1, $2, $3, $4, $5)`, [r.id, version, b.action === "finish" ? "completed" : "cancelled", b.reason, b.openStops]);
              break;
            case "withdraw":
              await tx.query(`select unpublish_tour($1, $2)`, [r.id, version]);
              break;
          }
          await tx.query("release savepoint bulk_item");
          results.push({ id: r.id, name: r.name, result: "done" });
        } catch (e) {
          await tx.query("rollback to savepoint bulk_item");
          const err = mapPgError(e);
          if (!(err instanceof ApiError)) throw err;
          results.push({ id: r.id, name: r.name, result: "failed", code: err.code, message: err.message });
        }
      }
      const count = (k: string) => results.filter((x) => x.result === k).length;
      return { action: b.action, selected: rows.length, done: count("done"), unchanged: count("unchanged"), skipped: count("skipped"), failed: count("failed"), results };
    });
  });
}

/** Archive or restore one tour (version-checked; the database guard enforces which tours qualify). */
async function setArchived(tx: Tx, orgId: string, id: string, archive: boolean, expectedVersion: number): Promise<TourRow> {
  const cur = await loadTour(tx, orgId, id);
  if (cur.version !== expectedVersion) throw new ApiError(409, "version_conflict", "The tour was changed by someone else. Reload and try again.");
  if (!!cur.archived_at === archive) return cur;
  const { rows } = await tx.query<TourRow>(
    `update tours set archived_at = case when $3 then now() end where id = $1 and organization_id = $2 and version = $4 returning *`,
    [id, orgId, archive, expectedVersion],
  );
  if (!rows[0]) throw new ApiError(409, "version_conflict", "The tour was changed by someone else. Reload and try again.");
  return rows[0];
}
