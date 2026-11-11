import {
  addStop as addStopToList,
  defaultFailureReasons,
  isOpen,
  resequence,
  sortBySequence,
  type Depot,
  type Driver,
  type FailureReason,
  type Stop,
  type Tour,
  type Vehicle,
} from "@turvio/shared";
import type { OutboxItem } from "./outbox";

export interface DriverSettingsView {
  failureReasons: FailureReason[];
  podLocation: boolean;
  showRecipientPhone: boolean;
}

export const DEFAULT_DRIVER_SETTINGS: DriverSettingsView = { failureReasons: defaultFailureReasons(), podLocation: false, showRecipientPhone: false };

/** Response of GET /v1/me/tours (see apps/api/src/routes/driver.ts). */
export interface MyTour {
  tour: Tour;
  organization: { id: string; name: string; timeZone: string; driverSettings?: DriverSettingsView };
  depot: Depot | null;
  driver: { id: string; displayName: string; maxShiftMinutes: number };
  vehicle: { id: string; label: string; licensePlate: string } | null;
  stops: Stop[];
}

export type { OutboxItem };

export interface ServerSnapshot {
  organizationId: string;
  organizationName: string;
  depots: Depot[];
  drivers: Driver[];
  vehicles: Vehicle[];
  tours: Tour[];
  stops: Stop[];
  driverId: string;
  settingsByOrg: Record<string, DriverSettingsView>;
  /** The company's IANA time zone; its calendar day decides which tours are "today". */
  timeZone: string | null;
}

/** Map the API payload into the driver store shape. */
export function snapshotFrom(payload: { tours: MyTour[]; timeZone?: string | null }, fallbackDriverId: string, previous?: Pick<ServerSnapshot, "depots" | "drivers"> & { timeZone?: string | null }): ServerSnapshot {
  const t = payload.tours;
  const first = t[0];
  const depots = new Map<string, Depot>((previous?.depots ?? []).map((d) => [d.id, d]));
  const vehicles = new Map<string, Vehicle>();
  const settingsByOrg: Record<string, DriverSettingsView> = {};
  for (const x of t) {
    if (x.depot) depots.set(x.depot.id, x.depot);
    if (x.vehicle) vehicles.set(x.vehicle.id, { id: x.vehicle.id, organizationId: x.tour.organizationId, label: x.vehicle.label, licensePlate: x.vehicle.licensePlate, depotId: x.tour.depotId, capacityParcels: null });
    settingsByOrg[x.organization.id] = { ...DEFAULT_DRIVER_SETTINGS, ...(x.organization.driverSettings ?? {}) };
  }
  return {
    organizationId: first?.organization.id ?? "",
    organizationName: first?.organization.name ?? "",
    depots: [...depots.values()],
    vehicles: [...vehicles.values()],
    drivers: first
      ? [{ id: first.driver.id, organizationId: first.tour.organizationId, displayName: first.driver.displayName, depotId: first.tour.depotId, maxShiftMinutes: first.driver.maxShiftMinutes, active: true }]
      : (previous?.drivers ?? []),
    tours: t.map((x) => x.tour),
    stops: t.flatMap((x) => x.stops),
    driverId: first?.driver.id ?? fallbackDriverId,
    settingsByOrg,
    timeZone: payload.timeZone ?? first?.organization.timeZone ?? previous?.timeZone ?? null,
  };
}

/**
 * Re-apply not-yet-confirmed local changes on top of fresh server data, so
 * nothing the driver did offline disappears from the screen while it waits.
 */
/** A stop without its approach point (invalid once the address or pin changed). */
const withoutApproach = (s: Stop): Stop => {
  const { approach: _a, ...rest } = s;
  return rest;
};

