import type { GeoPoint } from "@turvio/shared";
import type { BadgeTone } from "@turvio/web-ui/ds";
import { EN_T, type TFunction } from "./i18n";

/**
 * Stop location checks as Dispatch shows them (P0-3.4). The API decides; these helpers only word
 * it, in one place. A pending check is never shown as "checked" or "OK".
 */
export type LocationSeverity = "error" | "warning" | "info";
export interface LocationIssue {
  code: string;
  severity: LocationSeverity;
  message: string;
  suggestion?: { kind: "approach"; location: GeoPoint; roadName: string; distanceMeters: number };
}
export interface LocationReport {
  stopId: string;
  status: "checked" | "partial" | "pending" | "no_location";
  severity: LocationSeverity | null;
  issues: LocationIssue[];
  unavailable: string[];
  checkedAt?: string;
  source?: "stored" | "computed";
  road?: { distanceMeters: number; roadName: string; roadRef: string };
  confirmation: { by: string | null; at: string; issueCodes: string[]; note: string | null } | null;
  approach: { lat: number; lng: number; roadName?: string; distanceMeters: number | null; acceptedBy: string | null; acceptedAt: string } | null;
  acknowledged: boolean;
}
export interface LocationChecksResponse {
  pending: boolean;
  checks: LocationReport[];
}

export interface StopLocationDetail {
  stopId: string;
  current: { address: { street: string; houseNumber?: string; postalCode: string; city: string }; location: GeoPoint | null; locationSource: string | null; locationPrecision: string; addressVersion: number; locationVersion: number };
  original: {
    kind: "original" | "baseline_at_migration";
    label: string;
    provenance: string;
    address: { street: string; houseNumber?: string; postalCode: string; city: string };
    location: GeoPoint | null;
    locationPrecision: string;
    capturedAt: string;
  } | null;
  tourPublished: boolean;
  check: LocationReport;
}
export interface LocationEvent {
  id: string;
  at: string;
  actor: { userId: string | null; role: string };
  action: string;
  reason: string | null;
  previous: Record<string, unknown> | null;
  new: Record<string, unknown> | null;
}

/** A stop that needs a dispatcher: an error, or a warning nobody confirmed for this exact location. */
export function needsReview(r: LocationReport | undefined): boolean {
  if (!r || r.status === "pending" || r.status === "no_location") return false;
  return r.severity === "error" || (r.severity === "warning" && !r.acknowledged);
}

/** Short badge for lists, map and stop rows; null when there is nothing to say. */
export function locationBadge(r: LocationReport | undefined, t: TFunction = EN_T): { label: string; tone: BadgeTone } | null {
  if (!r || r.status === "no_location") return null;
  if (r.status === "pending") return r.severity === "error" ? { label: t("map.loc.error"), tone: "danger" } : { label: t("map.loc.checking"), tone: "neutral" };
  if (r.severity === "error") return { label: t("map.loc.error"), tone: "danger" };
  if (r.severity === "warning") return r.acknowledged ? { label: t("map.loc.confirmed"), tone: "success" } : { label: t("map.loc.check"), tone: "warning" };
  return null;
}

/** One line describing how complete the check is – never "validated" for pending or partial results. */
export function checkStatusLabel(r: LocationReport, t: TFunction = EN_T): string {
  if (r.status === "pending") return t("map.loc.statusPending");
  if (r.status === "no_location") return t("map.loc.statusNoLocation");
  // The unavailable check names come from the API as they are.
  if (r.status === "partial") return t("map.loc.statusPartial", { list: [...new Set(r.unavailable)].join(", ") || t("map.loc.someUnavailable") });
  return t("map.loc.checked");
}

const PRECISIONS = ["house", "street", "postal_code", "city", "manual_pin", "import_unverified", "unknown"] as const;
const ACTIONS = [
  "created",
  "address_changed",
  "location_changed",
  "location_cleared",
  "precision_changed",
  "confirmed",
  "confirmation_invalidated",
  "approach_accepted",
  "approach_cleared",
  "approach_invalidated",
  "stop_deleted",
] as const;

/** Location precision in the current language; an unknown code is shown as it is. */
export const precisionLabel = (code: string, t: TFunction = EN_T): string =>
  (PRECISIONS as readonly string[]).includes(code) ? t(`map.precision.${code as (typeof PRECISIONS)[number]}`) : code;
/** Location history action in the current language; an unknown code is shown as it is. */
export const actionLabel = (code: string, t: TFunction = EN_T): string =>
  (ACTIONS as readonly string[]).includes(code) ? t(`map.action.${code as (typeof ACTIONS)[number]}`) : code;

/** English labels (kept for callers that need the plain map). */
export const PRECISION_LABEL: Record<string, string> = Object.fromEntries(PRECISIONS.map((k) => [k, precisionLabel(k)]));
export const ACTION_LABEL: Record<string, string> = Object.fromEntries(ACTIONS.map((k) => [k, actionLabel(k)]));
