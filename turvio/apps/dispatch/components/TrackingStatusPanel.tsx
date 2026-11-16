"use client";

import { can } from "@turvio/shared";
import { cn } from "@turvio/web-ui/ds";
import { Radio, Settings2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EN_T, type TFunction } from "../lib/i18n";
import { useT } from "../lib/i18n/client";
import { ageLabel, freshnessOf } from "../lib/live";
import { modeLabel, settingsApi, type DriverTracking, type TrackingDrivers } from "../lib/settings";
import { useDispatch } from "../lib/store";

/**
 * What the live map can and cannot show, per driver on an active tour: live, stale, no signal,
 * awaiting acknowledgement, tracking off / not in pilot, paused. A position is called live only
 * when it is fresh (same rule as the map markers); older ones are named stale or no signal.
 */
export type FleetState = "live" | "stale" | "no_signal" | "awaiting_acknowledgement" | "disabled" | "no_app_login" | "tour_paused" | "no_active_tour";

/** Colours per state; texts come from `fleetStateLabel` / `fleetStateExplain`. */
export const FLEET_STATE: Record<FleetState, { dot: string; text: string }> = {
  live: { dot: "bg-success", text: "text-success-ink" },
  stale: { dot: "bg-nx-amber", text: "text-warning-ink" },
  no_signal: { dot: "bg-muted", text: "text-muted" },
  awaiting_acknowledgement: { dot: "bg-nx-amber", text: "text-warning-ink" },
  disabled: { dot: "bg-surface-3", text: "text-muted" },
  no_app_login: { dot: "bg-surface-3", text: "text-muted" },
  tour_paused: { dot: "bg-surface-3", text: "text-muted" },
  no_active_tour: { dot: "bg-surface-3", text: "text-muted" },
};
export const fleetStateLabel = (s: FleetState, t: TFunction = EN_T) => t(`fleet.state.${s}`);
export const fleetStateExplain = (s: FleetState, t: TFunction = EN_T) => t(`fleet.explain.${s}`);

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
  const t = useT();
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
    <section aria-label={t("fleet.trackingStatus")}>
      <h3 className="mb-2 flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-[0.1em] text-subtle g:text-[12px] g:font-medium g:normal-case g:tracking-normal g:text-ink-2 g:[&>svg]:hidden">
        <Radio className="size-3.5" /> {t("fleet.trackingOnActiveTours")}
        {data && <span className="ms-auto font-medium normal-case tracking-normal text-muted">{t("fleet.modeValue", { mode: modeLabel(data.mode, t) })}</span>}
      </h3>
      {!data ? null : data.mode === "off" ? (
        <p className="rounded-[14px] border border-line bg-surface-2 px-3 py-2.5 text-[13px] text-ink-2 g:rounded-md g:border-0 g:bg-transparent g:p-0 g:text-muted">
          {t("fleet.trackingOffNote")}{" "}
          {admin && (
            <Link href="/settings?section=tracking" className="font-semibold text-brand-700 hover:underline">
              {t("fleet.manageTracking")}
            </Link>
          )}
        </p>
      ) : rows.length === 0 ? (
        <p className="rounded-[14px] border border-line bg-surface-2 px-3 py-2.5 text-[13px] text-muted g:rounded-md g:border-0 g:bg-transparent g:p-0">{t("fleet.noTourDriven")}</p>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-1.5" data-testid="tracking-counts">
            {ORDER.filter((s) => counts.get(s)).map((s) => (
              <span key={s} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2 py-0.5 text-2xs font-semibold text-ink-2 g:rounded g:font-medium" title={fleetStateExplain(s, t)}>
                <span className={cn("size-2 rounded-full", FLEET_STATE[s].dot)} aria-hidden="true" />
                {t("fleet.stateCount", { count: counts.get(s), label: fleetStateLabel(s, t) })}
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
                      {d.currentTour!.name} · {fleetStateExplain(state, t)}
                    </span>
                  </span>
                  <span className={cn("shrink-0 text-2xs font-bold g:font-medium", FLEET_STATE[state].text)}>
                    {fleetStateLabel(state, t)}
                    {age !== null && state !== "live" ? ` · ${ageLabel(age, t)}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {admin && (
            <Link href="/settings?section=tracking" className="inline-flex items-center gap-1 text-2xs font-semibold text-brand-700 hover:underline">
              <Settings2 className="size-3.5" /> {t("fleet.manageTrackingPilots")}
            </Link>
          )}
        </div>
      )}
    </section>
  );
}

