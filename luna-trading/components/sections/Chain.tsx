"use client";

import { useRef } from "react";
import Chapter, { useChapterTimeline } from "@/components/stage/Chapter";
import ChapterTag from "@/components/ui/ChapterTag";
import { CHAIN } from "@/content/ecosystem";
import s from "./Chain.module.css";

const START = 0.1;
const END = 0.86;
const SLOT = (END - START) / CHAIN.length;

/**
 * 05 — THE CHAIN
 * Seven disciplines on one red line. The "+" travels the line; each link
 * takes the stage in turn. No cards — one word at a time, at full scale.
 */
export default function Chain() {
  return (
    <Chapter id="chain" title="Seven disciplines. One chain.">
      <Content />
    </Chapter>
  );
}

function Content() {
  const scope = useRef<HTMLDivElement>(null);
  useChapterTimeline(scope, (tl, q) => {
    tl.fromTo(q("[data-tag]"), { opacity: 0 }, { opacity: 1, duration: 0.04 }, 0.02)
      .fromTo(q("[data-tag-rule]"), { scaleX: 0 }, { scaleX: 1, duration: 0.06 }, 0.02)
      .fromTo(q("[data-intro] > span > span"), { yPercent: 110 }, { yPercent: 0, duration: 0.06, stagger: 0.02, ease: "power3.out" }, 0.03)
      .fromTo(q("[data-ticks] li"), { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.04, stagger: 0.008 }, 0.04)
      .fromTo(q("[data-fill]"), { scaleX: 0 }, { scaleX: 1, duration: END - START, ease: "none" }, START)
      .fromTo(q("[data-marker]"), { left: "0%" }, { left: "100%", duration: END - START, ease: "none" }, START)
      .fromTo(q("[data-marker]"), { opacity: 0 }, { opacity: 1, duration: 0.02 }, START - 0.02);

    const words = q("[data-word]");
    const lines = q("[data-desc]");
    const ticks = q("[data-ticks] li");
    CHAIN.forEach((_, i) => {
      const a = START + i * SLOT;
      tl.fromTo(words[i], { yPercent: 105 }, { yPercent: 0, duration: 0.035, ease: "power3.out" }, a);
      tl.fromTo(lines[i], { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.03 }, a + 0.01);
      tl.to(ticks[i], { color: "var(--paper)", duration: 0.01 }, a);
      if (i < CHAIN.length - 1) {
        tl.to(words[i], { yPercent: -105, duration: 0.03, ease: "power2.in" }, a + SLOT - 0.03);
        tl.to(lines[i], { opacity: 0, duration: 0.02 }, a + SLOT - 0.025);
      }
    });
    tl.to(words[CHAIN.length - 1], { yPercent: -105, duration: 0.04, ease: "power2.in" }, 0.9)
      .to(lines[CHAIN.length - 1], { opacity: 0, duration: 0.03 }, 0.9)
      .to(q("[data-intro], [data-tag], [data-ticks], [data-count]"), { opacity: 0, duration: 0.04 }, 0.9)
      .to(q("[data-marker]"), { opacity: 0, duration: 0.03 }, 0.94)
      .to(q("[data-rest]"), { opacity: 0, duration: 0.04 }, 0.9);
    const countEl = q("[data-count-n]")[0];
    tl.to(
      {},
      {
        duration: END - START,
        ease: "none",
        onUpdate(this: gsap.core.Tween) {
          const i = Math.min(CHAIN.length, Math.floor(this.progress() * CHAIN.length) + 1);
          countEl.textContent = String(i).padStart(2, "0");
        },
      },
      START
    );
  });

  return (
    <div ref={scope} className={s.wrap}>
      <ChapterTag index="05" label="The chain" className={s.tag} />
      <p className={`t-headline ${s.intro}`} data-intro>
        <span className="mask">
          <span>Seven disciplines.</span>
        </span>
        <span className="mask tone-graphite">
          <span>One chain.</span>
        </span>
      </p>

      <div className={s.stageWords} aria-hidden="true" data-cine-only>
        {CHAIN.map((c) => (
          <span key={c.id} className="mask">
            <span className={`t-display ${s.word}`} data-word>
              {c.label}
            </span>
          </span>
        ))}
      </div>

      <div className={s.line} data-cine-only aria-hidden="true">
        <span className={s.rest} data-rest />
        <span className={s.fill} data-fill />
        <ol className={`t-label t-mono ${s.ticks}`} data-ticks>
          {CHAIN.map((c, i) => (
            <li key={c.id} style={{ left: `${(i / (CHAIN.length - 1)) * 100}%` }}>
              {String(i + 1).padStart(2, "0")}
            </li>
          ))}
        </ol>
        <span className={s.marker} data-marker />
      </div>

      <div className={s.descs} aria-hidden="true" data-cine-only>
        <p className={`t-label t-mono ${s.count}`} data-count>
          <span data-count-n>01</span> / {String(CHAIN.length).padStart(2, "0")}
        </p>
        {CHAIN.map((c) => (
          <p key={c.id} className={`t-lead ${s.desc}`} data-desc>
            {c.line}
          </p>
        ))}
      </div>

      {/* Accessible / static representation */}
      <ol className={s.list}>
        {CHAIN.map((c, i) => (
          <li key={c.id}>
            <span className="t-label t-mono">{String(i + 1).padStart(2, "0")}</span>
            <strong>{c.label}</strong>
            <span>{c.line}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
