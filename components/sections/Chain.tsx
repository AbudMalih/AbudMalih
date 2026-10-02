"use client";

import { useRef } from "react";
import Chapter, { useChapterTimeline } from "@/components/stage/Chapter";
import ChapterTag from "@/components/ui/ChapterTag";
import { CHAIN, COMMERCE_STEP } from "@/content/ecosystem";
import { useI18n } from "@/content/i18n/I18nProvider";
import s from "./Chain.module.css";

/**
 * 05 · THE OPERATING MODEL (warm ivory brand light, ink type)
 * SOURCE → IMPORT → DEVELOP → BRAND → E-COMMERCE → DISTRIBUTE on one red
 * line. The line stays alive to the last frame and is handed to the light
 * E-Commerce chapter (06), where it reaches the product.
 */
const START = 0.04;
const END = 0.88;
const N = CHAIN.length;
const SLOT = (END - START) / N;
const slotStart = (i: number) => START + i * SLOT;

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

      tl.fromTo(q("[data-tag]"), { opacity: 0 }, { opacity: 1, duration: 0.03 }, 0)
        .fromTo(q("[data-tag-rule]"), { scaleX: 0 }, { scaleX: 1, duration: 0.05 }, 0)
        .fromTo(q("[data-intro] > span > span"), { yPercent: 135 }, { yPercent: 0, duration: 0.05, stagger: 0.02, ease: "power3.out" }, 0.01)
        .fromTo(ticks, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.03, stagger: 0.006 }, 0.01)
        .fromTo(marker, { opacity: 0, "--m": 0 }, { opacity: 1, "--m": 0, duration: 0.02 }, 0.02)
        .fromTo(fill, { scaleX: 0 }, { scaleX: 0.002, duration: 0.01 }, 0.02);

      CHAIN.forEach((_, i) => {
        const a = slotStart(i);
        const pos = i / (N - 1);
        if (i > 0) {
          tl.fromTo(marker, { "--m": (i - 1) / (N - 1) }, { "--m": pos, duration: 0.04, ease: "power2.inOut", immediateRender: false }, a - 0.015);
          tl.fromTo(fill, { scaleX: (i - 1) / (N - 1) }, { scaleX: pos, duration: 0.04, ease: "power2.inOut", immediateRender: false }, a - 0.015);
        }
        tl.fromTo(words[i], { yPercent: 135 }, { yPercent: 0, duration: 0.035, ease: "power3.out" }, a);
        tl.fromTo(lines[i], { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.03 }, a + 0.01);
        tl.fromTo(ticks[i], { color: "var(--chain-tick)" }, { color: "var(--chain-tick-on)", duration: 0.01, immediateRender: false }, a);
        const end = i < N - 1 ? slotStart(i + 1) - 0.01 : 0.93;
        tl.to(words[i], { yPercent: -135, duration: 0.03, ease: "power2.in" }, end - 0.02);
        tl.to(lines[i], { opacity: 0, duration: 0.02 }, end - 0.02);
      });

      tl.eventCallback("onUpdate", () => {
        const now = tl.time();
        let k = 0;
        CHAIN.forEach((_, i) => {
          if (now >= slotStart(i)) k = i;
        });
        const txt = String(k + 1).padStart(2, "0");
        if (countEl.textContent !== txt) countEl.textContent = txt;
      });

      // hand-off: the details fall away, the red line remains for chapter 06
      tl.to(q("[data-intro], [data-tag], [data-ticks], [data-count], [data-rest]"), { opacity: 0, duration: 0.05 }, 0.9)
        .to(marker, { opacity: 0, duration: 0.04 }, 0.92);
    },
    [locale]
  );

  return (
    <div ref={scope} className={s.wrap}>
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

      <div className={s.line} data-line data-cine-only aria-hidden="true">
        <span className={s.rest} data-rest />
        <span className={s.fill} data-fill />
        <ol className={`t-label t-mono ${s.ticks}`} data-ticks>
          {CHAIN.map((id, i) => (
            <li key={id} style={{ insetInlineStart: `${(i / (N - 1)) * 100}%` }} className={i === COMMERCE_STEP ? s.tickKey : undefined}>
              {String(i + 1).padStart(2, "0")}
            </li>
          ))}
        </ol>
        <span className={s.marker} data-marker />
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
    </div>
  );
}
