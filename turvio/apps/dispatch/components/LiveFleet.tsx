"use client";

import { formatClock } from "@turvio/shared";
import { Badge, Button, cn } from "@turvio/web-ui/ds";
import { Crosshair, Radio, Truck } from "lucide-react";
import { finishTitle, finishValue, projectionNote } from "../lib/eta";
import { durationText } from "../lib/i18n";
import { useI18n } from "../lib/i18n/client";
import { ageLabel, freshnessOf, freshnessLabel, unavailableExplain, unavailableLabel, type Freshness, type FreshnessThresholds, type LiveVehicle, type UnavailableDriver } from "../lib/live";
import { useDispatch } from "../lib/store";

const TONE: Record<Freshness, string> = {
  live: "bg-success-soft text-success-ink g:text-ink-2",
  delayed: "bg-warning-soft text-warning-ink",
  offline: "bg-surface-3 text-muted",
};
/** G: status as a small static dot + text (no filled pill, no pulse). */
const DOT: Record<Freshness, string> = { live: "bg-success", delayed: "bg-warning", offline: "bg-subtle" };

export function FreshnessBadge({ positionAt, serverNow, thresholds }: { positionAt: string; serverNow: number; thresholds: FreshnessThresholds }) {
  const { t } = useI18n();
  const { state, ageSeconds } = freshnessOf(positionAt, serverNow, thresholds);
  const age = ageLabel(ageSeconds, t);
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-semibold g:shrink-0 g:gap-1.5 g:bg-transparent g:px-0 g:py-0 g:text-[12px] g:font-normal", TONE[state])} title={t("fleet.positionRecorded", { age })} data-state={state}>
      {state === "live" && <span className="size-1.5 animate-pulse rounded-full bg-current g:hidden" aria-hidden="true" />}
      <span className={cn("hidden size-1.5 shrink-0 rounded-full g:inline-block", DOT[state])} aria-hidden="true" />
      {freshnessLabel(state, t)} · {age}
    </span>
  );
}

/** Paused / no position: a neutral label (no marker, no age – there is no position to age). */
export function UnavailableBadge({ reason }: { reason: UnavailableDriver["reason"] }) {
  const { t } = useI18n();
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-surface-3 px-2 py-0.5 text-2xs font-semibold text-muted g:gap-1.5 g:bg-transparent g:px-0 g:py-0 g:text-[12px] g:font-normal" title={unavailableExplain(reason, t)} data-reason={reason}>
      <span className={cn("hidden size-1.5 shrink-0 rounded-full g:inline-block", reason === "paused" ? "bg-subtle" : "bg-warning")} aria-hidden="true" />
      {unavailableLabel(reason, t)}
    </span>
  );
}

const H3 = "mb-2 flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-[0.1em] text-subtle g:text-[12px] g:font-medium g:normal-case g:tracking-normal g:text-ink-2 g:[&>svg]:hidden";

/**
 * Overview list: every vehicle with a position, worst freshness first (state + server-clock age),
 * then the drivers of running or paused tours that have no marker, with the reason.
 */
