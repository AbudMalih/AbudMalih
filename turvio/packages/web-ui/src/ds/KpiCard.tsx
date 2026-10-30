import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";
import { Card } from "./Card";
import { cn } from "./cn";

export interface Trend {
  /** Signed change, e.g. +2 or -1. */
  delta: number;
  /** e.g. "vs. previous 30 days" */
  label: string;
  /** Whether an increase is good (green). */
  positiveIsGood?: boolean;
}

/** Minimal inline sparkline. Only pass genuine historical series. */
export function Sparkline({ values, className, label }: { values: number[]; className?: string; label: string }) {
  if (values.length < 2) return null;
  const w = 96;
  const h = 32;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, h - 3 - ((v - min) / span) * (h - 6)] as const);
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const last = pts.at(-1)!;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={cn("h-8 w-24 overflow-visible", className)} role="img" aria-label={label}>
      <defs>
        <linearGradient id="spark-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#2563EB" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#2563EB" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${d} L${w},${h} L0,${h} Z`} fill="url(#spark-fill)" />
      <path d={d} fill="none" stroke="#2563EB" strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r="2.5" fill="#FFFFFF" stroke="#2563EB" strokeWidth="1.5" />
    </svg>
  );
}

export function KpiCard({
  label,
  value,
  icon,
  trend,
  footnote,
  sparkline,
  accent = "brand",
}: {
  label: string;
  value: ReactNode;
  icon: ReactNode;
  trend?: Trend;
  footnote?: ReactNode;
  sparkline?: ReactNode;
  accent?: "brand" | "success" | "warning" | "navy";
}) {
  const accentCls = {
    brand: "bg-brand-50 text-brand-600 ring-brand-100",
    success: "bg-success-soft text-success-ink ring-emerald-100",
    warning: "bg-warning-soft text-warning-ink ring-amber-100",
    navy: "bg-surface-2 text-navy ring-line",
  }[accent];
  const up = trend && trend.delta > 0;
  const good = trend && (trend.delta === 0 ? null : (trend.delta > 0) === (trend.positiveIsGood ?? true));
  return (
    <Card interactive className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13px] font-medium text-muted">{label}</span>
        <span className={cn("inline-flex size-8 items-center justify-center rounded-md ring-1 ring-inset [&_svg]:size-4", accentCls)}>{icon}</span>
      </div>
      <div className="flex items-end justify-between gap-3">
        <div className="tabular text-[26px] font-semibold leading-none tracking-tight text-ink">{value}</div>
        {sparkline}
      </div>
      <div className="flex min-h-5 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
        {trend && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-medium tabular",
              good === null ? "bg-surface-2 text-muted" : good ? "bg-success-soft text-success-ink" : "bg-danger-soft text-danger-ink",
            )}
          >
            {trend.delta !== 0 && (up ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />)}
            {trend.delta > 0 ? "+" : ""}
            {trend.delta}
          </span>
        )}
        {trend && <span>{trend.label}</span>}
        {footnote && <span>{footnote}</span>}
      </div>
    </Card>
  );
}
