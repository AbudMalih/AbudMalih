import { estimateDrive } from "./geo";
import {
  NewStopInput,
  type GeoPoint,
  type NewStopInput as NewStopInputType,
  type Stop,
  type StopStatus,
} from "./schemas";

/** Allowed status transitions for a stop. Completed stops can be reopened. */
const TRANSITIONS: Record<StopStatus, readonly StopStatus[]> = {
  pending: ["delivered", "picked_up", "failed", "skipped"],
  delivered: ["pending"],
  picked_up: ["pending"],
  failed: ["pending"],
  skipped: ["pending"],
};

export function canTransition(from: StopStatus, to: StopStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function setStopStatus(stop: Stop, to: StopStatus, now: Date = new Date()): Stop {
  if (!canTransition(stop.status, to)) {
    throw new Error(`Invalid stop status transition ${stop.status} -> ${to}`);
  }
  if (to === "delivered" && stop.type !== "delivery") {
    throw new Error("Only delivery stops can be marked delivered");
  }
  if (to === "picked_up" && stop.type !== "pickup") {
    throw new Error("Only pickup stops can be marked picked up");
  }
  return {
    ...stop,
    status: to,
    completedAt: to === "pending" ? undefined : now.toISOString(),
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
  done: number;
  delivered: number;
  failed: number;
  skipped: number;
  pending: number;
  parcels: number;
}

export function tourProgress(stops: Stop[]): TourProgress {
  const work = stops.filter((s) => s.type !== "break");
  const count = (st: StopStatus) => work.filter((s) => s.status === st).length;
  const pending = count("pending");
  return {
    total: work.length,
    done: work.length - pending,
    delivered: count("delivered") + count("picked_up"),
    failed: count("failed"),
    skipped: count("skipped"),
    pending,
    parcels: work.reduce((n, s) => n + s.parcels.length, 0),
  };
}

export function formatAddress(stop: Pick<Stop, "address">): string {
  const a = stop.address;
  const street = [a.street, a.houseNumber].filter(Boolean).join(" ");
  return `${street}, ${a.postalCode} ${a.city}`;
}

/** Normalised key used to detect stops/parcels for the same delivery address. */
export function addressKey(a: Stop["address"]): string {
  const norm = (s: string | undefined) =>
    (s ?? "")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/ß/g, "ss")
      .replace(/str(asse|\.|\b)/g, "str")
      .replace(/[^a-z0-9]/g, "");
  return [norm(a.street), norm(a.houseNumber), norm(a.postalCode), a.countryCode].join("|");
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
  const parcels = parsed.trackingNumbers.map((trackingNumber) => ({
    id: makeId("pcl"),
    trackingNumber,
    recipientName: parsed.recipientName,
  }));

  const key = addressKey(parsed.address);
  const existing = stops.find(
    (s) => s.status === "pending" && s.type === parsed.type && addressKey(s.address) === key,
  );
  if (existing) {
    const known = new Set(existing.parcels.map((p) => p.trackingNumber));
    const merged: Stop = {
      ...existing,
      parcels: [...existing.parcels, ...parcels.filter((p) => !known.has(p.trackingNumber))],
      priority: existing.priority || parsed.priority,
      location: existing.location ?? parsed.location,
    };
    return {
      stops: stops.map((s) => (s.id === existing.id ? merged : s)),
      stop: merged,
      merged: true,
    };
  }

  const stop: Stop = {
    id: makeId("stp"),
    organizationId: tour.organizationId,
    tourId: tour.id,
    type: parsed.type,
    sequence: stops.length,
    recipientName: parsed.recipientName,
    address: parsed.address,
    location: parsed.location,
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
