"use client";

import { useRef } from "react";
import Chapter, { useChapterTimeline } from "@/components/stage/Chapter";
import ChapterTag from "@/components/ui/ChapterTag";
import { useI18n } from "@/content/i18n/I18nProvider";
import { PLATFORMS, type Platform } from "@/content/platforms";
import s from "./Commerce.module.css";

/**
 * 06 · E-COMMERCE: PHYSICAL TRADE BECOMES DIGITAL COMMERCE (light chapter)
 *  PRODUCT → DIGITAL COMMERCE → PLATFORMS → MARKETPLACES → CUSTOMERS / MARKETS
 *  1. light spreads from the product; the red route from the chain arrives at it
 *  2. product → digital-commerce layers
 *  3. layers → store technology (Shopify, WooCommerce) and marketplaces
 *     (Amazon, eBay, OTTO) → customers (D2C) and European markets; order
 *     signals travel both hops with the scroll
 *  4. the network simplifies channel by channel; the red connection reaches
 *     one owned-brand node, LUVISCENT, which opens into air: the line
 *     becomes champagne light and the emerald world blooms from the node
 *     (components/chrome/Atmosphere.tsx)
 * Platforms are technologies and channels, never presented as partners.
 * Every value is a function of chapter progress (direction-independent).
 */

// geometry (percent of the diagram box)
const CARTON_X = 8;
const LAYERS = { x0: 21, x1: 24, y0: 14, y1: 86 };
const COL = { store: 44, marketplace: 61 } as const;
const ROW = { store: [32, 68], marketplace: [14, 50, 86] } as const;
const END_X = 84;
const END_Y = [32, 68];
const NODE = { x: 50, y: 50 };
const WAVES = 3;

type Pt = [number, number];
const cubic = (p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): Pt => {
  const m = 1 - t;
  const a = m * m * m, b = 3 * m * m * t, c = 3 * m * t * t, d = t * t * t;
  return [a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]];
};
const pathOf = (a: Pt, b: Pt) => `M ${a[0]} ${a[1]} C ${a[0] + (b[0] - a[0]) * 0.45} ${a[1]}, ${b[0] - (b[0] - a[0]) * 0.45} ${b[1]}, ${b[0]} ${b[1]}`;
const pointOf = (a: Pt, b: Pt, t: number) =>
  cubic(a, [a[0] + (b[0] - a[0]) * 0.45, a[1]], [b[0] - (b[0] - a[0]) * 0.45, b[1]], b, t);

type Node = Platform & { at: Pt; end: Pt };
const NODES: Node[] = (() => {
  const counters = { store: 0, marketplace: 0 };
  return PLATFORMS.map((p) => {
    const i = counters[p.group]++;
    const at: Pt = [COL[p.group], ROW[p.group][i]];
    // store technology serves direct customers; marketplaces open markets
    const end: Pt = [END_X, p.group === "store" ? END_Y[0] : END_Y[1]];
    return { ...p, at, end };
  });
})();
const LAYER_EXIT: Pt = [LAYERS.x1, 50];

export default function Commerce() {
  return (
    <Chapter id="commerce" stageClassName={s.stage}>
      <Content />
    </Chapter>
  );
}

function Mark({ p }: { p: Platform }) {
  if (!p.useMark) return <span className={s.markText}>{p.name}</span>;
  return (
    <svg viewBox="0 0 24 24" className={`${s.markSvg} ${s[`m_${p.id}`] ?? ""}`} role="img" aria-label={p.name}>
      <path d={p.path} />
    </svg>
  );
}