export function LiveFleetList({
  vehicles,
  unavailable = [],
  serverNow,
  thresholds,
  onSelect,
  onSelectTour,
}: {
  vehicles: LiveVehicle[];
  unavailable?: UnavailableDriver[];
  serverNow: number;
  thresholds: FreshnessThresholds;
  onSelect: (v: LiveVehicle) => void;
  onSelectTour?: (tourId: string) => void;
}) {
  const { t } = useI18n();
  if (!vehicles.length && !unavailable.length) return null;
  const order: Record<Freshness, number> = { offline: 0, delayed: 1, live: 2 };
  const st = (v: LiveVehicle) => freshnessOf(v.positionAt ?? v.recordedAt, serverNow, thresholds).state;
  const sorted = [...vehicles].sort((a, b) => order[st(a)] - order[st(b)] || a.driverName.localeCompare(b.driverName));
  const off = [...unavailable].sort((a, b) => (a.reason === b.reason ? a.driverName.localeCompare(b.driverName) : a.reason === "no_position" ? -1 : 1));
  return (
    <div className="flex flex-col gap-4" data-testid="live-fleet">
      {sorted.length > 0 && (
        <section>
          <h3 className={H3}>
            <Radio className="size-3.5" /> {t("fleet.liveFleet")}
            <span className="ms-auto font-medium normal-case tracking-normal text-muted">{t("fleet.liveFleetCount", { count: sorted.length })}</span>
          </h3>
          <ul className="flex flex-col divide-y divide-line rounded-md border border-line bg-surface">
            {sorted.map((v) => (
              <li key={v.driverId}>
                <button onClick={() => onSelect(v)} className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-start hover:bg-surface-2 g:py-2 g:hover:bg-[var(--hover)]">
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-medium text-ink">{v.driverName}</div>
                    <div className="truncate text-2xs text-muted">
                      {v.vehicle?.label ?? t("fleet.noVehicle")} · {v.tourName} · {v.progress.done}/{v.progress.done + v.progress.remaining}
                    </div>
                  </div>
                  <FreshnessBadge positionAt={v.positionAt ?? v.recordedAt} serverNow={serverNow} thresholds={thresholds} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {off.length > 0 && (
        <section aria-label={t("fleet.notOnMap")} data-testid="live-unavailable">
          <h3 className={H3}>
            <Truck className="size-3.5" /> {t("fleet.notOnMap")}
            <span className="ms-auto font-medium normal-case tracking-normal text-muted tabular">{off.length}</span>
          </h3>
          <ul className="flex flex-col divide-y divide-line rounded-md border border-line bg-surface">
            {off.map((u) => (
              <li key={u.driverId}>
                <button type="button" onClick={() => onSelectTour?.(u.tourId)} className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-start hover:bg-surface-2 g:py-2 g:hover:bg-[var(--hover)]">
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-medium text-ink">{u.driverName}</div>
                    <div className="truncate text-2xs text-muted" title={unavailableExplain(u.reason, t)}>
                      {u.tourName} · {u.progress.done}/{u.progress.done + u.progress.remaining} · {unavailableExplain(u.reason, t)}
                    </div>
                  </div>
                  <UnavailableBadge reason={u.reason} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/** The selected tour's driver has no marker (paused or no position): say so and why. */
export function UnavailableDriverPanel({ u }: { u: UnavailableDriver }) {
  const { t } = useI18n();
  return (
    <section className="flex flex-col gap-1.5 rounded-lg border border-line bg-surface p-3" aria-label={t("fleet.liveVehicle")} data-testid="unavailable-panel">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-ink g:text-[13.5px]">{u.driverName}</div>
          <div className="truncate text-xs text-muted g:text-[12px]">{u.vehicle ? `${u.vehicle.label ?? ""} · ${u.vehicle.licensePlate ?? ""}` : t("fleet.noVehicleAssigned")}</div>
        </div>
        <UnavailableBadge reason={u.reason} />
      </div>
      <p className="text-xs text-muted g:text-[12px]">{unavailableExplain(u.reason, t)}</p>
    </section>
  );
}

/** Details of the selected vehicle, above the tour detail. */
export function LiveVehiclePanel({ v, serverNow, thresholds, onFocus }: { v: LiveVehicle; serverNow: number; thresholds: FreshnessThresholds; onFocus: () => void }) {
  const { t, tr, fmt, locale } = useI18n();
  const { state } = freshnessOf(v.positionAt ?? v.recordedAt, serverNow, thresholds);
  // Same projection as the tour list, detail and map (dataset road times + live position).
  const { summaries } = useDispatch();
  const summary = summaries.find((x) => x.tour.id === v.tourId);
  const proj = summary?.timeline.projection;
  const next = v.nextStop ? summary?.timeline.projections.get(v.nextStop.id) : undefined;
  const lateCount = proj ? [...proj.stops.values()].filter((x) => x.state === "projected_late" || x.state === "deadline_missed").length : 0;
  const total = v.progress.done + v.progress.remaining;
  const speedKmh = v.position.speedMps != null && state === "live" ? Math.round(v.position.speedMps * 3.6) : null;
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-3" aria-label={t("fleet.liveVehicle")}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full g:hidden", state === "live" ? "bg-brand-600 text-white" : state === "delayed" ? "bg-nx-amber text-white" : "bg-surface-3 text-muted")}>
            <Truck className="size-4" />
          </span>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-ink g:text-[13.5px]">{v.driverName}</div>
            <div className="truncate text-xs text-muted g:text-[12px]">{v.vehicle ? `${v.vehicle.label ?? ""} · ${v.vehicle.licensePlate ?? ""}` : t("fleet.noVehicleAssigned")}</div>
          </div>
        </div>
        <FreshnessBadge positionAt={v.positionAt ?? v.recordedAt} serverNow={serverNow} thresholds={thresholds} />
      </div>
      {state !== "live" && (
        <p className="rounded-md bg-warning-soft/70 px-2.5 py-1.5 text-xs text-warning-ink g:border g:border-line-2 g:bg-transparent g:text-[12px]">
          {state === "delayed" ? t("fleet.delayedNote") : t("fleet.offlineNote", { min: Math.round(thresholds.offlineAfterSeconds / 60) })}
        </p>
      )}
      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs g:gap-x-4 g:text-[12.5px]">
        <div>
          <dt className="text-subtle g:text-[12px] g:text-muted">{t("fleet.progress")}</dt>
          <dd className="font-medium text-ink">{t("fleet.progressValue", { done: v.progress.done, count: total, remaining: v.progress.remaining })}</dd>
        </div>
        <div>
          <dt className="text-subtle g:text-[12px] g:text-muted">{t("fleet.gpsAccuracy")}</dt>
          <dd className="font-medium text-ink">{v.position.accuracyMeters != null ? t("fleet.accuracyValue", { n: Math.round(v.position.accuracyMeters) }) : t("fleet.unknown")}</dd>
        </div>
        <div>
          <dt className="text-subtle g:text-[12px] g:text-muted">{t("fleet.speed")}</dt>
          <dd className="font-medium text-ink">{speedKmh != null ? t("fleet.speedValue", { n: speedKmh }) : "–"}</dd>
        </div>
        <div>
          <dt className="text-subtle g:text-[12px] g:text-muted">{t("fleet.lastPosition")}</dt>
          <dd className="font-medium text-ink tabular">{fmt.time(v.recordedAt, true)}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-subtle g:text-[12px] g:text-muted">{t("fleet.nextStop")}</dt>
          <dd className="font-medium text-ink">
            {v.nextStop ? (
              <>
                {v.nextStop.sequence + 1}. {v.nextStop.name ?? ""} · {v.nextStop.street} {v.nextStop.houseNumber ?? ""}, {v.nextStop.city}
                {v.nextStop.twEnd != null && <Badge tone="outline" className="ms-1.5">{t("fleet.nextStopBy", { time: formatClock(v.nextStop.twEnd) })}</Badge>}
              </>
            ) : (
              t("fleet.allStopsDone")
            )}
          </dd>
        </div>
      </dl>
      <div className="rounded-md border border-line bg-surface-2/60 px-2.5 py-2 text-xs g:border-line-2 g:bg-transparent g:text-[12.5px]" aria-label={t("fleet.liveEta")} data-testid="live-eta">
        {proj && summary ? (
          <div className="flex flex-col gap-1">
            <div className="text-ink">
              {next && Number.isFinite(next.etaMinute) ? tr("fleet.nextStopEta", { time: <strong>{formatClock(next.etaMinute)}</strong> }) : null}
              {tr("fleet.finishLine", {
                // English reads "finish at last stop 14:05"; other languages keep their capitalisation.
                finish: locale === "en" ? finishTitle(summary.tour, proj, t).toLowerCase() : finishTitle(summary.tour, proj, t),
                value: <strong>{finishValue(proj)}</strong>,
                duration: durationText(proj.remainingDriveSeconds / 60, t),
                km: fmt.number(proj.remainingMeters / 1000, 1),
              })}
            </div>
            <div className="text-subtle">{projectionNote(proj, t)}</div>
            {lateCount > 0 && <div className={proj.source === "road" ? "text-danger-ink" : "text-warning-ink"}>{t(proj.source === "road" ? "fleet.lateRoad" : "fleet.lateEstimate", { count: lateCount })}</div>}
          </div>
        ) : (
          <div className="text-subtle">{state === "offline" ? t("fleet.noLiveEtaOld") : t("fleet.noEtaForTour")}</div>
        )}
      </div>
      <Button variant="secondary" size="sm" onClick={onFocus}>
        <Crosshair /> {t("fleet.focusVehicle")}
      </Button>
    </section>
  );
}
