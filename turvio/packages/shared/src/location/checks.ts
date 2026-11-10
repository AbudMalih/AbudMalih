import { haversineMeters } from "../geo";
import type { GeoPoint } from "../schemas";

/**
 * Location safeguards for delivery stops (P0-3.1): pure rules that turn evidence about a stop's
 * coordinate (road snap from OSRM, our own address lookup, other stops) into explicit issues.
 *
 * Principles
 * - Errors only where a coordinate cannot be right or cannot be driven to: invalid coordinates,
 *   a German address outside Germany, no road within the coverage limit, no road connection.
 * - Everything that can be legitimate is a warning or information, never an error:
 *   motorway snaps (service areas), pedestrian zones, residents-only streets, a nearest road with
 *   another name, approximate (street-level) locations.
 * - Rules never move a stop. A suggested approach point is only a suggestion.
 * - Missing evidence is "pending" or "unavailable" – never reported as checked.
 *
 * Thresholds measured on 1,000 real Hannover house addresses (OSM): nearest drivable road
 * median 16 m, 99 % ≤ 69 m, max 115 m (pedestrian zone). See docs/ROUTE_OPTIMIZATION.md.
 */

export interface LocationThresholds {
  /** Nearest drivable road further than this: warning "far from road". */
  farFromRoadMeters: number;
  /** Coordinate further than this from the house found for its address: warning. */
  addressMismatchMeters: number;
  /** Nearest drivable road further than this: error "outside the road data" (same as routing). */
  coverageMeters: number;
  /** A differently named access road further than this: information (e.g. pedestrian zone). */
  accessRoadHintMeters: number;
  /** A normal (non-motorway) road within this distance is offered as approach suggestion. */
  motorwayAlternativeMeters: number;
  /** Coordinate this close to a street-level lookup result: "approximate location". */
  streetCentreMeters: number;
}

/** Bumped whenever the rules or thresholds change: stored results of older rules are stale. */
export const LOCATION_RULES_VERSION = 1;

export const DEFAULT_LOCATION_THRESHOLDS: LocationThresholds = {
  farFromRoadMeters: 150,
  addressMismatchMeters: 250,
  coverageMeters: 1000,
  accessRoadHintMeters: 75,
  motorwayAlternativeMeters: 250,
  streetCentreMeters: 5,
};

export type LocationSeverity = "error" | "warning" | "info";

export type LocationIssueCode =
  // errors
  | "coordinates_invalid"
  | "outside_country"
  | "out_of_coverage"
  | "unreachable"
  // warnings
  | "far_from_road"
  | "motorway"
  | "address_mismatch"
  | "approximate_location"
  | "duplicate_coordinates"
  // information
  | "different_access_road"
  | "restricted_access"
  | "address_not_in_map_data";

export interface LocationSuggestion {
  kind: "approach";
  /** Nearest normal road (motorways excluded). Only a suggestion – never applied automatically. */
  location: GeoPoint;
  roadName: string;
  distanceMeters: number;
}

export interface LocationIssue {
  code: LocationIssueCode;
  severity: LocationSeverity;
  message: string;
  details?: Record<string, string | number | boolean | null>;
  suggestion?: LocationSuggestion;
}

/** What OSRM says about the stop's coordinate. */
export interface RoadSnapEvidence {
  distanceMeters: number;
  roadName: string;
  roadRef: string;
  /** OSRM road classes of the snapped road (car profile: motorway, restricted, toll, tunnel, ferry); null = unknown. */
  classes: string[] | null;
  snapped: GeoPoint;
  /** Nearest road with motorways excluded – only looked up when the snap is on a motorway. */
  nonMotorway?: { location: GeoPoint; roadName: string; distanceMeters: number } | null;
}

/** Road connection to and from the tour's start (or the depot for unassigned stops). */
export interface ReachEvidence {
  fromOrigin: boolean;
  toOrigin: boolean;
}

/** Our own address lookup (OSM house addresses) for the stop's address. */
export type AddressEvidence = { precision: "house" | "street" | "postal_code" | "city" | "other"; location: GeoPoint } | null;

export type Evidence<T> = { state: "done"; value: T } | { state: "pending" } | { state: "unavailable"; reason: string };

export interface StopLocationInput {
  stopId: string;
  location: GeoPoint | null | undefined;
  street?: string;
  countryCode?: string;
  road: Evidence<RoadSnapEvidence>;
  reach: Evidence<ReachEvidence>;
  address: Evidence<AddressEvidence>;
  /** Other stops at the same coordinate with a different address. */
  duplicateOf?: string[];
}

