import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  addStop as addStopToList,
  canTransition,
  createSyntheticDataset,
  isOpen,
  moveStop as moveStopInList,
  normalizeTrackingNumber,
  resequence,
  routeKey,
  setStopStatus as applyStatus,
  sortBySequence,
  validateOutcome,
  type GeoPoint,
  type Locale,
  type NewStopInput,
  type ScanEntry,
  type Stop,
  type StopStatus,
  type SyntheticDataset,
  type Tour,
  type TourStatus,
} from "@turvio/shared";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { stopTracking } from "../lib/tracking";
import { createAuthClient, isTransient, type AuthClient, type SessionUser } from "../lib/auth";
import { deleteFile, readFileBase64 } from "../lib/files";
import { uuid } from "../lib/ids";
import type { NavApp } from "../lib/navigation";
import { apiBaseUrl, optimizeLocally, type OptimizationOutcome, type OptimizeOptions } from "../lib/optimizer";
import { drainOutbox, type OutboxItem } from "../lib/outbox";
import { DEFAULT_DRIVER_SETTINGS, applyOutbox, snapshotFrom, type DriverSettingsView, type MyTour } from "../lib/sync";

/**
 * Driver-side state, persisted on the device so the current tour, queued
 * changes, scans and captured proofs survive restarts and dead zones.
 *
 * - server mode (EXPO_PUBLIC_API_URL set): signed-in driver, tours published by
 *   dispatch plus personal routes. Every change is applied on the device at
 *   once and queued in a persistent outbox (client ids -> idempotent retries).
 * - demo mode (no server): synthetic data, everything stays on the device.
 */

export const DEV_DRIVER_ID = "drv_01";

const TOUR_TRANSITIONS: Record<"start" | "pause" | "resume" | "finish", [TourStatus[], Exclude<TourStatus, "planned">]> = {
  start: [["planned"], "in_progress"],
  pause: [["in_progress"], "paused"],
  resume: [["paused"], "in_progress"],
  finish: [["in_progress", "paused"], "completed"],
};

export type SyncState = "idle" | "syncing" | "offline" | "error";

export interface Prefs {
  /** Preferred navigation app; null = ask every time. */
  navApp: NavApp | null;
  /** Use the device position as start when optimizing. */
  optimizeFromDevice: boolean;
  colorScheme: "system" | "light" | "dark";
  /** Scan every supported symbology instead of the parcel-label profile (slower). */
  allBarcodeTypes?: boolean;
}

export interface FailedItem {
  item: OutboxItem;
  error: string;
  at: string;
}

export interface ProofCapture {
  photo?: { uri: string; base64?: string };
  signatureSvg?: string;
  recipientName?: string;
  notes?: string;
  location?: GeoPoint;
}

/** Road route from the API (OSRM), valid for the stop order it was computed for. */
export interface CachedRoad {
  key: string;
  source: "osrm" | "none";
  note?: string;
  geometry?: [number, number][];
  metrics?: { totalMeters: number; totalDriveSeconds: number; remainingMeters: number; remainingDriveSeconds: number; etas: Record<string, number> };
  at: string;
}

export interface TourState extends SyntheticDataset {
  roads: Record<string, CachedRoad>;
  loadRoad(tourId: string): Promise<void>;
  driverId: string;
  locale: Locale | null;
  prefs: Prefs;
  activeTourId: string | null;
  settingsByOrg: Record<string, DriverSettingsView>;
  lastOptimization: (OptimizationOutcome & { tourId: string; at: string }) | null;
  optimizing: boolean;
  /** Scan history per tour (survives restarts). */
  scans: Record<string, ScanEntry[]>;
  // server mode
  user: SessionUser | null;
  organizationName: string;
  outbox: OutboxItem[];
  failed: FailedItem[];
  syncState: SyncState;
  syncMessage: string | null;
  lastSyncAt: string | null;

