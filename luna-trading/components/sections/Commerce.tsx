"use client";

import { useRef } from "react";
import Chapter, { useChapterTimeline } from "@/components/stage/Chapter";
import ChapterTag from "@/components/ui/ChapterTag";
import { useI18n } from "@/content/i18n/I18nProvider";
import s from "./Commerce.module.css";

/**
 * 06 · E-COMMERCE: PHYSICAL TRADE BECOMES DIGITAL COMMERCE (light chapter)
 *  1. the environment lifts out of graphite into warm off-white / silver
 *  2. the red route from the chain retracts and arrives at one product
 *  3. product → platform (typographic platform layer) → four destinations;
 *     order signals travel outward with the scroll
 *  4. the network converges on one owned-brand node, which opens into the
 *     champagne horizon of LUVISCENT (07)
 * Everything is a pure function of chapter progress: identical state from
 * either scroll direction.
 */

// geometry (percent of the diagram box)
const CARTON_X = 9;
const PLATFORM = { x0: 33, x1: 37, y0: 12, y1: 88 };
const DEST_X = 74;
const DEST_Y = [12, 37, 63, 88];
const NODE = { x: 50, y: 50 };
const WAVES = 3;

function bezier(yEnd: number, t: number): [number, number] {
  const p0 = [PLATFORM.x1, 50], p1 = [PLATFORM.x1 + 13, 50], p2 = [DEST_X - 17, yEnd], p3 = [DEST_X, yEnd];
  const m = 1 - t;
  const a = m * m * m, b = 3 * m * m * t, c = 3 * m * t * t, d = t * t * t;
  return [a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]];
}
const branchPath = (y: number) => `M ${PLATFORM.x1} 50 C ${PLATFORM.x1 + 13} 50, ${DEST_X - 17} ${y}, ${DEST_X} ${y}`;

