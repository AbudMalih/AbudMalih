"use client";

import type { TourEndsPatch } from "../components/TourEndsDialog";
import {
  dispatchKpis,
  filterByDepot,
  pickupRows,
  summarizeTours,
  type DispatchDataset,
  type DispatchKpis,
  type GeoPoint,
  type NewStopInput,
  type PickupRow,
  type Stop,
  type Tour,
  type TourSummary,
} from "@turvio/shared";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ApiCallError, api } from "./api";
import { isLocale } from "./i18n";
import { useI18n } from "./i18n/client";
import type { LocationChecksResponse, LocationEvent, LocationReport, StopLocationDetail } from "./locations";

export interface SessionInfo {
  userName: string;
  email: string;
  role: "owner" | "admin" | "dispatcher" | "driver";
  organizationId: string;
  organizationName: string;
  companyWide: boolean;
  workspaces: { id: string; name: string; role: string }[];
  /** Optional environment label, e.g. "Development · synthetic data". */
  environment: string | null;
}

export type LiveState = "connecting" | "live" | "offline";

/** A live-position event from the shared stream: the tour whose position changed (undefined = refetch everything). */
export type PositionListener = (tourId: string | undefined) => void;

export interface OptimizeMeta {
  engine: string;
  matrixSource: string;
  unassignedStopIds: string[];
  unlocatedStopIds?: string[];
  /** Stops with a certain location error (P0-3.3): not optimized, kept at the end. */
  locationErrors?: { stopId: string; codes: string[] }[];
  /** Stops routed to their accepted approach point. */
  approachStopIds?: string[];
  distanceMeters?: number;
  durationSeconds?: number;
  driveSeconds?: number | null;
  waitSeconds?: number | null;
  endMinute?: number | null;
  overtimeMinutes?: number;
  violations?: { kind: "late" | "overtime" | "unassigned_unreachable" | "unassigned_infeasible" | "pair_split"; stopId?: string | null; minutes?: number | null }[];
}

export interface OptimizeOutcome {
  preview: boolean;
  proposedStopIds?: string[];
  result: OptimizeMeta;
}

