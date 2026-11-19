"use client";

import { FormAlert, cn } from "@turvio/web-ui/ds";
import { Activity, Clock, GitCommitHorizontal, Route } from "lucide-react";
import type { TFunction } from "../lib/i18n";
import { useI18n } from "../lib/i18n/client";
import { STATE, ServiceRows, RefreshButton, useSystemStatus } from "./SystemHealth";

export function uptime(s: number, t: TFunction) {
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  return d ? t("system.uptimeDays", { d, h }) : h ? t("system.uptimeHours", { h, m }) : t("system.uptimeMinutes", { m });
}

function Tile({ icon, label, value, foot }: { icon: React.ReactNode; label: string; value: React.ReactNode; foot?: React.ReactNode }) {
  return (
    <div className="relative flex min-w-0 flex-col gap-3 rounded-[22px] border border-line bg-surface p-5 shadow-card g:gap-1.5 g:px-4 g:py-3 g:shadow-none">
      <div className="flex items-center gap-2.5 text-[13px] font-semibold text-ink-2 g:text-[12px] g:font-normal g:text-muted">
        <span className="inline-grid size-[30px] place-items-center rounded-[10px] bg-nx-violet-soft text-nx-violet-text [&_svg]:size-4 g:hidden">{icon}</span>
        {label}
      </div>
      <div className="truncate text-[28px] font-extrabold leading-none tracking-[-0.03em] text-ink tabular g:text-[20px] g:font-medium g:leading-7">{value}</div>
      {foot && <div className="text-xs text-muted">{foot}</div>}
    </div>
  );
}

/** System status (prototype "System"): live service checks measured now, configuration labelled as such. */
export function SystemStatusView() {
  const { t, fmt } = useI18n();
  const { state, busy, reload } = useSystemStatus();
  if (state.status === "error")
    return (
      <div className="flex flex-col items-start gap-3">
        <FormAlert>{t("system.loadFailed", { reason: state.message })}</FormAlert>
        <RefreshButton busy={busy} onClick={() => void reload()} />
      </div>
    );
  if (state.status === "loading")
    return (
      <div className="grid grid-cols-1 gap-[18px] xl:grid-cols-4" aria-busy="true" aria-label={t("system.checking")}>
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-[120px] animate-pulse rounded-[22px] bg-surface" />
        ))}
        <div className="h-[360px] animate-pulse rounded-[22px] bg-surface xl:col-span-2" />
        <div className="h-[360px] animate-pulse rounded-[22px] bg-surface xl:col-span-2" />
      </div>
    );
  const d = state.data;
  const live = d.services.filter((s) => s.kind === "live");
  const config = d.services.filter((s) => s.kind === "config");
  const ok = live.filter((s) => s.state === "operational").length;
  const issues = live.filter((s) => s.state === "down" || s.state === "degraded");
  const unconfigured = live.filter((s) => s.state === "not_configured");
  const rc = d.routingCounters;
  return (
    <>
      <section className="grid grid-cols-1 gap-[18px] sm:grid-cols-2 xl:grid-cols-4 g:gap-4" aria-label={t("system.summary")}>
        <Tile icon={<Activity />} label={t("system.liveOperational")} value={`${ok} / ${live.length}`} foot={t("system.measuredAt", { time: fmt.time(d.checkedAt, true) })} />
        <Tile icon={<GitCommitHorizontal />} label={t("system.release")} value={<span className="font-mono text-xl g:text-[18px]">{d.release ? d.release.slice(0, 7) : "—"}</span>} foot={d.release ? t("system.releaseFoot") : t("system.releaseNone")} />
        <Tile icon={<Clock />} label={t("system.uptime")} value={uptime(d.uptimeSeconds, t)} foot={t("system.uptimeFoot")} />
        <Tile
          icon={<Route />}
          label={t("system.routing")}
          value={rc ? fmt.number(rc.routeRequests + rc.tableRequests) : "—"}
          foot={rc ? t("system.routingFoot", { failed: rc.failures, cached: rc.cacheHits }) : t("system.routingNone")}
        />
      </section>

      <div className="grid grid-cols-1 gap-[18px] xl:grid-cols-12 g:gap-4">
        <section className="min-w-0 rounded-[22px] border border-line bg-surface p-5 shadow-card g:p-4 g:shadow-none xl:col-span-7">
          <div className="mb-2 flex items-start gap-3">
            <div>
              <h2 className="text-[15.5px] font-bold tracking-[-0.01em] text-ink g:text-[13.5px] g:font-semibold g:tracking-normal">{t("system.serviceHealth")}</h2>
              <p className="mt-px text-[12.5px] text-muted">{t("system.serviceHealthDescription")}</p>
            </div>
            <div className="ms-auto">
              <RefreshButton busy={busy} onClick={() => void reload()} />
            </div>
          </div>
          <ServiceRows services={live} />
        </section>

        <section className="min-w-0 rounded-[22px] border border-line bg-surface p-5 shadow-card g:p-4 g:shadow-none xl:col-span-5">
          <h2 className="text-[15.5px] font-bold tracking-[-0.01em] text-ink g:text-[13.5px] g:font-semibold g:tracking-normal">{t("system.attention")}</h2>
          <p className="mb-3.5 mt-px text-[12.5px] text-muted">{issues.length + unconfigured.length ? t("system.attentionItems", { count: issues.length + unconfigured.length }) : t("system.attentionNone")}</p>
          <div className="flex flex-col gap-2.5">
            {[...issues, ...unconfigured].map((s) => (
              <div key={s.key} className="grid grid-cols-[4px_1fr] gap-3 rounded-[14px] border border-line bg-surface-2 p-3 g:grid-cols-[6px_1fr] g:bg-transparent">
                <span className={cn("self-stretch rounded g:mt-1.5 g:size-1.5 g:self-start g:rounded-full", s.state === "down" ? "bg-nx-coral" : s.state === "degraded" ? "bg-nx-amber" : "bg-muted")} aria-hidden="true" />
                <div className="min-w-0">
                  <div className="text-[13.5px] font-bold text-ink">
                    {s.label}: {t(STATE[s.state].label)}
                  </div>
                  <div className="text-xs text-muted">{s.detail}</div>
                </div>
              </div>
            ))}
            {issues.length + unconfigured.length === 0 && (
              <div className="flex items-center gap-2.5 rounded-[14px] border border-line bg-surface-2 p-3 text-[13px] font-semibold text-ink-2 g:border-0 g:bg-transparent g:p-0 g:font-normal">
                <span className="size-2 rounded-full bg-nx-mint" aria-hidden="true" />
                {t("system.allPassed")}
              </div>
            )}
          </div>
        </section>
      </div>

      <section className="min-w-0 rounded-[22px] border border-line bg-surface p-5 shadow-card g:p-4 g:shadow-none">
        <div className="mb-2 flex flex-wrap items-baseline gap-x-3">
          <h2 className="text-[15.5px] font-bold tracking-[-0.01em] text-ink g:text-[13.5px] g:font-semibold g:tracking-normal">{t("system.configuration")}</h2>
          <span className="inline-flex h-6 items-center rounded-lg bg-surface-2 px-[9px] text-xs font-bold text-muted g:h-5 g:rounded g:px-1.5 g:font-medium">{t("system.notHealthCheck")}</span>
        </div>
        <p className="mb-2 text-[12.5px] text-muted">{t("system.configurationDescription")}</p>
        <ServiceRows services={config} />
      </section>
    </>
  );
}
