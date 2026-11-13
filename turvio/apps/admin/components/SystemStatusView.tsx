"use client";

import { FormAlert, cn } from "@turvio/web-ui/ds";
import { Activity, Clock, GitCommitHorizontal, Route } from "lucide-react";
import { STATE, ServiceRows, RefreshButton, checkedLabel, useSystemStatus } from "./SystemHealth";

function uptime(s: number) {
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  return d ? `${d} d ${h} h` : h ? `${h} h ${m} min` : `${m} min`;
}

function Tile({ icon, label, value, foot }: { icon: React.ReactNode; label: string; value: React.ReactNode; foot?: React.ReactNode }) {
  return (
    <div className="relative flex min-w-0 flex-col gap-3 rounded-[22px] border border-line bg-surface p-5 shadow-card">
      <div className="flex items-center gap-2.5 text-[13px] font-semibold text-ink-2">
        <span className="inline-grid size-[30px] place-items-center rounded-[10px] bg-nx-violet-soft text-nx-violet-text [&_svg]:size-4">{icon}</span>
        {label}
      </div>
      <div className="truncate text-[28px] font-extrabold leading-none tracking-[-0.03em] text-ink tabular">{value}</div>
      {foot && <div className="text-xs text-muted">{foot}</div>}
    </div>
  );
}

/** System status (prototype "System"): live service checks measured now, configuration labelled as such. */
export function SystemStatusView() {
  const { state, busy, reload } = useSystemStatus();
  if (state.status === "error")
    return (
      <FormAlert>
        The live status could not be loaded ({state.message}). No status is shown rather than an unverified one.
      </FormAlert>
    );
  if (state.status === "loading")
    return (
      <div className="grid grid-cols-1 gap-[18px] xl:grid-cols-4" aria-busy="true" aria-label="Checking services">
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
      <section className="grid grid-cols-1 gap-[18px] sm:grid-cols-2 xl:grid-cols-4" aria-label="Summary">
        <Tile icon={<Activity />} label="Live services operational" value={`${ok} / ${live.length}`} foot={`Measured at ${checkedLabel(d.checkedAt)}`} />
        <Tile icon={<GitCommitHorizontal />} label="Release" value={<span className="font-mono text-xl">{d.release ? d.release.slice(0, 7) : "—"}</span>} foot={d.release ? "API image of this deployment" : "Not reported by this API"} />
        <Tile icon={<Clock />} label="API uptime" value={uptime(d.uptimeSeconds)} foot="since the API process started" />
        <Tile
          icon={<Route />}
          label="Road routing requests"
          value={rc ? (rc.routeRequests + rc.tableRequests).toLocaleString("de-DE") : "—"}
          foot={rc ? `${rc.failures} failed · ${rc.cacheHits} from cache · since start` : "No road routing configured"}
        />
      </section>

      <div className="grid grid-cols-1 gap-[18px] xl:grid-cols-12">
        <section className="min-w-0 rounded-[22px] border border-line bg-surface p-5 shadow-card xl:col-span-7">
          <div className="mb-2 flex items-start gap-3">
            <div>
              <h2 className="text-[15.5px] font-bold tracking-[-0.01em] text-ink">Service health</h2>
              <p className="mt-px text-[12.5px] text-muted">Live checks – each service was called just now (time-out 4 s)</p>
            </div>
            <div className="ms-auto">
              <RefreshButton busy={busy} onClick={() => void reload()} />
            </div>
          </div>
          <ServiceRows services={live} />
        </section>

        <section className="min-w-0 rounded-[22px] border border-line bg-surface p-5 shadow-card xl:col-span-5">
          <h2 className="text-[15.5px] font-bold tracking-[-0.01em] text-ink">Needs attention</h2>
          <p className="mb-3.5 mt-px text-[12.5px] text-muted">{issues.length + unconfigured.length ? `${issues.length + unconfigured.length} item(s) from the live checks` : "From the live checks"}</p>
          <div className="flex flex-col gap-2.5">
            {[...issues, ...unconfigured].map((s) => (
              <div key={s.key} className="grid grid-cols-[4px_1fr] gap-3 rounded-[14px] border border-line bg-surface-2 p-3">
                <span className={cn("self-stretch rounded", s.state === "down" ? "bg-nx-coral" : s.state === "degraded" ? "bg-nx-amber" : "bg-muted")} aria-hidden="true" />
                <div className="min-w-0">
                  <div className="text-[13.5px] font-bold text-ink">
                    {s.label}: {STATE[s.state].label.toLowerCase()}
                  </div>
                  <div className="text-xs text-muted">{s.detail}</div>
                </div>
              </div>
            ))}
            {issues.length + unconfigured.length === 0 && (
              <div className="flex items-center gap-2.5 rounded-[14px] border border-line bg-surface-2 p-3 text-[13px] font-semibold text-ink-2">
                <span className="size-2 rounded-full bg-nx-mint" aria-hidden="true" />
                All live checks passed.
              </div>
            )}
          </div>
        </section>
      </div>

      <section className="min-w-0 rounded-[22px] border border-line bg-surface p-5 shadow-card">
        <div className="mb-2 flex flex-wrap items-baseline gap-x-3">
          <h2 className="text-[15.5px] font-bold tracking-[-0.01em] text-ink">Configuration</h2>
          <span className="inline-flex h-6 items-center rounded-lg bg-surface-2 px-[9px] text-xs font-bold text-muted">Not a health check</span>
        </div>
        <p className="mb-2 text-[12.5px] text-muted">How this API instance is configured, read from its settings. These entries are not tested.</p>
        <ServiceRows services={config} />
      </section>
    </>
  );
}
