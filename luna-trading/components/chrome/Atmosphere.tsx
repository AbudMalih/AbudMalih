"use client";

import { useEffect, useRef } from "react";
import { stage, range, smooth } from "@/lib/stage/store";
import { onFrame } from "@/lib/stage/ticker";
import styles from "./Atmosphere.module.css";

/**
 * The tonal score of the film. One continuous set of light values:
 *   deep black (hero) → graphite (brand / chain) → light digital commerce
 *   (warm off-white, silver) → LUVISCENT forest and warm light → dark Luna
 *   ecosystem → a brighter, calm closing.
 * The line-world sets its own graphite / metallic tones (createWorld).
 * While the light chapter dominates, <html data-tone="light"> flips the
 * navigation and chrome to ink.
 */
export default function Atmosphere() {
  const graphiteRef = useRef<HTMLDivElement>(null);
  const lightRef = useRef<HTMLDivElement>(null);
  const forestRef = useRef<HTMLDivElement>(null);
  const keyRef = useRef<HTMLDivElement>(null);
  const hazeRef = useRef<HTMLDivElement>(null);
  const dawnRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let last = "";
    let tone = "";
    return onFrame(() => {
      const { brands: b, chain: ch, commerce: cm, luviscent: lv, closing: cl } = stage.p;
      const commerceIn = smooth(range(cm, 0.0, 0.1));
      const commerceOut = smooth(range(cm, 0.84, 0.98));
      const graphite = Math.min(1, smooth(range(b, 0.7, 1)) + (ch > 0 ? 1 : 0)) * (1 - commerceIn);
      const light = commerceIn * (1 - commerceOut);
      const lvOut = 1 - smooth(range(lv, 0.76, 0.94));
      const forest = Math.max(commerceOut, lv > 0 ? 1 : 0) * lvOut;
      const key = Math.max(commerceOut * 0.6, smooth(range(lv, 0.0, 0.3))) * (1 - smooth(range(lv, 0.68, 0.88)));
      const haze = smooth(range(lv, 0.1, 0.4)) * (1 - smooth(range(lv, 0.66, 0.86)));
      const dawn = smooth(range(cl, 0.04, 0.6));
      const k = [graphite, light, forest, key, haze, dawn, lv].map((v) => v.toFixed(3)).join("|");
      if (k !== last) {
        last = k;
        graphiteRef.current!.style.opacity = graphite.toFixed(3);
        // light does not fade in as grey: it spreads outward from the product
        lightRef.current!.style.opacity = (Math.min(1, commerceIn * 2.2) * (1 - commerceOut)).toFixed(3);
        const r = 12 + commerceIn * 190;
        const m = `radial-gradient(circle at ${stage.rtl ? 86 : 14}% 50%, #000 ${Math.max(0, r - 40).toFixed(1)}%, transparent ${r.toFixed(1)}%)`;
        lightRef.current!.style.maskImage = m;
        lightRef.current!.style.webkitMaskImage = m;
        forestRef.current!.style.opacity = forest.toFixed(3);
        keyRef.current!.style.opacity = key.toFixed(3);
        keyRef.current!.style.transform = `translate3d(${(-4 + lv * 8).toFixed(2)}vw, ${(3 - lv * 6).toFixed(2)}vh, 0)`;
        hazeRef.current!.style.opacity = (haze * 0.6).toFixed(3);
        dawnRef.current!.style.opacity = dawn.toFixed(3);
      }
      const t = light > 0.45 ? "light" : "dark";
      if (t !== tone) {
        tone = t;
        document.documentElement.dataset.tone = t;
      }
    });
  }, []);

  return (
    <div className={styles.root} aria-hidden="true">
      <div ref={graphiteRef} className={styles.graphite} />
      <div ref={lightRef} className={styles.light} />
      <div ref={forestRef} className={styles.forest} />
      <div ref={keyRef} className={styles.key} />
      <div ref={hazeRef} className={styles.haze} />
      <div ref={dawnRef} className={styles.dawn} />
      <div className={styles.grain} />
    </div>
  );
}
