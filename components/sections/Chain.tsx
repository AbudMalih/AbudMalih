"use client";

import { useRef } from "react";
import Chapter, { useChapterTimeline } from "@/components/stage/Chapter";
import ChapterTag from "@/components/ui/ChapterTag";
import { CHAIN, COMMERCE_STEP } from "@/content/ecosystem";
import { useI18n } from "@/content/i18n/I18nProvider";
import s from "./Chain.module.css";

/**
 * 05 · THE OPERATING MODEL
 * SOURCE → IMPORT → DEVELOP → BRAND → E-COMMERCE → DISTRIBUTE on one red line.
 * At E-COMMERCE the line opens into the digital-commerce moment
 * (product → platform → market endpoints), then closes again. At the end
 * the red warms to champagne: the threshold of the LUVISCENT world.
 */

// Timeline map (chapter progress)
const START = 0.08;
const SLOT = 0.085; // steps before e-commerce
const N = CHAIN.length;
const slotStart = (i: number) => (i <= COMMERCE_STEP ? START + i * SLOT : 0.745 + (i - COMMERCE_STEP - 1) * 0.1);
const COMMERCE_IN = 0.48;
const COMMERCE_OUT = 0.7;
const WARM = 0.88;

// Commerce diagram geometry (percent of the diagram box)
const ORIGIN = { x: 2, y: 50 };
const PLATFORM = { x0: 34, x1: 38, y0: 16, y1: 84 };
const END_X = 76;
const ENDS_Y = [12, 37, 63, 88];

/** Point on a branch curve (percent space): cubic bezier platform → endpoint. */
function bezier(yEnd: number, t: number): [number, number] {
  const p0 = [PLATFORM.x1, 50], p1 = [PLATFORM.x1 + 14, 50], p2 = [END_X - 18, yEnd], p3 = [END_X, yEnd];
  const m = 1 - t;
  const a = m * m * m, b = 3 * m * m * t, c = 3 * m * t * t, d = t * t * t;
  return [a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]];
}

export default function Chain() {
  return (
    <Chapter id="chain">
      <Content />
    </Chapter>
  );
}

