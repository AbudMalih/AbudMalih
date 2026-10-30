import { sortBySequence } from "@turvio/shared";
import { useMemo } from "react";
import { useTourStore } from "./tourStore";

/** The signed-in driver's current tour with its depot and ordered stops. */
export function useMyTour() {
  // Select stable slices only; derived arrays are memoised to avoid re-render loops.
  const tours = useTourStore((s) => s.tours);
  const allStops = useTourStore((s) => s.stops);
  const depots = useTourStore((s) => s.depots);
  const drivers = useTourStore((s) => s.drivers);
  const driverId = useTourStore((s) => s.driverId);

  return useMemo(() => {
    const mine = tours.filter((t) => t.driverId === driverId);
    const tour = mine.find((t) => t.status !== "completed") ?? mine[0];
    const depot = depots.find((d) => d.id === tour?.depotId);
    const driver = drivers.find((d) => d.id === driverId);
    const stops = tour ? sortBySequence(allStops.filter((s) => s.tourId === tour.id)) : [];
    return { tour, depot, driver, stops };
  }, [tours, allStops, depots, drivers, driverId]);
}
