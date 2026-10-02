"use client";

import { useEffect, useRef } from "react";
import Chapter, { useChapterTimeline } from "@/components/stage/Chapter";
import { stage, range, easeInOut, lerp } from "@/lib/stage/store";
import { onFrame } from "@/lib/stage/ticker";
import { worldShared } from "@/lib/world/shared";
import { useI18n } from "@/content/i18n/I18nProvider";
import s from "./BrandShift.module.css";

/**
 * 04 — LOGISTICS → PRODUCT → BRAND
 * The camera isolates one carton; the world falls away into fog. The
 * carton's outline is handed to a DOM frame, which opens into the frame
 * of the statement — then collapses into the red line of the chain.
 */
export default function BrandShift() {
  return (
    <Chapter id="brands">
      <Content />
    </Chapter>
  );
}

function Content() {
  const { dict, locale } = useI18n();
  const t = dict.brands;
  const scope = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);

  // Frame geometry: carton rect → editorial frame → horizontal line
  useEffect(() => {
    if (!document.documentElement.classList.contains("cine")) return;
    const el = frame.current!;
    let lastKey = "";
    return onFrame(() => {
      const p = stage.p.brands;
      const W = stage.vw, H = stage.vh;
      const m = stage.mobile;
      const final = m
        ? { x: W * 0.06, y: H * 0.28, w: W * 0.88, h: H * 0.44 }
        : { x: W * 0.14, y: H * 0.2, w: W * 0.72, h: H * 0.6 };
      const c = worldShared.carton.w > 0 ? worldShared.carton : { x: W / 2 - 60, y: H / 2 - 40, w: 120, h: 80 };
      const open = easeInOut(range(p, 0.5, 0.7));
      const collapse = easeInOut(range(p, 0.86, 0.985));
      let x = lerp(c.x, final.x, open), y = lerp(c.y, final.y, open);
      let w = lerp(c.w, final.w, open), h = lerp(c.h, final.h, open);
      // collapse into the chain line (full width, vertical centre)
      const lineY = H * 0.5;
      x = lerp(x, stage.mobile ? W * 0.06 : W * 0.045, collapse);
      w = lerp(w, stage.mobile ? W * 0.88 : W * 0.91, collapse);
      y = lerp(y, lineY, collapse);
      h = lerp(h, 0, collapse);
      const vis = range(p, 0.44, 0.5);
      const key = `${x | 0}|${y | 0}|${w | 0}|${h | 0}|${vis.toFixed(2)}|${collapse.toFixed(2)}`;
      if (key === lastKey) return;
      lastKey = key;
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      el.style.width = `${w.toFixed(1)}px`;
      el.style.height = `${Math.max(0, h).toFixed(1)}px`;
      el.style.opacity = vis.toFixed(3);
      el.style.setProperty("--collapse", collapse.toFixed(3));
    });
  }, []);

  useChapterTimeline(scope, (tl, q) => {
    tl.fromTo(q("[data-a1]"), { yPercent: 135 }, { yPercent: 0, duration: 0.1, ease: "power3.out" }, 0.06)
      .fromTo(q("[data-a2]"), { yPercent: 135 }, { yPercent: 0, duration: 0.1, ease: "power3.out" }, 0.12)
      .to(q("[data-a1], [data-a2]"), { yPercent: -135, duration: 0.08, ease: "power2.in", stagger: 0.02 }, 0.36)
      .fromTo(q("[data-b1]"), { yPercent: 135 }, { yPercent: 0, duration: 0.1, ease: "power3.out" }, 0.64)
      .fromTo(q("[data-b2]"), { yPercent: 135 }, { yPercent: 0, duration: 0.1, ease: "power3.out" }, 0.69)
      .fromTo(q("[data-corner]"), { opacity: 0 }, { opacity: 1, duration: 0.05 }, 0.6)
      .to(q("[data-b1], [data-b2]"), { yPercent: -135, duration: 0.07, ease: "power2.in", stagger: 0.015 }, 0.82)
      .to(q("[data-corner]"), { opacity: 0, duration: 0.04 }, 0.84);
  }, [locale]);

  return (
    <div ref={scope} className={s.wrap}>
      <h2 className={s.h}>
        <span className={`t-display ${s.first}`}>
          <span className="mask">
            <span data-a1>{t.a1}</span>
          </span>
          <span className="mask tone-graphite">
            <span data-a2>{t.a2}</span>
          </span>
        </span>
        <span className={`t-mega ${s.second}`}>
          <span className="mask">
            <span data-b1>{t.b1}</span>
          </span>
          <span className="mask">
            <span data-b2>
              {t.b2}
              <span className={s.dot}>.</span>
            </span>
          </span>
        </span>
      </h2>

      <div ref={frame} className={s.frame} data-cine-only aria-hidden="true">
        <i className={s.c} data-corner data-pos="tl" />
        <i className={s.c} data-corner data-pos="tr" />
        <i className={s.c} data-corner data-pos="bl" />
        <i className={s.c} data-corner data-pos="br" />
      </div>
    </div>
  );
}
