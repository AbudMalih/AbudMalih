"use client";

import { cn } from "@turvio/web-ui/ds";
import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api, errorText } from "../lib/api";
import type { MessageKey } from "../lib/i18n";
import { useI18n } from "../lib/i18n/client";

/** Shape of GET /v1/platform/system (apps/api/src/system-status.ts). */
export type ServiceState = "operational" | "degraded" | "down" | "not_configured" | "disabled";
export interface ServiceStatus {
  key: string;
  label: string;
  kind: "live" | "config";
  state: ServiceState;
  detail: string;
  latencyMs?: number;
}
export interface SystemStatus {
  checkedAt: string;
  release: string | null;
  uptimeSeconds: number;
  services: ServiceStatus[];
  routingCounters: { routeRequests: number; tableRequests: number; failures: number; cacheHits: number } | null;
}

export const STATE: Record<ServiceState, { label: MessageKey; dot: string; text: string }> = {
  operational: { label: "system.state.operational", dot: "bg-nx-mint g:bg-success", text: "text-nx-mint g:text-ink-2" },
  degraded: { label: "system.state.degraded", dot: "bg-nx-amber", text: "text-nx-amber" },
  down: { label: "system.state.down", dot: "bg-nx-coral", text: "text-nx-coral" },
  not_configured: { label: "system.state.not_configured", dot: "bg-muted", text: "text-muted" },
  disabled: { label: "system.state.disabled", dot: "bg-muted", text: "text-muted" },
};

export type LoadState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; data: SystemStatus };

/** Fetches the live status (through the Admin's API proxy) on mount and on demand; a missing second factor redirects to its set-up. */
export function useSystemStatus() {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setBusy(true);
    try {
      setState({ status: "ready", data: await api<SystemStatus>("GET", "/v1/platform/system") });
    } catch (e) {
      setState({ status: "error", message: errorText(e) });
    } finally {
      setBusy(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  return { state, busy, reload: load };
}

export function RefreshButton({ busy, onClick }: { busy: boolean; onClick: () => void }) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="inline-grid size-8 place-items-center rounded-[10px] border border-line-strong bg-surface text-ink-2 transition-colors hover:border-line-3 hover:text-ink disabled:opacity-60 g:size-7 g:border-line-2 g:hover:bg-[var(--hover)]"
      aria-label={t("system.checkAgain")}
      title={t("system.checkAgain")}
    >
      <RefreshCw className={cn("size-3.5", busy && "animate-spin")} />
    </button>
  );
}

/** Prototype .health rows: dot, service, detail, measured latency / state. */
export function ServiceRows({ services, compact = false }: { services: ServiceStatus[]; compact?: boolean }) {
  const { t } = useI18n();
  return (
    <ul className="flex flex-col">
      {services.map((s) => {
        // Configuration is reported, not measured: never shown as "Operational" or in green.
        const st = s.kind === "config" && s.state === "operational" ? { label: "system.state.configured" as MessageKey, dot: "bg-nx-cobalt", text: "text-ink-2" } : STATE[s.state];
        return (
          <li key={s.key} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 border-t border-line py-2.5 first:border-t-0 g:gap-2.5 g:py-2">
            <span className={cn("size-2 rounded-full g:size-1.5", st.dot, s.state === "operational" && s.kind === "live" && "animate-nx-live")} aria-hidden="true" />
            <div className="min-w-0">
              <div className="truncate text-[13.5px] font-semibold text-ink g:text-[13px] g:font-medium">{s.label}</div>
              {!compact && <div className="truncate text-xs text-muted" title={s.detail}>{s.detail}</div>}
            </div>
            <div className="text-end">
              <div className={cn("text-[12.5px] font-bold g:text-[12px] g:font-normal", st.text)}>{t(st.label)}</div>
              {s.latencyMs !== undefined && <div className="text-[11px] font-semibold tabular text-muted">{t("system.ms", { n: s.latencyMs })}</div>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Compact live card for the Overview. */
export function SystemHealthCard() {
  const { t, fmt } = useI18n();
  const { state, busy, reload } = useSystemStatus();
  const live = state.status === "ready" ? state.data.services.filter((s) => s.kind === "live") : [];
  return (
    <section className="relative min-w-0 rounded-[22px] border border-line bg-surface p-5 shadow-card g:p-4 g:shadow-none">
      <div className="mb-2 flex items-start gap-3">
        <div className="min-w-0">
          <h2 className="text-[15.5px] font-bold tracking-[-0.01em] text-ink g:text-[13.5px] g:font-semibold g:tracking-normal">{t("system.health")}</h2>
          <p className="mt-px text-[12.5px] text-muted">{state.status === "ready" ? t("system.measuredAt", { time: fmt.time(state.data.checkedAt, true) }) : t("system.liveChecks")}</p>
        </div>
        <div className="ms-auto">
          <RefreshButton busy={busy} onClick={() => void reload()} />
        </div>
      </div>
      {state.status === "loading" && (
        <div className="flex flex-col gap-3 py-2" aria-busy="true">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="h-5 animate-pulse rounded-md bg-surface-2" />
          ))}
        </div>
      )}
      {state.status === "error" && <p className="py-3 text-[13px] text-danger-ink">{t("system.loadFailed", { reason: state.message })}</p>}
      {state.status === "ready" && <ServiceRows services={live} compact />}
    </section>
  );
}