interface DispatchState {
  /** Increments on every live-position event (server-sent). */
  positionTick: number;
  /**
   * Subscribe to live-position events of the tab's one shared event stream (no second
   * EventSource). Returns the unsubscribe function.
   */
  onPosition: (listener: PositionListener) => () => void;
  session: SessionInfo;
  /** Everything the user may see for the selected date (scoped by the database). */
  scoped: DispatchDataset;
  /** `scoped` narrowed to the selected depot. */
  data: DispatchDataset;
  summaries: TourSummary[];
  kpis: DispatchKpis;
  pickups: PickupRow[];
  depotId: string | null;
  setDepotId: (id: string | null) => void;
  date: string;
  setDate: (date: string) => void;
  today: string;
  loading: boolean;
  live: LiveState;
  lastLoadedAt: number;
  reload: () => Promise<void>;
  selectedTourId: string | null;
  selectedStopId: string | null;
  selectTour: (id: string | null) => void;
  selectStop: (id: string | null, tourId?: string | null) => void;
  // Persistent operations (API). All reload the view on success.
  createTour: (input: { depotId: string; plannedStartMinute: number; driverId: string | null; vehicleId: string | null; name?: string }) => Promise<Tour>;
  updateTour: (tour: Tour, patch: { name?: string; plannedStartMinute?: number; driverId?: string | null; vehicleId?: string | null } & TourEndsPatch) => Promise<Tour>;
  deleteTour: (tour: Tour) => Promise<void>;
  publishTour: (tour: Tour) => Promise<void>;
  unpublishTour: (tour: Tour) => Promise<void>;
  /** apply=false: preview only. confirmActive: the dispatcher confirmed re-sequencing a tour on the road. */
  optimizeTour: (tour: Tour, opts?: { apply?: boolean; confirmActive?: boolean }) => Promise<OptimizeOutcome>;
  optimizePlan: (tourIds: string[], includeUnassigned: boolean) => Promise<{ unassignedStopIds: string[]; unlocatedStopIds?: string[]; locationErrors?: { stopId: string; codes: string[] }[]; matrixSource: string }>;
  /** `rejectPlannedTracking`: refuse (409) if a parcel is already planned/delivered in the company (imports). */
  addStops: (
    target: { tourId?: string; depotId?: string },
    stops: NewStopInput[],
    opts?: { rejectPlannedTracking?: boolean; provenance?: "import_file" | "import_paste" | "dispatch_manual" },
  ) => Promise<string[]>;
  assignStops: (stopIds: string[], tourId: string | null) => Promise<void>;
  setPriority: (stopId: string, value: boolean) => Promise<void>;
  deleteStop: (stopId: string) => Promise<void>;
  editStopAddress: (
    stopId: string,
    address: { street: string; houseNumber?: string | null; postalCode: string; city: string },
    recipientName?: string | null,
    opts?: { reason?: string; expectedAddressVersion?: number },
  ) => Promise<void>;
  /** Location checks of the open stops of the selected day (P0-3.4); empty while unavailable. */
  locationChecks: Map<string, LocationReport>;
  locationChecksPending: boolean;
  /** Move the pin (address unchanged). Reason required on published tours; stale versions → 409. */
  moveStopPin: (stop: Stop, location: GeoPoint, opts: { reason?: string; precision?: string }) => Promise<void>;
  confirmStopLocation: (stop: Stop, issueCodes: string[], note?: string) => Promise<void>;
  /** Explicitly accept a navigation approach point – never done automatically. */
  acceptApproach: (stop: Stop, point: GeoPoint, reason?: string) => Promise<void>;
  clearApproach: (stop: Stop, reason?: string) => Promise<void>;
  stopLocation: (stopId: string) => Promise<StopLocationDetail>;
  stopLocationHistory: (stopId: string) => Promise<LocationEvent[]>;
  /** New order of a tour's open stops. */
  reorderStops: (tourId: string, openStopIds: string[]) => Promise<void>;
  switchWorkspace: (orgId: string) => void;
  /** This user's saved defaults for this company (null until loaded / unavailable). */
  orgDefaults: { defaultDepotId?: string | null; toursView?: "day" | "all" | "archived" } | null;
  /** Switch the day view to a tour's date and select it (Tours manager → day view). */
  openTour: (date: string, tourId: string) => Promise<void>;
}

const Ctx = createContext<DispatchState | null>(null);

