import { estimateDrive } from "./geo";
import { canTransition, isNotDelivered, isOpen, isSuccess } from "./stopStatus";
import {
  NewStopInput,
  type GeoPoint,
  type NewStopInput as NewStopInputType,
  type Stop,
  type StopStatus,
} from "./schemas";

export { canTransition } from "./stopStatus";

type TourEnds = { startLocation?: GeoPoint; endLocation?: GeoPoint; endMode?: "depot" | "address" | "last_stop" };

/** Where the tour starts when there is no live position: its own start address, else the depot. */
export function tourStartPoint(tour: TourEnds, depot: GeoPoint): GeoPoint {
  return tour.startLocation ?? depot;
}

/** Where the tour ends; undefined = at its last stop (no return trip). */
export function tourEndPoint(tour: TourEnds, depot: GeoPoint): GeoPoint | undefined {
  if (tour.endMode === "last_stop") return undefined;
  if (tour.endMode === "depot") return depot;
  return tour.endLocation ?? depot;
}

export function setStopStatus(
  stop: Stop,
  to: StopStatus,
  now: Date = new Date(),
  extra: { failureReason?: string; notes?: string } = {},
): Stop {
  if (!canTransition(stop.status, to)) {
    throw new Error(`Invalid stop status transition ${stop.status} -> ${to}`);
  }
  if (to === "delivered" && stop.type !== "delivery") {
    throw new Error("Only delivery stops can be marked delivered");
  }
  if (to === "picked_up" && stop.type !== "pickup") {
    throw new Error("Only pickup stops can be marked picked up");
  }
  const closed = !isOpen(to);
  return {
    ...stop,
    status: to,
    completedAt: closed ? now.toISOString() : undefined,
    failureReason: isNotDelivered(to) ? extra.failureReason : undefined,
    ...(extra.notes !== undefined ? { notes: extra.notes } : {}),
  };
}

/** Renumber `sequence` to match array order. */
export function resequence(stops: Stop[]): Stop[] {
  return stops.map((s, i) => (s.sequence === i ? s : { ...s, sequence: i }));
}

export function sortBySequence(stops: Stop[]): Stop[] {
  return [...stops].sort((a, b) => a.sequence - b.sequence);
}

/** Move one stop from index `from` to index `to` (manual reordering). */
export function moveStop(stops: Stop[], from: number, to: number): Stop[] {
  const ordered = sortBySequence(stops);
  if (from < 0 || from >= ordered.length || to < 0 || to >= ordered.length) {
    return ordered;
  }
  const [item] = ordered.splice(from, 1);
  ordered.splice(to, 0, item!);
  return resequence(ordered);
}

export interface TourProgress {
  total: number;
  /** Closed stops (any outcome). */
  done: number;
  /** Delivered or picked up. */
  delivered: number;
  /** Not delivered (failed, attempted, rescheduled, returned). */
  failed: number;
  skipped: number;
  /** Open stops (pending or in progress). */
  pending: number;
  inProgress: number;
  parcels: number;
  /** Parcels scanned into the vehicle. */
  parcelsLoaded: number;
}

export function tourProgress(stops: Stop[]): TourProgress {
  const work = stops.filter((s) => s.type !== "break");
  const pending = work.filter((s) => isOpen(s.status)).length;
  return {
    total: work.length,
    done: work.length - pending,
    delivered: work.filter((s) => isSuccess(s.status)).length,
    failed: work.filter((s) => isNotDelivered(s.status)).length,
    skipped: work.filter((s) => s.status === "skipped").length,
    pending,
    inProgress: work.filter((s) => s.status === "in_progress").length,
    parcels: work.reduce((n, s) => n + s.parcels.length, 0),
    parcelsLoaded: work.reduce((n, s) => n + s.parcels.filter((p) => p.loadedAt).length, 0),
  };
}

export function formatAddress(stop: Pick<Stop, "address">): string {
  const a = stop.address;
  const street = [a.street, a.houseNumber].filter(Boolean).join(" ");
  return `${street}, ${a.postalCode} ${a.city}`;
}

/** Normalised key used to detect stops/parcels for the same delivery address. */
/**
 * Matching key of an address: one delivery stop per key. Insensitive to case, spacing,
 * punctuation and hyphens ("Elfriede-Döler-Weg" = "elfriede döler weg"), "Straße/Strasse/Str.",
 * house-number spacing ("12 a" = "12a") and German umlauts written in ASCII
 * ("Döler" = "Doeler", "Müller" = "Mueller"). The city is not part of the key (postcode is).
 */
