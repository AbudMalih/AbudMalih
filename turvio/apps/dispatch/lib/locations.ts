import type { GeoPoint } from "@turvio/shared";
import type { BadgeTone } from "@turvio/web-ui/ds";

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
export function locationBadge(r: LocationReport | undefined): { label: string; tone: BadgeTone } | null {
  if (!r || r.status === "no_location") return null;
  if (r.status === "pending") return r.severity === "error" ? { label: "Location error", tone: "danger" } : { label: "Checking location…", tone: "neutral" };
  if (r.severity === "error") return { label: "Location error", tone: "danger" };
  if (r.severity === "warning") return r.acknowledged ? { label: "Location confirmed", tone: "success" } : { label: "Check location", tone: "warning" };
  return null;
}

/** One line describing how complete the check is – never "validated" for pending or partial results. */
export function checkStatusLabel(r: LocationReport): string {
  if (r.status === "pending") return "Location check still running – not yet checked";
  if (r.status === "no_location") return "No map position – nothing to check";
  if (r.status === "partial") return `Partly checked (${[...new Set(r.unavailable)].join(", ") || "some checks unavailable"})`;
  return "Checked";
}

export const PRECISION_LABEL: Record<string, string> = {
  house: "house number",
  street: "street only (approximate)",
  postal_code: "postcode only (approximate)",
  city: "city only (approximate)",
  manual_pin: "placed by hand",
  import_unverified: "from the import file (not verified)",
  unknown: "unknown",
};

export const ACTION_LABEL: Record<string, string> = {
  created: "Created",
  address_changed: "Address changed",
  location_changed: "Pin moved",
  location_cleared: "Map position removed",
  precision_changed: "Precision changed",
  confirmed: "Location confirmed",
  confirmation_invalidated: "Confirmation no longer valid",
  approach_accepted: "Navigation approach set",
  approach_cleared: "Navigation approach removed",
  approach_invalidated: "Navigation approach no longer valid",
  stop_deleted: "Stop deleted",
};
