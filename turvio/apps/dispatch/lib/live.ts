"use client";

import { can } from "@turvio/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";
import { useDispatch } from "./store";

/** One driver on the road, as GET /fleet/live returns it. */
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
  progress: { done: number; remaining: number };
  nextStop: { id: string; sequence: number; lat: number | null; lng: number | null; name: string | null; street: string; houseNumber: string | null; city: string; twEnd: number | null } | null;
}

/**
 * How current a position is – shown everywhere a position is shown. A stale position is never
 * drawn or described as live. The phone sends a fix at least once a minute while the tour runs
 * (also when parked), so silence beyond that means delayed upload or lost connection.
 */
export type Freshness = "live" | "delayed" | "offline";
export const LIVE_MAX_SECONDS = 90;
export const DELAYED_MAX_SECONDS = 5 * 60;

export function freshnessOf(recordedAt: string, nowMs: number): { state: Freshness; ageSeconds: number } {
  const ageSeconds = Math.max(0, Math.round((nowMs - Date.parse(recordedAt)) / 1000));
  return { state: ageSeconds <= LIVE_MAX_SECONDS ? "live" : ageSeconds <= DELAYED_MAX_SECONDS ? "delayed" : "offline", ageSeconds };
}

export function ageLabel(seconds: number): string {
  if (seconds < 60) return `${seconds} s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  return `${Math.floor(seconds / 3600)} h ${Math.floor((seconds % 3600) / 60)} min ago`;
}

export const FRESHNESS_LABEL: Record<Freshness, string> = { live: "Live", delayed: "Delayed", offline: "No signal" };

/**
 * Live positions for the dispatcher's scope. Refetches on server-sent "position" events
 * (throttled), every 15 s as a fallback, and ticks the clock so ages stay correct.
 * Freshness uses the server clock (offset), not the dispatcher's PC clock.
 */
export function useLiveFleet() {
  const { session, positionTick } = useDispatch();
  const allowed = can(session.role, "tracking.view_live");
  const org = session.organizationId;
  const [vehicles, setVehicles] = useState<LiveVehicle[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const offset = useRef(0);
  const [now, setNow] = useState(() => Date.now());
  const last = useRef(0);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    if (!allowed) return;
    last.current = Date.now();
    try {
      const r = await api<{ serverTime: string; vehicles: LiveVehicle[] }>("GET", `/v1/orgs/${org}/fleet/live`);
      offset.current = Date.parse(r.serverTime) - Date.now();
      setVehicles(r.vehicles);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoaded(true);
    }
  }, [allowed, org]);

  // Initial load, fallback polling and the age clock.
  useEffect(() => {
    if (!allowed) return;
    void load();
    const poll = setInterval(() => void load(), 15_000);
    const clock = setInterval(() => setNow(Date.now()), 5_000);
    return () => {
      clearInterval(poll);
      clearInterval(clock);
    };
  }, [allowed, load]);

  // Position events: at most one refetch every 2 s.
  useEffect(() => {
    if (!allowed || positionTick === 0) return;
    const wait = Math.max(0, 2_000 - (Date.now() - last.current));
    if (pending.current) return;
    pending.current = setTimeout(() => {
      pending.current = null;
      void load();
    }, wait);
  }, [allowed, positionTick, load]);

  return { allowed, loaded, error, vehicles, serverNow: now + offset.current, reload: load };
}

export interface LiveEta {
  source: "osrm" | "none";
  reason?: "tour_not_in_progress" | "no_live_position" | "position_stale" | "no_routing" | "routing_unavailable";
  positionAgeSeconds?: number;
  stops?: { stopId: string; etaMinute: number; deadlineMinute: number | null; lateMinutes: number; priority: boolean }[];
  remainingMeters?: number;
  remainingDriveSeconds?: number;
  finishMinute?: number;
  atRiskStopIds?: string[];
  suggestReoptimize?: boolean;
}

/** Road ETA from the vehicle's current GPS position (refreshed at most every 30 s). */
export function useLiveEta(tourId: string | null, enabled: boolean) {
  const { session, positionTick } = useDispatch();
  const org = session.organizationId;
  const [eta, setEta] = useState<LiveEta | null>(null);
  const last = useRef(0);
  useEffect(() => {
    setEta(null);
    last.current = 0;
  }, [tourId]);
  useEffect(() => {
    if (!tourId || !enabled) return;
    if (Date.now() - last.current < 30_000) return;
    last.current = Date.now();
    let cancelled = false;
    api<LiveEta>("GET", `/v1/orgs/${org}/tours/${tourId}/eta`)
      .then((r) => !cancelled && setEta(r))
      .catch(() => !cancelled && setEta(null));
    return () => {
      cancelled = true;
    };
  }, [org, tourId, enabled, positionTick]);
  return eta;
}