export function addressKey(a: { street: string; houseNumber?: string; postalCode: string; countryCode?: string; city?: string }): string {
  const norm = (s: string | undefined) =>
    (s ?? "")
      .toLowerCase()
      .replace(/ß/g, "ss")
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "") // ä -> a, é -> e …
      .replace(/([aou])e/g, "$1") // ASCII umlauts: ae/oe/ue -> a/o/u (same on both sides)
      .replace(/str(asse|\.|\b)/g, "str")
      .replace(/[^a-z0-9]/g, "");
  return [norm(a.street), norm(a.houseNumber), norm(a.postalCode), a.countryCode ?? "DE"].join("|");
}

/** Case-insensitive search over tracking numbers, recipient and address. */
export function searchStops(stops: Stop[], query: string): Stop[] {
  const q = query.trim().toLowerCase();
  if (!q) return stops;
  return stops.filter((s) => {
    const haystack = [
      s.recipientName,
      formatAddress(s),
      ...s.parcels.flatMap((p) => [p.trackingNumber, p.barcode, p.recipientName]),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
}

let idCounter = 0;
export function makeId(prefix: string): string {
  idCounter = (idCounter + 1) % 1_000_000;
  return `${prefix}_${Date.now().toString(36)}${idCounter.toString(36)}${Math.random()
    .toString(36)
    .slice(2, 7)}`;
}

/**
 * Validate manual stop input and add it to the tour. If a pending stop already
 * exists for the same address, the parcels are merged into it instead of
 * creating a duplicate stop. Returns the new stop list and the affected stop.
 */
export function addStop(
  stops: Stop[],
  tour: { id: string; organizationId: string },
  input: NewStopInputType,
): { stops: Stop[]; stop: Stop; merged: boolean } {
  const parsed = NewStopInput.parse(input);
  // Imports carry each parcel's own recipient/company; manual entry only tracking numbers.
  const parcels = parsed.parcels
    ? parsed.parcels.map((p) => ({ id: makeId("pcl"), trackingNumber: p.trackingNumber, recipientName: p.recipientName, ...(p.company ? { company: p.company } : {}) }))
    : parsed.trackingNumbers.map((trackingNumber) => ({ id: makeId("pcl"), trackingNumber, recipientName: parsed.recipientName }));

  const key = addressKey(parsed.address);
  const existing = stops.find(
    (s) => isOpen(s.status) && s.type === parsed.type && addressKey(s.address) === key,
  );
  if (existing) {
    const known = new Set(existing.parcels.map((p) => p.trackingNumber));
    const merged: Stop = {
      ...existing,
      parcels: [...existing.parcels, ...parcels.filter((p) => !known.has(p.trackingNumber))],
      priority: existing.priority || parsed.priority,
      location: existing.location ?? parsed.location,
      locationSource: existing.location ? existing.locationSource : (parsed.locationSource ?? existing.locationSource),
    };
    return {
      stops: stops.map((s) => (s.id === existing.id ? merged : s)),
      stop: merged,
      merged: true,
    };
  }

  const stop: Stop = {
    id: parsed.id ?? makeId("stp"),
    organizationId: tour.organizationId,
    tourId: tour.id,
    type: parsed.type,
    sequence: stops.length,
    recipientName: parsed.recipientName,
    address: parsed.address,
    location: parsed.location,
    locationSource: parsed.location ? (parsed.locationSource ?? "manual_pin") : null,
    recipientPhone: parsed.recipientPhone,
    timeWindow: parsed.timeWindow,
    serviceSeconds: parsed.serviceSeconds,
    priority: parsed.priority,
    notes: parsed.notes,
    parcels,
    status: "pending",
  };
  return { stops: [...stops, stop], stop, merged: false };
}

export interface RouteEstimate {
  distanceMeters: number;
  driveSeconds: number;
  serviceSeconds: number;
}

/** Straight-line based estimate for an ordered list of pending stops. */
export function estimateRoute(start: GeoPoint, stops: Stop[], end?: GeoPoint): RouteEstimate {
  let distanceMeters = 0;
  let driveSeconds = 0;
  let serviceSeconds = 0;
  let prev = start;
  for (const s of stops) {
    if (!s.location) continue;
    const leg = estimateDrive(prev, s.location);
    distanceMeters += leg.meters;
    driveSeconds += leg.seconds;
    serviceSeconds += s.serviceSeconds;
    prev = s.location;
  }
  if (end) {
    const leg = estimateDrive(prev, end);
    distanceMeters += leg.meters;
    driveSeconds += leg.seconds;
  }
  return { distanceMeters, driveSeconds, serviceSeconds };
}

export interface RouteMetrics {
  /** Whole route: start -> every located stop in sequence -> end. */
  totalMeters: number;
  totalDriveSeconds: number;
  /** What is left: from the last closed stop (or the start) through the open stops -> end. */
  remainingMeters: number;
  remainingDriveSeconds: number;
  remainingServiceSeconds: number;
  /** Open stops without coordinates – not included in the figures. */
  unlocatedOpen: number;
  /** Always straight-line × detour-factor estimates; never road-network values. */
  source: "haversine_estimate";
}

/**
 * Single source for tour distance/duration figures, used by Dispatch AND the
 * driver app so both show the same numbers (total vs. remaining are labelled).
 */
export function routeMetrics(start: GeoPoint, stops: Stop[], end?: GeoPoint): RouteMetrics {
  const ordered = sortBySequence(stops.filter((s) => s.type !== "break"));
  let totalMeters = 0;
  let totalDriveSeconds = 0;
  let prev = start;
  for (const s of ordered) {
    if (!s.location) continue;
    const leg = estimateDrive(prev, s.location);
    totalMeters += leg.meters;
    totalDriveSeconds += leg.seconds;
    prev = s.location;
  }
  if (end) {
    const leg = estimateDrive(prev, end);
    totalMeters += leg.meters;
    totalDriveSeconds += leg.seconds;
  }
  const lastClosed = ordered.filter((s) => !isOpen(s.status) && s.location).at(-1);
  const open = ordered.filter((s) => isOpen(s.status));
  const remaining = estimateRoute(lastClosed?.location ?? start, open, end);
  return {
    totalMeters,
    totalDriveSeconds,
    remainingMeters: remaining.distanceMeters,
    remainingDriveSeconds: remaining.driveSeconds,
    remainingServiceSeconds: remaining.serviceSeconds,
    unlocatedOpen: open.filter((s) => !s.location).length,
    source: "haversine_estimate",
  };
}

export interface RoadMetrics {
  totalMeters: number;
  totalDriveSeconds: number;
  remainingMeters: number;
  remainingDriveSeconds: number;
  /** Estimated arrival (minutes since local midnight) per open stop, from road travel times. */
  etas: Record<string, number>;
  source: "osrm";
}

/**
 * Figures from a road route. `waypointStopIds[i]` is the stop at waypoint i
 * (null for start/end); leg i runs from waypoint i to i+1. Remaining = legs
 * after the last closed stop. ETAs add service times and wait for time windows.
 */
export function roadMetrics(stops: Stop[], route: { legs: { meters: number; seconds: number }[]; waypointStopIds: (string | null)[] }, fromMinute: number): RoadMetrics {
  const byId = new Map(stops.map((s) => [s.id, s]));
  const ids = route.waypointStopIds;
  let lastClosed = 0;
  ids.forEach((id, i) => {
    const s = id ? byId.get(id) : undefined;
    if (s && !isOpen(s.status)) lastClosed = i;
  });
  let totalMeters = 0;
  let totalDriveSeconds = 0;
  let remainingMeters = 0;
  let remainingDriveSeconds = 0;
  route.legs.forEach((l, i) => {
    totalMeters += l.meters;
    totalDriveSeconds += l.seconds;
    if (i >= lastClosed) {
      remainingMeters += l.meters;
      remainingDriveSeconds += l.seconds;
    }
  });
  const etas: Record<string, number> = {};
  let t = fromMinute;
  for (let i = lastClosed + 1; i < ids.length; i++) {
    t += (route.legs[i - 1]?.seconds ?? 0) / 60;
    const s = ids[i] ? byId.get(ids[i]!) : undefined;
    if (!s || !isOpen(s.status)) continue;
    if (s.timeWindow && t < s.timeWindow.start) t = s.timeWindow.start;
    etas[s.id] = Math.round(t);
    t += s.serviceSeconds / 60;
  }
  return { totalMeters, totalDriveSeconds, remainingMeters, remainingDriveSeconds, etas, source: "osrm" };
}

/** Identifies a stop order + positions + statuses; a cached road route is valid only for the same key. */
export const routeKey = (stops: Pick<Stop, "id" | "sequence" | "status" | "location">[]) =>
  stops.map((s) => `${s.id}:${s.sequence}:${s.status}:${s.location?.lat ?? ""}`).join("|");