function Content() {
  const { dict, locale } = useI18n();
  const t = dict.chain;
  const scope = useRef<HTMLDivElement>(null);

  useChapterTimeline(
    scope,
    (tl, q) => {
      const words = q("[data-word]");
      const lines = q("[data-desc]");
      const ticks = q("[data-ticks] li");
      const marker = q("[data-marker]");
      const fill = q("[data-fill]");
      const countEl = q("[data-count-n]")[0];

      tl.fromTo(q("[data-tag]"), { opacity: 0 }, { opacity: 1, duration: 0.03 }, 0.01)
        .fromTo(q("[data-tag-rule]"), { scaleX: 0 }, { scaleX: 1, duration: 0.05 }, 0.01)
        .fromTo(q("[data-intro] > span > span"), { yPercent: 135 }, { yPercent: 0, duration: 0.05, stagger: 0.02, ease: "power3.out" }, 0.02)
        .fromTo(q("[data-line]"), { opacity: 0 }, { opacity: 1, duration: 0.03 }, 0.03)
        .fromTo(ticks, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.03, stagger: 0.006 }, 0.04)
        .fromTo(marker, { opacity: 0, "--m": 0 }, { opacity: 1, duration: 0.02 }, START - 0.02)
        .fromTo(fill, { scaleX: 0 }, { scaleX: 0.002, duration: 0.01 }, START - 0.01);

      CHAIN.forEach((_, i) => {
        const a = slotStart(i);
        const pos = i / (N - 1);
        if (i > 0) {
          tl.to(marker, { "--m": pos, duration: 0.03, ease: "power2.inOut" }, a - 0.01);
          tl.to(fill, { scaleX: pos, duration: 0.03, ease: "power2.inOut" }, a - 0.01);
        }
        tl.fromTo(words[i], { yPercent: 135 }, { yPercent: 0, duration: 0.03, ease: "power3.out" }, a);
        tl.fromTo(lines[i], { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.025 }, a + 0.01);
        tl.to(ticks[i], { color: "var(--paper)", duration: 0.01 }, a);
        const end = i === COMMERCE_STEP ? COMMERCE_IN : i < N - 1 ? slotStart(i + 1) - 0.02 : WARM - 0.03;
        tl.to(words[i], { yPercent: -135, duration: 0.025, ease: "power2.in" }, end - 0.005);
        tl.to(lines[i], { opacity: 0, duration: 0.02 }, end - 0.01);
      });

      // step counter derived from timeline time (exact when scrubbing backwards)
      tl.eventCallback("onUpdate", () => {
        const now = tl.time();
        let k = 0;
        CHAIN.forEach((_, i) => {
          if (now >= slotStart(i)) k = i;
        });
        const txt = String(k + 1).padStart(2, "0");
        if (countEl.textContent !== txt) countEl.textContent = txt;
      });

      // ---- the digital-commerce moment ---------------------------------
      const pulses = q("[data-c-pulse]") as HTMLElement[];
      const placePulses = (u: number) => {
        pulses.forEach((el, i) => {
          // trunk pulse (i = 0) then one per branch, slightly staggered
          const k = Math.min(1, Math.max(0, u * 1.25 - i * 0.07));
          let x: number, y: number;
          if (i === 0) {
            x = ORIGIN.x + (PLATFORM.x0 - ORIGIN.x) * k;
            y = 50;
          } else {
            [x, y] = bezier(ENDS_Y[i - 1], k);
          }
          el.style.insetInlineStart = `${x}%`;
          el.style.top = `${y}%`;
          el.style.opacity = k > 0 && k < 1 ? "1" : "0";
        });
      };
      tl.fromTo(q("[data-commerce]"), { opacity: 0 }, { opacity: 1, duration: 0.02 }, COMMERCE_IN)
        .to(q("[data-dim]"), { opacity: 0.05, duration: 0.03 }, COMMERCE_IN)
        .to(q("[data-line]"), { opacity: 0.08, duration: 0.03 }, COMMERCE_IN)
        .fromTo(q("[data-c-h] > span > span"), { yPercent: 135 }, { yPercent: 0, duration: 0.04, stagger: 0.015, ease: "power3.out" }, COMMERCE_IN + 0.01)
        .fromTo(q("[data-c-origin]"), { opacity: 0, scale: 0.4 }, { opacity: 1, scale: 1, duration: 0.02 }, COMMERCE_IN + 0.015)
        .fromTo(q("[data-c-trunk]"), { scaleX: 0 }, { scaleX: 1, duration: 0.04, ease: "power2.inOut" }, COMMERCE_IN + 0.02)
        .fromTo(q("[data-c-layer]"), { scaleY: 0 }, { scaleY: 1, duration: 0.03, stagger: 0.006, ease: "power2.out" }, COMMERCE_IN + 0.05)
        .fromTo(q("[data-c-branch]"), { opacity: 0 }, { opacity: 1, duration: 0.03, stagger: 0.01 }, COMMERCE_IN + 0.07)
        .fromTo(q("[data-c-end]"), { opacity: 0, x: 0 }, { opacity: 1, duration: 0.03, stagger: 0.01 }, COMMERCE_IN + 0.1)
        .fromTo(q("[data-c-label]"), { opacity: 0 }, { opacity: 1, duration: 0.03 }, COMMERCE_IN + 0.06)
        .fromTo(q("[data-c-support]"), { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.03 }, COMMERCE_IN + 0.13)
        // data movement travels with the scroll and stops when it stops
        .fromTo(
          { u: 0 },
          { u: 0 },
          {
            u: 1,
            duration: 0.12,
            ease: "none",
            onUpdate(this: gsap.core.Tween) {
              placePulses((this.targets()[0] as { u: number }).u);
            },
          },
          COMMERCE_IN + 0.08
        )
        .to(q("[data-commerce]"), { opacity: 0, duration: 0.035 }, COMMERCE_OUT)
        .to(q("[data-dim]"), { opacity: 1, duration: 0.03 }, COMMERCE_OUT + 0.02)
        .to(q("[data-line]"), { opacity: 1, duration: 0.03 }, COMMERCE_OUT + 0.02);
      placePulses(0);

      // ---- warming: red → champagne, graphite falls away -----------------
      tl.to(q("[data-intro], [data-tag], [data-ticks], [data-count]"), { opacity: 0, duration: 0.04 }, WARM - 0.03)
        .to(marker, { opacity: 0, duration: 0.03 }, WARM)
        .to(q("[data-rest]"), { opacity: 0, duration: 0.04 }, WARM)
        .to(fill, { scaleX: 1, duration: 0.05, ease: "power2.inOut" }, WARM)
        .fromTo(q("[data-champagne]"), { opacity: 0 }, { opacity: 1, duration: 0.09, ease: "power1.inOut" }, WARM + 0.02);
    },
    [locale]
  );

  const branch = (y: number) =>
    `M ${PLATFORM.x1} 50 C ${PLATFORM.x1 + 14} 50, ${END_X - 18} ${y}, ${END_X} ${y}`;

  return (
    <div ref={scope} className={s.wrap}>
      <div data-dim className={s.dimGroup}>
        <ChapterTag index="05" label={t.tag} className={s.tag} />
        <p className={`t-headline ${s.intro}`} data-intro>
          <span className="mask">
            <span>{t.h1}</span>
          </span>
          <span className="mask tone-graphite">
            <span>{t.h2}</span>
          </span>
        </p>

        <div className={s.stageWords} aria-hidden="true" data-cine-only>
          {CHAIN.map((id) => (
            <span key={id} className="mask">
              <span className={`t-display ${s.word}`} data-word>
                {t.steps[id].label}
              </span>
            </span>
          ))}
        </div>

        <div className={s.descs} aria-hidden="true" data-cine-only>
          <p className={`t-label t-mono ${s.count}`} data-count dir="ltr">
            <span data-count-n>01</span> / {String(N).padStart(2, "0")}
          </p>
          {CHAIN.map((id) => (
            <p key={id} className={`t-lead ${s.desc}`} data-desc>
              {t.steps[id].line}
            </p>
          ))}
        </div>
      </div>

      <div className={s.line} data-line data-cine-only aria-hidden="true">
        <span className={s.rest} data-rest data-dim />
        <span className={s.fill} data-fill>
          <span className={s.champagne} data-champagne />
        </span>
        <ol className={`t-label t-mono ${s.ticks}`} data-ticks data-dim>
          {CHAIN.map((id, i) => (
            <li key={id} style={{ insetInlineStart: `${(i / (N - 1)) * 100}%` }} className={i === COMMERCE_STEP ? s.tickKey : undefined}>
              {String(i + 1).padStart(2, "0")}
            </li>
          ))}
        </ol>
        <span className={s.marker} data-marker />
      </div>

      {/* ---- Digital commerce infrastructure ---- */}
      <div className={s.commerce} data-commerce data-cine-only aria-hidden="true">
        <p className={`t-display ${s.cHead}`} data-c-h>
          <span className="mask">
            <span>{t.commerce.h1}</span>
          </span>
          <span className="mask tone-graphite">
            <span>{t.commerce.h2}</span>
          </span>
        </p>

        <div className={s.diagram}>
          <svg className={s.svg} viewBox="0 0 100 100" preserveAspectRatio="none">
            {ENDS_Y.map((y) => (
              <path key={y} d={branch(y)} className={s.branch} data-c-branch />
            ))}
          </svg>
          <span
            className={s.trunk}
            data-c-trunk
            style={{ insetInlineStart: `${ORIGIN.x}%`, width: `${PLATFORM.x0 - ORIGIN.x}%` }}
          />
          {[0, ...ENDS_Y].map((y, i) => (
            <span key={i} className={s.pulse} data-c-pulse />
          ))}

          <span className={s.origin} data-c-origin style={{ insetInlineStart: `${ORIGIN.x}%`, top: `${ORIGIN.y}%` }} />
          <span className={`t-label ${s.originLabel}`} data-c-label style={{ insetInlineStart: `${ORIGIN.x}%` }}>
            {t.commerce.origin}
          </span>

          {[0, 1, 2, 3].map((k) => (
            <span
              key={k}
              className={s.layer}
              data-c-layer
              style={{ insetInlineStart: `${PLATFORM.x0 + (k * (PLATFORM.x1 - PLATFORM.x0)) / 3}%`, top: `${PLATFORM.y0}%`, height: `${PLATFORM.y1 - PLATFORM.y0}%` }}
            />
          ))}
          <span className={`t-label ${s.platformLabel}`} data-c-label style={{ insetInlineStart: `${PLATFORM.x0}%` }}>
            {t.commerce.platform}
          </span>

          {ENDS_Y.map((y, i) => (
            <div key={y} className={s.end} data-c-end style={{ insetInlineStart: `${END_X}%`, top: `${y}%` }}>
              <i className={s.endSq} />
              <span className={s.endText}>
                <span className={`t-label t-mono ${s.endIdx}`}>{`0${i + 1}`}</span>
                {t.commerce.endpoints[i]}
              </span>
            </div>
          ))}
        </div>

        <p className={`t-lead ${s.cSupport}`} data-c-support>
          {t.commerce.support}
        </p>
      </div>

      {/* Accessible / static representation */}
      <ol className={s.list}>
        {CHAIN.map((id, i) => (
          <li key={id}>
            <span className="t-label t-mono">{String(i + 1).padStart(2, "0")}</span>
            <strong>{t.steps[id].label}</strong>
            <span>{t.steps[id].line}</span>
          </li>
        ))}
      </ol>
      <div className={s.commerceStatic}>
        <p className="t-headline">
          {t.commerce.h1} <span className="tone-graphite">{t.commerce.h2}</span>
        </p>
        <ul className="t-label">
          {t.commerce.endpoints.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
        <p className="t-lead">{t.commerce.support}</p>
      </div>
    </div>
  );
}
