"use client";

import { useRef } from "react";
import Chapter, { useChapterTimeline } from "@/components/stage/Chapter";
import ChapterTag from "@/components/ui/ChapterTag";
import { useI18n } from "@/content/i18n/I18nProvider";
import s from "./journey.module.css";

/**
 * 03 — FACILITY → WAREHOUSE
 * The sectional door rises; the camera enters the hall. Information is
 * anchored in the environment itself (see WorldLayer labels).
 */
export default function Warehouse() {
  return (
    <Chapter id="warehouse">
      <Content />
    </Chapter>
  );
}

function Content() {
  const { dict, locale } = useI18n();
  const t = dict.warehouse;
  const scope = useRef<HTMLDivElement>(null);
  useChapterTimeline(scope, (tl, q) => {
    tl.fromTo(q("[data-tag]"), { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.06 }, 0.06)
      .fromTo(q("[data-tag-rule]"), { scaleX: 0 }, { scaleX: 1, duration: 0.1 }, 0.06)
      .fromTo(q("[data-l1]"), { yPercent: 135 }, { yPercent: 0, duration: 0.12, ease: "power3.out" }, 0.18)
      .fromTo(q("[data-l2]"), { yPercent: 135 }, { yPercent: 0, duration: 0.12, ease: "power3.out" }, 0.26)
      .to(q("[data-l1], [data-l2]"), { yPercent: -135, duration: 0.1, ease: "power2.in", stagger: 0.03 }, 0.8)
      .to(q("[data-tag]"), { opacity: 0, duration: 0.06 }, 0.82);
  }, [locale]);

  return (
    <div ref={scope} className={s.wrap}>
      <ChapterTag index="03" label={t.tag} className={s.tag} />
      <div className={s.block}>
        <h2 className={`t-headline ${s.headline}`}>
          <span className="mask">
            <span data-l1>{t.l1}</span>
          </span>
          <span className="mask tone-graphite">
            <span data-l2>{t.l2}</span>
          </span>
        </h2>
      </div>
      {/* Shown as environment labels in the cinematic view; as a list otherwise */}
      <ul className={`t-label ${s.facts}`}>
        <li>03.1 {t.labels.germany}</li>
        <li>03.2 {t.labels.eu}</li>
        <li>03.3 {t.labels.ecommerce}</li>
        <li>03.4 {t.labels.b2b}</li>
      </ul>
    </div>
  );
}
