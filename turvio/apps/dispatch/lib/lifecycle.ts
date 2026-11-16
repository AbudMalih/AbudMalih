import type { Stop, Tour } from "@turvio/shared";
import { api } from "./api";

/*
 * Tour lifecycle API (Phase B): list with filters, calendar, finish / cancel, archive / restore,
 * delete eligibility, duplicate, stop cancel, bulk preview / run. The server decides every rule;
 * these helpers only call it.
 */

export type ArchivedFilter = "exclude" | "only" | "all";
export type LifecycleStatus = Tour["status"];

export interface TourListFilter {
  /** One of: a day, a range, or a month. */
  date?: string;
  from?: string;
  to?: string;
  month?: string;
  driverId?: string;
  depotId?: string;
  status?: LifecycleStatus[];
  archived: ArchivedFilter;
  published?: boolean;
  empty?: boolean;
  q?: string;
}

export interface StopCounts {
  total: number;
  open: number;
  delivered: number;
  notDelivered: number;
  cancelled: number;
  skipped: number;
}

export interface ListedTour {
  tour: Tour;
  depotName: string;
  driverName: string | null;
  vehicleLabel: string | null;
  stops: StopCounts;
}

export interface TourListPage {
  range: { from: string; to: string };
  total: number;
  limit: number;
  offset: number;
  tours: ListedTour[];
}

export interface CalendarDay {
  day: string;
  tours: number;
  archived: number;
  cancelled: number;
  completed: number;
  active: number;
  empty: number;
}

export interface DeleteEligibility {
  tour: { id: string; name: string; date: string; status: LifecycleStatus; driverName: string | null; version: number };
  eligible: boolean;
  reasons: string[];
  stops: number;
  processedStops: number;
  stopEvents: number;
  proofs: number;
  scannedParcels: number;
  locationPoints: number;
  completedDeliveries: number;
}

export type BulkAction = "archive" | "restore" | "delete" | "finish" | "cancel" | "withdraw";
export type BulkSelection = { tourIds: string[] } | { filter: Omit<TourListFilter, "published" | "empty"> & { published?: boolean; empty?: boolean } };

export interface BulkPreviewRow {
  id: string;
  name: string;
  date: string;
  status: LifecycleStatus;
  published: boolean;
  archived: boolean;
  driverName: string | null;
  stops: number;
  completedDeliveries: number;
  openStops: number;
  eligible: boolean;
  unchanged: boolean;
  reasons: string[];
  version: number;
}

export interface BulkPreview {
  summary: { action: BulkAction; selected: number; eligible: number; protected: number; unchanged: number; affectedStops: number; completedDeliveries: number };
  tours: BulkPreviewRow[];
}

export interface BulkResult {
  action: BulkAction;
  selected: number;
  done: number;
  unchanged: number;
  skipped: number;
  failed: number;
  results: { id: string; name: string; result: "done" | "unchanged" | "skipped" | "failed"; code?: string; message?: string }[];
}

export interface TourEvent {
  source: "tour" | "stop";
  kind: string;
  detail: Record<string, unknown>;
  at: string;
}

/** Query string of a list filter (shared by list, ids and export). */
export function filterQuery(f: TourListFilter): URLSearchParams {
  const p = new URLSearchParams();
  if (f.date) p.set("date", f.date);
  if (f.month) p.set("month", f.month);
  if (f.from) p.set("from", f.from);
  if (f.to) p.set("to", f.to);
  if (f.driverId) p.set("driverId", f.driverId);
  if (f.depotId) p.set("depotId", f.depotId);
  if (f.status?.length) p.set("status", f.status.join(","));
  p.set("archived", f.archived);
  if (f.published !== undefined) p.set("published", String(f.published));
  if (f.empty !== undefined) p.set("empty", String(f.empty));
  if (f.q?.trim()) p.set("q", f.q.trim());
  return p;
}

/** The filter as the bulk API expects it ("all matching"). */
export function bulkFilter(f: TourListFilter): BulkSelection {
  const { date, from, to, month, driverId, depotId, status, archived, published, empty, q } = f;
  return { filter: { date, from, to, month, driverId, depotId, status, archived, published, empty, q: q?.trim() || undefined } };
}

