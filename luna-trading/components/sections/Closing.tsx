"use client";

import { useRef } from "react";
import Chapter, { useChapterTimeline } from "@/components/stage/Chapter";
import MagneticLink from "@/components/ui/MagneticLink";
import { stage } from "@/lib/stage/store";
import { useI18n } from "@/content/i18n/I18nProvider";
import s from "./Closing.module.css";

/**
 * 09 · RETURN TO THE WORLD
 * The instrument has converged into the "+". The Earth returns, calm, the
 * full route drawn and Cologne marked. The story closes where it began.
 *
 * Pacing: the statement and "Let's do business +" arrive early, then the CTA
 * is HELD for about one screen of scroll while the ending keeps breathing
 * (the globe settles, the light lifts, the CTA's red underline completes).
 * Only then does the footer rise; the closing block rides just above the
 * footer's edge (never overlapped) and fades before the navigation zone.
 */
export default function Closing() {
  return (
    <Chapter id="closing">
      <Content />
    </Chapter>
  );
}

function Content() {
  const { dict, locale, href } = useI18n();
  const t = dict.closing;
  const scope = useRef<HTMLDivElement>(null);
  const block = useRef<HTMLDivElement>(null);

  useChapterTimeline(
    scope,
    (tl, q) => {
      // arrival (same scroll distance as before)
      tl.fromTo(q("[data-origin]"), { scale: 0.55, opacity: 1 }, { scale: 0, opacity: 0, duration: 0.06, ease: "power2.in" }, 0)
        .fromTo(q("[data-c] > span > span"), { yPercent: 135 }, { yPercent: 0, duration: 0.06, stagger: 0.03, ease: "power3.out" }, 0.03)
        .fromTo(q("[data-cta-rule]"), { scaleX: 0 }, { scaleX: 1, duration: 0.08, ease: "power2.inOut" }, 0.15)
        .fromTo(q("[data-cta]"), { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.05 }, 0.17)
        .fromTo(q("[data-sign]"), { opacity: 0 }, { opacity: 1, duration: 0.05 }, 0.21)
        // the held CTA keeps breathing: its red underline completes
        .fromTo(q("[data-cta-line]"), { scaleX: 0 }, { scaleX: 1, duration: 0.36, ease: "power1.inOut" }, 0.22);

      // Footer hand-over, evaluated in the same scroll update (never a frame
      // behind): the block rides just above the rising footer's edge and
      // fades only once it nears the top. Pure function of the footer position.
      const el = block.current!;
      const stmt = el.querySelector("[data-c]") as HTMLElement;
      const row = el.querySelector("[data-cta-row]") as HTMLElement;
      const footer = document.querySelector("footer");
      let last = "";
      const handOver = () => {
        if (!footer) return;
        const vh = stage.vh;
        const top = footer.getBoundingClientRect().top;
        const gap = Math.max(28, vh * 0.05);
        const restBottom = vh - (parseFloat(getComputedStyle(el).bottom) || 0);
        const lift = Math.max(0, restBottom + gap - top);
        // each part fades only as it nears the navigation's protected zone:
        // the statement first, the CTA last
        const restTop = restBottom - el.offsetHeight;
        const fade = (y: number, span: number) => Math.min(1, Math.max(0, (y - lift - vh * 0.1) / (vh * span)));
        const oS = fade(restTop + stmt.offsetTop, 0.14);
        const oC = fade(restTop + row.offsetTop, 0.18);
        const k = `${lift.toFixed(1)}|${oS.toFixed(3)}|${oC.toFixed(3)}`;
        if (k === last) return;
        last = k;
        el.style.transform = lift > 0 ? `translate3d(0, ${(-lift).toFixed(1)}px, 0)` : "";
        stmt.style.opacity = oS < 1 ? oS.toFixed(3) : "";
        row.style.opacity = oC < 1 ? oC.toFixed(3) : "";
      };
      tl.eventCallback("onUpdate", handOver);
      handOver();
    },
    [locale]
  );

  return (
    <div ref={scope} className={s.wrap}>
      <span className={s.origin} data-origin data-cine-only aria-hidden="true" />
      <div ref={block} className={s.block}>
        <h2 className={`t-display ${s.statement}`} data-c>
          {t.lines.map((l, i) => (
            <span key={i} className={`mask ${i === 0 ? "tone-graphite" : ""}`}>
              <span>{l}</span>
            </span>
          ))}
        </h2>
        <div className={`${s.ctaRow} interactive`} data-cta-row>
          <span className={s.ctaRule} data-cta-rule aria-hidden="true" />
          <div data-cta>
            <MagneticLink href={href("/contact")} className={s.cta}>
              <span className={s.ctaText}>
                {t.cta}
                <span className={s.ctaLine} data-cta-line data-cine-only aria-hidden="true" />
              </span>
              <span className={s.plus} aria-hidden="true" />
            </MagneticLink>
          </div>
          <p className={`t-label ${s.sign}`} data-sign>
            {t.sign}
          </p>
        </div>
      </div>
    </div>
  );
}