export default function Commerce() {
  return (
    <Chapter id="commerce" stageClassName={s.stage}>
      <Content />
    </Chapter>
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
      const placePackets = (u: number) => {
        packets.forEach((el, n) => {
          const w = Math.floor(n / 5);
          const i = n % 5; // 0 = trunk, 1..4 = branches
          // each packet owns a travel window inside u ∈ [0, 1]; all finish before u = 1
          const start = w * 0.2 + (i === 0 ? 0 : 0.1 + i * 0.03);
          const k = (u - start) / (i === 0 ? 0.12 : 0.32);
          let x: number, y: number;
          if (i === 0) {
            x = CARTON_X + 4 + (PLATFORM.x0 - CARTON_X - 4) * Math.min(1, Math.max(0, k));
            y = 50;
          } else {
            [x, y] = bezier(DEST_Y[i - 1], Math.min(1, Math.max(0, k)));
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
        // 2 · product → platform
        .fromTo(q("[data-trunk]"), { scaleX: 0 }, { scaleX: 1, duration: 0.07, ease: "power2.inOut" }, 0.15)
        .fromTo(q("[data-layer]"), { scaleY: 0 }, { scaleY: 1, duration: 0.06, stagger: 0.01, ease: "power2.out" }, 0.2)
        .fromTo(q("[data-band]"), { opacity: 0 }, { opacity: 1, duration: 0.06 }, 0.24)
        .fromTo(q("[data-band-track]"), { xPercent: 0 }, { xPercent: -50, duration: 0.6, ease: "none" }, 0.2)
        // 3 · platform → destinations, signals outward
        .fromTo(q("[data-branch]"), { opacity: 0 }, { opacity: 1, duration: 0.05, stagger: 0.015 }, 0.28)
        .fromTo(q("[data-dest]"), { opacity: 0, x: 0 }, { opacity: 1, x: 0, duration: 0.05, stagger: 0.015 }, 0.33)
        .fromTo(
          { u: 0 },
          { u: 0 },
          {
            u: 1,
            duration: 0.34,
            ease: "none",
            onUpdate(this: gsap.core.Tween) {
              placePackets((this.targets()[0] as { u: number }).u);
            },
          },
          0.32
        )
        .fromTo(q("[data-secondary]"), { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.05 }, 0.44)
        .fromTo(q("[data-body]"), { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.05 }, 0.48)
        // 4 · converge on one owned-brand node
        .to(q("[data-dest]"), { opacity: 0, duration: 0.06, stagger: 0.008 }, 0.68)
        .to(q("[data-branch]"), { opacity: 0, duration: 0.06 }, 0.68)
        .to(q("[data-h] > span > span"), { yPercent: -135, duration: 0.05, ease: "power2.in", stagger: 0.015 }, 0.68)
        .to(q("[data-secondary], [data-body], [data-tag], [data-band]"), { opacity: 0, duration: 0.05 }, 0.68)
        .to(q("[data-carton], [data-origin-label]"), { opacity: 0, duration: 0.05 }, 0.7)
        .to(q("[data-layer]"), { scaleY: 0, duration: 0.05, stagger: 0.01 }, 0.71)
        .to(q("[data-trunk], [data-route]"), { opacity: 0, duration: 0.05 }, 0.72)
        .fromTo(q("[data-converge]"), { opacity: 0 }, { opacity: 1, duration: 0.05 }, 0.68)
        .to(q("[data-converge]"), { opacity: 0, duration: 0.05 }, 0.8)
        .fromTo(q("[data-node]"), { opacity: 0, scale: 0.3 }, { opacity: 1, scale: 1, duration: 0.05, ease: "back.out(2)" }, 0.75)
        .fromTo(q("[data-node-label]"), { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.04 }, 0.78)
        // 5 · the node opens into the LUVISCENT horizon
        .to(q("[data-node-label]"), { opacity: 0, duration: 0.03 }, 0.88)
        .to(q("[data-node]"), { scale: 0.4, opacity: 0, duration: 0.05 }, 0.9)
        .fromTo(q("[data-horizon]"), { scaleX: 0, opacity: 1 }, { scaleX: 1, duration: 0.12, ease: "power2.inOut" }, 0.86);
      placePackets(0);
    },
    [locale]
  );

  const packets = Array.from({ length: WAVES * 5 });
  const band = [...t.platforms, ...t.platforms, ...t.platforms, ...t.platforms];

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

      <div className={s.diagram} data-cine-only aria-hidden="true">
        <svg className={s.svg} viewBox="0 0 100 100" preserveAspectRatio="none">
          {DEST_Y.map((y) => (
            <path key={y} d={branchPath(y)} className={s.branch} data-branch />
          ))}
        </svg>
        <svg className={s.svg} viewBox="0 0 100 100" preserveAspectRatio="none" data-converge>
          {DEST_Y.map((y) => (
            <path key={y} d={`M ${DEST_X} ${y} C ${DEST_X - 12} ${y}, ${NODE.x + 10} ${NODE.y}, ${NODE.x} ${NODE.y}`} className={s.converge} />
          ))}
        </svg>

        {/* the product */}
        <div className={s.carton} data-carton style={{ insetInlineStart: `${CARTON_X}%` }}>
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

        <span className={s.trunk} data-trunk style={{ insetInlineStart: `${CARTON_X + 3}%`, width: `${PLATFORM.x0 - CARTON_X - 3}%` }} />

        {[0, 1, 2, 3].map((k) => (
          <span
            key={k}
            className={s.layer}
            data-layer
            style={{ insetInlineStart: `${PLATFORM.x0 + (k * (PLATFORM.x1 - PLATFORM.x0)) / 3}%`, top: `${PLATFORM.y0}%`, height: `${PLATFORM.y1 - PLATFORM.y0}%` }}
          />
        ))}

        {DEST_Y.map((y, i) => (
          <div key={y} className={s.dest} data-dest style={{ insetInlineStart: `${DEST_X}%`, top: `${y}%` }}>
            <i className={s.destSq} />
            <span className={s.destText}>
              <span className={`t-label t-mono ${s.destIdx}`}>{`0${i + 1}`}</span>
              {t.destinations[i]}
            </span>
          </div>
        ))}

        {packets.map((_, i) => (
          <span key={i} className={s.packet} data-packet />
        ))}

        {/* owned-brand node */}
        <div className={s.node} data-node style={{ insetInlineStart: `${NODE.x}%`, top: `${NODE.y}%` }}>
          <i />
        </div>
        <div className={s.nodeLabel} data-node-label style={{ insetInlineStart: `${NODE.x}%` }}>
          <span className="t-label">{t.owned}</span>
          <span className={s.nodeName} lang="en" dir="ltr">
            LUVISCENT®
          </span>
        </div>

        {/* typographic platform layer: technologies and channels, not endorsements */}
        <div className={s.band} data-band style={{ insetInlineStart: `${PLATFORM.x0 - 18}%` }}>
          <div className={s.bandTrack} data-band-track>
            {band.map((p, i) => (
              <span key={i}>{p}</span>
            ))}
          </div>
        </div>
      </div>

      <span className={s.horizon} data-horizon data-cine-only aria-hidden="true" />

      <div className={s.copy}>
        <p className={`t-headline ${s.secondary}`} data-secondary>
          {t.secondary}
        </p>
        <p className={`t-lead ${s.body}`} data-body>
          {t.body}
        </p>
      </div>

      <ul className={s.staticList}>
        {t.destinations.map((d) => (
          <li key={d}>{d}</li>
        ))}
      </ul>
    </div>
  );
}
