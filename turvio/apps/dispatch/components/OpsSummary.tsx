"use client";

import { cn } from "@turvio/web-ui/ds";
import { AlertTriangle, CircleCheck, PackageCheck, PackageOpen, Route, Steering } from "./icons";
import { motion } from "motion/react";
import Link from "next/link";
import type { ReactNode } from "react";
import { useT } from "../lib/i18n/client";
import { useDispatch } from "../lib/store";
import { useDesignG } from "../lib/ui";

/**
 * Phase G: one bordered band, six equal cells divided by hairlines. No icons or colour per figure:
 * the label, the figure and one line of context. Colour appears only where something needs
 * attention (a red or amber dot and text); progress is a 2 px neutral rule.
 */
function Cell({ label, value, foot, tone, progress, href }: { label: string; value: ReactNode; foot?: ReactNode; tone?: "danger" | "warning"; progress?: number; href?: string }) {
  const body = (
    <>
      <span className="truncate text-[12px] text-muted">{label}</span>
      <span className="tabular text-[22px] font-medium leading-7 tracking-[-0.02em] text-ink">{value}</span>
      {progress !== undefined ? (
        <span className="block h-[2px] overflow-hidden rounded-full bg-[var(--selected)]" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
          <span className="block h-full rounded-full bg-[var(--text-3)] transition-[width] duration-700" style={{ width: `${Math.round(progress * 100)}%` }} />
        </span>
      ) : (
        <span className="block h-[2px]" aria-hidden="true" />
      )}
      <span className={cn("flex min-h-4 items-center gap-1.5 truncate text-[12px] leading-4", tone === "danger" ? "text-danger-ink" : tone === "warning" ? "text-warning-ink" : "text-muted")}>
        {tone && <span className={cn("size-1.5 shrink-0 rounded-full", tone === "danger" ? "bg-danger" : "bg-warning")} aria-hidden="true" />}
        <span className="truncate">{foot}</span>
      </span>
    </>
  );
  const cls = "flex min-w-0 flex-col gap-1.5 px-4 py-3 outline-none transition-colors focus-visible:shadow-[var(--shadow-focus)]";
  return href ? (
    <Link href={href} className={cn(cls, "hover:bg-[var(--hover)]")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

type Accent = "violet" | "cobalt" | "mint" | "cyan" | "amber" | "coral";
const ACC: Record<Accent, { tile: string; bar: string }> = {
  violet: { tile: "bg-nx-violet-soft text-nx-violet-text", bar: "var(--violet)" },
  cobalt: { tile: "bg-nx-cobalt-soft text-nx-cobalt-text", bar: "var(--cobalt)" },
  mint: { tile: "bg-nx-mint-soft text-nx-mint", bar: "var(--mint)" },
  cyan: { tile: "bg-nx-cyan-soft text-nx-cyan", bar: "var(--cyan)" },
  amber: { tile: "bg-nx-amber-soft text-nx-amber", bar: "var(--amber)" },
  coral: { tile: "bg-nx-coral-soft text-nx-coral", bar: "var(--coral)" },
};

/** Prototype .kpi card: tinted icon tile + label, 30 px value, optional progress bar and foot line. */
function Kpi({ icon, label, value, foot, footTone, progress, accent, href }: { icon: ReactNode; label: string; value: ReactNode; foot?: ReactNode; footTone?: "coral"; progress?: number; accent: Accent; href?: string }) {
  const a = ACC[accent];
  const body = (
    <>
      <div className="flex min-h-[34px] items-center gap-2.5">
        <span className={cn("inline-flex size-[30px] shrink-0 items-center justify-center rounded-[10px] [&_svg]:size-4", a.tile)}>{icon}</span>
        <span className="line-clamp-2 text-[13px] font-semibold leading-[1.3] text-ink-2">{label}</span>
      </div>
      <div className="tabular text-[28px] font-extrabold leading-none tracking-[-0.03em] text-ink">{value}</div>
      {progress !== undefined && (
        <div className="h-1.5 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
          <motion.i className="block h-full rounded-full" style={{ background: a.bar }} initial={{ width: 0 }} animate={{ width: `${Math.round(progress * 100)}%` }} transition={{ duration: 1.1, ease: [0.2, 0.75, 0.25, 1] }} />
        </div>
      )}
      <div className={cn("min-h-4 text-xs leading-4", footTone === "coral" ? "text-nx-coral" : "text-muted")}>{foot}</div>
    </>
  );
  const cls =
    "relative flex min-w-0 flex-col gap-3 rounded-2xl border border-line bg-surface p-4 shadow-card transition-[border-color,transform,box-shadow] duration-300 ease-[var(--ease-out-quart)] hover:-translate-y-0.5 hover:border-line-strong hover:shadow-overlay";
  return href ? (
    <Link href={href} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** KPI row of the Overview (prototype: Active tours · Drivers · Stops completed · Remaining · Delayed · Pickups). */
export function OpsSummary() {
  const { kpis, data } = useDispatch();
  const t = useT();
  const hasData = data.tours.length > 0 || data.unassigned.length > 0;
  const remainingShare = kpis.totalStops ? kpis.remainingDeliveries / Math.max(kpis.totalStops, kpis.remainingDeliveries) : 0;
  const delayedSub = [
    kpis.delayedConfirmed && t("map.ops.confirmed", { n: kpis.delayedConfirmed }),
    kpis.delayedProjected && t("map.ops.projected", { n: kpis.delayedProjected }),
    kpis.delayedEstimated && t("map.ops.estimate", { n: kpis.delayedEstimated }),
  ]
    .filter(Boolean)
    .join(" · ");
  const totalTours = kpis.activeTours + kpis.plannedTours;
  const g = useDesignG();
  if (g)
    return (
      <section
        aria-label={t("map.ops.aria")}
        className="grid grid-cols-2 overflow-hidden rounded-lg border border-line bg-surface md:grid-cols-3 xl:grid-cols-6 [&>*]:border-line [&>*]:border-b xl:[&>*]:border-b-0 [&>*:not(:first-child)]:border-s max-md:[&>*:nth-child(odd)]:border-s-0 md:max-xl:[&>*:nth-child(3n+1)]:border-s-0"
      >
        <Cell
          label={t("map.ops.activeTours")}
          value={kpis.activeTours}
          progress={totalTours ? kpis.activeTours / totalTours : 0}
          foot={kpis.plannedTours ? t("map.ops.plannedMore", { n: kpis.plannedTours }) : hasData ? t("map.ops.allStarted") : t("map.ops.noTours")}
        />
        <Cell label={t("map.ops.drivers")} value={kpis.activeDrivers} foot={t("map.ops.vehiclesAvailable", { a: kpis.availableVehicles, b: kpis.totalVehicles })} />
        <Cell
          label={t("map.ops.stopsCompleted")}
          value={kpis.completedStops}
          progress={kpis.completion}
          foot={hasData ? t("map.ops.completionFoot", { pct: Math.round(kpis.completion * 100), count: kpis.totalStops }) : "–"}
        />
        <Cell
          label={t("map.ops.deliveriesRemaining")}
          value={kpis.remainingDeliveries}
          progress={remainingShare}
          tone={kpis.unassignedDeliveries ? "warning" : undefined}
          foot={kpis.unassignedDeliveries ? t("map.ops.unassigned", { n: kpis.unassignedDeliveries }) : hasData ? t("map.ops.allAssigned") : "–"}
        />
        <Cell
          label={t("map.delayedTours")}
          value={kpis.delayedTours}
          tone={kpis.delayedConfirmed || kpis.delayedProjected ? "danger" : kpis.delayedEstimated ? "warning" : undefined}
          foot={delayedSub || t("map.ops.none")}
          href="/list?status=delayed"
        />
        <Cell
          label={t("map.ops.pickups")}
          value={kpis.scheduledPickups}
          tone={kpis.pickupConflicts ? "danger" : undefined}
          foot={kpis.pickupConflicts ? t("map.ops.needAttention", { n: kpis.pickupConflicts }) : t("map.ops.onSchedule")}
          href="/pickups"
        />
      </section>
    );
  return (
    <section aria-label={t("map.ops.aria")} className="grid grid-cols-2 gap-[18px] md:grid-cols-3 xl:grid-cols-6">
      <Kpi
        accent="violet"
        icon={<Route />}
        label={t("map.ops.activeTours")}
        value={kpis.activeTours}
        progress={totalTours ? kpis.activeTours / totalTours : 0}
        foot={kpis.plannedTours ? t("map.ops.plannedMore", { n: kpis.plannedTours }) : hasData ? t("map.ops.allStarted") : t("map.ops.noTours")}
      />
      <Kpi accent="cobalt" icon={<Steering />} label={t("map.ops.drivers")} value={kpis.activeDrivers} foot={t("map.ops.vehiclesAvailable", { a: kpis.availableVehicles, b: kpis.totalVehicles })} />
      <Kpi
        accent="mint"
        icon={<CircleCheck />}
        label={t("map.ops.stopsCompleted")}
        value={kpis.completedStops}
        progress={kpis.completion}
        foot={hasData ? t("map.ops.completionFoot", { pct: Math.round(kpis.completion * 100), count: kpis.totalStops }) : "–"}
      />
      <Kpi
        accent="cyan"
        icon={<PackageOpen />}
        label={t("map.ops.deliveriesRemaining")}
        value={kpis.remainingDeliveries}
        progress={remainingShare}
        foot={kpis.unassignedDeliveries ? t("map.ops.unassigned", { n: kpis.unassignedDeliveries }) : hasData ? t("map.ops.allAssigned") : "–"}
      />
      <Kpi
        accent="amber"
        icon={<AlertTriangle />}
        label={t("map.delayedTours")}
        value={kpis.delayedTours}
        foot={delayedSub || t("map.ops.none")}
        footTone={kpis.delayedConfirmed || kpis.delayedProjected ? "coral" : undefined}
        href="/list?status=delayed"
      />
      <Kpi
        accent="coral"
        icon={<PackageCheck />}
        label={t("map.ops.pickups")}
        value={kpis.scheduledPickups}
        foot={kpis.pickupConflicts ? t("map.ops.needAttention", { n: kpis.pickupConflicts }) : t("map.ops.onSchedule")}
        footTone={kpis.pickupConflicts ? "coral" : undefined}
        href="/pickups"
      />
    </section>
  );
}
