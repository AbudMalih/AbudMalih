import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  addStop as addStopToList,
  createSyntheticDataset,
  moveStop as moveStopInList,
  setStopStatus as setStatus,
  sortBySequence,
  type Locale,
  type NewStopInput,
  type Stop,
  type StopStatus,
  type SyntheticDataset,
  type Tour,
  type TourStatus,
} from "@turvio/shared";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { optimizeTour, type OptimizationOutcome } from "../lib/optimizer";

/**
 * Driver-side state. Persisted to AsyncStorage so the current tour stays
 * available offline. Until the Supabase sync is implemented the data source
 * is the synthetic dataset from @turvio/shared.
 */

// Development identity until Supabase Auth is wired up.
export const DEV_DRIVER_ID = "drv_01";

const TOUR_TRANSITIONS: Record<"start" | "pause" | "resume" | "finish", [TourStatus[], TourStatus]> = {
  start: [["planned"], "in_progress"],
  pause: [["in_progress"], "paused"],
  resume: [["paused"], "in_progress"],
  finish: [["in_progress", "paused"], "completed"],
};

export interface TourState extends SyntheticDataset {
  driverId: string;
  locale: Locale | null;
  lastOptimization: (OptimizationOutcome & { tourId: string; at: string }) | null;
  optimizing: boolean;

  setLocale(locale: Locale): void;
  addStop(tourId: string, input: NewStopInput): { stop: Stop; merged: boolean };
  setStopStatus(stopId: string, status: StopStatus, notes?: string): void;
  moveStop(tourId: string, from: number, to: number): void;
  tourAction(tourId: string, action: keyof typeof TOUR_TRANSITIONS): void;
  optimize(tourId: string): Promise<OptimizationOutcome>;
  resetData(): void;
}

function replaceTourStops(all: Stop[], tourId: string, tourStops: Stop[]): Stop[] {
  return [...all.filter((s) => s.tourId !== tourId), ...tourStops];
}

export const useTourStore = create<TourState>()(
  persist(
    (set, get) => ({
      ...createSyntheticDataset(),
      driverId: DEV_DRIVER_ID,
      locale: null,
      lastOptimization: null,
      optimizing: false,

      setLocale: (locale) => set({ locale }),

      addStop: (tourId, input) => {
        const tour = get().tours.find((t) => t.id === tourId);
        if (!tour) throw new Error(`Unknown tour ${tourId}`);
        const current = get().stops.filter((s) => s.tourId === tourId);
        const result = addStopToList(current, tour, input);
        set({ stops: replaceTourStops(get().stops, tourId, result.stops) });
        return { stop: result.stop, merged: result.merged };
      },

      setStopStatus: (stopId, status, notes) => {
        set({
          stops: get().stops.map((s) => {
            if (s.id !== stopId) return s;
            const updated = setStatus(s, status);
            return notes !== undefined ? { ...updated, notes } : updated;
          }),
        });
      },

      moveStop: (tourId, from, to) => {
        const current = get().stops.filter((s) => s.tourId === tourId);
        set({ stops: replaceTourStops(get().stops, tourId, moveStopInList(current, from, to)) });
      },

      tourAction: (tourId, action) => {
        const [allowed, next] = TOUR_TRANSITIONS[action];
        const now = new Date().toISOString();
        set({
          tours: get().tours.map((t): Tour => {
            if (t.id !== tourId || !allowed.includes(t.status)) return t;
            return {
              ...t,
              status: next,
              startedAt: action === "start" ? now : t.startedAt,
              finishedAt: action === "finish" ? now : t.finishedAt,
            };
          }),
        });
      },

      optimize: async (tourId) => {
        const state = get();
        const tour = state.tours.find((t) => t.id === tourId);
        const depot = state.depots.find((d) => d.id === tour?.depotId);
        const driver = state.drivers.find((d) => d.id === tour?.driverId);
        if (!tour || !depot) throw new Error(`Unknown tour ${tourId}`);
        set({ optimizing: true });
        try {
          const outcome = await optimizeTour({
            tour,
            depot,
            maxShiftMinutes: driver?.maxShiftMinutes ?? 480,
            stops: sortBySequence(state.stops.filter((s) => s.tourId === tourId)),
          });
          set({
            stops: replaceTourStops(get().stops, tourId, outcome.stops),
            lastOptimization: { ...outcome, tourId, at: new Date().toISOString() },
          });
          return outcome;
        } finally {
          set({ optimizing: false });
        }
      },

      resetData: () => set({ ...createSyntheticDataset(), lastOptimization: null }),
    }),
    {
      // v2: entities carry organizationId (multi-tenant). Older caches are discarded.
      name: "turvio-driver-v2",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        organizationId: s.organizationId,
        depots: s.depots,
        drivers: s.drivers,
        vehicles: s.vehicles,
        tours: s.tours,
        stops: s.stops,
        driverId: s.driverId,
        locale: s.locale,
        lastOptimization: s.lastOptimization,
      }),
    },
  ),
);