export function applyOutbox(snapshot: ServerSnapshot, outbox: OutboxItem[], localTours: Tour[] = []): ServerSnapshot {
  if (!outbox.length) return snapshot;
  let { stops, tours } = snapshot;
  for (const o of outbox) {
    switch (o.kind) {
      case "create_tour": {
        if (!tours.some((t) => t.id === o.tourId)) {
          const local = localTours.find((t) => t.id === o.tourId);
          if (local) tours = [...tours, local];
        }
        break;
      }
      case "create_stops": {
        const tour = tours.find((t) => t.id === o.tourId);
        if (!tour) break;
        for (const input of o.stops) {
          const existing = stops.find((s) => s.id === input.id);
          if (existing) {
            const known = new Set(existing.parcels.map((p) => p.trackingNumber));
            const extra = (input.trackingNumbers ?? []).filter((n) => !known.has(n));
            if (extra.length) stops = stops.map((s) => (s.id === existing.id ? { ...s, parcels: [...s.parcels, ...extra.map((n, i) => ({ id: `${s.id}-p${known.size + i}`, trackingNumber: n }))] } : s));
          } else {
            const current = stops.filter((s) => s.tourId === o.tourId);
            const { stop } = addStopToList([], tour, input);
            stops = [...stops, { ...stop, id: input.id, sequence: current.length }];
          }
        }
        break;
      }
      case "stop_status":
        stops = stops.map((s) =>
          s.id === o.stopId
            ? {
                ...s,
                status: o.status,
                completedAt: isOpen(o.status) ? undefined : o.at,
                failureReason: o.failureReason,
                driverNotes: o.notes ?? s.driverNotes,
              }
            : s,
        );
        break;
      case "stop_note":
        stops = stops.map((s) => (s.id === o.stopId ? { ...s, driverNotes: o.note } : s));
        break;
      case "tour_status":
        tours = tours.map((t) => (t.id === o.tourId ? { ...t, status: o.status } : t));
        break;
      case "scans": {
        const codes = new Map(o.scans.map((x) => [x.code, x.at]));
        stops = stops.map((s) =>
          s.tourId === o.tourId && s.parcels.some((p) => codes.has(p.trackingNumber.toUpperCase()))
            ? { ...s, parcels: s.parcels.map((p) => (codes.has(p.trackingNumber.toUpperCase()) && !p.loadedAt ? { ...p, loadedAt: codes.get(p.trackingNumber.toUpperCase()) } : p)) }
            : s,
        );
        break;
      }
      case "stop_update":
        // Same rules as the database (P0-3.2): a moved pin gets the next location version and loses
        // its approach point (that belonged to the old position).
        stops = stops.map((s) =>
          s.id === o.stopId
            ? o.location
              ? withoutApproach({
                  ...s,
                  locked: o.locked ?? s.locked,
                  location: o.location,
                  locationSource: o.locationSource ?? "manual_pin",
                  ...(s.locationVersion != null ? { locationVersion: s.locationVersion + 1 } : {}),
                })
              : { ...s, locked: o.locked ?? s.locked }
            : s,
        );
        break;
      case "sequence": {
        const tourStops = sortBySequence(stops.filter((s) => s.tourId === o.tourId));
        const closed = tourStops.filter((s) => !isOpen(s.status));
        const byId = new Map(tourStops.map((s) => [s.id, s]));
        const ordered = o.stopIds.map((id) => byId.get(id)).filter((s): s is Stop => !!s && isOpen(s.status));
        const rest = tourStops.filter((s) => isOpen(s.status) && !o.stopIds.includes(s.id));
        const next = resequence([...closed, ...ordered, ...rest]);
        stops = [...stops.filter((s) => s.tourId !== o.tourId), ...next];
        break;
      }
      case "stop_edit":
        stops = stops.map((s) => {
          if (s.id !== o.stopId) return s;
          const changed = s.address.street !== o.address.street || (s.address.houseNumber ?? "") !== (o.address.houseNumber ?? "") || s.address.postalCode !== o.address.postalCode || s.address.city !== o.address.city;
          const location = o.location ?? (changed ? null : s.location);
          const moved = (location?.lat ?? null) !== (s.location?.lat ?? null) || (location?.lng ?? null) !== (s.location?.lng ?? null);
          const next: Stop = {
            ...s,
            recipientName: o.recipientName ?? undefined,
            address: { ...s.address, ...o.address },
            location,
            locationSource: o.location ? (o.locationSource ?? "manual_pin") : changed ? null : s.locationSource,
            ...(changed && s.addressVersion != null ? { addressVersion: s.addressVersion + 1 } : {}),
            ...(moved && s.locationVersion != null ? { locationVersion: s.locationVersion + 1 } : {}),
          };
          return changed || moved ? withoutApproach(next) : next;
        });
        break;
      case "stop_remove":
        stops = stops.filter((s) => s.id !== o.stopId);
        break;
      case "stop_merge": {
        const from = stops.find((s) => s.id === o.stopId);
        if (from) {
          stops = stops
            .filter((s) => s.id !== o.stopId)
            .map((s) => (s.id === o.intoStopId ? { ...s, priority: s.priority || from.priority, parcels: [...s.parcels, ...from.parcels.filter((p) => !s.parcels.some((q) => q.trackingNumber === p.trackingNumber))] } : s));
        }
        break;
      }
      case "proof":
        stops = stops.map((s) =>
          s.id === o.stopId && !(s.proofs ?? []).some((p) => p.id === o.proofId)
            ? { ...s, proofs: [...(s.proofs ?? []), { id: o.proofId, kind: o.proofKind, capturedAt: o.at, recipientName: o.recipientName ?? null, notes: o.notes ?? null, hasLocation: !!o.location }] }
            : s,
        );
        break;
    }
  }
  return { ...snapshot, stops, tours };
}

/** Ids of proofs that are still only on this device. */
export function pendingProofIds(outbox: OutboxItem[]): Set<string> {
  return new Set(outbox.flatMap((o) => (o.kind === "proof" ? [o.proofId] : [])));
}