export function DispatchProvider({ base: initial, session, children }: { base: DispatchDataset; session: SessionInfo; children: ReactNode }) {
  const org = session.organizationId;
  const [scoped, setScoped] = useState<DispatchDataset>(initial);
  const [date, setDateState] = useState(initial.date);
  const today = useRef(initial.date).current;
  const [depotId, setDepotIdState] = useState<string | null>(initial.depots.length === 1 ? initial.depots[0]!.id : null);
  const [selectedTourId, setSelectedTourId] = useState<string | null>(null);
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [live, setLive] = useState<LiveState>("connecting");
  // Live GPS: bumps on every "position" event; the fleet layer refetches positions only.
  const [positionTick, setPositionTick] = useState(0);
  const [lastLoadedAt, setLastLoadedAt] = useState(() => Date.now());
  const [orgDefaults, setOrgDefaults] = useState<DispatchState["orgDefaults"]>(null);
  const { locale, setLocale } = useI18n();
  const localeRef = useRef(locale);
  localeRef.current = locale;
  // Personal defaults (Settings → My preferences): the default location applies once, at start.
  useEffect(() => {
    let alive = true;
    api<{ language?: string | null; orgDefaults: Record<string, NonNullable<DispatchState["orgDefaults"]>> } | undefined>("GET", "/v1/me/preferences").then(
      (p) => {
        if (!alive) return;
        // Language is per user: the saved choice (Settings → My preferences) wins, also in a new
        // browser. Without one, this browser's choice (sign-in page) stays – nothing is saved implicitly.
        if (isLocale(p?.language) && p.language !== localeRef.current) setLocale(p.language);
        const d = p?.orgDefaults?.[org] ?? {};
        setOrgDefaults(d);
        if (d.defaultDepotId && initial.depots.some((x) => x.id === d.defaultDepotId)) setDepotIdState((cur) => cur ?? d.defaultDepotId!);
      },
      () => alive && setOrgDefaults({}),
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org]);
  const dateRef = useRef(date);
  dateRef.current = date;

  const pendingRetry = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [locationChecks, setLocationChecks] = useState<Map<string, LocationReport>>(() => new Map());
  const [locationChecksPending, setLocationChecksPending] = useState(false);
  const locationRetry = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // Location checks load beside the dataset (never block it); while some still run, again in 3 s.
  const loadLocationChecks = useCallback(async () => {
    clearTimeout(locationRetry.current);
    try {
      const r = await api<LocationChecksResponse>("GET", `/v1/orgs/${org}/location-checks?date=${dateRef.current}`);
      setLocationChecks(new Map(r.checks.map((c) => [c.stopId, c])));
      setLocationChecksPending(r.pending);
      if (r.pending) locationRetry.current = setTimeout(() => void loadLocationChecks(), 3_000);
    } catch {
      // Not available (permission, network): show nothing rather than a false "checked".
      setLocationChecks(new Map());
      setLocationChecksPending(false);
    }
  }, [org]);
  const lastReload = useRef(0);
  const reload = useCallback(async () => {
    setLoading(true);
    lastReload.current = Date.now();
    try {
      const d = await api<DispatchDataset>("GET", `/v1/orgs/${org}/dispatch?date=${dateRef.current}`);
      setScoped(d);
      void loadLocationChecks();
      setLastLoadedAt(Date.now());
      // Road times still being computed (labelled as estimates meanwhile): fetch them shortly.
      clearTimeout(pendingRetry.current);
      if (d.roadsPending) pendingRetry.current = setTimeout(() => void reload().catch(() => undefined), 3_000);
    } finally {
      setLoading(false);
    }
  }, [org, loadLocationChecks]);

  const setDate = useCallback(
    (d: string) => {
      dateRef.current = d;
      setDateState(d);
      setSelectedTourId(null);
      void reload().catch(() => undefined);
    },
    [reload],
  );

  // Live updates: ONE server-sent event stream per tab (API, Postgres notifications), polling as
  // fallback. The server refuses more than a few streams per user (429): a refused or closed stream
  // is retried with a growing pause (1 → 5 min), never in a tight loop; meanwhile views poll.
  const positionListeners = useRef(new Set<PositionListener>());
  const onPosition = useCallback((listener: PositionListener) => {
    positionListeners.current.add(listener);
    return () => void positionListeners.current.delete(listener);
  }, []);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let retryDelay = 60_000;
    let closed = false;
    const scheduleReload = () => {
      clearTimeout(timer);
      timer = setTimeout(() => void reload().catch(() => undefined), 350);
    };
    let es: EventSource | null = null;
    const connect = () => {
      if (closed) return;
      es = new EventSource(`/api/turvio/v1/orgs/${org}/events`);
      es.addEventListener("ready", () => {
        retryDelay = 60_000;
        setLive("live");
      });
      es.addEventListener("change", scheduleReload);
      es.addEventListener("position", (e) => {
        let tour: string | undefined;
        try {
          const d = JSON.parse((e as MessageEvent).data ?? "{}") as { tour?: unknown };
          tour = typeof d.tour === "string" ? d.tour : undefined;
        } catch {
          tour = undefined;
        }
        setPositionTick((n) => n + 1);
        for (const l of positionListeners.current) l(tour);
        // Live-position ETAs come with the dataset: refresh it, at most every 30 s.
        if (Date.now() - lastReload.current > 30_000) scheduleReload();
      });
      es.onerror = () => {
        setLive("offline");
        // CONNECTING: the browser reconnects by itself. CLOSED (e.g. 429 too many streams): try later.
        if (es && es.readyState === 2) {
          es.close();
          clearTimeout(retry);
          retry = setTimeout(connect, retryDelay);
          retryDelay = Math.min(retryDelay * 2, 5 * 60_000);
        }
      };
    };
    if (typeof EventSource !== "undefined") connect();
    else setLive("offline");
    const poll = setInterval(() => void reload().catch(() => undefined), 60_000);
    return () => {
      closed = true;
      es?.close();
      clearTimeout(retry);
      clearInterval(poll);
      clearTimeout(timer);
      clearTimeout(pendingRetry.current);
      clearTimeout(locationRetry.current);
    };
  }, [org, reload]);

  // First load (the server-rendered dataset arrives without location checks).
  useEffect(() => {
    void loadLocationChecks();
  }, [loadLocationChecks]);

  const data = useMemo(() => filterByDepot(scoped, depotId), [scoped, depotId]);
  const summaries = useMemo(() => summarizeTours(data), [data]);
  const kpis = useMemo(() => dispatchKpis(data, summaries), [data, summaries]);
  const pickups = useMemo(() => pickupRows(data, summaries), [data, summaries]);

  // After a version conflict, refresh so the user works on current data.
  const run = useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T> => {
      try {
        const r = await fn();
        await reload();
        return r;
      } catch (e) {
        if (e instanceof ApiCallError && (e.code === "version_conflict" || e.status === 404)) await reload().catch(() => undefined);
        throw e;
      }
    },
    [reload],
  );

  const value: DispatchState = {
    session,
    scoped,
    data,
    summaries,
    kpis,
    pickups,
    depotId,
    setDepotId: (id) => {
      setDepotIdState(scoped.depots.length === 1 ? scoped.depots[0]!.id : id);
      setSelectedTourId(null);
      setSelectedStopId(null);
    },
    date,
    setDate,
    today,
    loading,
    live,
    positionTick,
    onPosition,
    lastLoadedAt,
    reload,
    selectedTourId,
    selectedStopId,
    selectTour: (id) => {
      setSelectedTourId(id);
      setSelectedStopId(null);
    },
    selectStop: (id, tourId) => {
      if (tourId !== undefined) setSelectedTourId(tourId);
      setSelectedStopId(id);
    },
    createTour: (input) => run(() => api<Tour>("POST", `/v1/orgs/${org}/tours`, { ...input, date })),
    updateTour: (tour, patch) => run(() => api<Tour>("PATCH", `/v1/orgs/${org}/tours/${tour.id}`, { expectedVersion: tour.version, ...patch })),
    deleteTour: (tour) => run(() => api<void>("DELETE", `/v1/orgs/${org}/tours/${tour.id}?expectedVersion=${tour.version}`)),
    publishTour: (tour) => run(() => api<void>("POST", `/v1/orgs/${org}/tours/${tour.id}/publish`, { expectedVersion: tour.version })),
    unpublishTour: (tour) => run(() => api<void>("POST", `/v1/orgs/${org}/tours/${tour.id}/unpublish`, { expectedVersion: tour.version })),
    optimizeTour: (tour, opts) =>
      run(() =>
        api<OptimizeOutcome>("POST", `/v1/orgs/${org}/tours/${tour.id}/optimize`, {
          expectedVersion: tour.version,
          apply: opts?.apply ?? true,
          confirmActive: opts?.confirmActive ?? false,
        }),
      ),
    optimizePlan: (tourIds, includeUnassigned) => run(() => api("POST", `/v1/orgs/${org}/plans/optimize`, { tourIds, includeUnassigned })),
    addStops: (target, stops, opts) =>
      run(
        async () =>
          (
            await api<{ ids: string[] }>("POST", `/v1/orgs/${org}/stops`, {
              ...target,
              stops,
              ...(opts?.rejectPlannedTracking ? { rejectPlannedTracking: true } : {}),
              ...(opts?.provenance ? { provenance: opts.provenance } : {}),
            })
          ).ids,
      ),
    assignStops: (stopIds, tourId) => run(() => api<void>("POST", `/v1/orgs/${org}/stops/assign`, { stopIds, tourId })),
    setPriority: (stopId, v) => run(() => api<void>("PATCH", `/v1/orgs/${org}/stops/${stopId}`, { priority: v })),
    deleteStop: (stopId) => run(() => api<void>("DELETE", `/v1/orgs/${org}/stops/${stopId}`)),
    editStopAddress: (stopId, address, recipientName, opts) =>
      run(() =>
        api<void>("PATCH", `/v1/orgs/${org}/stops/${stopId}`, {
          address,
          ...(recipientName !== undefined ? { recipientName } : {}),
          ...(opts?.reason ? { reason: opts.reason } : {}),
          ...(opts?.expectedAddressVersion ? { expectedAddressVersion: opts.expectedAddressVersion } : {}),
        }),
      ),
    locationChecks,
    locationChecksPending,
    moveStopPin: (stop, location, opts) =>
      run(() =>
        api<void>("PATCH", `/v1/orgs/${org}/stops/${stop.id}`, {
          location,
          locationPrecision: opts.precision ?? "manual_pin",
          ...(opts.reason ? { reason: opts.reason } : {}),
          ...(stop.locationVersion ? { expectedLocationVersion: stop.locationVersion } : {}),
        }),
      ),
    confirmStopLocation: (stop, issueCodes, note) =>
      run(() =>
        api<void>("POST", `/v1/orgs/${org}/stops/${stop.id}/location/confirm`, {
          expectedLat: stop.location!.lat,
          expectedLng: stop.location!.lng,
          expectedAddressVersion: stop.addressVersion,
          issueCodes,
          ...(note ? { note } : {}),
        }),
      ),
    acceptApproach: (stop, point, reason) =>
      run(() =>
        api<void>("POST", `/v1/orgs/${org}/stops/${stop.id}/location/approach`, {
          lat: point.lat,
          lng: point.lng,
          expectedLat: stop.location!.lat,
          expectedLng: stop.location!.lng,
          expectedAddressVersion: stop.addressVersion,
          ...(reason ? { reason } : {}),
        }),
      ),
    clearApproach: (stop, reason) => run(() => api<void>("DELETE", `/v1/orgs/${org}/stops/${stop.id}/location/approach${reason ? `?reason=${encodeURIComponent(reason)}` : ""}`)),
    stopLocation: (stopId) => api<StopLocationDetail>("GET", `/v1/orgs/${org}/stops/${stopId}/location`),
    stopLocationHistory: async (stopId) => (await api<{ events: LocationEvent[] }>("GET", `/v1/orgs/${org}/stops/${stopId}/location/history`)).events,
    reorderStops: (tourId, ids) => run(() => api<void>("POST", `/v1/me/tours/${tourId}/sequence`, { stopIds: ids })),
    orgDefaults,
    openTour: async (d, tourId) => {
      dateRef.current = d;
      setDateState(d);
      await reload().catch(() => undefined);
      setSelectedTourId(tourId);
      setSelectedStopId(null);
    },
    switchWorkspace: (orgId) => {
      document.cookie = `tv_org=${encodeURIComponent(orgId)}; path=/; samesite=lax; max-age=31536000`;
      window.location.assign("/map");
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDispatch(): DispatchState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useDispatch must be used inside <DispatchProvider>");
  return v;
}