/**
 * - checked:     every check that applies here ran
 * - partial:     some checks could not run (no routing / address data); the rest ran
 * - pending:     at least one check is still running – NOT validated
 * - no_location: the stop has no coordinate (needs a location before it can be routed)
 */
export type LocationCheckStatus = "checked" | "partial" | "pending" | "no_location";

export interface StopLocationCheck {
  stopId: string;
  status: LocationCheckStatus;
  /** Worst severity among the issues; null when there are none (or when pending). */
  severity: LocationSeverity | null;
  issues: LocationIssue[];
  /** Per check: done / pending / unavailable (with reason). */
  checks: { road: Evidence<unknown>["state"]; reach: Evidence<unknown>["state"]; address: Evidence<unknown>["state"] };
  unavailable: string[];
  /** Snapped road, when known (for display; never used to move the stop). */
  road?: { distanceMeters: number; roadName: string; roadRef: string; classes: string[] | null };
}

/** Germany incl. border regions (generous: a German address is never outside this box). */
const DE_BOX = { minLat: 47.2, maxLat: 55.1, minLng: 5.8, maxLng: 15.1 };
const inBox = (lat: number, lng: number, b = DE_BOX) => lat >= b.minLat && lat <= b.maxLat && lng >= b.minLng && lng <= b.maxLng;

/** Coordinate errors that need no external data. */
export function coordinateIssues(location: GeoPoint, countryCode?: string): LocationIssue[] {
  const { lat, lng } = location;
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180)
    return [{ code: "coordinates_invalid", severity: "error", message: "The coordinates are not valid." }];
  if (Math.abs(lat) < 0.01 && Math.abs(lng) < 0.01)
    return [{ code: "coordinates_invalid", severity: "error", message: "The coordinates are 0,0 – no real location was set." }];
  if ((countryCode ?? "DE").toUpperCase() === "DE" && !inBox(lat, lng)) {
    const swapped = inBox(lng, lat);
    return [
      {
        code: "outside_country",
        severity: "error",
        message: swapped ? "The coordinates are outside Germany – latitude and longitude look swapped." : "The coordinates are outside Germany, but the address is German.",
        details: { swapped },
      },
    ];
  }
  return [];
}

/** Street names compared without case, accents, "straße/str." spelling and punctuation. */
export function sameStreet(a: string, b: string): boolean {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/ß/g, "ss")
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/(strasse|str\.|str)(?=\b|$)/g, "strasse")
      .replace(/[^a-z0-9]/g, "");
  return !!a && !!b && norm(a) === norm(b);
}

const SEVERITY_RANK: Record<LocationSeverity, number> = { error: 3, warning: 2, info: 1 };
const m = (x: number) => `${Math.round(x)} m`;

