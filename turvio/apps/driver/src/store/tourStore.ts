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
import { createAuthClient, isTransient, type AuthClient, type SessionUser } from "../lib/auth";
import { apiBaseUrl, optimizeTour, type OptimizationOutcome } from "../lib/optimizer";
import { applyOutbox, newOutboxId, snapshotFrom, type MyTour, type OutboxItem } from "../lib/sync";

/**
 * Driver-side state, persisted to AsyncStorage so the current tour stays
 * available offline.
 *
 * - server mode (EXPO_PUBLIC_API_URL set): the driver signs in; tours come from
 *   the TURVIO API (only tours dispatch published to this driver). Status
 *   changes are applied immediately on the device and queued in an outbox
 *   that is sent to the server – retried automatically when offline.
 * - demo mode (no server configured): synthetic data, everything local.
 */

export const DEV_DRIVER_ID = "drv_01";

const TOUR_TRANSITIONS: Record<"start" | "pause" | "resume" | "finish", [TourStatus[], Exclude<TourStatus, "planned">]> = {
  start: [["planned"], "in_progress"],
  pause: [["in_progress"], "paused"],
  resume: [["paused"], "in_progress"],
  finish: [["in_progress", "paused"], "completed"],
};

export type SyncState = "idle" | "syncing" | "offline" | "error";

export interface TourState extends SyntheticDataset {
  driverId: string;
  locale: Locale | null;
  lastOptimization: (OptimizationOutcome & { tourId: string; at: string }) | null;
  optimizing: boolean;
  // server mode
  user: SessionUser | null;
  organizationName: string;
  outbox: OutboxItem[];
  syncState: SyncState;
  syncMessage: string | null;
  lastSyncAt: string | null;

  setLocale(locale: Locale): void;
  addStop(tourId: string, input: NewStopInput): { stop: Stop; merged: boolean };
  setStopStatus(stopId: string, status: StopStatus, notes?: string): void;
  moveStop(tourId: string, from: number, to: number): void;
  tourAction(tourId: string, action: keyof typeof TOUR_TRANSITIONS): void;
  optimize(tourId: string): Promise<OptimizationOutcome>;
  resetData(): void;
  // server mode
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  sync(): Promise<void>;
}

export const isServerMode = () => !!apiBaseUrl();

let client: AuthClient | null = null;
/** Replaceable for tests. */
export function setAuthClient(c: AuthClient | null) {
  client = c;
}
function auth(): AuthClient {
  client ??= createAuthClient({ onSignedOut: () => useTourStore.setState({ user: null }) });
  return client;
}

function replaceTourStops(all: Stop[], tourId: string, tourStops: Stop[]): Stop[] {
  return [...all.filter((s) => s.tourId !== tourId), ...tourStops];
}

const EMPTY_SERVER = { organizationId: "", organizationName: "", depots: [], drivers: [], vehicles: [], tours: [], stops: [] };

