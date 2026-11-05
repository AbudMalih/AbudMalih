"use client";

import { useEffect, useRef } from "react";
import { stage } from "@/lib/stage/store";
import { onFrame, damp } from "@/lib/stage/ticker";
import styles from "./HeroSky.module.css";

/**
 * The opening's sky: the page opens at night over the steel, then the sun
 * breaks over the globe's limb. Rays fan out, the dusk warms, a great moon
 * (Luna) hangs over the trade route and cloud banks drift across it.
 * Depth: every layer answers the pointer at its own distance (desktop),
 * and the moon climbs as the story begins. The headline never moves.
 * Lives inside the steel texture, so it fades out with the opening.
 */
export default function HeroSky() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current!;
    const html = document.documentElement;
    const still = html.classList.contains("static") || window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // sunrise once the intro hands over
    const rise = () => el.setAttribute("data-risen", "");
    if (still) {
      el.setAttribute("data-still", "");
      rise();
    } else if (!html.classList.contains("intro-pending")) requestAnimationFrame(() => requestAnimationFrame(rise));
    else window.addEventListener("luna:intro", rise, { once: true });

    // pointer depth (fine pointers only) + the moon's climb with the scroll
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches && !still;
    const tgt = { x: 0, y: 0 };
    const cur = { x: 0, y: 0 };
    const move = (e: PointerEvent) => {
      tgt.x = (e.clientX / Math.max(1, window.innerWidth)) * 2 - 1;
      tgt.y = (e.clientY / Math.max(1, window.innerHeight)) * 2 - 1;
    };
    if (fine) window.addEventListener("pointermove", move, { passive: true });
    let last = "";
    const stop = onFrame((dt) => {
      const k = damp(2.2, dt);
      cur.x += (tgt.x - cur.x) * k;
      cur.y += (tgt.y - cur.y) * k;
      const key = `${cur.x.toFixed(3)}|${cur.y.toFixed(3)}|${stage.p.hero.toFixed(3)}`;
      if (key === last) return;
      last = key;
      el.style.setProperty("--px", cur.x.toFixed(3));
      el.style.setProperty("--py", cur.y.toFixed(3));
      el.style.setProperty("--hp", stage.p.hero.toFixed(3));
    });
    return () => {
      stop();
      window.removeEventListener("pointermove", move);
      window.removeEventListener("luna:intro", rise);
    };
  }, []);

  return (
    <div ref={ref} className={styles.root} aria-hidden="true">
      <div className={styles.sky} />
      <div className={`${styles.depth} ${styles.d1}`}>
        <div className={styles.moon}>
          <i className={styles.moonHalo} />
          <i className={styles.moonDisc} />
        </div>
      </div>
      <div className={`${styles.depth} ${styles.d2}`}>
        <div className={`${styles.clouds} ${styles.cloudsFar}`} />
      </div>
      <div className={`${styles.depth} ${styles.d3}`}>
        <div className={styles.sunrise}>
          <div className={styles.rays}>
            <i />
          </div>
          <div className={styles.sun} />
          <div className={styles.flare} />
        </div>
      </div>
      <div className={`${styles.depth} ${styles.d4}`}>
        <div className={`${styles.clouds} ${styles.cloudsNear}`} />
      </div>
      <div className={styles.night} />
    </div>
  );
}
