"use client";

import { useEffect, useRef } from "react";
import { CHAPTERS } from "@/content/chapters";
import { stage } from "@/lib/stage/store";
import { onFrame } from "@/lib/stage/ticker";
import { scrollToTarget } from "@/lib/motion/SmoothScroll";
import styles from "./ProgressRail.module.css";

/**
 * Story index on the right edge: one tick per chapter, a red "+" tracking
 * the reader's position. Ticks are real buttons (keyboard + screen reader).
 */
export default function ProgressRail() {
  const markerRef = useRef<HTMLSpanElement>(null);
  const railRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let last = -1;
    return onFrame(() => {
      // weighted position: chapter index + local progress
      let pos = 0;
      CHAPTERS.forEach((c, i) => {
        if (stage.p[c.id] > 0) pos = i + stage.p[c.id];
      });
      const ratio = Math.min(1, pos / CHAPTERS.length);
      if (Math.abs(ratio - last) < 0.0005) return;
      last = ratio;
      if (markerRef.current) markerRef.current.style.transform = `translate3d(0, ${(ratio * 100).toFixed(3)}cqh, 0)`;
      const active = Math.min(CHAPTERS.length - 1, Math.floor(pos));
      railRef.current?.querySelectorAll("button").forEach((b, i) => b.toggleAttribute("data-active", i === active));
      railRef.current?.toggleAttribute("data-hidden", stage.p.closing > 0.85);
    });
  }, []);

  return (
    <div ref={railRef} className={styles.rail} data-cine-only aria-label="Story chapters" role="navigation">
      <div className={styles.track}>
        {CHAPTERS.map((c, i) => (
          <button
            key={c.id}
            type="button"
            className={styles.tick}
            style={{ top: `${(i / CHAPTERS.length) * 100}%` }}
            onClick={() => {
              const el = document.getElementById(c.id);
              if (el) scrollToTarget(el.offsetTop + (i === 0 ? 0 : window.innerHeight * 0.02));
            }}
            data-cursor="link"
          >
            <span className={`t-label ${styles.label}`}>
              <span className={styles.idx}>{c.index}</span> {c.label}
            </span>
            <span className="sr-only">Go to chapter {c.index}: {c.label}</span>
          </button>
        ))}
        <span ref={markerRef} className={styles.marker} aria-hidden="true" />
      </div>
    </div>
  );
}
