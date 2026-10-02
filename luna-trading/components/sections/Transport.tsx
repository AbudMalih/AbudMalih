"use client";

import { useRef } from "react";
import Chapter, { useChapterTimeline } from "@/components/stage/Chapter";
import ChapterTag from "@/components/ui/ChapterTag";
import { useI18n } from "@/content/i18n/I18nProvider";
import s from "./journey.module.css";

/**
 * 02 — CONTAINER → TRUCK → EUROPE
 * The container is lowered onto a 40-tonne combination; the camera tracks
 * the truck along the red route to a logistics facility.
 */
export default function Transport() {
  return (
    <Chapter id="transport">
      <Content />
    </Chapter>
  );
}

function Content() {
  const { dict, locale } = useI18n();
  const t = dict.transport;
  const scope = useRef<HTMLDivElement>(null);
  useChapterTimeline(scope, (tl, q) => {
    tl.fromTo(q("[data-tag]"), { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.05 }, 0.04)
      .fromTo(q("[data-tag-rule]"), { scaleX: 0 }, { scaleX: 1, duration: 0.08 }, 0.04)
      .fromTo(q("[data-l1]"), { yPercent: 135 }, { yPercent: 0, duration: 0.1, ease: "power3.out" }, 0.4)
      .fromTo(q("[data-l2]"), { yPercent: 135 }, { yPercent: 0, duration: 0.1, ease: "power3.out" }, 0.45)
      .fromTo(q("[data-lead]"), { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.06 }, 0.52)
      .fromTo(q("[data-scrim]"), { opacity: 0 }, { opacity: 1, duration: 0.08 }, 0.36)
      .to(q("[data-l1], [data-l2]"), { yPercent: -135, duration: 0.08, ease: "power2.in", stagger: 0.02 }, 0.8)
      .to(q("[data-lead], [data-tag]"), { opacity: 0, duration: 0.05 }, 0.8)
      .to(q("[data-scrim]"), { opacity: 0, duration: 0.08 }, 0.84);
  }, [locale]);

  return (
    <div ref={scope} className={s.wrap}>
      <div className={s.scrim} data-scrim data-cine-only />
      <ChapterTag index="02" label={t.tag} className={s.tag} />
      <div className={s.block}>
        <h2 className={`t-display ${s.headline}`}>
          <span className="mask">
            <span data-l1>{t.l1}</span>
          </span>
          <span className="mask tone-graphite">
            <span data-l2>{t.l2}</span>
          </span>
        </h2>
        <p className={`t-lead ${s.lead}`} data-lead>
          <strong>{t.leadStrong}</strong> {t.lead}
        </p>
      </div>
    </div>
  );
}
