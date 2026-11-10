import { operatingClock, type Depot, type DispatchDataset, type Driver, type Stop, type Tour, type UnassignedStop, type Vehicle } from "@turvio/shared";
import type { Tx } from "../db";

/* Row -> domain mappers. Every query runs under RLS (Db.asUser). */

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : undefined);

export interface DepotRow {
  id: string;
  organization_id: string;
  name: string;
  street: string;
  house_number: string | null;
  postal_code: string;
  city: string;
  country_code: string;
  lat: number;
  lng: number;
}
export const toDepot = (r: DepotRow): Depot => ({
  id: r.id,
  organizationId: r.organization_id,
  name: r.name,
  address: { street: r.street, houseNumber: r.house_number ?? undefined, postalCode: r.postal_code, city: r.city, countryCode: r.country_code.trim() },
  location: { lat: r.lat, lng: r.lng },
});

export interface DriverRow {
  id: string;
  organization_id: string;
  user_id: string | null;
  depot_id: string | null;
  display_name: string;
  max_shift_minutes: number;
  active: boolean;
}
export const toDriver = (r: DriverRow): Driver & { userId: string | null } => ({
  id: r.id,
  organizationId: r.organization_id,
  displayName: r.display_name,
  depotId: r.depot_id ?? "",
  maxShiftMinutes: r.max_shift_minutes,
  active: r.active,
  userId: r.user_id,
});

export interface VehicleRow {
  id: string;
  organization_id: string;
  depot_id: string | null;
  label: string;
  license_plate: string;
  capacity_parcels: number | null;
  active: boolean;
}
export const toVehicle = (r: VehicleRow): Vehicle & { active: boolean } => ({
  id: r.id,
  organizationId: r.organization_id,
  label: r.label,
  licensePlate: r.license_plate,
  depotId: r.depot_id ?? "",
  capacityParcels: r.capacity_parcels,
  active: r.active,
});

export interface TourRow {
  id: string;
  organization_id: string;
  depot_id: string;
  driver_id: string | null;
  vehicle_id: string | null;
  name: string;
  tour_date: string;
  status: Tour["status"];
  planned_start_minute: number;
  start_lat: number | null;
  start_lng: number | null;
  end_lat: number | null;
  end_lng: number | null;
  /** Added in 20261114000100_tour_start_end (absent on databases without it). */
  end_mode?: "depot" | "address" | "last_stop";
  start_label?: string | null;
  end_label?: string | null;
  started_at: Date | null;
  finished_at: Date | null;
  version: number;
  published_at: Date | null;
  optimized_at: Date | null;
  optimization: Tour["optimization"];
  origin?: "dispatch" | "driver";
}
export const toTour = (r: TourRow): Tour => ({
  id: r.id,
  organizationId: r.organization_id,
  name: r.name,
  date: r.tour_date,
  depotId: r.depot_id,
  driverId: r.driver_id,
  vehicleId: r.vehicle_id,
  status: r.status,
  plannedStartMinute: r.planned_start_minute,
  startLocation: r.start_lat != null && r.start_lng != null ? { lat: r.start_lat, lng: r.start_lng } : undefined,
  endLocation: r.end_lat != null && r.end_lng != null ? { lat: r.end_lat, lng: r.end_lng } : undefined,
  startLabel: r.start_label ?? null,
  endLabel: r.end_label ?? null,
  endMode: r.end_mode ?? (r.end_lat != null && r.end_lng != null ? "address" : "depot"),
  startedAt: iso(r.started_at),
  finishedAt: iso(r.finished_at),
  version: r.version,
  publishedAt: r.published_at ? r.published_at.toISOString() : null,
  optimizedAt: r.optimized_at ? r.optimized_at.toISOString() : null,
  optimization: r.optimization ?? null,
  origin: r.origin ?? "dispatch",
});

export interface StopRow {
  id: string;
  organization_id: string;
  tour_id: string | null;
  depot_id: string | null;
  type: Stop["type"];
  sequence: number;
  recipient_name: string | null;
  street: string;
  house_number: string | null;
  postal_code: string;
  city: string;
  country_code: string;
  lat: number | null;
  lng: number | null;
  tw_start_minute: number | null;
  tw_end_minute: number | null;
  service_seconds: number;
  priority: boolean;
  notes: string | null;
  status: Stop["status"];
  completed_at: Date | null;
  failure_reason?: string | null;
  driver_notes?: string | null;
  locked?: boolean;
  location_source?: Stop["locationSource"];
  address_version?: number;
  location_version?: number;
  location_precision?: Stop["locationPrecision"];
  recipient_phone?: string | null;
  parcels: { id: string; tracking_number: string; barcode: string | null; recipient_name: string | null; company?: string | null; loaded_at?: string | null }[] | null;
  proofs?: { id: string; kind: "photo" | "signature"; captured_at: string; recipient_name: string | null; notes: string | null; has_location: boolean }[] | null;
}
function stopBase(r: StopRow) {
  return {
    id: r.id,
    organizationId: r.organization_id,
    type: r.type,
    recipientName: r.recipient_name ?? undefined,
    address: { street: r.street, houseNumber: r.house_number ?? undefined, postalCode: r.postal_code, city: r.city, countryCode: r.country_code.trim() },
    location: r.lat != null && r.lng != null ? { lat: r.lat, lng: r.lng } : null,
    timeWindow: r.tw_start_minute != null && r.tw_end_minute != null ? { start: r.tw_start_minute, end: r.tw_end_minute } : undefined,
    serviceSeconds: r.service_seconds,
    priority: r.priority,
    notes: r.notes ?? undefined,
    parcels: (r.parcels ?? []).map((p) => ({
      id: p.id,
      trackingNumber: p.tracking_number,
      barcode: p.barcode ?? undefined,
      recipientName: p.recipient_name ?? undefined,
      ...(p.company ? { company: p.company } : {}),
      ...(p.loaded_at ? { loadedAt: new Date(p.loaded_at).toISOString() } : {}),
    })),
    status: r.status,
    completedAt: iso(r.completed_at),
    failureReason: r.failure_reason ?? undefined,
    driverNotes: r.driver_notes ?? undefined,
    locked: r.locked ?? false,
    locationSource: r.location_source ?? null,
    ...(r.address_version != null ? { addressVersion: r.address_version, locationVersion: r.location_version!, locationPrecision: r.location_precision ?? "unknown" } : {}),
    recipientPhone: r.recipient_phone ?? undefined,
    proofs: (r.proofs ?? []).map((p) => ({
      id: p.id,
      kind: p.kind,
      capturedAt: new Date(p.captured_at).toISOString(),
      recipientName: p.recipient_name,
      notes: p.notes,
      hasLocation: p.has_location,
    })),
  };
}
export const toStop = (r: StopRow): Stop => ({ ...stopBase(r), tourId: r.tour_id!, sequence: r.sequence });
export const toUnassigned = (r: StopRow): UnassignedStop => ({ ...stopBase(r), depotId: r.depot_id! });

