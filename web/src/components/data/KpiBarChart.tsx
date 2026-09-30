"use client";

import { useState } from "react";
import type { KpiSeries } from "@/content/types";

const pct = (v: number) => `${Math.round(v * 100)} %`;

/**
 * Single-series bar chart with a target line.
 * Demo series are always labelled as such – see /src/content/kpis.ts.
 */
export function KpiBarChart({ series }: { series: KpiSeries }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 560;
  const H = 280;
  const pad = { l: 44, r: 12, t: 16, b: 32 };
  const min = 0.7;
  const max = 1;
  const y = (v: number) => pad.t + (1 - (v - min) / (max - min)) * (H - pad.t - pad.b);
  const band = (W - pad.l - pad.r) / series.data.length;
  const bw = Math.min(28, band * 0.4);
  const isDemo = series.source === "demo";

  return (
    <figure className="relative">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <figcaption className="text-base font-semibold text-white">
          {series.title} <span className="font-normal text-steel-400">· Wochenansicht</span>
        </figcaption>
        {isDemo && (
          <span className="border border-white/25 px-2 py-1 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-steel-200">
            Beispieldarstellung – keine Echtdaten
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-steel-400">{series.description}</p>

      <div className="relative mt-6">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" aria-hidden="true">
          {[0.7, 0.8, 0.9, 1].map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="rgba(255,255,255,0.08)" />
              <text x={pad.l - 10} y={y(t) + 4} textAnchor="end" fontSize="11" className="max-sm:text-[18px]" fill="#9aa0a7" fontFamily="var(--font-geist-mono), monospace">
                {Math.round(t * 100)}
              </text>
            </g>
          ))}
          {series.data.map((d, i) => {
            const cx = pad.l + band * i + band / 2;
            const top = y(d.value);
            const bottom = y(min);
            return (
              <g key={d.label}>
                <path
                  d={`M${cx - bw / 2} ${bottom} V${top + 4} Q${cx - bw / 2} ${top} ${cx - bw / 2 + 4} ${top} H${cx + bw / 2 - 4} Q${cx + bw / 2} ${top} ${cx + bw / 2} ${top + 4} V${bottom} Z`}
                  fill={hover === i ? "#ffffff" : "#bfc3c8"}
                />
                <text x={cx} y={H - 10} textAnchor="middle" fontSize="11" className="max-sm:text-[18px]" fill="#9aa0a7" fontFamily="var(--font-geist-mono), monospace">
                  {d.label}
                </text>
                {/* Hit target larger than the mark */}
                <rect
                  x={cx - band / 2}
                  y={pad.t}
                  width={band}
                  height={H - pad.t - pad.b}
                  fill="transparent"
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                />
              </g>
            );
          })}
          {series.target !== undefined && (
            <g>
              <line x1={pad.l} x2={W - pad.r} y1={y(series.target)} y2={y(series.target)} stroke="#f0080f" strokeWidth="2" strokeDasharray="6 4" />
              <text x={pad.l + 6} y={y(series.target) - 8} textAnchor="start" fontSize="11" className="max-sm:text-[18px]" fill="#f5f4f0" fontFamily="var(--font-geist-mono), monospace">
                ZIELWERT
              </text>
            </g>
          )}
        </svg>
        {hover !== null && (
          <div
            className="pointer-events-none absolute top-0 -translate-x-1/2 border border-white/15 bg-graphite-800 px-3 py-2 text-xs text-white"
            style={{ left: `${((pad.l + band * hover + band / 2) / W) * 100}%` }}
          >
            <span className="text-steel-400">{series.data[hover]!.label}</span> · {pct(series.data[hover]!.value)}
            {isDemo && <span className="block text-steel-400">Beispielwert</span>}
          </div>
        )}
      </div>

      <div className="sr-only">
      <table>
        <caption>
          {series.title}
          {isDemo ? " (Beispieldaten, keine Echtdaten)" : ""}
        </caption>
        <thead>
          <tr>
            <th scope="col">Tag</th>
            <th scope="col">Wert</th>
          </tr>
        </thead>
        <tbody>
          {series.data.map((d) => (
            <tr key={d.label}>
              <th scope="row">{d.label}</th>
              <td>{pct(d.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </figure>
  );
}
