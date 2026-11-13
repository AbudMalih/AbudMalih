import { cn } from "@turvio/web-ui/ds";
import { ArrowDownRight, ArrowUpRight, ChevronRight, Info } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

/*
 * Building blocks of the Admin Overview, following the approved prototype (design/next/admin,
 * styles.css: .hero, .live, .kpi, .card, .reason, .feed, .health, .warn). They only render what they
 * are given – the page passes real platform aggregates.
 */

export function Panel({ title, description, action, children, className }: { title: ReactNode; description?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("relative min-w-0 rounded-[22px] border border-line bg-surface p-5 shadow-card", className)}>
      <div className="mb-3.5 flex items-start gap-3">
        <div className="min-w-0">
          <h2 className="text-[15.5px] font-bold tracking-[-0.01em] text-ink">{title}</h2>
          {description && <p className="mt-px text-[12.5px] text-muted">{description}</p>}
        </div>
        {action && <div className="ms-auto flex shrink-0 items-center gap-1.5">{action}</div>}
      </div>
      {children}
    </section>
  );
}

export function InfoTip({ text }: { text: string }) {
  return (
    <span className="inline-grid size-[22px] place-items-center rounded-[7px] text-muted" title={text} aria-label={text} role="img">
      <Info className="size-3.5" />
    </span>
  );
}

export function Delta({ value, suffix = "", goodWhenUp = true }: { value: number; suffix?: string; goodWhenUp?: boolean }) {
  const flat = value === 0;
  const good = flat ? null : value > 0 === goodWhenUp;
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-0.5 rounded-full px-2 text-xs font-bold tabular",
        good === null ? "bg-surface-2 text-muted" : good ? "bg-nx-mint-soft text-nx-mint" : "bg-nx-coral-soft text-nx-coral",
      )}
    >
      {!flat && (value > 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />)}
      {value > 0 ? "+" : ""}
      {value}
      {suffix}
    </span>
  );
}

/** Smooth area chart (prototype hero chart) for a short real series. */
export function AreaChart({ values, labels, height = 150, id }: { values: number[]; labels: string[]; height?: number; id: string }) {
  const W = 640;
  const H = height;
  const top = 16;
  const bottom = 26;
  const max = Math.max(1, ...values);
  const pts = values.map((v, i) => [values.length === 1 ? W / 2 : (i / (values.length - 1)) * (W - 48) + 24, top + (1 - v / (max * 1.15)) * (H - top - bottom)] as const);
  const line = pts.map(([x, y], i) => {
    if (i === 0) return `M${x},${y}`;
    const [px, py] = pts[i - 1]!;
    const cx = (px + x) / 2;
    return `C${cx},${py} ${cx},${y} ${x},${y}`;
  });
  const d = line.join(" ");
  const last = pts.at(-1)!;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block h-full w-full overflow-visible" role="img" aria-label={values.map((v, i) => `${labels[i]}: ${v}`).join(", ")}>
      <defs>
        <linearGradient id={`${id}-fill`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--violet-hi)" stopOpacity="0.45" />
          <stop offset="100%" stopColor="var(--violet-hi)" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${id}-line`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="var(--cobalt)" />
          <stop offset="100%" stopColor="var(--violet-hi)" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((f) => (
        <line key={f} x1="0" x2={W} y1={top + f * (H - top - bottom)} y2={top + f * (H - top - bottom)} stroke="var(--chart-grid)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      ))}
      <path d={`${d} L${last[0]},${H - bottom} L${pts[0]![0]},${H - bottom} Z`} fill={`url(#${id}-fill)`} className="reveal-area" />
      <path d={d} fill="none" stroke={`url(#${id}-line)`} strokeWidth="3" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      {pts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i === pts.length - 1 ? 5 : 3} fill={i === pts.length - 1 ? "var(--violet-hi)" : "var(--surface)"} stroke="var(--violet-hi)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      ))}
      {labels.map((l, i) => (
        <text key={l + i} x={pts[i]![0]} y={H - 6} textAnchor="middle" className="fill-[var(--chart-label)] text-[11px] font-semibold">
          {l}
        </text>
      ))}
    </svg>
  );
}

/** Prototype "Live today" ring. */
export function Ring({ value, size = 128, label }: { value: number; size?: number; label: string }) {
  const r = size / 2 - 9;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0 -rotate-90" role="img" aria-label={label}>
      <defs>
        <linearGradient id="ring-grad" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--cyan)" />
          <stop offset="100%" stopColor="var(--cobalt)" />
        </linearGradient>
      </defs>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth="12" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="url(#ring-grad)" strokeWidth="12" strokeLinecap="round" strokeDasharray={`${Math.max(0.001, value) * c} ${c}`} />
    </svg>
  );
}

