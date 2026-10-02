"use client";

import { useRef } from "react";
import Chapter, { useChapterTimeline } from "@/components/stage/Chapter";
import ChapterTag from "@/components/ui/ChapterTag";
import s from "./journey.module.css";

/**
 * 03 — FACILITY → WAREHOUSE
 * The sectional door rises; the camera enters the hall. Information is
 * anchored in the environment itself (see WorldLayer labels).
 */
export default function Warehouse() {
  return (
    <Chapter id="warehouse" title="Germany as the base. Europe as the market.">
      <Content />
    </Chapter>
  );
}

function Content() {
  const scope = useRef<HTMLDivElement>(null);
  useChapterTimeline(scope, (tl, q) => {
    tl.fromTo(q("[data-tag]"), { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.06 }, 0.06)
      .fromTo(q("[data-tag-rule]"), { scaleX: 0 }, { scaleX: 1, duration: 0.1 }, 0.06)
      .fromTo(q("[data-l1]"), { yPercent: 110 }, { yPercent: 0, duration: 0.12, ease: "power3.out" }, 0.18)
      .fromTo(q("[data-l2]"), { yPercent: 110 }, { yPercent: 0, duration: 0.12, ease: "power3.out" }, 0.26)
      .to(q("[data-l1], [data-l2]"), { yPercent: -110, duration: 0.1, ease: "power2.in", stagger: 0.03 }, 0.8)
      .to(q("[data-tag]"), { opacity: 0, duration: 0.06 }, 0.82);
  });

  return (
    <div ref={scope} className={s.wrap}>
      <ChapterTag index="03" label="Distribution" className={s.tag} />
      <div className={s.block}>
        <h2 className={`t-headline ${s.headline}`}>
          <span className="mask">
            <span data-l1>Germany as the base.</span>
          </span>
          <span className="mask tone-graphite">
            <span data-l2>Europe as the market.</span>
          </span>
        </h2>
      </div>
      {/* Shown as environment labels in the cinematic view; as a list otherwise */}
      <ul className={`t-label ${s.facts}`}>
        <li>03.1 Germany</li>
        <li>03.2 EU distribution</li>
        <li>03.3 E-commerce</li>
        <li>03.4 B2B</li>
      </ul>
    </div>
  );
}
