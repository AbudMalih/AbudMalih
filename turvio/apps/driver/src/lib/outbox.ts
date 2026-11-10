import type { GeoPoint, NewStopInput, StopStatus, TourStatus } from "@turvio/shared";
import { ApiError, isTransient } from "./auth";

/**
 * Persistent outbox: every change made on the device is stored here first and
 * sent in order. Each item carries client-generated ids, so a retried request
 * (app killed mid-upload, timeout after the server already committed) never
 * creates a duplicate on the server.
 */
interface Base {
  id: string;
  orgId: string;
  /** ISO time the driver made the change. */
  at: string;
  attempts?: number;
  /** Epoch ms – not before this time (exponential backoff). */
  nextAttemptAt?: number;
  lastError?: string;
}

export type OutboxItem = Base &
  (
    | { kind: "stop_status"; stopId: string; status: StopStatus; notes?: string; failureReason?: string }
    | { kind: "tour_status"; tourId: string; status: Exclude<TourStatus, "planned"> }
    | { kind: "stop_note"; stopId: string; note: string }
    | { kind: "scans"; tourId: string; scans: { code: string; at: string }[] }
    | { kind: "create_tour"; tourId: string; name: string; date: string }
    | { kind: "create_stops"; tourId: string; stops: (NewStopInput & { id: string })[] }
    | {
        kind: "stop_update";
        stopId: string;
        locked?: boolean;
        location?: GeoPoint;
        locationSource?: "geocoder" | "manual_pin";
        /** Location version this move was made against (P0-3.2): a newer dispatcher change → 409, never overwritten. */
        expectedLocationVersion?: number;
        reason?: string;
      }
    | { kind: "sequence"; tourId: string; stopIds: string[] }
    | {
        kind: "stop_edit";
        stopId: string;
        recipientName?: string;
        address: { street: string; houseNumber?: string; postalCode: string; city: string };
        location?: GeoPoint;
        locationSource?: "geocoder" | "manual_pin";
        expectedAddressVersion?: number;
        reason?: string;
      }
    | { kind: "stop_remove"; stopId: string }
    | { kind: "stop_merge"; stopId: string; intoStopId: string }
    | {
        kind: "proof";
        proofId: string;
        stopId: string;
        proofKind: "photo" | "signature";
        contentType: "image/jpeg" | "image/png" | "image/svg+xml";
        /** Private app file (native) – deleted after a confirmed upload. */
        fileUri?: string;
        /** Inline data (signature SVG, or the web test build). */
        dataBase64?: string;
        recipientName?: string;
        notes?: string;
        location?: GeoPoint;
      }
  );

export type OutboxKind = OutboxItem["kind"];

export interface Requester {
  request<T>(method: string, path: string, body?: unknown): Promise<T>;
}

export interface OutboxDeps {
  client: Requester;
  readFileBase64: (uri: string) => Promise<string>;
  deleteFile: (uri: string) => Promise<void>;
}

