"use client";

import { useEffect, useRef } from "react";
import { stage, range, smooth } from "@/lib/stage/store";
import { onFrame } from "@/lib/stage/ticker";
import styles from "./Atmosphere.module.css";

/**
 * The base light of the whole story. Near-black for Luna; for the LUVISCENT
 * chapter it slowly becomes deep forest green with a warm golden key light,
 * then returns. One continuous value, never a theme switch.
 */
export default function Atmosphere() {
  const lvRef = useRef<HTMLDivElement>(null);
  const goldRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let last = -1;
    return onFrame(() => {
      const p = stage.p.luviscent;
      const k = smooth(range(p, 0.02, 0.24)) * (1 - smooth(range(p, 0.8, 0.99)));
      const g = smooth(range(p, 0.12, 0.4)) * (1 - smooth(range(p, 0.74, 0.94)));
      const key = Math.round(k * 1000) + Math.round(g * 1000) * 1e4 + Math.round(p * 200) * 1e8;
      if (key === last) return;
      last = key;
      if (lvRef.current) lvRef.current.style.opacity = k.toFixed(3);
      if (goldRef.current) {
        goldRef.current.style.opacity = g.toFixed(3);
        goldRef.current.style.transform = `translate3d(${(-6 + p * 12).toFixed(2)}vw, ${(4 - p * 8).toFixed(2)}vh, 0)`;
      }
    });
  }, []);
  return (
    <div className={styles.root} aria-hidden="true">
      <div ref={lvRef} className={styles.forest} />
      <div ref={goldRef} className={styles.gold} />
      <div className={styles.grain} />
    </div>
  );
}
