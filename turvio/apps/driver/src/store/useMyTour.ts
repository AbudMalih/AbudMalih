import { sortBySequence, type Stop, type Tour } from "@turvio/shared";
import { useMemo } from "react";
import { DEFAULT_DRIVER_SETTINGS } from "../lib/sync";
import { useTourStore } from "./tourStore";

/** The driver's routes (dispatch tours + personal routes) and the active one with its stops. */
export function useMyTour() {
  const tours = useTourStore((s) => s.tours);
  const allStops = useTourStore((s) => s.stops);
  const depots = useTourStore((s) => s.depots);
  const drivers = useTourStore((s) => s.drivers);
  const driverId = useTourStore((s) => s.driverId);
  const activeTourId = useTourStore((s) => s.activeTourId);
  const settingsByOrg = useTourStore((s) => s.settingsByOrg);

  return useMemo(() => {
    const mine = tours.filter((t) => t.driverId === driverId);
    const rank = (t: Tour) => (t.status === "in_progress" ? 0 : t.status === "paused" ? 1 : t.status === "planned" ? 2 : 3);
    const ordered = [...mine].sort((a, b) => rank(a) - rank(b) || a.plannedStartMinute - b.plannedStartMinute);
    const tour = mine.find((t) => t.id === activeTourId) ?? ordered[0];
    const depot = depots.find((d) => d.id === tour?.depotId);
    const driver = drivers.find((d) => d.id === driverId);
    const stops: Stop[] = tour ? sortBySequence(allStops.filter((s) => s.tourId === tour.id)) : [];
    const settings = (tour && settingsByOrg[tour.organizationId]) || DEFAULT_DRIVER_SETTINGS;
    return { tours: ordered, tour, depot, driver, stops, settings };
  }, [tours, allStops, depots, drivers, driverId, activeTourId, settingsByOrg]);
}

export function useStop(id: string | undefined) {
  const stop = useTourStore((s) => s.stops.find((x) => x.id === id));
  const tour = useTourStore((s) => s.tours.find((t) => t.id === stop?.tourId));
  const settings = useTourStore((s) => (tour ? s.settingsByOrg[tour.organizationId] : undefined)) ?? DEFAULT_DRIVER_SETTINGS;
  return { stop, tour, settings };
}