export const useTourStore = create<TourState>()(
  persist(
    (set, get) => {
      let syncing: Promise<void> | null = null;

      async function flushOutbox() {
        // Drain the live queue, so changes made while a sync runs are sent in the same pass.
        for (let item = get().outbox[0]; item; item = get().outbox[0]) {
          try {
            if (item.kind === "stop_status") {
              await auth().request("POST", `/v1/orgs/${item.orgId}/stops/${item.stopId}/status`, { status: item.status, notes: item.notes });
            } else {
              await auth().request("POST", `/v1/orgs/${item.orgId}/tours/${item.tourId}/status`, { status: item.status });
            }
            set({ outbox: get().outbox.filter((o) => o.id !== item.id) });
          } catch (e) {
            if (isTransient(e)) throw e; // keep queued, retry on next sync
            // Rejected by the server (e.g. tour withdrawn): drop it and tell the driver.
            set({ outbox: get().outbox.filter((o) => o.id !== item.id), syncMessage: e instanceof Error ? e.message : String(e) });
          }
        }
      }

      function enqueue(item: OutboxItem) {
        set({ outbox: [...get().outbox, item] });
        void get().sync();
      }

      return {
        ...(isServerMode() ? EMPTY_SERVER : createSyntheticDataset()),
        organizationName: "",
        driverId: DEV_DRIVER_ID,
        locale: null,
        lastOptimization: null,
        optimizing: false,
        user: null,
        outbox: [],
        syncState: "idle",
        syncMessage: null,
        lastSyncAt: null,

        setLocale: (locale) => set({ locale }),

        addStop: (tourId, input) => {
          const tour = get().tours.find((t) => t.id === tourId);
          if (!tour) throw new Error(`Unknown tour ${tourId}`);
          const current = get().stops.filter((s) => s.tourId === tourId);
          if (!isServerMode()) {
            const result = addStopToList(current, tour, input);
            set({ stops: replaceTourStops(get().stops, tourId, result.stops) });
            return { stop: result.stop, merged: result.merged };
          }
          // Server: always a new stop (shown immediately, confirmed by the next sync).
          const { stop } = addStopToList([], tour, input);
          const placed = { ...stop, sequence: current.length };
          set({ stops: [...get().stops, placed] });
          auth()
            .request("POST", `/v1/orgs/${tour.organizationId}/stops`, { tourId, stops: [input] })
            .then(() => get().sync())
            .catch((e) => set({ syncMessage: `Stop not saved: ${e instanceof Error ? e.message : String(e)}`, stops: get().stops.filter((s) => s.id !== placed.id) }));
          return { stop: placed, merged: false };
        },

        setStopStatus: (stopId, status, notes) => {
          const before = get().stops.find((s) => s.id === stopId);
          set({
            stops: get().stops.map((s) => {
              if (s.id !== stopId) return s;
              const updated = setStatus(s, status);
              return notes !== undefined ? { ...updated, notes } : updated;
            }),
          });
          if (isServerMode() && before) {
            enqueue({ id: newOutboxId(), kind: "stop_status", orgId: before.organizationId, stopId, status, notes, at: new Date().toISOString() });
          }
        },

        moveStop: (tourId, from, to) => {
          const current = get().stops.filter((s) => s.tourId === tourId);
          const moved = moveStopInList(current, from, to);
          set({ stops: replaceTourStops(get().stops, tourId, moved) });
          if (isServerMode()) {
            const pending = moved.filter((s) => s.status === "pending").map((s) => s.id);
            auth()
              .request("POST", `/v1/me/tours/${tourId}/sequence`, { stopIds: pending })
              .then(() => get().sync())
              .catch((e) => set({ syncMessage: `New order not saved: ${e instanceof Error ? e.message : String(e)}` }));
          }
        },

        tourAction: (tourId, action) => {
          const [allowed, next] = TOUR_TRANSITIONS[action];
          const tour = get().tours.find((t) => t.id === tourId);
          if (!tour || !allowed.includes(tour.status)) return;
          const now = new Date().toISOString();
          set({
            tours: get().tours.map((t): Tour =>
              t.id !== tourId ? t : { ...t, status: next, startedAt: action === "start" ? now : t.startedAt, finishedAt: action === "finish" ? now : t.finishedAt },
            ),
          });
          if (isServerMode()) enqueue({ id: newOutboxId(), kind: "tour_status", orgId: tour.organizationId, tourId, status: next, at: now });
        },

        optimize: async (tourId) => {
          const state = get();
          const tour = state.tours.find((t) => t.id === tourId);
          const depot = state.depots.find((d) => d.id === tour?.depotId);
          const driver = state.drivers.find((d) => d.id === tour?.driverId);
          if (!tour || !depot) throw new Error(`Unknown tour ${tourId}`);
          set({ optimizing: true });
          try {
            let outcome: OptimizationOutcome;
            if (isServerMode()) {
              // Saved tour: the server optimizes with OR-Tools and stores the new order.
              const r = await auth().request<{ stops: Stop[]; result: { matrixSource: "osrm" | "haversine_estimate"; unassignedStopIds: string[]; unlocatedStopIds?: string[] } }>(
                "POST",
                `/v1/orgs/${tour.organizationId}/tours/${tourId}/optimize`,
                {},
              );
              outcome = { stops: r.stops, engine: "server", matrixSource: r.result.matrixSource, unassignedStopIds: r.result.unassignedStopIds, unlocatedStopIds: r.result.unlocatedStopIds ?? [] };
            } else {
              outcome = await optimizeTour({ tour, depot, maxShiftMinutes: driver?.maxShiftMinutes ?? 480, stops: sortBySequence(state.stops.filter((s) => s.tourId === tourId)) });
            }
            set({ stops: replaceTourStops(get().stops, tourId, outcome.stops), lastOptimization: { ...outcome, tourId, at: new Date().toISOString() } });
            return outcome;
          } finally {
            set({ optimizing: false });
          }
        },

        resetData: () => set({ ...createSyntheticDataset(), lastOptimization: null }),

        signIn: async (email, password) => {
          const user = await auth().login(email.trim(), password);
          set({ user, syncMessage: null, outbox: [] });
          await get().sync();
        },

        signOut: async () => {
          await auth().logout();
          set({ ...EMPTY_SERVER, user: null, outbox: [], lastSyncAt: null, lastOptimization: null, syncState: "idle", syncMessage: null });
        },

        sync: async () => {
          if (!isServerMode() || !get().user) return;
          if (syncing) return syncing;
          syncing = (async () => {
            set({ syncState: "syncing" });
            try {
              await flushOutbox();
              const payload = await auth().request<{ tours: MyTour[] }>("GET", "/v1/me/tours");
              const snap = applyOutbox(snapshotFrom(payload, get().driverId), get().outbox);
              set({ ...snap, syncState: "idle", lastSyncAt: new Date().toISOString(), syncMessage: get().syncMessage });
            } catch (e) {
              const offline = isTransient(e);
              set({ syncState: offline ? "offline" : "error", syncMessage: e instanceof Error ? e.message : String(e) });
              if (!offline && (e as { status?: number }).status === 401) set({ user: null });
            } finally {
              syncing = null;
            }
          })();
          return syncing;
        },
      };
    },
    {
      // v3: server mode (user, outbox). Older caches are discarded.
      name: "turvio-driver-v3",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        organizationId: s.organizationId,
        organizationName: s.organizationName,
        depots: s.depots,
        drivers: s.drivers,
        vehicles: s.vehicles,
        tours: s.tours,
        stops: s.stops,
        driverId: s.driverId,
        locale: s.locale,
        lastOptimization: s.lastOptimization,
        user: s.user,
        outbox: s.outbox,
        lastSyncAt: s.lastSyncAt,
      }),
    },
  ),
);
