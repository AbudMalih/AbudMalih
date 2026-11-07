"use client";

import {
  dispatchKpis,
  filterByDepot,
  pickupRows,
  summarizeTours,
  type DispatchDataset,
  type DispatchKpis,
  type NewStopInput,
  type PickupRow,
  type Tour,
  type TourSummary,
} from "@turvio/shared";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ApiCallError, api } from "./api";

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

export interface OptimizeMeta {
  engine: string;
  matrixSource: string;
  unassignedStopIds: string[];
  unlocatedStopIds?: string[];
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
  updateTour: (tour: Tour, patch: { name?: string; plannedStartMinute?: number; driverId?: string | null; vehicleId?: string | null }) => Promise<Tour>;
  deleteTour: (tour: Tour) => Promise<void>;
  publishTour: (tour: Tour) => Promise<void>;
  unpublishTour: (tour: Tour) => Promise<void>;
  /** apply=false: preview only. confirmActive: the dispatcher confirmed re-sequencing a tour on the road. */
  optimizeTour: (tour: Tour, opts?: { apply?: boolean; confirmActive?: boolean }) => Promise<OptimizeOutcome>;
  optimizePlan: (tourIds: string[], includeUnassigned: boolean) => Promise<{ unassignedStopIds: string[]; matrixSource: string }>;
  addStops: (target: { tourId?: string; depotId?: string }, stops: NewStopInput[]) => Promise<string[]>;
  assignStops: (stopIds: string[], tourId: string | null) => Promise<void>;
  setPriority: (stopId: string, value: boolean) => Promise<void>;
  deleteStop: (stopId: string) => Promise<void>;
  editStopAddress: (stopId: string, address: { street: string; houseNumber?: string | null; postalCode: string; city: string }, recipientName?: string | null) => Promise<void>;
  /** New order of a tour's open stops. */
  reorderStops: (tourId: string, openStopIds: string[]) => Promise<void>;
  switchWorkspace: (orgId: string) => void;
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
  const [lastLoadedAt, setLastLoadedAt] = useState(() => Date.now());
  const dateRef = useRef(date);
  dateRef.current = date;

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api<DispatchDataset>("GET", `/v1/orgs/${org}/dispatch?date=${dateRef.current}`);
      setScoped(d);
      setLastLoadedAt(Date.now());
    } finally {
      setLoading(false);
    }
  }, [org]);

  const setDate = useCallback(
    (d: string) => {
      dateRef.current = d;
      setDateState(d);
      setSelectedTourId(null);
      void reload().catch(() => undefined);
    },
    [reload],
  );

  // Live updates: server-sent events from the API (Postgres notifications), polling as fallback.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const scheduleReload = () => {
      clearTimeout(timer);
      timer = setTimeout(() => void reload().catch(() => undefined), 350);
    };
    let es: EventSource | null = null;
    if (typeof EventSource !== "undefined") {
      es = new EventSource(`/api/turvio/v1/orgs/${org}/events`);
      es.addEventListener("ready", () => setLive("live"));
      es.addEventListener("change", scheduleReload);
      es.onerror = () => setLive("offline");
    } else setLive("offline");
    const poll = setInterval(() => void reload().catch(() => undefined), 60_000);
    return () => {
      es?.close();
      clearInterval(poll);
      clearTimeout(timer);
    };
  }, [org, reload]);

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
    addStops: (target, stops) => run(async () => (await api<{ ids: string[] }>("POST", `/v1/orgs/${org}/stops`, { ...target, stops })).ids),
    assignStops: (stopIds, tourId) => run(() => api<void>("POST", `/v1/orgs/${org}/stops/assign`, { stopIds, tourId })),
    setPriority: (stopId, v) => run(() => api<void>("PATCH", `/v1/orgs/${org}/stops/${stopId}`, { priority: v })),
    deleteStop: (stopId) => run(() => api<void>("DELETE", `/v1/orgs/${org}/stops/${stopId}`)),
    editStopAddress: (stopId, address, recipientName) => run(() => api<void>("PATCH", `/v1/orgs/${org}/stops/${stopId}`, { address, ...(recipientName !== undefined ? { recipientName } : {}) })),
    reorderStops: (tourId, ids) => run(() => api<void>("POST", `/v1/me/tours/${tourId}/sequence`, { stopIds: ids })),
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
