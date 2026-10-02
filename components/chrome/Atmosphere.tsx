"use client";

import { useEffect, useRef } from "react";
import { stage, range, smooth } from "@/lib/stage/store";
import { onFrame } from "@/lib/stage/ticker";
import styles from "./Atmosphere.module.css";

/**
 * The base light of the whole story. Near-black for Luna. Entering
 * LUVISCENT, warmth arrives before colour: an amber light leak at the end of
 * the chain, then deep forest and olive, a champagne key light and an ivory
 * haze. Leaving, it all recedes back into graphite. One continuous value,
 * never a theme switch.
 */
export default function Atmosphere() {
  const forestRef = useRef<HTMLDivElement>(null);
  const amberRef = useRef<HTMLDivElement>(null);
  const keyRef = useRef<HTMLDivElement>(null);
  const hazeRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let last = "";
    return onFrame(() => {
      const c = stage.p.chain;
      const p = stage.p.luviscent;
      const out = 1 - smooth(range(p, 0.8, 0.99));
      const amber = Math.max(smooth(range(c, 0.84, 1)) * 0.9, smooth(range(p, 0, 0.1))) * (1 - smooth(range(p, 0.3, 0.6)) * 0.55) * out;
      const forest = Math.max(smooth(range(c, 0.93, 1)) * 0.35, smooth(range(p, 0.0, 0.26))) * out;
      const key = smooth(range(p, 0.08, 0.42)) * (1 - smooth(range(p, 0.74, 0.94)));
      const haze = smooth(range(p, 0.18, 0.5)) * (1 - smooth(range(p, 0.7, 0.9)));
      const k = `${forest.toFixed(3)}|${amber.toFixed(3)}|${key.toFixed(3)}|${haze.toFixed(3)}|${p.toFixed(3)}`;
      if (k === last) return;
      last = k;
      if (forestRef.current) forestRef.current.style.opacity = forest.toFixed(3);
      if (amberRef.current) amberRef.current.style.opacity = amber.toFixed(3);
      if (keyRef.current) {
        keyRef.current.style.opacity = key.toFixed(3);
        keyRef.current.style.transform = `translate3d(${(-4 + p * 8).toFixed(2)}vw, ${(3 - p * 6).toFixed(2)}vh, 0)`;
      }
      if (hazeRef.current) hazeRef.current.style.opacity = (haze * 0.6).toFixed(3);
    });
  }, []);
  return (
    <div className={styles.root} aria-hidden="true">
      <div ref={forestRef} className={styles.forest} />
      <div ref={amberRef} className={styles.amber} />
      <div ref={keyRef} className={styles.key} />
      <div ref={hazeRef} className={styles.haze} />
      <div className={styles.grain} />
    </div>
  );
}
