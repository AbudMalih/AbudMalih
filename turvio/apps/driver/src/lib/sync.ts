import type { Depot, Driver, Stop, StopStatus, Tour, TourStatus, Vehicle } from "@turvio/shared";

/** Response of GET /v1/me/tours (see apps/api/src/routes/driver.ts). */
export interface MyTour {
  tour: Tour;
  organization: { id: string; name: string; timeZone: string };
  depot: Depot | null;
  driver: { id: string; displayName: string; maxShiftMinutes: number };
  vehicle: { id: string; label: string; licensePlate: string } | null;
  stops: Stop[];
}

/** A change made on the device that still has to reach the server. */
export type OutboxItem =
  | { id: string; kind: "stop_status"; orgId: string; stopId: string; status: StopStatus; notes?: string; at: string }
  | { id: string; kind: "tour_status"; orgId: string; tourId: string; status: Exclude<TourStatus, "planned">; at: string };

export interface ServerSnapshot {
  organizationId: string;
  organizationName: string;
  depots: Depot[];
  drivers: Driver[];
  vehicles: Vehicle[];
  tours: Tour[];
  stops: Stop[];
  driverId: string;
}

/** Map the API payload into the driver store shape. */
export function snapshotFrom(payload: { tours: MyTour[] }, fallbackDriverId: string): ServerSnapshot {
  const t = payload.tours;
  const first = t[0];
  const depots = new Map<string, Depot>();
  const vehicles = new Map<string, Vehicle>();
  for (const x of t) {
    if (x.depot) depots.set(x.depot.id, x.depot);
    if (x.vehicle) vehicles.set(x.vehicle.id, { id: x.vehicle.id, organizationId: x.tour.organizationId, label: x.vehicle.label, licensePlate: x.vehicle.licensePlate, depotId: x.tour.depotId, capacityParcels: null });
  }
  return {
    organizationId: first?.organization.id ?? "",
    organizationName: first?.organization.name ?? "",
    depots: [...depots.values()],
    vehicles: [...vehicles.values()],
    drivers: first ? [{ id: first.driver.id, organizationId: first.tour.organizationId, displayName: first.driver.displayName, depotId: first.tour.depotId, maxShiftMinutes: first.driver.maxShiftMinutes, active: true }] : [],
    tours: t.map((x) => x.tour),
    stops: t.flatMap((x) => x.stops),
    driverId: first?.driver.id ?? fallbackDriverId,
  };
}

/** Re-apply not-yet-confirmed local changes on top of fresh server data. */
export function applyOutbox(snapshot: ServerSnapshot, outbox: OutboxItem[]): ServerSnapshot {
  if (!outbox.length) return snapshot;
  let { stops, tours } = snapshot;
  for (const o of outbox) {
    if (o.kind === "stop_status") {
      stops = stops.map((s) => (s.id === o.stopId ? { ...s, status: o.status, completedAt: o.status === "pending" ? undefined : o.at, notes: o.notes ?? s.notes } : s));
    } else {
      tours = tours.map((t) => (t.id === o.tourId ? { ...t, status: o.status } : t));
    }
  }
  return { ...snapshot, stops, tours };
}

export function newOutboxId(): string {
  return `ob_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
