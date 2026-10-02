"use client";

import { useRef } from "react";
import Chapter, { useChapterTimeline } from "@/components/stage/Chapter";
import ChapterTag from "@/components/ui/ChapterTag";
import { useI18n } from "@/content/i18n/I18nProvider";
import s from "./journey.module.css";

/**
 * 01 — WORLD → ROUTE → FREIGHT
 * The globe dives into Europe; the red route hands over to the line-world,
 * where it lies on the quay under a single container. Camera pitches from
 * a satellite view down to eye level as the terminal reveals itself.
 */
export default function SourceToMarket() {
  return (
    <Chapter id="source">
      <Content />
    </Chapter>
  );
}

function Content() {
  const { dict, locale } = useI18n();
  const t = dict.source;
  const scope = useRef<HTMLDivElement>(null);
  useChapterTimeline(scope, (tl, q) => {
    tl.fromTo(q("[data-scrim]"), { opacity: 0 }, { opacity: 1, duration: 0.1 }, 0.24)
      .fromTo(q("[data-tag]"), { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.06 }, 0.26)
      .fromTo(q("[data-tag-rule]"), { scaleX: 0 }, { scaleX: 1, duration: 0.1 }, 0.26)
      .fromTo(q("[data-l1]"), { yPercent: 135 }, { yPercent: 0, duration: 0.14, ease: "power3.out" }, 0.32)
      .fromTo(q("[data-l2]"), { yPercent: 135 }, { yPercent: 0, duration: 0.14, ease: "power3.out" }, 0.38)
      .fromTo(q("[data-support] span"), { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.06, stagger: 0.03 }, 0.5)
      .to(q("[data-l1], [data-l2]"), { yPercent: -135, duration: 0.1, ease: "power2.in", stagger: 0.02 }, 0.86)
      .to(q("[data-support] span, [data-tag]"), { opacity: 0, duration: 0.06 }, 0.86)
      .to(q("[data-scrim]"), { opacity: 0.4, duration: 0.08 }, 0.9);
  }, [locale]);

  return (
    <div ref={scope} className={s.wrap}>
      <div className={s.scrim} data-scrim data-cine-only />
      <ChapterTag index="01" label={t.tag} className={s.tag} />
      <div className={s.block}>
        <h2 className={`t-display ${s.headline}`}>
          <span className="mask">
            <span data-l1>{t.l1}</span>
          </span>
          <span className="mask tone-graphite">
            <span data-l2>{t.l2}</span>
          </span>
        </h2>
        <p className={`t-lead ${s.lead} ${s.supporting}`} data-support>
          {t.supporting.map((x) => (
            <span key={x}>{x}</span>
          ))}
        </p>
      </div>
    </div>
  );
}
