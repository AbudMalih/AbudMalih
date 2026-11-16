"use client";

import { cn } from "@turvio/web-ui/ds";
import { useState } from "react";
import { delivered, notDelivered, pct, type TrendBucket } from "../lib/analytics";

/*
 * Analytics charts (SVG, no chart library). Series colours are --viz-1 / --viz-2 (validated for
 * both themes); text always uses ink tokens. One y-axis per chart; hover shows the exact values.
 */

const bucketLabel = (b: string, g: "day" | "week" | "month") => {
  const d = new Date(`${b}T00:00:00Z`);
  if (g === "month") return d.toLocaleDateString("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" });
  if (g === "week") return `wk ${d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", timeZone: "UTC" })}`;
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", timeZone: "UTC" });
};

/** Nice upper bound and 3–4 ticks for a count axis. */
function niceMax(v: number) {
  if (v <= 4) return { max: 4, step: 1 };
  const pow = 10 ** Math.floor(Math.log10(v));
  const steps = [1, 2, 2.5, 5, 10].map((s) => s * pow);
  const step = steps.find((s) => v / s <= 4) ?? 10 * pow;
  return { max: Math.ceil(v / step) * step, step };
}

function Legend({ items }: { items: { color: string; label: string }[] }) {
  return (
    <div className="flex flex-wrap gap-3 text-2xs font-semibold text-ink-2">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-[3px]" style={{ background: i.color }} aria-hidden="true" />
          {i.label}
        </span>
      ))}
    </div>
  );
}