/** Prototype .bar: cobalt → cyan progress. */
export function Bar({ value, tone = "cyan" }: { value: number; tone?: "cyan" | "violet" | "amber" | "coral" | "mint" }) {
  const bg = {
    cyan: "linear-gradient(90deg,var(--cobalt),var(--cyan))",
    violet: "var(--violet)",
    amber: "var(--amber)",
    coral: "var(--coral)",
    mint: "var(--mint)",
  }[tone];
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
      <i className="block h-full rounded-full transition-[width] duration-1000" style={{ width: `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`, background: bg }} />
    </div>
  );
}

type Accent = "violet" | "cobalt" | "mint" | "cyan" | "amber" | "coral";
const ACC: Record<Accent, { tile: string; line: string; bar: "violet" | "cyan" | "amber" | "coral" | "mint" }> = {
  violet: { tile: "bg-nx-violet-soft text-nx-violet-text", line: "var(--violet)", bar: "violet" },
  cobalt: { tile: "bg-nx-cobalt-soft text-nx-cobalt-text", line: "var(--cobalt)", bar: "cyan" },
  mint: { tile: "bg-nx-mint-soft text-nx-mint", line: "var(--mint)", bar: "mint" },
  cyan: { tile: "bg-nx-cyan-soft text-nx-cyan", line: "var(--cyan)", bar: "cyan" },
  amber: { tile: "bg-nx-amber-soft text-nx-amber", line: "var(--amber)", bar: "amber" },
  coral: { tile: "bg-nx-coral-soft text-nx-coral", line: "var(--coral)", bar: "coral" },
};

/** Prototype .kpi card: accent hairline, 38 px tinted icon, 30 px value with optional "/ total", bar, foot. */
export function Kpi({ icon, label, value, of, progress, foot, accent, info, href }: { icon: ReactNode; label: string; value: ReactNode; of?: ReactNode; progress?: number; foot?: ReactNode; accent: Accent; info?: string; href?: string }) {
  const a = ACC[accent];
  const body = (
    <>
      <span className="absolute inset-x-[22px] -top-px h-[1.5px] rounded-sm opacity-85" style={{ background: a.line }} aria-hidden="true" />
      <div className="flex items-center gap-3">
        <span className={cn("inline-grid size-[38px] shrink-0 place-items-center rounded-xl [&_svg]:size-[18px]", a.tile)}>{icon}</span>
        <span className="min-w-0 flex-1 text-[13px] font-semibold text-ink-2">{label}</span>
        {info && <InfoTip text={info} />}
      </div>
      <div className="tabular text-[30px] font-extrabold leading-none tracking-[-0.03em] text-ink">
        {value}
        {of !== undefined && <small className="ms-1 text-[15px] font-bold tracking-normal text-muted">/ {of}</small>}
      </div>
      {progress !== undefined && <Bar value={progress} tone={a.bar} />}
      <div className="flex min-h-4 items-center gap-2 text-xs text-muted">{foot}</div>
    </>
  );
  const cls = "relative flex min-w-0 flex-col gap-3 overflow-hidden rounded-[22px] border border-line bg-surface p-5 shadow-card transition-[border-color,transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-overlay";
  return href ? (
    <Link href={href} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** Prototype .reason row: label, value, share and a coloured bar. */
export function ReasonRow({ label, value, share, color }: { label: string; value: ReactNode; share: number; color: string }) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-x-2.5 gap-y-1.5">
      <span className="truncate text-[13px] font-semibold text-ink">{label}</span>
      <span className="text-[13px] font-bold tabular text-ink">
        {value} <span className="font-semibold text-muted">· {Math.round(share * 100)} %</span>
      </span>
      <div className="col-span-2 h-2 overflow-hidden rounded-full bg-surface-2">
        <i className="block h-full rounded-full" style={{ width: `${Math.round(share * 100)}%`, background: color }} />
      </div>
    </div>
  );
}

/** Prototype .warn row: severity stripe, text, action. */
export function AttentionRow({ tone, title, detail, href, action = "Open" }: { tone: "coral" | "amber" | "violet" | "cobalt"; title: string; detail: string; href?: string; action?: string }) {
  return (
    <div className="grid grid-cols-[4px_1fr_auto] items-center gap-3 rounded-[14px] border border-line bg-surface-2 p-3">
      <span className="self-stretch rounded" style={{ background: `var(--${tone})` }} aria-hidden="true" />
      <div className="min-w-0">
        <div className="truncate text-[13.5px] font-bold text-ink">{title}</div>
        <div className="truncate text-xs text-muted">{detail}</div>
      </div>
      {href && (
        <Link href={href} className="inline-flex h-8 items-center gap-1 rounded-[10px] border border-line-strong bg-surface px-3 text-[12.5px] font-bold text-ink transition-colors hover:border-line-3">
          {action}
          <ChevronRight className="size-3.5 rtl:rotate-180" />
        </Link>
      )}
    </div>
  );
}
