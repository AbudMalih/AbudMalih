"use client";

import { useState } from "react";
import { labelFor } from "@/content/locations";
import type { Location } from "@/content/types";
import { GERMANY_PATH, GERMANY_VIEWBOX, project } from "@/lib/geo/germany";

/**
 * Operational map of Germany. Locations and their classification come from
 * /src/content/locations.ts. Unconfirmed types are shown as "Standort".
 * Connecting lines illustrate the network – they are not actual routes.
 */
/** Schematic network connections (illustrative, not driving routes). */
const NETWORK: [string, string][] = [
  ["bremen", "hannover"],
  ["hannover", "magdeburg"],
  ["hannover", "kassel"],
  ["kassel", "haiger"],
  ["kassel", "erfurt"],
  ["erfurt", "suhl"],
  ["erfurt", "zwickau"],
];

/** Label placement to avoid collisions. Default: right of the pin. */
const LABEL: Record<string, "left" | "below"> = { haiger: "left", suhl: "below" };

export function OperationsMap({ locations }: { locations: Location[] }) {
  const [active, setActive] = useState<string | null>(null);
  const pts = locations.map((l) => ({ ...l, ...project(l.lat, l.lng) }));
  const byId = new Map(pts.map((p) => [p.id, p]));
  const edges = NETWORK.map(([a, b]) => [byId.get(a), byId.get(b)] as const).filter(
    (e): e is readonly [(typeof pts)[number], (typeof pts)[number]] => Boolean(e[0] && e[1]),
  );
  const activeLoc = pts.find((p) => p.id === active) ?? null;

  return (
    <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
      <div className="relative lg:col-span-7">
        <svg viewBox={GERMANY_VIEWBOX} className="mx-auto w-full max-w-[560px]" role="img" aria-label="Deutschlandkarte mit JARBOU-Standorten">
          <path d={GERMANY_PATH} fill="#121417" stroke="#3a3f45" strokeWidth="1.5" strokeLinejoin="round" />
          {edges.map(([a, b], i) => (
            <line
              key={`${a.id}-${b.id}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke="#f0080f"
              strokeWidth="1.5"
              strokeDasharray="1"
              pathLength={1}
              className="map-route group-data-[inview=true]/iv:[animation:draw_1.2s_var(--ease-in-out-quart)_forwards]"
              style={{ animationDelay: `${0.5 + i * 0.22}s` }}
              opacity="0.75"
            />
          ))}
          {pts.map((p, i) => {
            const on = active === p.id;
            return (
              <g key={p.id} transform={`translate(${p.x} ${p.y})`}>
                <circle r={on ? 22 : 0} fill="#f0080f" opacity="0.18" className="transition-all duration-500" />
                <g className="map-pin group-data-[inview=true]/iv:[animation:fade-up_0.6s_var(--ease-out-expo)_both]" style={{ animationDelay: `${0.4 + i * 0.18}s` }}>
                  <rect x={-6} y={-6} width={12} height={12} fill={on ? "#f0080f" : "#f5f4f0"} transform="rotate(45)" />
                  <text
                    x={LABEL[p.id] === "left" ? -12 : LABEL[p.id] === "below" ? 0 : 12}
                    y={LABEL[p.id] === "below" ? 24 : 5}
                    textAnchor={LABEL[p.id] === "left" ? "end" : LABEL[p.id] === "below" ? "middle" : "start"}
                    fontSize="15"
                    fontWeight="600"
                    className="max-sm:text-[26px]"
                    fill={on ? "#ffffff" : "#bfc3c8"}
                    fontFamily="var(--font-inter-tight), sans-serif"
                  >
                    {p.name}
                  </text>
                </g>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="lg:col-span-5">
        <ul className="border-t border-white/10">
          {pts.map((p) => (
            <li key={p.id} className="border-b border-white/10">
              <button
                type="button"
                onMouseEnter={() => setActive(p.id)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(p.id)}
                onBlur={() => setActive(null)}
                aria-pressed={active === p.id}
                className="group flex w-full items-center justify-between gap-4 py-4 text-left"
              >
                <span className="flex items-center gap-4">
                  <span aria-hidden="true" className={`size-2 rotate-45 transition-colors ${active === p.id ? "bg-red" : "bg-steel-400"}`} />
                  <span className="text-lg font-semibold text-white">{p.name}</span>
                  <span className="text-sm text-steel-500">{p.state}</span>
                </span>
                <span className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-steel-400">
                  {labelFor(p)}
                  {p.projectNote ? ` · ${p.projectNote}` : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-steel-500" aria-live="polite">
          {activeLoc ? `${activeLoc.name}, ${activeLoc.state}` : "Linien stellen das Netzwerk schematisch dar, keine Fahrtrouten."}
        </p>
      </div>
    </div>
  );
}
