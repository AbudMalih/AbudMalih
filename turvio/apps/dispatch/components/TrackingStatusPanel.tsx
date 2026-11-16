"use client";

import { can } from "@turvio/shared";
import { cn } from "@turvio/web-ui/ds";
import { Radio, Settings2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ageLabel, freshnessOf } from "../lib/live";
import { MODE_LABEL, settingsApi, type DriverTracking, type TrackingDrivers } from "../lib/settings";
import { useDispatch } from "../lib/store";

/**
 * What the live map can and cannot show, per driver on an active tour: live, stale, no signal,
 * awaiting acknowledgement, tracking off / not in pilot, paused. A position is called live only
 * when it is fresh (same rule as the map markers); older ones are named stale or no signal.
 */
export type FleetState = "live" | "stale" | "no_signal" | "awaiting_acknowledgement" | "disabled" | "no_app_login" | "tour_paused" | "no_active_tour";

export const FLEET_STATE: Record<FleetState, { label: string; dot: string; text: string; explain: string }> = {
  live: { label: "Live", dot: "bg-success", text: "text-success-ink", explain: "Position from the last 90 seconds." },
  stale: { label: "Stale", dot: "bg-nx-amber", text: "text-warning-ink", explain: "Last position 1.5–5 minutes old – shown as the last received position, not live." },
  no_signal: { label: "No signal", dot: "bg-muted", text: "text-muted", explain: "No position for over 5 minutes, or none yet on this tour." },
  awaiting_acknowledgement: { label: "Awaiting acknowledgement", dot: "bg-nx-amber", text: "text-warning-ink", explain: "The driver has not confirmed the tracking notice – nothing is recorded." },
  disabled: { label: "Not tracked", dot: "bg-surface-3", text: "text-muted", explain: "Tracking is off for the company, or this driver is not in the pilot." },
  no_app_login: { label: "No app login", dot: "bg-surface-3", text: "text-muted", explain: "This driver has no TURVIO Driver account." },
  tour_paused: { label: "Paused", dot: "bg-surface-3", text: "text-muted", explain: "No positions are recorded while the tour is paused." },
  no_active_tour: { label: "No active tour", dot: "bg-surface-3", text: "text-muted", explain: "Tracking only runs while a tour is driven." },
};

/** Map-consistent state of one driver (positions: 90 s live, 5 min stale). */
export function fleetStateOf(d: DriverTracking, serverNowMs: number): FleetState {
  switch (d.state) {
    case "disabled":
    case "pilot_not_enabled":
      return "disabled";
    case "no_app_login":
    case "awaiting_acknowledgement":
    case "tour_paused":
    case "no_active_tour":
      return d.state;
    default: {
      if (!d.lastPositionAt) return "no_signal";
      const f = freshnessOf(d.lastPositionAt, serverNowMs).state;
      return f === "live" ? "live" : f === "delayed" ? "stale" : "no_signal";
    }
  }
}

const ORDER: FleetState[] = ["live", "stale", "no_signal", "awaiting_acknowledgement", "tour_paused", "disabled", "no_app_login", "no_active_tour"];

export function TrackingStatusPanel() {
  const { session, positionTick } = useDispatch();
  const allowed = can(session.role, "tracking.view_live");
  const [data, setData] = useState<TrackingDrivers | null>(null);
  const [failed, setFailed] = useState(false);
  const offset = useRef(0);
  const [now, setNow] = useState(() => Date.now());
  const last = useRef(0);
  const load = useCallback(async () => {
    last.current = Date.now();
    try {
      const r = await settingsApi(session.organizationId).trackingDrivers();
      offset.current = Date.parse(r.serverTime) - Date.now();
      setData(r);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [session.organizationId]);
  useEffect(() => {
    if (!allowed) return;
    void load();
    const poll = setInterval(() => void load(), 30_000);
    const clock = setInterval(() => setNow(Date.now()), 5_000);
    return () => (clearInterval(poll), clearInterval(clock));
  }, [allowed, load]);
  useEffect(() => {
    if (allowed && positionTick > 0 && Date.now() - last.current > 10_000) void load();
  }, [allowed, positionTick, load]);

  const rows = useMemo(() => {
    if (!data) return [];
    const serverNow = now + offset.current;
    return data.drivers
      .filter((d) => d.currentTour)
      .map((d) => ({ d, state: fleetStateOf(d, serverNow), age: d.lastPositionAt ? freshnessOf(d.lastPositionAt, serverNow).ageSeconds : null }))
      .sort((a, b) => ORDER.indexOf(b.state) - ORDER.indexOf(a.state) || a.d.name.localeCompare(b.d.name));
  }, [data, now]);
  if (!allowed || failed) return null;
  const counts = new Map<FleetState, number>();
  for (const r of rows) counts.set(r.state, (counts.get(r.state) ?? 0) + 1);
  const notLive = rows.filter((r) => r.state !== "live");
  const admin = can(session.role, "org.settings.manage");
  return (
    <section aria-label="Tracking status">
      <h3 className="mb-2 flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-[0.1em] text-subtle">
        <Radio className="size-3.5" /> Tracking on active tours
        {data && <span className="ms-auto font-medium normal-case tracking-normal text-muted">Mode: {MODE_LABEL[data.mode]}</span>}
      </h3>
      {!data ? null : data.mode === "off" ? (
        <p className="rounded-[14px] border border-line bg-surface-2 px-3 py-2.5 text-[13px] text-ink-2">
          Live tracking is switched off for the company – the map shows no vehicles.{" "}
          {admin && (
            <Link href="/settings?section=tracking" className="font-semibold text-brand-700 hover:underline">
              Manage tracking
            </Link>
          )}
        </p>
      ) : rows.length === 0 ? (
        <p className="rounded-[14px] border border-line bg-surface-2 px-3 py-2.5 text-[13px] text-muted">No tour is being driven right now.</p>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-1.5" data-testid="tracking-counts">
            {ORDER.filter((s) => counts.get(s)).map((s) => (
              <span key={s} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2 py-0.5 text-2xs font-semibold text-ink-2" title={FLEET_STATE[s].explain}>
                <span className={cn("size-2 rounded-full", FLEET_STATE[s].dot)} aria-hidden="true" />
                {counts.get(s)} {FLEET_STATE[s].label}
              </span>
            ))}
          </div>
          {notLive.length > 0 && (
            <ul className="flex flex-col divide-y divide-line rounded-md border border-line bg-surface">
              {notLive.map(({ d, state, age }) => (
                <li key={d.driverId} className="flex items-center justify-between gap-3 px-3 py-2 text-[13px]">
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-ink">{d.name}</span>
                    <span className="block truncate text-2xs text-muted">
                      {d.currentTour!.name} · {FLEET_STATE[state].explain}
                    </span>
                  </span>
                  <span className={cn("shrink-0 text-2xs font-bold", FLEET_STATE[state].text)}>
                    {FLEET_STATE[state].label}
                    {age !== null && state !== "live" ? ` · ${ageLabel(age)}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {admin && (
            <Link href="/settings?section=tracking" className="inline-flex items-center gap-1 text-2xs font-semibold text-brand-700 hover:underline">
              <Settings2 className="size-3.5" /> Manage tracking and pilots
            </Link>
          )}
        </div>
      )}
    </section>
  );
}