export const STOP_SELECT = `
  select s.*, (select coalesce(json_agg(json_build_object('id', p.id, 'tracking_number', p.tracking_number, 'barcode', p.barcode, 'recipient_name', p.recipient_name, 'company', p.company, 'loaded_at', p.loaded_at) order by p.created_at, p.import_position nulls last, p.id), '[]'::json)
                 from public.parcels p where p.stop_id = s.id) as parcels,
              (select coalesce(json_agg(json_build_object('id', f.id, 'kind', f.kind, 'captured_at', f.captured_at, 'recipient_name', f.recipient_name, 'notes', f.notes, 'has_location', f.lat is not null) order by f.captured_at), '[]'::json)
                 from public.proofs f where f.stop_id = s.id) as proofs
    from public.stops s`;

export async function orgTimeZone(tx: Tx, orgId: string): Promise<string> {
  const { rows } = await tx.query<{ time_zone: string }>(`select time_zone from public.organizations where id = $1`, [orgId]);
  return rows[0]?.time_zone ?? "Europe/Berlin";
}

/** Everything Dispatch needs for one operating day, already scoped by RLS. */
export async function loadDispatchDataset(tx: Tx, orgId: string, date: string | undefined): Promise<DispatchDataset> {
  const timeZone = await orgTimeZone(tx, orgId);
  const clock = operatingClock(date, timeZone);
  const day = clock.date;
  const [depots, drivers, vehicles, tours] = await Promise.all([
    tx.query<DepotRow>(`select * from public.depots where organization_id = $1 order by name`, [orgId]),
    tx.query<DriverRow>(`select * from public.drivers where organization_id = $1 order by display_name`, [orgId]),
    tx.query<VehicleRow>(`select * from public.vehicles where organization_id = $1 and active order by label`, [orgId]),
    tx.query<TourRow>(`select * from public.tours where organization_id = $1 and tour_date = $2 order by name`, [orgId, day]),
  ]);
  const tourIds = tours.rows.map((t) => t.id);
  const stops = await tx.query<StopRow>(
    `${STOP_SELECT} where s.organization_id = $1 and (s.tour_id = any($2::uuid[]) or s.tour_id is null) order by s.tour_id nulls last, s.sequence`,
    [orgId, tourIds],
  );
  return {
    organizationId: orgId,
    date: day,
    asOfMinute: clock.asOfMinute,
    isToday: clock.isToday,
    timeZone,
    depots: depots.rows.map(toDepot),
    drivers: drivers.rows.map(toDriver),
    vehicles: vehicles.rows.map(toVehicle),
    tours: tours.rows.map(toTour),
    stops: stops.rows.filter((s) => s.tour_id).map(toStop),
    unassigned: stops.rows.filter((s) => !s.tour_id).map(toUnassigned),
  };
}

type Point = { lat: number; lng: number };
/** The tour's own start address, else the depot. */
export function tourStartOf(t: Pick<TourRow, "start_lat" | "start_lng">, depot: Point): Point {
  return t.start_lat != null && t.start_lng != null ? { lat: t.start_lat, lng: t.start_lng } : depot;
}
/** Where the tour ends; undefined = at its last stop (no return trip). */
export function tourEndOf(t: Pick<TourRow, "end_lat" | "end_lng" | "end_mode">, depot: Point): Point | undefined {
  if (t.end_mode === "last_stop") return undefined;
  if (t.end_mode !== "depot" && t.end_lat != null && t.end_lng != null) return { lat: t.end_lat, lng: t.end_lng };
  return depot;
}

/** Latest live position per tour of the dataset (RLS: only tours the caller may see). No coordinates leave the API. */
export async function loadTourPositions(tx: Tx, orgId: string, tourIds: string[]): Promise<Map<string, { lat: number; lng: number; ageSeconds: number }>> {
  if (!tourIds.length) return new Map();
  const { rows } = await tx.query<{ tour_id: string; lat: number; lng: number; age: number }>(
    `select tour_id, lat, lng, greatest(0, extract(epoch from now() - recorded_at))::int as age from public.driver_positions where organization_id = $1 and tour_id = any($2::uuid[])`,
    [orgId, tourIds],
  );
  return new Map(rows.map((r) => [r.tour_id, { lat: r.lat, lng: r.lng, ageSeconds: r.age }]));
}
