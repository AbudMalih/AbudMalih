"use client";

import { can } from "@turvio/shared";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "./api";
import { EN_T, type TFunction } from "./i18n";
import { useDispatch } from "./store";

/** One driver on the road with a visible position, as GET /fleet/live returns it. */
export interface LiveVehicle {
  driverId: string;
  driverName: string;
  tourId: string;
  tourName: string;
  tourStatus: string;
  depotId: string;
  vehicle: { id: string; label: string | null; licensePlate: string | null } | null;
  position: { lat: number; lng: number; accuracyMeters: number | null; speedMps: number | null; headingDeg: number | null };
  recordedAt: string;
  receivedAt: string;
  /** What freshness is aged from (server-decided: receipt time of a real-time fix, else recording time). */
  positionAt: string;
  /** State at `serverTime` of the response (clients re-age it between updates). */
  state?: Freshness;
  progress: { done: number; remaining: number };
  nextStop: { id: string; sequence: number; lat: number | null; lng: number | null; name: string | null; street: string; houseNumber: string | null; city: string; twEnd: number | null } | null;
}

/** A running or paused tour of the day without a visible position (no marker). */
export interface UnavailableDriver {
  driverId: string;
  driverName: string;
  tourId: string;
  tourName: string;
  tourStatus: string;
  depotId: string;
  vehicle: LiveVehicle["vehicle"];
  progress: LiveVehicle["progress"];
  nextStop: LiveVehicle["nextStop"];
  reason: "paused" | "no_position";
}

export interface FleetLiveResponse {
  serverTime: string;
  date: string;
  staleAfterSeconds: number;
  offlineAfterSeconds: number;
  vehicles: LiveVehicle[];
  unavailable?: UnavailableDriver[];
}

/**
 * How current a position is – shown everywhere a position is shown. A stale position is never
 * drawn or described as live. The thresholds come from the server (they follow the company's
 * position interval); the age is measured on the server clock.
 */
export type Freshness = "live" | "delayed" | "offline";
export interface FreshnessThresholds {
  staleAfterSeconds: number;
  offlineAfterSeconds: number;
}
/** Only until the first response arrives: the server's minimums (max(120 s, 3 intervals) / max(300 s, 10 intervals)). */
export const FALLBACK_THRESHOLDS: FreshnessThresholds = { staleAfterSeconds: 120, offlineAfterSeconds: 300 };

export function freshnessOf(positionAt: string, serverNowMs: number, th: FreshnessThresholds = FALLBACK_THRESHOLDS): { state: Freshness; ageSeconds: number } {
  const ageSeconds = Math.max(0, Math.round((serverNowMs - Date.parse(positionAt)) / 1000));
  return { state: ageSeconds <= th.staleAfterSeconds ? "live" : ageSeconds <= th.offlineAfterSeconds ? "delayed" : "offline", ageSeconds };
}

export function ageLabel(seconds: number, t: TFunction = EN_T): string {
  if (seconds < 60) return t("fleet.age.s", { n: seconds });
  if (seconds < 3600) return t("fleet.age.min", { n: Math.floor(seconds / 60) });
  return t("fleet.age.h", { h: Math.floor(seconds / 3600), m: Math.floor((seconds % 3600) / 60) });
}

export const freshnessLabel = (f: Freshness, t: TFunction = EN_T) => t(`fleet.freshness.${f}`);
export const unavailableLabel = (r: UnavailableDriver["reason"], t: TFunction = EN_T) => t(`fleet.unavailable.${r}`);
export const unavailableExplain = (r: UnavailableDriver["reason"], t: TFunction = EN_T) => t(`fleet.unavailableExplain.${r}`);

/** Replace everything the server sent for one tour (a tour can disappear: finished, withdrawn, other depot). */
export function mergeTour(
  cur: { vehicles: LiveVehicle[]; unavailable: UnavailableDriver[] },
  tourId: string,
  next: { vehicles: LiveVehicle[]; unavailable?: UnavailableDriver[] },
): { vehicles: LiveVehicle[]; unavailable: UnavailableDriver[] } {
  const v = next.vehicles.filter((x) => x.tourId === tourId);
  const u = (next.unavailable ?? []).filter((x) => x.tourId === tourId);
  // A driver appears once: drop their old rows (also from another tour) when a new row arrives.
  const drivers = new Set([...v, ...u].map((x) => x.driverId));
  const keep = <T extends { tourId: string; driverId: string }>(x: T) => x.tourId !== tourId && !drivers.has(x.driverId);
  const byName = <T extends { driverName: string }>(a: T, b: T) => a.driverName.localeCompare(b.driverName);
  return { vehicles: [...cur.vehicles.filter(keep), ...v].sort(byName), unavailable: [...cur.unavailable.filter(keep), ...u].sort(byName) };
}

/** Single-tour refetches: at most one per tour per this interval. */
export const TOUR_THROTTLE_MS = 2_000;
/** Fallback polling while the event stream is not open. */
export const POLL_MS = 30_000;
/** Full resync while the stream is open (catches missed events). */
export const RESYNC_MS = 5 * 60_000;

/**
 * Live positions for the dispatcher's scope, for the selected day and depot (RLS still scopes to
 * the user's depots). Uses the tab's one shared event stream: a "position" event for a tour fetches
 * only that tour (throttled per tour) and merges it; an event without a tour, or a reconnect,
 * fetches everything. Polls every 30 s only while the stream is not open. Freshness uses the
 * server clock (offset) and the server's thresholds – never the dispatcher's PC clock.
 */
