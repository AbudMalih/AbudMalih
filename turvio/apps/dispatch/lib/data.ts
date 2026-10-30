import {
  createSyntheticDataset,
  sortBySequence,
  tourProgress,
  type SyntheticDataset,
  type Tour,
  type TourProgress,
} from "@turvio/shared";

/**
 * DEVELOPMENT DATA SOURCE. Until Supabase Auth + queries are wired in, the
 * dashboard shows the synthetic dataset of the pilot tenant. Every query is
 * already scoped by organization so the switch to RLS-backed queries does
 * not change call sites.
 */
export const DEV_ORGANIZATION_ID = "org_jarbou";

export function getTenantData(organizationId: string = DEV_ORGANIZATION_ID): SyntheticDataset {
  const all = createSyntheticDataset();
  const own = <T extends { organizationId: string }>(rows: T[]) => rows.filter((r) => r.organizationId === organizationId);
  return {
    organizationId,
    depots: own(all.depots),
    drivers: own(all.drivers),
    vehicles: own(all.vehicles),
    tours: own(all.tours),
    stops: own(all.stops),
  };
}

export interface TourSummary {
  tour: Tour;
  driverName: string | null;
  vehicleLabel: string | null;
  depotName: string;
  progress: TourProgress;
  timeWindowStops: number;
  priorityStops: number;
}

export function summarizeTours(data: SyntheticDataset): TourSummary[] {
  return data.tours.map((tour) => {
    const stops = sortBySequence(data.stops.filter((s) => s.tourId === tour.id));
    return {
      tour,
      driverName: data.drivers.find((d) => d.id === tour.driverId)?.displayName ?? null,
      vehicleLabel: data.vehicles.find((v) => v.id === tour.vehicleId)?.label ?? null,
      depotName: data.depots.find((d) => d.id === tour.depotId)?.name ?? "–",
      progress: tourProgress(stops),
      timeWindowStops: stops.filter((s) => s.timeWindow).length,
      priorityStops: stops.filter((s) => s.priority).length,
    };
  });
}

export function overviewKpis(summaries: TourSummary[]) {
  return {
    tours: summaries.length,
    unassignedTours: summaries.filter((s) => !s.tour.driverId).length,
    stops: summaries.reduce((n, s) => n + s.progress.total, 0),
    parcels: summaries.reduce((n, s) => n + s.progress.parcels, 0),
    done: summaries.reduce((n, s) => n + s.progress.done, 0),
  };
}