export function evaluateStopLocation(input: StopLocationInput, t: LocationThresholds = DEFAULT_LOCATION_THRESHOLDS): StopLocationCheck {
  const checks = { road: input.road.state, reach: input.reach.state, address: input.address.state };
  const unavailable = [input.road, input.reach, input.address].flatMap((e) => (e.state === "unavailable" ? [e.reason] : []));
  if (!input.location) return { stopId: input.stopId, status: "no_location", severity: null, issues: [], checks, unavailable };

  const issues: LocationIssue[] = [...coordinateIssues(input.location, input.countryCode)];
  const coordinateError = issues.length > 0;
  let road: StopLocationCheck["road"];

  if (!coordinateError && input.road.state === "done") {
    const r = input.road.value;
    road = { distanceMeters: Math.round(r.distanceMeters), roadName: r.roadName, roadRef: r.roadRef, classes: r.classes };
    const roadLabel = r.roadName || r.roadRef || "an unnamed road";
    if (r.distanceMeters > t.coverageMeters) {
      issues.push({ code: "out_of_coverage", severity: "error", message: `No road in the routing data within ${(t.coverageMeters / 1000).toFixed(1)} km (nearest ${(r.distanceMeters / 1000).toFixed(1)} km away).`, details: { snapMeters: Math.round(r.distanceMeters) } });
    } else {
      if (r.distanceMeters > t.farFromRoadMeters)
        issues.push({ code: "far_from_road", severity: "warning", message: `The nearest drivable road (${roadLabel}) is ${m(r.distanceMeters)} away – check the location.`, details: { snapMeters: Math.round(r.distanceMeters), roadName: r.roadName } });
      if (r.classes?.includes("motorway")) {
        const alt = r.nonMotorway && r.nonMotorway.distanceMeters <= t.motorwayAlternativeMeters ? r.nonMotorway : null;
        issues.push({
          code: "motorway",
          severity: "warning",
          message: alt
            ? `The location is on a motorway${r.roadRef ? ` (${r.roadRef})` : ""}. Nearest normal road: ${alt.roadName || "unnamed road"}, ${m(alt.distanceMeters)} – check the location (correct for a service-area delivery).`
            : `The location is on a motorway${r.roadRef ? ` (${r.roadRef})` : ""} and no normal road is within ${m(t.motorwayAlternativeMeters)} – check the location (correct for a service-area delivery).`,
          details: { roadRef: r.roadRef },
          ...(alt ? { suggestion: { kind: "approach" as const, location: alt.location, roadName: alt.roadName, distanceMeters: Math.round(alt.distanceMeters) } } : {}),
        });
      }
      if (r.classes?.includes("restricted"))
        issues.push({ code: "restricted_access", severity: "info", message: `Access via ${roadLabel} is restricted (residents, delivery or destination traffic only).` });
      if (input.street && r.distanceMeters > t.accessRoadHintMeters && !sameStreet(input.street, r.roadName))
        issues.push({ code: "different_access_road", severity: "info", message: `Nearest car access is ${roadLabel}, ${m(r.distanceMeters)} away (e.g. pedestrian zone or courtyard).`, details: { snapMeters: Math.round(r.distanceMeters), roadName: r.roadName } });
    }
  }

  if (!coordinateError && input.reach.state === "done" && !issues.some((i) => i.code === "out_of_coverage")) {
    const { fromOrigin, toOrigin } = input.reach.value;
    if (!fromOrigin || !toOrigin)
      issues.push({ code: "unreachable", severity: "error", message: !fromOrigin && !toOrigin ? "No road connection to or from this location." : !fromOrigin ? "No road connection from the tour start to this location." : "No road connection from this location back to the tour end.", details: { fromOrigin, toOrigin } });
  }

  if (!coordinateError && input.address.state === "done") {
    const a = input.address.value;
    if (!a) issues.push({ code: "address_not_in_map_data", severity: "info", message: "The address was not found in the map's address data – the location could not be cross-checked." });
    else {
      const d = haversineMeters(input.location, a.location);
      if (a.precision === "house" && d > t.addressMismatchMeters)
        issues.push({ code: "address_mismatch", severity: "warning", message: `The location is ${m(d)} from where the map data puts this address – check the coordinates.`, details: { distanceMeters: Math.round(d) } });
      else if (a.precision !== "house" && d <= t.streetCentreMeters)
        issues.push({ code: "approximate_location", severity: "warning", message: "Approximate location: the house number is not in the map data, the stop is placed at the street centre.", details: { precision: a.precision } });
    }
  }

  if (!coordinateError && input.duplicateOf?.length)
    issues.push({ code: "duplicate_coordinates", severity: "warning", message: `Same coordinates as ${input.duplicateOf.length} stop(s) with a different address – check the locations.`, details: { count: input.duplicateOf.length } });

  const states = [input.road.state, input.reach.state, input.address.state];
  // A coordinate error is final: no road or address check can change it.
  const status: LocationCheckStatus = coordinateError ? "checked" : states.includes("pending") ? "pending" : states.includes("unavailable") ? "partial" : "checked";
  const ranked = [...issues].sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]);
  // Pending checks report what is known so far, but never a final verdict.
  const severity = status === "pending" && !ranked.some((i) => i.severity === "error") ? null : (ranked[0]?.severity ?? null);
  return { stopId: input.stopId, status, severity, issues: ranked, checks, unavailable, ...(road ? { road } : {}) };
}

/** Stops at the same coordinate (±1 m) with a different address. */
export function duplicateCoordinates(stops: { id: string; location?: GeoPoint | null; addressKey: string }[]): Map<string, string[]> {
  const byCell = new Map<string, typeof stops>();
  for (const s of stops) {
    if (!s.location) continue;
    const k = `${s.location.lat.toFixed(5)},${s.location.lng.toFixed(5)}`;
    byCell.set(k, [...(byCell.get(k) ?? []), s]);
  }
  const out = new Map<string, string[]>();
  for (const group of byCell.values()) {
    for (const s of group) {
      const others = group.filter((o) => o.id !== s.id && o.addressKey !== s.addressKey && haversineMeters(o.location!, s.location!) <= 1);
      if (others.length) out.set(s.id, others.map((o) => o.id));
    }
  }
  return out;
}