export const lifecycleApi = (org: string) => ({
  list: (f: TourListFilter, page: { limit: number; offset: number }) => {
    const p = filterQuery(f);
    p.set("limit", String(page.limit));
    p.set("offset", String(page.offset));
    return api<TourListPage>("GET", `/v1/orgs/${org}/tours?${p}`);
  },
  ids: (f: TourListFilter) => {
    const p = filterQuery(f);
    p.set("ids", "1");
    return api<{ total: number; ids: string[]; truncated: boolean }>("GET", `/v1/orgs/${org}/tours?${p}`);
  },
  calendar: (month: string, depotId?: string | null) => api<{ month: string; days: CalendarDay[] }>("GET", `/v1/orgs/${org}/tours/calendar?month=${month}${depotId ? `&depotId=${depotId}` : ""}`),
  exportUrl: (f: TourListFilter, format: "csv" | "xlsx") => {
    const p = filterQuery(f);
    p.set("format", format);
    return `/api/turvio/v1/orgs/${org}/tours/export?${p}`;
  },
  get: (id: string) => api<{ tour: Tour; stops: Stop[] }>("GET", `/v1/orgs/${org}/tours/${id}`),
  events: (id: string) => api<TourEvent[]>("GET", `/v1/orgs/${org}/tours/${id}/events`),
  update: (tour: Pick<Tour, "id" | "version">, patch: { name?: string; plannedStartMinute?: number; driverId?: string | null; vehicleId?: string | null; date?: string; depotId?: string }) =>
    api<Tour>("PATCH", `/v1/orgs/${org}/tours/${tour.id}`, { expectedVersion: tour.version, ...patch }),
  publish: (tour: Pick<Tour, "id" | "version">) => api<unknown>("POST", `/v1/orgs/${org}/tours/${tour.id}/publish`, { expectedVersion: tour.version }),
  withdraw: (tour: Pick<Tour, "id" | "version">) => api<unknown>("POST", `/v1/orgs/${org}/tours/${tour.id}/unpublish`, { expectedVersion: tour.version }),
  close: (tour: Pick<Tour, "id" | "version">, status: "completed" | "cancelled", reason: string, openStops: "return" | "cancel") =>
    api<{ tour: Tour; openStops: { count: number; action: "returned_to_pool" | "cancelled" | "none" } }>("POST", `/v1/orgs/${org}/tours/${tour.id}/close`, {
      status,
      expectedVersion: tour.version,
      reason,
      openStops,
    }),
  archive: (tour: Pick<Tour, "id" | "version">) => api<Tour>("POST", `/v1/orgs/${org}/tours/${tour.id}/archive`, { expectedVersion: tour.version }),
  restore: (tour: Pick<Tour, "id" | "version">) => api<Tour>("POST", `/v1/orgs/${org}/tours/${tour.id}/restore`, { expectedVersion: tour.version }),
  eligibility: (id: string) => api<DeleteEligibility>("GET", `/v1/orgs/${org}/tours/${id}/delete-eligibility`),
  remove: (tour: Pick<Tour, "id" | "version">, deleteStops: boolean) => api<void>("DELETE", `/v1/orgs/${org}/tours/${tour.id}?expectedVersion=${tour.version}&deleteStops=${deleteStops}`),
  duplicate: (id: string, body: { date: string; name?: string; driverId: string | null; vehicleId: string | null; includeStops: boolean }) =>
    api<{ tour: Tour; stops: number }>("POST", `/v1/orgs/${org}/tours/${id}/duplicate`, body),
  cancelStop: (stopId: string, reason: string) => api<unknown>("POST", `/v1/orgs/${org}/stops/${stopId}/cancel`, { reason }),
  bulkPreview: (action: BulkAction, selection: BulkSelection) => api<BulkPreview>("POST", `/v1/orgs/${org}/tours/bulk/preview`, { action, selection }),
  bulkRun: (body: { action: BulkAction; selection: BulkSelection; versions?: Record<string, number>; reason?: string; openStops?: "return" | "cancel"; deleteStops?: boolean }) =>
    api<BulkResult>("POST", `/v1/orgs/${org}/tours/bulk`, body),
});

/** Plain-language explanation of a refusal / protection code from the server. */
export const REASON_TEXT: Record<string, string> = {
  status_in_progress: "is being driven",
  status_paused: "is paused (running)",
  status_completed: "is completed",
  status_cancelled: "is cancelled",
  started: "was started",
  published: "is published to the driver (withdraw it first)",
  processed_stops: "has stops with an outcome",
  stop_history: "has stop history",
  proofs: "has proofs of delivery",
  scans: "has scanned parcels",
  tracking: "has GPS tracking records",
  returned_stops: "returned open stops to the pool when it was closed",
  execution_history: "has execution history",
  not_found: "is not visible to you (other location or deleted)",
  active: "is running – finish or cancel it first",
  archived: "is archived – restore it first",
  not_started: "has not started (cancel or withdraw it instead)",
  version_conflict: "was changed by someone else meanwhile",
  tour_closed: "is closed",
  tour_archived: "is archived",
  tour_protected: "has protected history",
};
export const reasonText = (code: string) => REASON_TEXT[code] ?? code.replace(/_/g, " ");

export const STATUS_LABEL: Record<LifecycleStatus, string> = {
  planned: "Planned",
  in_progress: "On route",
  paused: "Paused",
  completed: "Completed",
  cancelled: "Cancelled",
};

/** Which lifecycle actions apply to a tour in its current state (the server re-checks). */
export function availableActions(t: Pick<Tour, "status" | "publishedAt" | "archivedAt" | "driverId">, stopCount: number) {
  const archived = !!t.archivedAt;
  const closed = t.status === "completed" || t.status === "cancelled";
  const running = t.status === "in_progress" || t.status === "paused";
  return {
    edit: !archived && !closed,
    reschedule: !archived && t.status === "planned",
    publish: !archived && t.status === "planned" && !t.publishedAt && !!t.driverId && stopCount > 0,
    withdraw: !archived && t.status === "planned" && !!t.publishedAt,
    finish: !archived && running,
    cancel: !archived && !closed,
    archive: !archived && (closed || (t.status === "planned" && !t.publishedAt)),
    restore: archived,
    delete: !running,
    duplicate: true,
  };
}
