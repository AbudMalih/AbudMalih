import type { Stop, Tour } from "@turvio/shared";
import { api } from "./api";
import { EN_T, type TFunction } from "./i18n";

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
  /** `lang`: language of the column headings (values stay exact). */
  exportUrl: (f: TourListFilter, format: "csv" | "xlsx", lang?: string) => {
    const p = filterQuery(f);
    p.set("format", format);
    if (lang && lang !== "en") p.set("lang", lang);
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

/** Refusal / protection codes the server sends (delete / archive eligibility, bulk previews and runs). */
export const REASON_CODES = [
  "status_in_progress",
  "status_paused",
  "status_completed",
  "status_cancelled",
  "started",
  "published",
  "processed_stops",
  "stop_history",
  "proofs",
  "scans",
  "tracking",
  "returned_stops",
  "execution_history",
  "not_found",
  "active",
  "archived",
  "not_started",
  "version_conflict",
  "tour_closed",
  "tour_archived",
  "tour_protected",
] as const;
export type ReasonCode = (typeof REASON_CODES)[number];
const KNOWN_REASONS = new Set<string>(REASON_CODES);

/** Plain-language explanation of a refusal / protection code (completes "This tour …"), in English. */
export const REASON_TEXT: Record<string, string> = Object.fromEntries(REASON_CODES.map((c) => [c, EN_T(`tours.reason.${c}`)]));
/** The explanation of a code in the given language; an unknown code is shown readable as it is. */
export const reasonText = (code: string, t: TFunction = EN_T) => (KNOWN_REASONS.has(code) ? t(`tours.reason.${code as ReasonCode}`) : code.replace(/_/g, " "));

/** English status labels (kept for callers without a translator); use `statusLabel` for display. */
export const STATUS_LABEL: Record<LifecycleStatus, string> = {
  planned: "Planned",
  in_progress: "On route",
  paused: "Paused",
  completed: "Completed",
  cancelled: "Cancelled",
};
export const statusLabel = (s: LifecycleStatus, t: TFunction = EN_T) => t(`common.tourStatus.${s}`);

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
