import { can } from "../permissions";
import type { Membership } from "../schemas";
import type { DispatchDataset } from "./dataset";

/**
 * Depot-level access inside one tenant. Mirrors the database rule
 * app.can_access_depot(): owners/admins see every depot of their company;
 * dispatchers see only their assigned depots – none assigned = none (fail-closed) –
 * unless a Company Admin granted all locations. Drivers have no dispatch access.
 * Tenant isolation itself is enforced before this (membership must belong to the dataset's tenant).
 */
export function accessibleDepotIds(membership: Membership | null | undefined, data: Pick<DispatchDataset, "organizationId" | "depots">): string[] {
  if (!membership || !membership.active || membership.organizationId !== data.organizationId) return [];
  if (!can(membership.role, "tours.view_all")) return [];
  const all = data.depots.map((d) => d.id);
  if (membership.role === "owner" || membership.role === "admin") return all;
  if (membership.allLocations) return all;
  return all.filter((id) => (membership.depotIds ?? []).includes(id));
}

/** Return only the rows the membership may see (server-side filtering). */
export function scopeDispatchDataset(data: DispatchDataset, membership: Membership | null | undefined): DispatchDataset {
  const allowed = new Set(accessibleDepotIds(membership, data));
  const tours = data.tours.filter((t) => allowed.has(t.depotId));
  const tourIds = new Set(tours.map((t) => t.id));
  return {
    ...data,
    depots: data.depots.filter((d) => allowed.has(d.id)),
    drivers: data.drivers.filter((d) => allowed.has(d.depotId)),
    vehicles: data.vehicles.filter((v) => allowed.has(v.depotId)),
    tours,
    stops: data.stops.filter((s) => tourIds.has(s.tourId)),
    unassigned: data.unassigned.filter((u) => allowed.has(u.depotId)),
  };
}

/** Narrow an (already scoped) dataset to one depot, or keep all when depotId is null. */
export function filterByDepot(data: DispatchDataset, depotId: string | null): DispatchDataset {
  if (!depotId) return data;
  const tours = data.tours.filter((t) => t.depotId === depotId);
  const tourIds = new Set(tours.map((t) => t.id));
  return {
    ...data,
    depots: data.depots.filter((d) => d.id === depotId),
    drivers: data.drivers.filter((d) => d.depotId === depotId),
    vehicles: data.vehicles.filter((v) => v.depotId === depotId),
    tours,
    stops: data.stops.filter((s) => tourIds.has(s.tourId)),
    unassigned: data.unassigned.filter((u) => u.depotId === depotId),
  };
}