function Content() {
  const { dict, locale } = useI18n();
  const t = dict.commerce;
  const scope = useRef<HTMLDivElement>(null);

  useChapterTimeline(
    scope,
    (tl, q) => {
      const packets = q("[data-packet]") as HTMLElement[];
      const perWave = 1 + NODES.length;
      const placePackets = (u: number) => {
        packets.forEach((el, n) => {
          const w = Math.floor(n / perWave);
          const i = n % perWave; // 0 = trunk, 1.. = one per platform node (two hops)
          let x: number, y: number, k: number;
          if (i === 0) {
            k = (u - w * 0.2) / 0.1;
            const kk = Math.min(1, Math.max(0, k));
            x = CARTON_X + 3 + (LAYERS.x0 - CARTON_X - 3) * kk;
            y = 50;
          } else {
            const node = NODES[i - 1];
            k = (u - w * 0.2 - 0.08 - i * 0.02) / 0.34; // 0..1 first hop, 1..2 second hop
            const kk = Math.min(2, Math.max(0, k * 2));
            [x, y] = kk <= 1 ? pointOf(LAYER_EXIT, node.at, kk) : pointOf(node.at, node.end, kk - 1);
          }
          el.style.opacity = k > 0 && k < 1 ? "1" : "0";
          el.style.insetInlineStart = `${x}%`;
          el.style.top = `${y}%`;
        });
      };

      tl // 1 · the route arrives at the product
        .fromTo(q("[data-route]"), { scaleX: 1 }, { scaleX: (CARTON_X + 1) / 100, duration: 0.1, ease: "power2.inOut" }, 0.02)
        .fromTo(q("[data-carton]"), { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.06, ease: "power3.out" }, 0.06)
        .fromTo(q("[data-tag]"), { opacity: 0 }, { opacity: 1, duration: 0.04 }, 0.06)
        .fromTo(q("[data-tag-rule]"), { scaleX: 0 }, { scaleX: 1, duration: 0.06 }, 0.06)
        .fromTo(q("[data-h] > span > span"), { yPercent: 135 }, { yPercent: 0, duration: 0.07, stagger: 0.025, ease: "power3.out" }, 0.08)
        .fromTo(q("[data-origin-label]"), { opacity: 0 }, { opacity: 1, duration: 0.04 }, 0.12)
        // 2 · product → digital commerce
        .fromTo(q("[data-trunk]"), { scaleX: 0 }, { scaleX: 1, duration: 0.06, ease: "power2.inOut" }, 0.14)
        .fromTo(q("[data-layer]"), { scaleY: 0 }, { scaleY: 1, duration: 0.05, stagger: 0.01, ease: "power2.out" }, 0.18)
        // 3 · platforms & channels → customers / markets
        .fromTo(q("[data-channels]"), { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.04 }, 0.22)
        .fromTo(q("[data-hop1]"), { opacity: 0 }, { opacity: 1, duration: 0.04, stagger: 0.01 }, 0.22)
        .fromTo(q("[data-platform]"), { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.04, stagger: 0.012 }, 0.25)
        .fromTo(q("[data-group]"), { opacity: 0 }, { opacity: 1, duration: 0.04, stagger: 0.02 }, 0.27)
        .fromTo(q("[data-hop2]"), { opacity: 0 }, { opacity: 1, duration: 0.04, stagger: 0.01 }, 0.32)
        .fromTo(q("[data-dest]"), { opacity: 0 }, { opacity: 1, duration: 0.04, stagger: 0.015 }, 0.35)
        .fromTo(
          { u: 0 },
          { u: 0 },
          {
            u: 1,
            duration: 0.36,
            ease: "none",
            onUpdate(this: gsap.core.Tween) {
              placePackets((this.targets()[0] as { u: number }).u);
            },
          },
          0.3
        )
        .fromTo(q("[data-secondary]"), { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.05 }, 0.44)
        .fromTo(q("[data-body]"), { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.05 }, 0.48)
        // 4 · the network simplifies, channel by channel, until one owned-brand node remains
        .to(q("[data-channels], [data-group]"), { opacity: 0, duration: 0.04 }, 0.6)
        .to(q("[data-dest]"), { opacity: 0, duration: 0.04, stagger: 0.02 }, 0.61)
        .to(q("[data-h] > span > span"), { yPercent: -135, duration: 0.05, ease: "power2.in", stagger: 0.015 }, 0.66)
        .to(q("[data-secondary], [data-body], [data-tag]"), { opacity: 0, duration: 0.05 }, 0.66)
        .to(q("[data-origin-label]"), { opacity: 0, duration: 0.04 }, 0.7)
        .to(q("[data-layer]"), { scaleY: 0, duration: 0.05, stagger: 0.01 }, 0.72)
        // 5 · the red connection reaches LUVISCENT (drawn by the atmosphere's air line)
        .fromTo(q("[data-node]"), { opacity: 0, scale: 0.3 }, { opacity: 1, scale: 1, duration: 0.05, ease: "back.out(2)" }, 0.75)
        .fromTo(q("[data-node-label]"), { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.04 }, 0.78)
        .to(q("[data-trunk], [data-route]"), { opacity: 0, duration: 0.04 }, 0.79)
        // 6 · digital commerce becomes atmosphere: the node opens into air
        .to(q("[data-node] i"), { backgroundColor: "#d4c19b", duration: 0.06 }, 0.8)
        .to(q("[data-carton]"), { opacity: 0, duration: 0.06 }, 0.82)
        .to(q("[data-node-label]"), { opacity: 0, duration: 0.05 }, 0.87)
        .to(q("[data-node]"), { scale: 2.4, opacity: 0, duration: 0.08, ease: "power1.in" }, 0.86);
      // channels leave one by one: each mark with its own two routes
      NODES.forEach((_, i) => {
        const at = 0.62 + (NODES.length - 1 - i) * 0.022;
        tl.to(q("[data-platform]")[i], { opacity: 0, y: -4, duration: 0.035 }, at)
          .to(q("[data-hop2]")[i], { opacity: 0, duration: 0.035 }, at - 0.008)
          .to(q("[data-hop1]")[i], { opacity: 0, duration: 0.035 }, at + 0.01);
      });
      placePackets(0);
    },
    [locale]
  );

  const packets = Array.from({ length: WAVES * (1 + NODES.length) });

  return (
    <div ref={scope} className={s.wrap}>
      <ChapterTag index="06" label={t.tag} className={s.tag} />
      <h2 className={`t-display ${s.head}`} data-h>
        <span className="mask">
          <span>{t.h1}</span>
        </span>
        <span className={`mask ${s.dim}`}>
          <span>{t.h2}</span>
        </span>
      </h2>

      {/* the arriving route (continuation of the chain line) */}
      <span className={s.route} data-route data-cine-only aria-hidden="true" />

      <div className={s.diagram} data-cine-only>
        <svg className={s.svg} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {NODES.map((n) => (
            <path key={`h1-${n.id}`} d={pathOf(LAYER_EXIT, n.at)} className={s.branch} data-hop1 />
          ))}
          {NODES.map((n) => (
            <path key={`h2-${n.id}`} d={pathOf(n.at, n.end)} className={`${s.branch} ${s.hop2}`} data-hop2 />
          ))}
        </svg>

        {/* the product */}
        <div className={s.carton} data-carton style={{ insetInlineStart: `${CARTON_X}%` }} aria-hidden="true">
          <svg viewBox="0 0 64 56" className={s.cartonSvg}>
            <path d="M32 4 L60 16 L32 28 L4 16 Z" />
            <path d="M4 16 L4 42 L32 54 L32 28" />
            <path d="M60 16 L60 42 L32 54" />
            <path d="M18 10 L46 22" className={s.tape} />
          </svg>
        </div>
        <span className={`t-label ${s.originLabel}`} data-origin-label style={{ insetInlineStart: `${CARTON_X}%` }}>
          {t.origin}
        </span>

        <span className={s.trunk} data-trunk aria-hidden="true" style={{ insetInlineStart: `${CARTON_X + 3}%`, width: `${LAYERS.x0 - CARTON_X - 3}%` }} />
        {[0, 1, 2, 3].map((k) => (
          <span
            key={k}
            className={s.layer}
            data-layer
            aria-hidden="true"
            style={{ insetInlineStart: `${LAYERS.x0 + (k * (LAYERS.x1 - LAYERS.x0)) / 3}%`, top: `${LAYERS.y0}%`, height: `${LAYERS.y1 - LAYERS.y0}%` }}
          />
        ))}

        {/* platforms & channels: neutral, secondary to Luna */}
        <p className={`t-label ${s.channels}`} data-channels style={{ insetInlineStart: `${LAYERS.x0 - 6}%` }}>
          {t.channels}
        </p>
        <ul className={s.platforms} aria-label={t.channels}>
          {NODES.map((n) => (
            <li key={n.id} className={s.platform} data-platform style={{ insetInlineStart: `${n.at[0]}%`, top: `${n.at[1]}%` }}>
              <span className={s.mark}>
                <Mark p={n} />
              </span>
              <i className={s.pSq} aria-hidden="true" />
            </li>
          ))}
        </ul>
        <span className={`t-label ${s.group}`} data-group style={{ insetInlineStart: `${COL.store}%` }}>
          {t.groups.store}
        </span>
        <span className={`t-label ${s.group}`} data-group style={{ insetInlineStart: `${COL.marketplace}%` }}>
          {t.groups.marketplace}
        </span>

        {END_Y.map((y, i) => (
          <div key={y} className={s.dest} data-dest style={{ insetInlineStart: `${END_X}%`, top: `${y}%` }}>
            <i className={s.destSq} aria-hidden="true" />
            <span className={s.destText}>{t.destinations[i]}</span>
          </div>
        ))}

        {packets.map((_, i) => (
          <span key={i} className={s.packet} data-packet aria-hidden="true" />
        ))}

        {/* owned-brand node */}
        <div className={s.node} data-node style={{ insetInlineStart: `${NODE.x}%`, top: `${NODE.y}%` }} aria-hidden="true">
          <i />
        </div>
        <div className={s.nodeLabel} data-node-label style={{ insetInlineStart: `${NODE.x}%` }}>
          <span className="t-label">{t.owned}</span>
          <span className={s.nodeName} lang="en" dir="ltr">
            LUVISCENT®
          </span>
        </div>
      </div>

      <div className={s.copy}>
        <p className={`t-headline ${s.secondary}`} data-secondary>
          {t.secondary}
        </p>
        <p className={`t-lead ${s.body}`} data-body>
          {t.body}
        </p>
      </div>

      <div className={s.staticList}>
        <p className="t-label">{t.channels}</p>
        <ul>
          {PLATFORMS.map((p) => (
            <li key={p.id}>
              <Mark p={p} />
            </li>
          ))}
        </ul>
        <ul>
          {t.destinations.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
