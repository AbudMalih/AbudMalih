"use client";

import { useEffect, useState } from "react";
import { HOME_PLATFORMS as PLATFORMS } from "@/content/platforms";
import s from "./CommerceFlow.module.css";

/**
 * Product → digital commerce → store technology and marketplaces →
 * customers and European markets. Drawn once when it comes into view;
 * small order signals then run along the lines. Platforms are channels,
 * never partners.
 */
type Pt = [number, number];
const W = 1000;
const H = 420;
const PRODUCT: Pt = [90, 210];
const LAYER: Pt = [250, 210];
const STORE_X = 480;
const MARKET_X = 690;
const END_X = 905;
const ENDS: Pt[] = [
  [END_X, 120],
  [END_X, 300],
];
const curve = (a: Pt, b: Pt) => `M${a[0]} ${a[1]} C${a[0] + (b[0] - a[0]) * 0.5} ${a[1]} ${b[0] - (b[0] - a[0]) * 0.5} ${b[1]} ${b[0]} ${b[1]}`;

export default function CommerceFlow({
  copy,
}: {
  copy: { origin: string; platform: string; groups: { store: string; marketplace: string }; destinations: [string, string] };
}) {
  const stores = PLATFORMS.filter((p) => p.group === "store");
  const markets = PLATFORMS.filter((p) => p.group === "marketplace");
  const nodes = [
    ...stores.map((p, i) => ({ p, at: [STORE_X, stores.length === 1 ? 210 : 120 + i * 180] as Pt, end: ENDS[0] })),
    ...markets.map((p, i) => ({ p, at: [MARKET_X, 70 + i * 140] as Pt, end: ENDS[1] })),
  ];
  const [moving, setMoving] = useState(false);
  useEffect(() => {
    setMoving(!(document.documentElement.classList.contains("static") || window.matchMedia("(prefers-reduced-motion: reduce)").matches));
  }, []);
  const pct = (pt: Pt) => ({ left: `${(pt[0] / W) * 100}%`, top: `${(pt[1] / H) * 100}%` });

  return (
    <div className={s.flow} data-reveal>
      {/* desktop: the network */}
      <div className={s.diagram} aria-hidden="true">
        <svg viewBox={`0 0 ${W} ${H}`} className={s.svg}>
          <path d={`M${PRODUCT[0]} ${PRODUCT[1]} L${LAYER[0]} ${LAYER[1]}`} className={`${s.line} ${s.red}`} pathLength={1} />
          {nodes.map(({ p, at, end }) => (
            <g key={p.id}>
              <path d={curve(LAYER, at)} className={s.line} pathLength={1} />
              <path d={curve(at, end)} className={`${s.line} ${s.soft}`} pathLength={1} />
              {moving && (
                <circle r="3.5" className={s.packet}>
                  <animateMotion dur={`${5 + (p.id.length % 3)}s`} repeatCount="indefinite" path={`${curve(LAYER, at)} ${curve(at, end).replace("M", "L")}`} />
                </circle>
              )}
            </g>
          ))}
        </svg>
        <span className={s.product} style={pct(PRODUCT)}>
          <svg viewBox="0 0 48 48" aria-hidden="true">
            <path d="M8 16l16-8 16 8v18l-16 8-16-8z M8 16l16 8 16-8 M24 24v18" />
            <path d="M14 13l16 8" className={s.productRed} />
          </svg>
          <small>{copy.origin}</small>
        </span>
        <span className={s.layer} style={pct(LAYER)}>
          <i />
          <i />
          <i />
          <small>{copy.platform}</small>
        </span>
        <span className={s.colLabel} style={{ left: `${(STORE_X / W) * 100}%` }}>
          {copy.groups.store}
        </span>
        <span className={s.colLabel} style={{ left: `${(MARKET_X / W) * 100}%` }}>
          {copy.groups.marketplace}
        </span>
        {nodes.map(({ p, at }) => (
          <span key={p.id} className={s.node} style={pct(at)}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d={p.path} />
            </svg>
            {p.name}
          </span>
        ))}
        {ENDS.map((e, i) => (
          <span key={i} className={s.end} style={pct(e)}>
            <i />
            {copy.destinations[i]}
          </span>
        ))}
      </div>

      {/* phones: the same flow as columns */}
      <ol className={s.list}>
        <li>
          <small>{copy.origin}</small>
          <span className={s.chipRed}>{copy.platform}</span>
        </li>
        <li>
          <small>{copy.groups.store}</small>
          {stores.map((p) => (
            <span key={p.id} className={s.chip}>
              {p.name}
            </span>
          ))}
        </li>
        <li>
          <small>{copy.groups.marketplace}</small>
          {markets.map((p) => (
            <span key={p.id} className={s.chip}>
              {p.name}
            </span>
          ))}
        </li>
        <li>
          <small>→</small>
          {copy.destinations.map((x) => (
            <span key={x} className={s.chip}>
              {x}
            </span>
          ))}
        </li>
      </ol>
    </div>
  );
}