/** Send one item. Throws ApiError on failure. */
export async function sendItem(item: OutboxItem, deps: OutboxDeps): Promise<void> {
  const o = item.orgId;
  const c = deps.client;
  switch (item.kind) {
    case "stop_status":
      await c.request("POST", `/v1/orgs/${o}/stops/${item.stopId}/status`, {
        status: item.status,
        notes: item.notes,
        failureReason: item.failureReason,
        clientEventId: item.id,
        occurredAt: item.at,
      });
      return;
    case "tour_status":
      await c.request("POST", `/v1/orgs/${o}/tours/${item.tourId}/status`, { status: item.status });
      return;
    case "stop_note":
      await c.request("POST", `/v1/orgs/${o}/stops/${item.stopId}/note`, { note: item.note, clientEventId: item.id });
      return;
    case "scans":
      await c.request("POST", `/v1/orgs/${o}/tours/${item.tourId}/scans`, { scans: item.scans });
      return;
    case "create_tour":
      await c.request("POST", "/v1/me/tours", { id: item.tourId, name: item.name, date: item.date });
      return;
    case "create_stops":
      await c.request("POST", `/v1/orgs/${o}/stops`, { tourId: item.tourId, stops: item.stops });
      return;
    case "stop_update":
      await c.request("POST", `/v1/orgs/${o}/stops/${item.stopId}/driver-update`, {
        locked: item.locked,
        location: item.location,
        locationSource: item.locationSource,
        ...(item.location && item.expectedLocationVersion ? { expectedLocationVersion: item.expectedLocationVersion } : {}),
        ...(item.reason ? { reason: item.reason } : {}),
      });
      return;
    case "sequence":
      await c.request("POST", `/v1/me/tours/${item.tourId}/sequence`, { stopIds: item.stopIds });
      return;
    case "stop_edit":
      await c.request("POST", `/v1/orgs/${o}/stops/${item.stopId}/edit`, {
        recipientName: item.recipientName ?? null,
        address: item.address,
        location: item.location,
        locationSource: item.locationSource,
        ...(item.expectedAddressVersion ? { expectedAddressVersion: item.expectedAddressVersion } : {}),
        ...(item.reason ? { reason: item.reason } : {}),
      });
      return;
    case "stop_remove":
      await c.request("POST", `/v1/orgs/${o}/stops/${item.stopId}/remove`, {});
      return;
    case "stop_merge":
      await c.request("POST", `/v1/orgs/${o}/stops/${item.stopId}/merge`, { intoStopId: item.intoStopId });
      return;
    case "proof": {
      const data = item.dataBase64 ?? (item.fileUri ? await deps.readFileBase64(item.fileUri) : null);
      if (!data) throw new ApiError(422, "file_missing", "The photo of this proof is no longer on the device.");
      await c.request("POST", `/v1/orgs/${o}/stops/${item.stopId}/proofs`, {
        id: item.proofId,
        kind: item.proofKind,
        contentType: item.contentType,
        dataBase64: data,
        capturedAt: item.at,
        recipientName: item.recipientName,
        notes: item.notes,
        location: item.location,
      });
      if (item.fileUri) await deps.deleteFile(item.fileUri).catch(() => undefined);
      return;
    }
  }
}

export const backoffMs = (attempts: number) => Math.min(5 * 60_000, 2_000 * 2 ** Math.max(0, attempts - 1));

export interface DrainResult {
  sent: string[];
  /** Rejected by the server (permanent) – shown to the driver, never silently dropped. */
  failed: { item: OutboxItem; error: string }[];
  /** Stopped because the network/server is unavailable. */
  offline: boolean;
  error?: string;
}

/**
 * Drain the queue in order. `peek` reads the *live* queue so items added while
 * draining are sent in the same pass. A transient failure stops the drain (keeps
 * order: e.g. a stop must exist before its status is sent); a permanent failure
 * moves the item to the failed list and continues.
 */
export async function drainOutbox(
  peek: () => OutboxItem | undefined,
  remove: (id: string) => void,
  update: (item: OutboxItem) => void,
  deps: OutboxDeps,
  now: () => number = Date.now,
): Promise<DrainResult> {
  const result: DrainResult = { sent: [], failed: [], offline: false };
  for (let item = peek(); item; item = peek()) {
    if (item.nextAttemptAt && item.nextAttemptAt > now()) {
      result.offline = true;
      result.error = item.lastError;
      break;
    }
    try {
      await sendItem(item, deps);
      remove(item.id);
      result.sent.push(item.id);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      if (isTransient(e) || (e instanceof ApiError && e.status === 401)) {
        const attempts = (item.attempts ?? 0) + 1;
        update({ ...item, attempts, nextAttemptAt: now() + backoffMs(attempts), lastError: message });
        result.offline = true;
        result.error = message;
        break;
      }
      remove(item.id);
      result.failed.push({ item: { ...item, lastError: message }, error: message });
    }
  }
  return result;
}