  setLocale(locale: Locale): void;
  setPrefs(p: Partial<Prefs>): void;
  selectTour(id: string | null): void;
  createRoute(name: string, date: string): Tour;
  addStop(tourId: string, input: NewStopInput): { stop: Stop; merged: boolean };
  addStops(tourId: string, inputs: NewStopInput[]): { created: number; merged: number };
  setStopStatus(stopId: string, status: StopStatus, opts?: { notes?: string; failureReason?: string }): void;
  addNote(stopId: string, note: string): void;
  captureProof(stopId: string, capture: ProofCapture): Promise<number>;
  moveStop(tourId: string, from: number, to: number): void;
  /** New order of the open stops (closed stops keep their place first). */
  setOpenOrder(tourId: string, openIds: string[]): void;
  setLocked(stopId: string, locked: boolean): void;
  setStopLocation(stopId: string, location: GeoPoint, source: "geocoder" | "manual_pin"): void;
  recordScans(tourId: string, entries: ScanEntry[]): void;
  editStop(stopId: string, edit: { recipientName?: string; address: { street: string; houseNumber?: string; postalCode: string; city: string }; location?: GeoPoint | null; locationSource?: "geocoder" | "manual_pin" }): void;
  removeStop(stopId: string): void;
  mergeStops(fromId: string, intoId: string): void;
  tourAction(tourId: string, action: keyof typeof TOUR_TRANSITIONS): void;
  optimize(tourId: string, opts?: OptimizeOptions): Promise<OptimizationOutcome>;
  resetData(): void;
  retryFailed(id: string): void;
  discardFailed(id: string): Promise<void>;
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
export function auth(): AuthClient {
  client ??= createAuthClient({ onSignedOut: () => useTourStore.setState({ user: null }) });
  return client;
}

/** Overridable file helpers (tests). */
export const fileDeps = { readFileBase64, deleteFile };

function replaceTourStops(all: Stop[], tourId: string, tourStops: Stop[]): Stop[] {
  return [...all.filter((s) => s.tourId !== tourId), ...tourStops];
}

const EMPTY_SERVER = { organizationId: "", organizationName: "", depots: [], drivers: [], vehicles: [], tours: [], stops: [] };
const DEFAULT_PREFS: Prefs = { navApp: null, optimizeFromDevice: false, colorScheme: "system" };

export const useTourStore = create<TourState>()(
  persist(
    (set, get) => {
      let syncing: Promise<void> | null = null;
      const now = () => new Date().toISOString();

      function enqueue(item: OutboxItem) {
        if (!isServerMode()) return;
        set({ outbox: [...get().outbox, item] });
        void get().sync();
      }

      function orgOf(tourId: string) {
        return get().tours.find((t) => t.id === tourId)?.organizationId ?? get().organizationId;
      }

      function updateStop(stopId: string, fn: (s: Stop) => Stop) {
        set({ stops: get().stops.map((s) => (s.id === stopId ? fn(s) : s)) });
      }

      return {
        ...(isServerMode() ? EMPTY_SERVER : createSyntheticDataset()),
        organizationName: "",
        driverId: DEV_DRIVER_ID,
        locale: null,
        prefs: DEFAULT_PREFS,
        activeTourId: null,
        settingsByOrg: {},
        lastOptimization: null,
        optimizing: false,
        scans: {},
        roads: {},
        user: null,
        outbox: [],
        failed: [],
        syncState: "idle",
        syncMessage: null,
        lastSyncAt: null,

        setLocale: (locale) => set({ locale }),
        setPrefs: (p) => set({ prefs: { ...get().prefs, ...p } }),
        selectTour: (id) => set({ activeTourId: id }),

        createRoute: (name, date) => {
          const driver = get().drivers.find((d) => d.id === get().driverId) ?? get().drivers[0];
          const depotId = driver?.depotId ?? get().depots[0]?.id ?? "";
          const tour: Tour = {
            id: uuid(),
            organizationId: get().organizationId || driver?.organizationId || "",
            name: name.trim(),
            date,
            depotId,
            driverId: get().driverId,
            vehicleId: null,
            status: "planned",
            plannedStartMinute: 8 * 60,
            publishedAt: now(),
            origin: "driver",
          };
          set({ tours: [...get().tours, tour], activeTourId: tour.id });
          enqueue({ id: uuid(), kind: "create_tour", orgId: tour.organizationId, at: now(), tourId: tour.id, name: tour.name, date });
          return tour;
        },

        addStop: (tourId, input) => {
          const tour = get().tours.find((t) => t.id === tourId);
          if (!tour) throw new Error(`Unknown tour ${tourId}`);
          const current = get().stops.filter((s) => s.tourId === tourId);
          const result = addStopToList(current, tour, { ...input, id: input.id ?? uuid() });
          set({ stops: replaceTourStops(get().stops, tourId, result.stops) });
          const { stop } = result;
          enqueue({
            id: uuid(),
            kind: "create_stops",
            orgId: tour.organizationId,
            at: now(),
            tourId,
            stops: [
              {
                id: stop.id,
                type: stop.type === "pickup" ? "pickup" : "delivery",
                recipientName: stop.recipientName,
                address: stop.address,
                location: stop.location,
                locationSource: stop.location ? (stop.locationSource ?? "manual_pin") : null,
                timeWindow: stop.timeWindow,
                serviceSeconds: stop.serviceSeconds,
                priority: stop.priority,
                notes: stop.notes,
                recipientPhone: stop.recipientPhone,
                trackingNumbers: stop.parcels.map((p) => p.trackingNumber),
              },
            ],
          });
          return { stop, merged: result.merged };
        },

        addStops: (tourId, inputs) => {
          let created = 0;
          let merged = 0;
          for (const input of inputs) {
            const r = get().addStop(tourId, input);
            if (r.merged) merged++;
            else created++;
          }
          return { created, merged };
        },

        setStopStatus: (stopId, status, opts = {}) => {
          const before = get().stops.find((s) => s.id === stopId);
          if (!before) throw new Error(`Unknown stop ${stopId}`);
          if (!canTransition(before.status, status)) throw new Error(`Invalid stop status transition ${before.status} -> ${status}`);
          const reasons = (get().settingsByOrg[before.organizationId] ?? DEFAULT_DRIVER_SETTINGS).failureReasons;
          const invalid = validateOutcome({ status, failureReason: opts.failureReason, notes: opts.notes }, reasons);
          if (invalid) throw new Error(invalid);
          updateStop(stopId, (s) => {
            const next = applyStatus(s, status, new Date(), { failureReason: opts.failureReason });
            return opts.notes !== undefined ? { ...next, driverNotes: opts.notes } : next;
          });
          enqueue({ id: uuid(), kind: "stop_status", orgId: before.organizationId, at: now(), stopId, status, notes: opts.notes, failureReason: opts.failureReason });
        },

        addNote: (stopId, note) => {
          const stop = get().stops.find((s) => s.id === stopId);
          if (!stop || !note.trim()) return;
          updateStop(stopId, (s) => ({ ...s, driverNotes: note.trim() }));
          enqueue({ id: uuid(), kind: "stop_note", orgId: stop.organizationId, at: now(), stopId, note: note.trim() });
        },

        captureProof: async (stopId, capture) => {
          const stop = get().stops.find((s) => s.id === stopId);
          if (!stop) throw new Error(`Unknown stop ${stopId}`);
          const settings = get().settingsByOrg[stop.organizationId] ?? DEFAULT_DRIVER_SETTINGS;
          const location = settings.podLocation ? capture.location : undefined;
          const at = now();
          const items: OutboxItem[] = [];
          if (capture.photo) {
            const proofId = uuid();
            items.push({
              id: uuid(),
              kind: "proof",
              orgId: stop.organizationId,
              at,
              proofId,
              stopId,
              proofKind: "photo",
              contentType: "image/jpeg",
              fileUri: capture.photo.base64 ? undefined : capture.photo.uri,
              dataBase64: capture.photo.base64,
              recipientName: capture.recipientName,
              notes: capture.notes,
              location,
            });
          }
          if (capture.signatureSvg) {
            items.push({
              id: uuid(),
              kind: "proof",
              orgId: stop.organizationId,
              at,
              proofId: uuid(),
              stopId,
              proofKind: "signature",
              contentType: "image/svg+xml",
              dataBase64: base64Utf8(capture.signatureSvg),
              recipientName: capture.recipientName,
              notes: capture.notes,
              location,
            });
          }
          updateStop(stopId, (s) => ({
            ...s,
            proofs: [
              ...(s.proofs ?? []),
              ...items.map((i) => (i.kind === "proof" ? { id: i.proofId, kind: i.proofKind, capturedAt: at, recipientName: capture.recipientName ?? null, notes: capture.notes ?? null, hasLocation: !!location } : null)).filter((x) => !!x),
            ],
          }));
          if (isServerMode()) {
            set({ outbox: [...get().outbox, ...items] });
            void get().sync();
          }
          return items.length;
        },

        moveStop: (tourId, from, to) => {
          const current = get().stops.filter((s) => s.tourId === tourId);
          const moved = moveStopInList(current, from, to);
          set({ stops: replaceTourStops(get().stops, tourId, moved) });
          const open = moved.filter((s) => isOpen(s.status)).map((s) => s.id);
          if (open.length) enqueue({ id: uuid(), kind: "sequence", orgId: orgOf(tourId), at: now(), tourId, stopIds: open });
        },

        setOpenOrder: (tourId, openIds) => {
          const tourStops = sortBySequence(get().stops.filter((x) => x.tourId === tourId));
          const closed = tourStops.filter((x) => !isOpen(x.status));
          const byId = new Map(tourStops.map((x) => [x.id, x]));
          const open = openIds.map((id) => byId.get(id)).filter((x): x is Stop => !!x && isOpen(x.status));
          const rest = tourStops.filter((x) => isOpen(x.status) && !openIds.includes(x.id));
          set({ stops: replaceTourStops(get().stops, tourId, resequence([...closed, ...open, ...rest])) });
          enqueue({ id: uuid(), kind: "sequence", orgId: orgOf(tourId), at: now(), tourId, stopIds: [...open, ...rest].map((x) => x.id) });
        },

        setLocked: (stopId, locked) => {
          const stop = get().stops.find((s) => s.id === stopId);
          if (!stop) return;
          updateStop(stopId, (s) => ({ ...s, locked }));
          enqueue({ id: uuid(), kind: "stop_update", orgId: stop.organizationId, at: now(), stopId, locked });
        },

        setStopLocation: (stopId, location, source) => {
          const stop = get().stops.find((s) => s.id === stopId);
          if (!stop) return;
          updateStop(stopId, (s) => ({ ...s, location, locationSource: source }));
          enqueue({ id: uuid(), kind: "stop_update", orgId: stop.organizationId, at: now(), stopId, location, locationSource: source });
        },

        editStop: (stopId, edit) => {
          const stop = get().stops.find((x) => x.id === stopId);
          if (!stop) return;
          if (!isOpen(stop.status)) throw new Error("Only open stops can be edited");
          const item: OutboxItem = {
            id: uuid(),
            kind: "stop_edit",
            orgId: stop.organizationId,
            at: now(),
            stopId,
            recipientName: edit.recipientName,
            address: edit.address,
            location: edit.location ?? undefined,
            locationSource: edit.location ? (edit.locationSource ?? "manual_pin") : undefined,
          };
          // Same rule as the server: a changed address without a new pin loses the old position.
          const local = applyOutbox({ ...EMPTY_SERVER, driverId: "", settingsByOrg: {}, stops: [stop], tours: [] }, [item]).stops[0]!;
          updateStop(stopId, () => local);
          enqueue(item);
        },

        removeStop: (stopId) => {
          const stop = get().stops.find((x) => x.id === stopId);
          if (!stop) return;
          const tour = get().tours.find((t) => t.id === stop.tourId);
          if (tour?.origin !== "driver" && isServerMode()) throw new Error("Stops of dispatch tours are removed by dispatch");
          set({ stops: replaceTourStops(get().stops, stop.tourId, resequence(sortBySequence(get().stops.filter((x) => x.tourId === stop.tourId && x.id !== stopId)))) });
          enqueue({ id: uuid(), kind: "stop_remove", orgId: stop.organizationId, at: now(), stopId });
        },

        mergeStops: (fromId, intoId) => {
          const a = get().stops.find((x) => x.id === fromId);
          const b = get().stops.find((x) => x.id === intoId);
          if (!a || !b || a.tourId !== b.tourId || !isOpen(a.status) || !isOpen(b.status) || a.type !== b.type) throw new Error("Only open stops of the same type and route can be merged");
          const item: OutboxItem = { id: uuid(), kind: "stop_merge", orgId: a.organizationId, at: now(), stopId: fromId, intoStopId: intoId };
          const merged = applyOutbox({ ...EMPTY_SERVER, driverId: "", settingsByOrg: {}, stops: get().stops.filter((x) => x.tourId === a.tourId), tours: [] }, [item]).stops;
          set({ stops: replaceTourStops(get().stops, a.tourId, resequence(sortBySequence(merged))) });
          enqueue(item);
        },

        recordScans: (tourId, entries) => {
          if (!entries.length) return;
          const history = get().scans[tourId] ?? [];
          const known = new Set(history.map((e) => e.code));
          const fresh = entries.filter((e) => !known.has(e.code));
          set({ scans: { ...get().scans, [tourId]: [...history, ...fresh] } });
          const codes = new Map(fresh.map((e) => [e.code, e.at]));
          set({
            stops: get().stops.map((s) =>
              s.tourId !== tourId
                ? s
                : { ...s, parcels: s.parcels.map((p) => {
                      const code = normalizeTrackingNumber(p.trackingNumber);
                      return code && codes.has(code) && !p.loadedAt ? { ...p, loadedAt: codes.get(code) } : p;
                    }) },
            ),
          });
          if (fresh.length) enqueue({ id: uuid(), kind: "scans", orgId: orgOf(tourId), at: now(), tourId, scans: fresh.map((e) => ({ code: e.code, at: e.at })) });
        },

        tourAction: (tourId, action) => {
          const [allowed, next] = TOUR_TRANSITIONS[action];
          const tour = get().tours.find((t) => t.id === tourId);
          if (!tour || !allowed.includes(tour.status)) return;
          const at = now();
          set({
            tours: get().tours.map((t): Tour =>
              t.id !== tourId ? t : { ...t, status: next, startedAt: action === "start" ? at : t.startedAt, finishedAt: action === "finish" ? at : t.finishedAt },
            ),
          });
          enqueue({ id: uuid(), kind: "tour_status", orgId: tour.organizationId, at, tourId, status: next });
        },

        optimize: async (tourId, opts = {}) => {
          const state = get();
          const tour = state.tours.find((t) => t.id === tourId);
          const depot = state.depots.find((d) => d.id === tour?.depotId);
          if (!tour || !depot) throw new Error(`Unknown tour ${tourId}`);
          set({ optimizing: true });
          try {
            let outcome: OptimizationOutcome | null = null;
            if (isServerMode()) {
              // Queued stops must exist on the server before it can optimize them.
              await get().sync();
              const pendingForTour = get().outbox.some((o) => "tourId" in o && o.tourId === tourId);
              if (!pendingForTour) {
                try {
                  const r = await auth().request<{
                    stops: Stop[];
                    result: {
                      matrixSource: "osrm" | "haversine_estimate";
                      unassignedStopIds: string[];
                      unlocatedStopIds?: string[];
                      lockedStopIds?: string[];
                      distanceMeters?: number;
                      durationSeconds?: number;
                      violations?: { kind: string; stopId?: string | null; minutes?: number | null }[];
                    };
                  }>(
                    "POST",
                    `/v1/orgs/${tour.organizationId}/tours/${tourId}/optimize`,
                    { start: opts.start, end: opts.end, respectLocks: opts.respectLocks ?? true },
                  );
                  outcome = {
                    stops: r.stops,
                    engine: "server",
                    matrixSource: r.result.matrixSource,
                    unassignedStopIds: r.result.unassignedStopIds,
                    unlocatedStopIds: r.result.unlocatedStopIds ?? [],
                    lockedStopIds: r.result.lockedStopIds ?? [],
                    distanceMeters: r.result.distanceMeters,
                    durationSeconds: r.result.durationSeconds,
                    lateStops: (r.result.violations ?? []).filter((v) => v.kind === "late" && v.stopId).map((v) => ({ stopId: v.stopId!, minutes: v.minutes ?? 0 })),
                    overtimeMinutes: (r.result.violations ?? []).find((v) => v.kind === "overtime")?.minutes ?? 0,
                    unreachableStopIds: (r.result.violations ?? []).filter((v) => v.kind === "unassigned_unreachable" && v.stopId).map((v) => v.stopId!),
                  };
                } catch (e) {
                  // Road-routing problems are reported, never replaced by an on-device straight-line order.
                  if (!isTransient(e) || (e as { code?: string }).code?.startsWith("routing_")) throw e;
                  outcome = null; // offline -> on-device fallback below
                }
              }
            }
            if (!outcome) {
              const stops = sortBySequence(get().stops.filter((s) => s.tourId === tourId));
              outcome = optimizeLocally(tour, depot, stops, opts);
              if (isServerMode()) {
                const open = outcome.stops.filter((s) => isOpen(s.status)).map((s) => s.id);
                if (open.length) enqueue({ id: uuid(), kind: "sequence", orgId: tour.organizationId, at: now(), tourId, stopIds: open });
              }
            }
            set({ stops: replaceTourStops(get().stops, tourId, resequence(sortBySequence(outcome.stops))), lastOptimization: { ...outcome, tourId, at: now() } });
            if (outcome.engine === "server") void get().loadRoad(tourId);
            return outcome;
          } finally {
            set({ optimizing: false });
          }
        },

        loadRoad: async (tourId) => {
          if (!isServerMode() || !get().user) return;
          const tour = get().tours.find((t) => t.id === tourId);
          if (!tour || get().outbox.some((o) => "tourId" in o && o.tourId === tourId)) return; // server order not current yet
          const key = routeKey(sortBySequence(get().stops.filter((s) => s.tourId === tourId)));
          try {
            const r = await auth().request<Omit<CachedRoad, "key" | "at">>("GET", `/v1/orgs/${tour.organizationId}/tours/${tourId}/route`);
            set({ roads: { ...get().roads, [tourId]: { key, source: r.source, note: r.note, geometry: r.geometry, metrics: r.metrics, at: now() } } });
          } catch {
            // offline: keep the cached route; it is only shown while the stop order still matches
          }
        },

        resetData: () => set({ ...createSyntheticDataset(), lastOptimization: null, scans: {}, activeTourId: null, settingsByOrg: {} }),

        retryFailed: (id) => {
          const f = get().failed.find((x) => x.item.id === id);
          if (!f) return;
          set({ failed: get().failed.filter((x) => x.item.id !== id), outbox: [...get().outbox, { ...f.item, attempts: 0, nextAttemptAt: undefined }] });
          void get().sync();
        },

        discardFailed: async (id) => {
          const f = get().failed.find((x) => x.item.id === id);
          if (f?.item.kind === "proof" && f.item.fileUri) await fileDeps.deleteFile(f.item.fileUri).catch(() => undefined);
          set({ failed: get().failed.filter((x) => x.item.id !== id) });
          void get().sync();
        },

        signIn: async (email, password) => {
          const user = await auth().login(email.trim(), password);
          set({ user, syncMessage: null, outbox: [], failed: [] });
          await get().sync();
        },

        signOut: async () => {
          // Signing out ends any live tracking (the rest is uploaded first, while still signed in).
          await stopTracking().catch(() => undefined);
          await auth().logout();
          for (const o of get().outbox) if (o.kind === "proof" && o.fileUri) await fileDeps.deleteFile(o.fileUri).catch(() => undefined);
          set({ ...EMPTY_SERVER, user: null, outbox: [], failed: [], scans: {}, activeTourId: null, settingsByOrg: {}, lastSyncAt: null, lastOptimization: null, syncState: "idle", syncMessage: null });
        },

        sync: async () => {
          if (!isServerMode() || !get().user) return;
          if (syncing) return syncing;
          syncing = (async () => {
            set({ syncState: "syncing" });
            try {
              // Retry everything now (manual refresh / app foreground).
              set({ outbox: get().outbox.map((o) => ({ ...o, nextAttemptAt: undefined })) });
              const drained = await drainOutbox(
                () => get().outbox[0],
                (id) => set({ outbox: get().outbox.filter((o) => o.id !== id) }),
                (item) => set({ outbox: get().outbox.map((o) => (o.id === item.id ? item : o)) }),
                { client: auth(), ...fileDeps },
              );
              if (drained.failed.length) {
                set({
                  failed: [...get().failed, ...drained.failed.map((f) => ({ ...f, at: now() }))],
                  syncMessage: drained.failed.at(-1)!.error,
                });
              }
              if (drained.offline) {
                set({ syncState: "offline", syncMessage: drained.error ?? null });
                return;
              }
              const payload = await auth().request<{ tours: MyTour[] }>("GET", "/v1/me/tours");
              const localTours = get().tours;
              const snap = applyOutbox(snapshotFrom(payload, get().driverId, get()), get().outbox, localTours);
              const active = get().activeTourId;
              set({ ...snap, activeTourId: active && snap.tours.some((t) => t.id === active) ? active : null, syncState: "idle", lastSyncAt: now() });
              for (const t of snap.tours) if (t.status !== "completed") void get().loadRoad(t.id);
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
      // v4: Phase 4 outbox (client ids), proofs, scans, prefs. Older caches are discarded.
      name: "turvio-driver-v4",
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
        prefs: s.prefs,
        activeTourId: s.activeTourId,
        settingsByOrg: s.settingsByOrg,
        lastOptimization: s.lastOptimization,
        scans: s.scans,
        roads: s.roads,
        user: s.user,
        outbox: s.outbox,
        failed: s.failed,
        lastSyncAt: s.lastSyncAt,
      }),
    },
  ),
);

/** UTF-8 safe base64 (signature SVG). */
function base64Utf8(text: string): string {
  // encodeURIComponent -> percent bytes -> binary string; btoa exists in Hermes, browsers and Node.
  return btoa(unescape(encodeURIComponent(text)));
}