export function useLiveFleet() {
  const { session, depotId, date, live, onPosition } = useDispatch();
  const allowed = can(session.role, "tracking.view_live");
  const org = session.organizationId;
  const [rows, setRows] = useState<{ vehicles: LiveVehicle[]; unavailable: UnavailableDriver[] }>({ vehicles: [], unavailable: [] });
  const [thresholds, setThresholds] = useState<FreshnessThresholds>(FALLBACK_THRESHOLDS);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const offset = useRef(0);
  const [now, setNow] = useState(() => Date.now());
  // Responses for an older day/depot selection are dropped.
  const scope = `${date}|${depotId ?? ""}`;
  const scopeRef = useRef(scope);
  scopeRef.current = scope;
  const query = useCallback((extra = "") => `/v1/orgs/${org}/fleet/live?date=${date}${depotId ? `&depotId=${depotId}` : ""}${extra}`, [org, date, depotId]);

  const accept = (r: FleetLiveResponse) => {
    offset.current = Date.parse(r.serverTime) - Date.now();
    setNow(Date.now());
    if (r.staleAfterSeconds > 0 && r.offlineAfterSeconds > 0) setThresholds((t) => (t.staleAfterSeconds === r.staleAfterSeconds && t.offlineAfterSeconds === r.offlineAfterSeconds ? t : { staleAfterSeconds: r.staleAfterSeconds, offlineAfterSeconds: r.offlineAfterSeconds }));
  };

  const load = useCallback(async () => {
    if (!allowed) return;
    const at = scopeRef.current;
    try {
      const r = await api<FleetLiveResponse>("GET", query());
      if (scopeRef.current !== at) return;
      accept(r);
      setRows({ vehicles: r.vehicles, unavailable: r.unavailable ?? [] });
      setError(null);
    } catch (e) {
      if (scopeRef.current === at) setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (scopeRef.current === at) setLoaded(true);
    }
  }, [allowed, query]);

  const loadTour = useCallback(
    async (tourId: string) => {
      const at = scopeRef.current;
      try {
        const r = await api<FleetLiveResponse>("GET", query(`&tourId=${tourId}`));
        if (scopeRef.current !== at) return;
        accept(r);
        setRows((cur) => mergeTour(cur, tourId, r));
      } catch {
        // The next full fetch (poll or resync) repairs it.
      }
    },
    [query],
  );

  // New day or depot: start over.
  useEffect(() => {
    setRows({ vehicles: [], unavailable: [] });
    setLoaded(false);
    void load();
  }, [load]);

  // Fallback polling while the stream is not open; a slow full resync while it is.
  const streamOpen = live === "live";
  useEffect(() => {
    if (!allowed) return;
    const poll = setInterval(() => void load(), streamOpen ? RESYNC_MS : POLL_MS);
    return () => clearInterval(poll);
  }, [allowed, streamOpen, load]);

  // The stream came back after an interruption: events may have been missed.
  const wasOpen = useRef<boolean | null>(null);
  useEffect(() => {
    if (wasOpen.current === false && streamOpen) void load();
    if (live !== "connecting") wasOpen.current = streamOpen;
  }, [live, streamOpen, load]);

  // The age clock: only re-ages (state styling), never refetches.
  useEffect(() => {
    if (!allowed) return;
    const clock = setInterval(() => setNow(Date.now()), 5_000);
    return () => clearInterval(clock);
  }, [allowed]);

  // Position events: one tour → fetch that tour (≤ 1 per tour per 2 s); no tour → everything.
  const loadRef = useRef(load);
  loadRef.current = load;
  const loadTourRef = useRef(loadTour);
  loadTourRef.current = loadTour;
  useEffect(() => {
    if (!allowed) return;
    const last = new Map<string, number>();
    const pending = new Map<string, ReturnType<typeof setTimeout>>();
    let full: ReturnType<typeof setTimeout> | undefined;
    let lastFull = 0;
    const off = onPosition((tourId) => {
      if (!tourId) {
        if (full) return;
        full = setTimeout(() => {
          full = undefined;
          lastFull = Date.now();
          void loadRef.current();
        }, Math.max(0, lastFull + TOUR_THROTTLE_MS - Date.now()));
        return;
      }
      if (pending.has(tourId)) return;
      const wait = Math.max(0, (last.get(tourId) ?? 0) + TOUR_THROTTLE_MS - Date.now());
      const run = () => {
        pending.delete(tourId);
        last.set(tourId, Date.now());
        void loadTourRef.current(tourId);
      };
      if (wait === 0) run();
      else pending.set(tourId, setTimeout(run, wait));
    });
    return () => {
      off();
      for (const t of pending.values()) clearTimeout(t);
      clearTimeout(full);
    };
  }, [allowed, onPosition]);

  // Defensive: never show another depot's vehicles, whatever the server sent.
  const vehicles = useMemo(() => (depotId ? rows.vehicles.filter((v) => v.depotId === depotId) : rows.vehicles), [rows.vehicles, depotId]);
  const unavailable = useMemo(() => (depotId ? rows.unavailable.filter((v) => v.depotId === depotId) : rows.unavailable), [rows.unavailable, depotId]);

  return { allowed, loaded, error, vehicles, unavailable, thresholds, streamOpen, serverNow: now + offset.current, reload: load };
}
