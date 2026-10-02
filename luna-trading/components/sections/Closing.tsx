"use client";

import { useRef } from "react";
import Chapter, { useChapterTimeline } from "@/components/stage/Chapter";
import MagneticLink from "@/components/ui/MagneticLink";
import s from "./Closing.module.css";

/**
 * 08 — RETURN TO THE WORLD
 * The instrument has converged into the "+". The Earth returns, calm,
 * the full route drawn and Cologne marked. The story closes where it began.
 */
export default function Closing() {
  return (
    <Chapter id="closing" title="Connecting products, markets, opportunities">
      <Content />
    </Chapter>
  );
}

function Content() {
  const scope = useRef<HTMLDivElement>(null);
  useChapterTimeline(scope, (tl, q) => {
    tl.fromTo(q("[data-origin]"), { scale: 0.55, opacity: 1 }, { scale: 0, opacity: 0, duration: 0.14, ease: "power2.in" }, 0.06)
      .fromTo(q("[data-c] > span > span"), { yPercent: 110 }, { yPercent: 0, duration: 0.1, stagger: 0.06, ease: "power3.out" }, 0.24)
      .fromTo(q("[data-cta]"), { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.08 }, 0.56)
      .fromTo(q("[data-cta-rule]"), { scaleX: 0 }, { scaleX: 1, duration: 0.14, ease: "power2.inOut" }, 0.56)
      .fromTo(q("[data-sign]"), { opacity: 0 }, { opacity: 1, duration: 0.08 }, 0.64);
  });

  return (
    <div ref={scope} className={s.wrap}>
      <span className={s.origin} data-origin data-cine-only aria-hidden="true" />
      <div className={s.block}>
        <h2 className={`t-display ${s.statement}`} data-c>
          <span className="mask tone-graphite">
            <span>Connecting</span>
          </span>
          <span className="mask">
            <span>Products.</span>
          </span>
          <span className="mask">
            <span>Markets.</span>
          </span>
          <span className="mask">
            <span>Opportunities.</span>
          </span>
        </h2>
        <div className={`${s.ctaRow} interactive`}>
          <span className={s.ctaRule} data-cta-rule aria-hidden="true" />
          <div data-cta>
            <MagneticLink href="/contact" className={s.cta}>
              <span>Let&rsquo;s do business</span>
              <span className={s.plus} aria-hidden="true" />
            </MagneticLink>
          </div>
          <p className={`t-label ${s.sign}`} data-sign>
            Luna Trading GmbH · Köln
          </p>
        </div>
      </div>
    </div>
  );
}
