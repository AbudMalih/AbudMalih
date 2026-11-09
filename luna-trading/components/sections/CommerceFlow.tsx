"use client";

import { useEffect, useState } from "react";
import {
  HOME_PLATFORMS as PLATFORMS,
  type Platform,
} from "@/content/platforms";
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
/* the phone layout, top to bottom */
const VW = 340;
const VH = 600;
const V_PRODUCT: Pt = [170, 34];
const V_LAYER: Pt = [170, 116];
const V_STORE_Y = 236;
const V_MARKET_Y = 372;
const V_ENDS: Pt[] = [
  [170, 498],
  [170, 566],
];
const vcurve = (a: Pt, b: Pt) =>
  `M${a[0]} ${a[1]} C${a[0]} ${a[1] + (b[1] - a[1]) * 0.5} ${b[0]} ${b[1] - (b[1] - a[1]) * 0.5} ${b[0]} ${b[1]}`;
const curve = (a: Pt, b: Pt) =>
  `M${a[0]} ${a[1]} C${a[0] + (b[0] - a[0]) * 0.5} ${a[1]} ${b[0] - (b[0] - a[0]) * 0.5} ${b[1]} ${b[0]} ${b[1]}`;

export default function CommerceFlow({
  copy,
}: {
  copy: {
    origin: string;
    platform: string;
    groups: { store: string; marketplace: string };
    destinations: [string, string];
  };
}) {
  const stores = PLATFORMS.filter((p) => p.group === "store");
  const markets = PLATFORMS.filter((p) => p.group === "marketplace");
  const nodes = [
    ...stores.map((p, i) => ({
      p,
      at: [STORE_X, stores.length === 1 ? 210 : 120 + i * 180] as Pt,
      end: ENDS[0],
    })),
    ...markets.map((p, i) => ({
      p,
      at: [MARKET_X, 70 + i * 140] as Pt,
      end: ENDS[1],
    })),
  ];
  const vNodes = [
    ...stores.map((p, i) => ({
      p,
      at: [stores.length === 1 ? 170 : 88 + i * 164, V_STORE_Y] as Pt,
      end: V_ENDS[0],
    })),
    ...markets.map((p, i) => ({
      p,
      at: [
        markets.length === 1
          ? 170
          : 56 + i * (228 / Math.max(1, markets.length - 1)),
        V_MARKET_Y,
      ] as Pt,
      end: V_ENDS[1],
    })),
  ];
  const vpct = (pt: Pt) => ({
    left: `${(pt[0] / VW) * 100}%`,
    top: `${(pt[1] / VH) * 100}%`,
  });
  const [moving, setMoving] = useState(false);
  useEffect(() => {
    setMoving(
      !(
        document.documentElement.classList.contains("static") ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ),
    );
  }, []);
  const pct = (pt: Pt) => ({
    left: `${(pt[0] / W) * 100}%`,
    top: `${(pt[1] / H) * 100}%`,
  });

  return (
    <div className={s.flow} data-reveal>
      {/* desktop: the network */}
      <div className={s.diagram} aria-hidden="true">
        <svg viewBox={`0 0 ${W} ${H}`} className={s.svg}>
          <path
            d={`M${PRODUCT[0]} ${PRODUCT[1]} L${LAYER[0]} ${LAYER[1]}`}
            className={`${s.line} ${s.red}`}
            pathLength={1}
          />
          {nodes.map(({ p, at, end }) => (
            <g key={p.id}>
              <path d={curve(LAYER, at)} className={s.line} pathLength={1} />
              <path
                d={curve(at, end)}
                className={`${s.line} ${s.soft}`}
                pathLength={1}
              />
              {moving && (
                <circle r="3.5" className={s.packet}>
                  <animateMotion
                    dur={`${5 + (p.id.length % 3)}s`}
                    repeatCount="indefinite"
                    path={`${curve(LAYER, at)} ${curve(at, end).replace("M", "L")}`}
                  />
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
        <span
          className={s.colLabel}
          style={{ left: `${(STORE_X / W) * 100}%` }}
        >
          {copy.groups.store}
        </span>
        <span
          className={s.colLabel}
          style={{ left: `${(MARKET_X / W) * 100}%` }}
        >
          {copy.groups.marketplace}
        </span>
        {nodes.map(({ p, at }) => (
          <span key={p.id} className={s.node} style={pct(at)}>
            <PlatformLabel p={p} />
          </span>
        ))}
        {ENDS.map((e, i) => (
          <span key={i} className={s.end} style={pct(e)}>
            <i />
            {copy.destinations[i]}
          </span>
        ))}
      </div>

      {/* phones: the same network, top to bottom */}
      <div className={s.diagramV} aria-hidden="true">
        <svg viewBox={`0 0 ${VW} ${VH}`} className={s.svg}>
          <path
            d={`M${V_PRODUCT[0]} ${V_PRODUCT[1] + 26} L${V_LAYER[0]} ${V_LAYER[1]}`}
            className={`${s.line} ${s.red}`}
            pathLength={1}
          />
          {vNodes.map(({ p, at, end }) => (
            <g key={p.id}>
              <path d={vcurve(V_LAYER, at)} className={s.line} pathLength={1} />
              <path
                d={vcurve(at, end)}
                className={`${s.line} ${s.soft}`}
                pathLength={1}
              />
              {moving && (
                <circle r="3.5" className={s.packet}>
                  <animateMotion
                    dur={`${5 + (p.id.length % 3)}s`}
                    repeatCount="indefinite"
                    path={`${vcurve(V_LAYER, at)} ${vcurve(at, end).replace("M", "L")}`}
                  />
                </circle>
              )}
            </g>
          ))}
        </svg>
        <span className={s.product} style={vpct(V_PRODUCT)}>
          <svg viewBox="0 0 48 48" aria-hidden="true">
            <path d="M8 16l16-8 16 8v18l-16 8-16-8z M8 16l16 8 16-8 M24 24v18" />
            <path d="M14 13l16 8" className={s.productRed} />
          </svg>
        </span>
        <span className={`${s.layer} ${s.layerV}`} style={vpct(V_LAYER)}>
          <i />
          <i />
          <i />
          <small>{copy.platform}</small>
        </span>
        <span
          className={s.rowLabel}
          style={{ top: `${((V_STORE_Y - 34) / VH) * 100}%` }}
        >
          {copy.groups.store}
        </span>
        <span
          className={s.rowLabel}
          style={{ top: `${((V_MARKET_Y - 34) / VH) * 100}%` }}
        >
          {copy.groups.marketplace}
        </span>
        {vNodes.map(({ p, at }) => (
          <span key={p.id} className={`${s.node} ${s.nodeV}`} style={vpct(at)}>
            <PlatformLabel p={p} />
          </span>
        ))}
        {V_ENDS.map((e, i) => (
          <span key={i} className={`${s.end} ${s.endV}`} style={vpct(e)}>
            <i />
            {copy.destinations[i]}
          </span>
        ))}
      </div>
      {/* screen readers: the flow as text */}
      <p className={s.srOnly}>
        {[
          copy.origin,
          copy.platform,
          ...stores.map((p) => p.name),
          ...markets.map((p) => p.name),
          ...copy.destinations,
        ].join(", ")}
      </p>
    </div>
  );
}

/** Marks whose logo is the name itself: shown in place of the text, cropped
 *  to the outline of the logo (viewBox) so all share one visible height.
 *  Symbol marks (Shopify, Amazon) sit beside the name. */
const WORDMARKS: Record<string, string> = {
  woocommerce: "0 9.58 24 4.84",
  ebay: "0 7.212 24 9.576",
  otto: "0 7.95 24 8.1",
};

function PlatformLabel({ p }: { p: Platform }) {
  if (!p.useMark) return <>{p.name}</>;
  const box = WORDMARKS[p.id];
  if (box)
    return (
      <svg
        viewBox={box}
        className={`${s.wordmark} ${s[`wm_${p.id}`] ?? ""}`}
        aria-hidden="true"
      >
        <path d={p.path} />
      </svg>
    );
  return (
    <>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d={p.path} />
      </svg>
      {p.name}
    </>
  );
}
