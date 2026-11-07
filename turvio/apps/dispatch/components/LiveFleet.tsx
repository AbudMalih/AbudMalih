"use client";

import { formatClock, formatDuration } from "@turvio/shared";
import { Badge, Button, cn } from "@turvio/web-ui/ds";
import { Crosshair, Radio, Truck } from "lucide-react";
import { ageLabel, freshnessOf, FRESHNESS_LABEL, useLiveEta, type Freshness, type LiveVehicle } from "../lib/live";

const TONE: Record<Freshness, string> = {
  live: "bg-success-soft text-success-ink",
  delayed: "bg-warning-soft text-warning-ink",
  offline: "bg-surface-3 text-muted",
};

export function FreshnessBadge({ recordedAt, serverNow }: { recordedAt: string; serverNow: number }) {
  const { state, ageSeconds } = freshnessOf(recordedAt, serverNow);
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-semibold", TONE[state])} title={`Position recorded ${ageLabel(ageSeconds)}`}>
      {state === "live" && <span className="size-1.5 animate-pulse rounded-full bg-current" aria-hidden="true" />}
      {FRESHNESS_LABEL[state]} · {ageLabel(ageSeconds)}
    </span>
  );
}

/** Overview list: every vehicle on the road with live GPS, worst freshness first. */
export function LiveFleetList({ vehicles, serverNow, onSelect }: { vehicles: LiveVehicle[]; serverNow: number; onSelect: (v: LiveVehicle) => void }) {
  if (!vehicles.length) return null;
  const order: Record<Freshness, number> = { offline: 0, delayed: 1, live: 2 };
  const sorted = [...vehicles].sort((a, b) => order[freshnessOf(a.recordedAt, serverNow).state] - order[freshnessOf(b.recordedAt, serverNow).state] || a.driverName.localeCompare(b.driverName));
  return (
    <section>
      <h3 className="mb-2 flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-[0.1em] text-subtle">
        <Radio className="size-3.5" /> Live fleet
      </h3>
      <ul className="flex flex-col divide-y divide-line rounded-md border border-line bg-surface">
        {sorted.map((v) => (
          <li key={v.driverId}>
            <button onClick={() => onSelect(v)} className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-start hover:bg-surface-2">
              <div className="min-w-0">
                <div className="truncate text-[13px] font-medium text-ink">{v.driverName}</div>
                <div className="truncate text-2xs text-muted">
                  {v.vehicle?.label ?? "No vehicle"} · {v.tourName} · {v.progress.done}/{v.progress.done + v.progress.remaining}
                </div>
              </div>
              <FreshnessBadge recordedAt={v.recordedAt} serverNow={serverNow} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Details of the selected vehicle, above the tour detail. */
export function LiveVehiclePanel({ v, serverNow, onFocus }: { v: LiveVehicle; serverNow: number; onFocus: () => void }) {
  const { state } = freshnessOf(v.recordedAt, serverNow);
  const eta = useLiveEta(v.tourId, state !== "offline");
  const nextEta = eta?.stops?.find((x) => x.stopId === v.nextStop?.id);
  const total = v.progress.done + v.progress.remaining;
  const speedKmh = v.position.speedMps != null && state === "live" ? Math.round(v.position.speedMps * 3.6) : null;
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-3" aria-label="Live vehicle">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", state === "live" ? "bg-brand-600 text-white" : state === "delayed" ? "bg-amber-500 text-white" : "bg-surface-3 text-muted")}>
            <Truck className="size-4" />
          </span>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-ink">{v.driverName}</div>
            <div className="truncate text-xs text-muted">{v.vehicle ? `${v.vehicle.label ?? ""} · ${v.vehicle.licensePlate ?? ""}` : "No vehicle assigned"}</div>
          </div>
        </div>
        <FreshnessBadge recordedAt={v.recordedAt} serverNow={serverNow} />
      </div>
      {state !== "live" && (
        <p className="rounded-md bg-warning-soft/70 px-2.5 py-1.5 text-xs text-warning-ink">
          {state === "delayed"
            ? "Positions are arriving late (weak network or the phone is saving battery). The marker shows the last received position."
            : "No position for more than 5 minutes – the marker shows the LAST KNOWN position, not where the vehicle is now. Possible causes: no network, phone off, location permission revoked."}
        </p>
      )}
      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
        <div>
          <dt className="text-subtle">Progress</dt>
          <dd className="font-medium text-ink">
            {v.progress.done} of {total} stops · {v.progress.remaining} left
          </dd>
        </div>
        <div>
          <dt className="text-subtle">GPS accuracy</dt>
          <dd className="font-medium text-ink">{v.position.accuracyMeters != null ? `±${Math.round(v.position.accuracyMeters)} m` : "unknown"}</dd>
        </div>
        <div>
          <dt className="text-subtle">Speed</dt>
          <dd className="font-medium text-ink">{speedKmh != null ? `${speedKmh} km/h` : "–"}</dd>
        </div>
        <div>
          <dt className="text-subtle">Last position</dt>
          <dd className="font-medium text-ink">{new Date(v.recordedAt).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-subtle">Next stop</dt>
          <dd className="font-medium text-ink">
            {v.nextStop ? (
              <>
                {v.nextStop.sequence + 1}. {v.nextStop.name ?? ""} · {v.nextStop.street} {v.nextStop.houseNumber ?? ""}, {v.nextStop.city}
                {v.nextStop.twEnd != null && <Badge tone="outline" className="ms-1.5">by {formatClock(v.nextStop.twEnd)}</Badge>}
              </>
            ) : (
              "All stops done"
            )}
          </dd>
        </div>
      </dl>
      <div className="rounded-md border border-line bg-surface-2/60 px-2.5 py-2 text-xs" aria-label="Live ETA">
        {eta?.source === "osrm" ? (
          <div className="flex flex-col gap-1">
            <div className="text-ink">
              {nextEta ? <>Next stop ETA <strong>{formatClock(nextEta.etaMinute)}</strong> · </> : null}
              back by <strong>{formatClock(eta.finishMinute!)}</strong> · {formatDuration(eta.remainingDriveSeconds! / 60)} driving, {(eta.remainingMeters! / 1000).toFixed(1)} km left
            </div>
            <div className="text-subtle">Road route from the current GPS position (OSRM), planned stop order.</div>
            {eta.suggestReoptimize && (
              <div className="text-warning-ink">
                {eta.atRiskStopIds!.length} stop(s) will miss their deadline in the current order. Consider “Re-optimize…” below – the order is not changed automatically.
              </div>
            )}
          </div>
        ) : (
          <div className="text-subtle">
            {eta?.reason === "position_stale" || state === "offline"
              ? "No live ETA: the last position is too old."
              : eta?.reason === "no_routing" || eta?.reason === "routing_unavailable"
                ? "No live ETA: road routing is not available."
                : "Live ETA is calculated from the current position…"}
          </div>
        )}
      </div>
      <Button variant="secondary" size="sm" onClick={onFocus}>
        <Crosshair /> Focus map on vehicle
      </Button>
    </section>
  );
}
