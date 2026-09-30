"use client";

import Link from "next/link";
import { useState } from "react";
import { labelFor, locationTypePlural } from "@/content/locations";
import type { Location, LocationType } from "@/content/types";
import { GERMANY_PATH, GERMANY_VIEWBOX, project } from "@/lib/geo/germany";

/** Schematic network connections (illustrative, not driving routes). */
const NETWORK: [string, string][] = [
  ["bremen", "hannover"],
  ["hannover", "magdeburg"],
  ["hannover", "kassel"],
  ["kassel", "haiger"],
  ["haiger", "koeln"],
  ["kassel", "erfurt"],
  ["erfurt", "suhl"],
  ["erfurt", "zwickau"],
];

/** Label placement to avoid collisions. Default: right of the pin. */
const LABEL: Record<string, "left" | "below"> = { koeln: "left", suhl: "below" };

type JobLink = { slug: string; title: string };

type Props = {
  locations: Location[];
  /** Explorer mode for /standorte: click-to-select, type filter, detail panel. */
  explorer?: boolean;
  jobsByLocation?: Record<string, JobLink[]>;
};

/**
 * Operational map of Germany. Locations and their classification come from
 * /src/content/locations.ts. Unconfirmed types show the city name only.
 */
export function OperationsMap({ locations, explorer = false, jobsByLocation = {} }: Props) {
  const [hover, setHover] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState<LocationType | "all">("all");

  const pts = locations.map((l) => ({ ...l, ...project(l.lat, l.lng) }));
  const byId = new Map(pts.map((p) => [p.id, p]));
  const edges = NETWORK.map(([a, b]) => [byId.get(a), byId.get(b)] as const).filter(
    (e): e is readonly [(typeof pts)[number], (typeof pts)[number]] => Boolean(e[0] && e[1]),
  );
  // Only types that actually occur are offered as filters.
  const types = Array.from(new Set(locations.map((l) => l.type).filter((t): t is LocationType => Boolean(t))));
  const matches = (l: Location) => filter === "all" || l.type === filter;
  const active = hover ?? selected;
  const current = pts.find((p) => p.id === (explorer ? selected : hover)) ?? null;

  const toggle = (id: string) => setSelected((s) => (s === id ? null : id));

  return (
    <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
      <div className="relative min-w-0 lg:col-span-7">
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
              className="map-route transition-opacity duration-300 group-data-[inview=true]/iv:[animation:draw_1.2s_var(--ease-in-out-quart)_forwards]"
              style={{ animationDelay: `${0.5 + i * 0.22}s` }}
              opacity={filter === "all" ? 0.75 : 0.2}
            />
          ))}
          {pts.map((p, i) => {
            const on = active === p.id;
            const dim = !matches(p);
            return (
              <g
                key={p.id}
                transform={`translate(${p.x} ${p.y})`}
                className={explorer ? "cursor-pointer" : undefined}
                onClick={explorer ? () => toggle(p.id) : undefined}
                onMouseEnter={() => setHover(p.id)}
                onMouseLeave={() => setHover(null)}
                opacity={dim ? 0.25 : 1}
              >
                <circle r={on ? 22 : 0} fill="#f0080f" opacity="0.18" className="transition-all duration-500" />
                <g className="map-pin group-data-[inview=true]/iv:[animation:fade-up_0.6s_var(--ease-out-expo)_both]" style={{ animationDelay: `${0.4 + i * 0.16}s` }}>
                  <rect x={-6} y={-6} width={12} height={12} fill={on || (p.type && !dim && filter !== "all") ? "#f0080f" : "#f5f4f0"} transform="rotate(45)" />
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
                {explorer && <circle r={18} fill="transparent" />}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="min-w-0 lg:col-span-5">
        {explorer && types.length > 0 && (
          <div role="group" aria-label="Nach Standorttyp filtern" className="mb-6 flex flex-wrap gap-2">
            {(["all", ...types] as const).map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={filter === t}
                onClick={() => setFilter(t)}
                className={`min-h-11 border px-4 text-sm font-medium transition-colors ${
                  filter === t ? "border-white bg-white text-ink" : "border-white/25 text-steel-200 hover:border-white"
                }`}
              >
                {t === "all" ? "Alle Standorte" : locationTypePlural[t]}
              </button>
            ))}
          </div>
        )}
        <ul className="border-t border-white/10">
          {pts.map((p) => {
            const label = labelFor(p);
            const on = active === p.id;
            return (
              <li key={p.id} className={`border-b border-white/10 transition-opacity ${matches(p) ? "" : "opacity-35"}`}>
                <button
                  type="button"
                  onMouseEnter={() => setHover(p.id)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(p.id)}
                  onBlur={() => setHover(null)}
                  onClick={explorer ? () => toggle(p.id) : undefined}
                  aria-pressed={explorer ? selected === p.id : on}
                  className="group flex min-h-14 w-full items-center justify-between gap-4 py-3 text-left"
                >
                  <span className="flex min-w-0 items-center gap-4">
                    <span aria-hidden="true" className={`size-2 shrink-0 rotate-45 transition-colors ${on ? "bg-red" : "bg-steel-400"}`} />
                    <span className="text-lg font-semibold text-white">{p.name}</span>
                    <span className="text-sm text-steel-500">{p.state}</span>
                  </span>
                  {label && <span className="text-right font-mono text-[0.68rem] uppercase tracking-[0.14em] text-steel-400">{label}</span>}
                </button>
              </li>
            );
          })}
        </ul>

        {explorer ? (
          <div className="mt-6 min-h-40 border border-white/10 bg-graphite-900 p-6" aria-live="polite">
            {current ? (
              <>
                <p className="eyebrow text-steel-400">{current.state}</p>
                <p className="mt-2 text-3xl font-extrabold uppercase tracking-[-0.02em] text-white">{current.name}</p>
                {labelFor(current) && <p className="mt-2 font-mono text-xs uppercase tracking-[0.14em] text-red-glow">{labelFor(current)}</p>}
                {(jobsByLocation[current.id]?.length ?? 0) > 0 ? (
                  <ul className="mt-5 space-y-2">
                    {jobsByLocation[current.id]!.map((j) => (
                      <li key={j.slug}>
                        <Link href={`/karriere/jobs/${j.slug}`} className="text-white underline underline-offset-4 hover:text-red">
                          {j.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-5 text-sm text-steel-400">
                    Aktuell keine ausgeschriebene Stelle.{" "}
                    <Link href="/karriere/initiativbewerbung" className="text-white underline underline-offset-4">
                      Initiativ bewerben
                    </Link>
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-steel-400">Wählen Sie einen Standort auf der Karte oder in der Liste.</p>
            )}
          </div>
        ) : null}
        <p className="mt-4 text-xs text-steel-500">Linien stellen das Netzwerk schematisch dar, keine Fahrtrouten.</p>
      </div>
    </div>
  );
}