/** Processed stops per period: delivered / picked up and not delivered, stacked. */
export function OutcomeBars({ trend, granularity }: { trend: TrendBucket[]; granularity: "day" | "week" | "month" }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 720;
  const H = 220;
  const pad = { l: 40, r: 8, t: 10, b: 26 };
  const max = niceMax(Math.max(1, ...trend.map((t) => delivered(t) + notDelivered(t))));
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const slot = iw / Math.max(1, trend.length);
  const bw = Math.max(4, Math.min(36, slot * 0.6));
  const y = (v: number) => pad.t + ih - (v / max.max) * ih;
  const labelEvery = Math.ceil(trend.length / 12);
  const h = hover !== null ? trend[hover] : null;
  return (
    <div className="flex flex-col gap-2">
      <Legend items={[{ color: "var(--viz-1)", label: "Delivered / picked up" }, { color: "var(--viz-2)", label: "Not delivered" }]} />
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="Processed stops per period" onMouseLeave={() => setHover(null)}>
          {Array.from({ length: max.max / max.step + 1 }, (_, i) => i * max.step).map((v) => (
            <g key={v}>
              <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="var(--viz-grid)" strokeWidth={1} />
              <text x={pad.l - 6} y={y(v) + 3.5} textAnchor="end" className="fill-[var(--text-3)] text-[10px] tabular">
                {v.toLocaleString("de-DE")}
              </text>
            </g>
          ))}
          {trend.map((t, i) => {
            const cx = pad.l + slot * i + slot / 2;
            const ok = delivered(t);
            const bad = notDelivered(t);
            const gap = ok > 0 && bad > 0 ? 2 : 0;
            const okTop = y(ok);
            const badTop = y(ok + bad) - gap;
            return (
              <g key={t.bucket} onMouseEnter={() => setHover(i)}>
                <rect x={pad.l + slot * i} y={pad.t} width={slot} height={ih} fill="transparent" />
                {ok > 0 && <path d={roundedTop(cx - bw / 2, okTop, bw, y(0) - okTop, bad > 0 ? 0 : 4)} fill="var(--viz-1)" opacity={hover === null || hover === i ? 1 : 0.55} />}
                {bad > 0 && <path d={roundedTop(cx - bw / 2, badTop, bw, okTop - gap - badTop, 4)} fill="var(--viz-2)" opacity={hover === null || hover === i ? 1 : 0.55} />}
                {i % labelEvery === 0 && (
                  <text x={cx} y={H - 8} textAnchor="middle" className="fill-[var(--text-3)] text-[10px]">
                    {bucketLabel(t.bucket, granularity)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        {h && hover !== null && (
          <div
            className="pointer-events-none absolute top-1 z-10 min-w-[170px] rounded-xl border border-line-strong bg-raised px-3 py-2 text-2xs shadow-overlay"
            style={{ left: `${Math.min(78, ((pad.l + slot * hover + slot / 2) / W) * 100)}%` }}
            role="status"
          >
            <div className="mb-1 font-bold text-ink">{bucketLabel(h.bucket, granularity)}</div>
            <div className="flex justify-between gap-4 text-ink-2">
              <span>Delivered / picked up</span>
              <span className="font-bold text-ink tabular">{delivered(h)}</span>
            </div>
            <div className="flex justify-between gap-4 text-ink-2">
              <span>Not delivered</span>
              <span className="font-bold text-ink tabular">{notDelivered(h)}</span>
            </div>
            <div className="flex justify-between gap-4 text-ink-2">
              <span>Success rate</span>
              <span className="font-bold text-ink tabular">{pct(h.successRate)}</span>
            </div>
            <div className="flex justify-between gap-4 text-muted">
              <span>Open / cancelled</span>
              <span className="tabular">
                {h.open} / {h.cancelled}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function roundedTop(x: number, y: number, w: number, h: number, r: number) {
  if (h <= 0) return "";
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h} L${x},${y + rr} Q${x},${y} ${x + rr},${y} L${x + w - rr},${y} Q${x + w},${y} ${x + w},${y + rr} L${x + w},${y + h} Z`;
}

/** Success rate per period (0–100 %), one series. Periods without processed stops are gaps. */
export function SuccessLine({ trend, granularity }: { trend: TrendBucket[]; granularity: "day" | "week" | "month" }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 720;
  const H = 150;
  const pad = { l: 40, r: 10, t: 10, b: 24 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const x = (i: number) => pad.l + (trend.length <= 1 ? iw / 2 : (i / (trend.length - 1)) * iw);
  const y = (v: number) => pad.t + ih - v * ih;
  const segments: string[] = [];
  let cur = "";
  trend.forEach((t, i) => {
    if (t.successRate === null) {
      if (cur) segments.push(cur);
      cur = "";
      return;
    }
    cur += `${cur ? "L" : "M"}${x(i)},${y(t.successRate)} `;
  });
  if (cur) segments.push(cur);
  const h = hover !== null ? trend[hover] : null;
  const labelEvery = Math.ceil(trend.length / 12);
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="Success rate per period" onMouseLeave={() => setHover(null)}>
        {[0, 0.5, 1].map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="var(--viz-grid)" strokeWidth={1} />
            <text x={pad.l - 6} y={y(v) + 3.5} textAnchor="end" className="fill-[var(--text-3)] text-[10px]">
              {v * 100} %
            </text>
          </g>
        ))}
        {segments.map((d, i) => (
          <path key={i} d={d} fill="none" stroke="var(--viz-1)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        ))}
        {trend.map((t, i) => (
          <g key={t.bucket} onMouseEnter={() => setHover(i)}>
            <rect x={x(i) - iw / Math.max(2, trend.length) / 2} y={pad.t} width={iw / Math.max(2, trend.length)} height={ih} fill="transparent" />
            {t.successRate !== null && (hover === i || trend.length <= 14) && <circle cx={x(i)} cy={y(t.successRate)} r={4} fill="var(--viz-1)" stroke="var(--surface)" strokeWidth={2} />}
            {i % labelEvery === 0 && (
              <text x={x(i)} y={H - 6} textAnchor="middle" className="fill-[var(--text-3)] text-[10px]">
                {bucketLabel(t.bucket, granularity)}
              </text>
            )}
          </g>
        ))}
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + ih} stroke="var(--line-2)" strokeDasharray="3 3" />}
      </svg>
      {h && hover !== null && (
        <div className="pointer-events-none absolute top-1 z-10 rounded-xl border border-line-strong bg-raised px-3 py-2 text-2xs shadow-overlay" style={{ left: `${Math.min(80, (x(hover) / W) * 100)}%` }} role="status">
          <span className="font-bold text-ink">{bucketLabel(h.bucket, granularity)}</span> · <span className="text-ink-2">{h.successRate === null ? "no processed stops" : pct(h.successRate)}</span>
        </div>
      )}
    </div>
  );
}

/** Not-delivered outcomes by reason, one series, labelled bars. */
export function ReasonBars({ rows, label }: { rows: { reason: string | null; status: string; count: number }[]; label: (code: string | null) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  const total = rows.reduce((n, r) => n + r.count, 0);
  if (!rows.length) return <p className="py-6 text-center text-[13px] text-muted">No undelivered stops in this period.</p>;
  return (
    <ul className="flex flex-col gap-2.5" aria-label="Reasons for not delivered stops">
      {rows.slice(0, 8).map((r) => (
        <li key={`${r.reason}-${r.status}`} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1">
          <span className="truncate text-[13px] font-semibold text-ink">
            {label(r.reason)} <span className="font-normal text-muted">· {r.status}</span>
          </span>
          <span className="text-[13px] font-bold text-ink tabular">
            {r.count} <span className="font-semibold text-muted">· {Math.round((r.count / total) * 100)} %</span>
          </span>
          <div className="col-span-2 h-2 overflow-hidden rounded-full bg-surface-2">
            <i className={cn("block h-full rounded-full")} style={{ width: `${(r.count / max) * 100}%`, background: "var(--viz-1)" }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
