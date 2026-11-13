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
          <stop offset="0%" stopColor="var(--violet)" stopOpacity="0.3" />
          <stop offset="100%" stopColor="var(--violet)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${d} L${w},${h} L0,${h} Z`} fill="url(#spark-fill)" />
      <path d={d} fill="none" stroke="var(--violet-hi)" strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r="2.5" fill="var(--surface)" stroke="var(--violet-hi)" strokeWidth="1.5" />
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
  accent?: "brand" | "success" | "warning" | "navy" | "cyan" | "danger";
}) {
  // [tile classes, hairline colour] – prototype .kpi: --acc / --acc-soft
  const [accentCls, line] = {
    brand: ["bg-nx-violet-soft text-nx-violet-text", "var(--violet)"],
    success: ["bg-nx-mint-soft text-nx-mint", "var(--mint)"],
    warning: ["bg-nx-amber-soft text-nx-amber", "var(--amber)"],
    navy: ["bg-nx-cobalt-soft text-nx-cobalt-text", "var(--cobalt)"],
    cyan: ["bg-nx-cyan-soft text-nx-cyan", "var(--cyan)"],
    danger: ["bg-nx-coral-soft text-nx-coral", "var(--coral)"],
  }[accent];
  const up = trend && trend.delta > 0;
  const good = trend && (trend.delta === 0 ? null : (trend.delta > 0) === (trend.positiveIsGood ?? true));
  return (
    <Card interactive className="flex flex-col gap-3 overflow-hidden p-5">
      <span className="absolute inset-x-[22px] -top-px h-[1.5px] rounded-sm opacity-85" style={{ background: line }} aria-hidden="true" />
      <div className="flex items-center gap-3">
        <span className={cn("inline-flex size-[38px] shrink-0 items-center justify-center rounded-xl [&_svg]:size-[18px]", accentCls)}>{icon}</span>
        <span className="text-[13px] font-semibold text-ink-2">{label}</span>
      </div>
      <div className="flex items-end justify-between gap-3">
        <div className="tabular text-[30px] font-extrabold leading-none tracking-[-0.03em] text-ink">{value}</div>
        {sparkline}
      </div>
      <div className="flex min-h-5 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
        {trend && (
          <span
            className={cn(
              "inline-flex h-6 items-center gap-0.5 rounded-full px-2 font-bold tabular",
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
