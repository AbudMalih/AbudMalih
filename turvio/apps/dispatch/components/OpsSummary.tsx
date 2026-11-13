"use client";

import { cn } from "@turvio/web-ui/ds";
import { AlertTriangle, CircleCheck, PackageCheck, PackageOpen, Route, Steering } from "./icons";
import { motion } from "motion/react";
import Link from "next/link";
import type { ReactNode } from "react";
import { useDispatch } from "../lib/store";

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
  const hasData = data.tours.length > 0 || data.unassigned.length > 0;
  const remainingShare = kpis.totalStops ? kpis.remainingDeliveries / Math.max(kpis.totalStops, kpis.remainingDeliveries) : 0;
  const delayedSub = [kpis.delayedConfirmed && `${kpis.delayedConfirmed} confirmed`, kpis.delayedProjected && `${kpis.delayedProjected} projected`, kpis.delayedEstimated && `${kpis.delayedEstimated} estimate`]
    .filter(Boolean)
    .join(" · ");
  const totalTours = kpis.activeTours + kpis.plannedTours;
  return (
    <section aria-label="Operations summary" className="grid grid-cols-2 gap-[18px] md:grid-cols-3 xl:grid-cols-6">
      <Kpi accent="violet" icon={<Route />} label="Active tours" value={kpis.activeTours} progress={totalTours ? kpis.activeTours / totalTours : 0} foot={kpis.plannedTours ? `+${kpis.plannedTours} planned` : hasData ? "all tours started" : "no tours"} />
      <Kpi accent="cobalt" icon={<Steering />} label="Drivers on the road" value={kpis.activeDrivers} foot={`${kpis.availableVehicles} of ${kpis.totalVehicles} vehicles available`} />
      <Kpi
        accent="mint"
        icon={<CircleCheck />}
        label="Stops completed"
        value={kpis.completedStops}
        progress={kpis.completion}
        foot={hasData ? `${Math.round(kpis.completion * 100)} % · ${kpis.totalStops} stops` : "–"}
      />
      <Kpi
        accent="cyan"
        icon={<PackageOpen />}
        label="Deliveries remaining"
        value={kpis.remainingDeliveries}
        progress={remainingShare}
        foot={kpis.unassignedDeliveries ? `${kpis.unassignedDeliveries} unassigned` : hasData ? "all assigned" : "–"}
      />
      <Kpi
        accent="amber"
        icon={<AlertTriangle />}
        label="Delayed tours"
        value={kpis.delayedTours}
        foot={delayedSub || "none"}
        footTone={kpis.delayedConfirmed || kpis.delayedProjected ? "coral" : undefined}
        href="/list?status=delayed"
      />
      <Kpi
        accent="coral"
        icon={<PackageCheck />}
        label="Pickups"
        value={kpis.scheduledPickups}
        foot={kpis.pickupConflicts ? `${kpis.pickupConflicts} need attention` : "on schedule"}
        footTone={kpis.pickupConflicts ? "coral" : undefined}
        href="/pickups"
      />
    </section>
  );
}
