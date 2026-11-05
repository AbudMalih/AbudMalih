"use client";

import { cn } from "@turvio/web-ui/ds";
import { AlertTriangle, CircleCheck, PackageCheck, PackageOpen, Route, Truck, UserRound } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import type { ReactNode } from "react";
import { useDispatch } from "../lib/store";

function Metric({ icon, label, value, sub, tone, href }: { icon: ReactNode; label: string; value: ReactNode; sub?: string; tone?: "danger" | "warning"; href?: string }) {
  const body = (
    <>
      <span
        className={cn(
          "inline-flex size-7 shrink-0 items-center justify-center rounded-md [&_svg]:size-3.5",
          tone === "danger" ? "bg-danger-soft text-danger-ink" : tone === "warning" ? "bg-warning-soft text-warning-ink" : "bg-surface-2 text-ink-2",
        )}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block whitespace-nowrap text-2xs font-medium uppercase tracking-[0.06em] text-subtle">{label}</span>
        <span className="flex items-baseline gap-1.5 whitespace-nowrap">
          <span className={cn("text-[15px] font-semibold leading-5 tabular", tone === "danger" ? "text-danger-ink" : "text-ink")}>{value}</span>
          {sub && <span className="text-2xs text-muted tabular">{sub}</span>}
        </span>
      </span>
    </>
  );
  const cls = "flex shrink-0 items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors";
  return href ? (
    <Link href={href} className={cn(cls, "hover:bg-surface-2")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export function OpsSummary() {
  const { kpis, hasDataForDate } = useDispatch();
  const pct = Math.round(kpis.completion * 100);
  return (
    <section aria-label="Operations summary" className="flex items-center gap-1 overflow-x-auto border-t border-line px-3 py-1.5 sm:px-4">
      <div className="me-2 flex shrink-0 items-center gap-3 rounded-md px-2 py-1.5">
        <div className="min-w-[132px]">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-2xs font-medium uppercase tracking-[0.06em] text-subtle">Day progress</span>
            <span className="text-xs font-semibold tabular text-ink">{hasDataForDate ? `${pct}%` : "–"}</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-3" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Stops completed today">
            <motion.div className="h-full rounded-full bg-brand-600" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6, ease: [0.25, 1, 0.5, 1] }} />
          </div>
        </div>
      </div>
      <span className="h-8 w-px shrink-0 bg-line" aria-hidden="true" />
      <Metric icon={<UserRound />} label="Active drivers" value={kpis.activeDrivers} />
      <Metric icon={<Route />} label="Active tours" value={kpis.activeTours} sub={kpis.plannedTours ? `+${kpis.plannedTours} planned` : undefined} />
      <Metric icon={<CircleCheck />} label="Completed stops" value={kpis.completedStops} sub={`of ${kpis.totalStops}`} />
      <Metric icon={<PackageOpen />} label="Remaining deliveries" value={kpis.remainingDeliveries} sub={kpis.unassignedDeliveries ? `${kpis.unassignedDeliveries} unassigned` : undefined} />
      <Metric icon={<PackageCheck />} label="Pickups" value={kpis.scheduledPickups} sub={kpis.pickupConflicts ? `${kpis.pickupConflicts} need attention` : undefined} tone={kpis.pickupConflicts ? "warning" : undefined} href="/pickups" />
      <Metric icon={<AlertTriangle />} label="Delayed tours" value={kpis.delayedTours} tone={kpis.delayedTours ? "danger" : undefined} href="/list?status=delayed" />
      <Metric icon={<Truck />} label="Available vehicles" value={kpis.availableVehicles} sub={`of ${kpis.totalVehicles}`} />
    </section>
  );
}
