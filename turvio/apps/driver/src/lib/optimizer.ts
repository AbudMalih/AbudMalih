import { buildServerUrl, serverUrlOverride } from "./serverUrl";
import { isOpen, orderStopsLocally, resequence, sortBySequence, type Depot, type GeoPoint, type Stop, type Tour } from "@turvio/shared";

export interface OptimizeOptions {
  /** Start from this point (device position) instead of the depot / last completed stop. */
  start?: GeoPoint;
  /** "depot" (default) = return to the depot, "none" = end at the last stop. */
  end?: "depot" | "none";
  /** Locked stops keep their position (default true). */
  respectLocks?: boolean;
}

export interface OptimizationOutcome {
  stops: Stop[];
  /** "server" = OR-Tools via the TURVIO API, "local" = on-device heuristic (offline / demo). */
  engine: "server" | "local";
  matrixSource?: "osrm" | "haversine_estimate";
  unassignedStopIds: string[];
  unlocatedStopIds: string[];
  lockedStopIds?: string[];
  distanceMeters?: number;
  durationSeconds?: number;
}

/**
 * TURVIO API base URL: the build-time EXPO_PUBLIC_API_URL, or – in development
 * and preview builds that have one – the server chosen on the login screen.
 * Null = demo mode (no server).
 */
export function apiBaseUrl(): string | null {
  const build = buildServerUrl();
  if (!build) return null;
  return serverUrlOverride() ?? build;
}

/**
 * On-device ordering (nearest neighbour + 2-opt on straight-line estimates).
 * Time windows, shift length and capacity are NOT considered – the UI says so.
 * Closed stops stay first; locked stops keep their slot among the open stops.
 */
export function optimizeLocally(tour: Tour, depot: Depot, stops: Stop[], opts: OptimizeOptions = {}): OptimizationOutcome {
  const ordered = sortBySequence(stops);
  const closed = ordered.filter((s) => !isOpen(s.status));
  const open = ordered.filter((s) => isOpen(s.status));
  const locked = opts.respectLocks === false ? [] : open.filter((s) => s.locked);
  const free = open.filter((s) => !locked.includes(s));
  const lastClosed = closed.filter((s) => s.location).at(-1)?.location;
  const from = opts.start ?? lastClosed ?? tour.startLocation ?? depot.location;
  const end = opts.end === "none" ? undefined : (tour.endLocation ?? depot.location);
  const local = orderStopsLocally(free, from, end);
  const queue = [...local.stops];
  const merged = open.map((s) => (locked.includes(s) ? s : queue.shift()!));
  return {
    stops: resequence([...closed, ...merged]),
    engine: "local",
    matrixSource: "haversine_estimate",
    unassignedStopIds: [],
    unlocatedStopIds: local.unlocatedStopIds,
    lockedStopIds: locked.map((s) => s.id),
  };
}
