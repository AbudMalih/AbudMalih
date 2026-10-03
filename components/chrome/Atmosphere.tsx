"use client";

import { useEffect, useRef } from "react";
import { stage, range, smooth, journeyT } from "@/lib/stage/store";
import { onFrame } from "@/lib/stage/ticker";
import { toneAt, lightness } from "@/lib/world/tones";
import styles from "./Atmosphere.module.css";

/**
 * The tonal score of the film. One continuous set of light values, every one
 * a pure function of chapter progress (forward and reverse are identical):
 *
 *   black hero → dark trade → dark / metallic logistics
 *   → BRAND (04–05): the carton's world brightens metallic → silver → warm
 *     ivory; tactile, physical, lit like a room (first light moment)
 *   → E-COMMERCE (06): cooler, cleaner off-white and silver with a fine
 *     digital grid; it spreads outward from the product
 *   → the signature transition: the red connection reaches the LUVISCENT
 *     node and dissolves into air. Silver warms, a warm ivory wave front
 *     opens from the node and deep emerald emerges behind it
 *   → LUVISCENT (07) → dark Luna ecosystem → calmer closing.
 *
 * The line-world shares the same tones (lib/world/tones.ts). While a light
 * environment dominates, <html data-tone="light"> flips the chrome to ink.
 */

/** Combined progress of the E-Commerce → LUVISCENT transformation, 0..1. */
export function airProgress() {
  return 0.58 * range(stage.p.commerce, 0.8, 1) + 0.42 * range(stage.p.luviscent, 0, 0.22);
}

const RED = [201, 2, 22];
const CHAMPAGNE = [212, 193, 155];
const IVORY = [241, 236, 226];
const mix = (a: number[], b: number[], t: number) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const rgba = (c: number[], a: number) => `rgba(${c[0]},${c[1]},${c[2]},${a.toFixed(3)})`;

type Pt = { x: number; y: number };

export default function Atmosphere() {
  const brandRef = useRef<HTMLDivElement>(null);
  const brandTexRef = useRef<HTMLDivElement>(null);
  const shaftRef = useRef<HTMLDivElement>(null);
  const lightRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const warmRef = useRef<HTMLDivElement>(null);
  const forestRef = useRef<HTMLDivElement>(null);
  const veilRef = useRef<HTMLDivElement>(null);
  const keyRef = useRef<HTMLDivElement>(null);
  const hazeRef = useRef<HTMLDivElement>(null);
  const dawnRef = useRef<HTMLDivElement>(null);
  const airRef = useRef<SVGSVGElement>(null);
  const glowRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    let last = "";
    let tone = "";
    const rgb: [number, number, number] = [0, 0, 0];
    const air = airRef.current!;
    const glow = glowRef.current!;
    const crisp = Array.from(air.querySelectorAll("path"));
    const soft = Array.from(glow.querySelectorAll("path"));

    // product + LUVISCENT node of the commerce diagram, in viewport pixels
    // (measured only around the transition; layout positions, not transforms)
    let node: Pt = { x: 0, y: 0 };
    let prod: Pt = { x: 0, y: 0 };
    const anchor = (sel: string, fx: number, fy: number): Pt => {
      const el = document.querySelector(sel);
      if (el) {
        const r = el.getBoundingClientRect();
        if (r.width || r.height) return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      }
      return { x: stage.vw * fx, y: stage.vh * fy };
    };

    const set = (el: HTMLElement | SVGElement, o: number) => {
      el.style.opacity = o.toFixed(3);
      el.style.visibility = o > 0.001 ? "visible" : "hidden";
    };

    // one organic strand across the viewport (x0..x1), pinned near the node
    const strand = (x0: number, x1: number, cy: number, amp: number, ph: number, f: number, pin: Pt, pinR: number) => {
      const n = 40;
      let d = "";
      for (let i = 0; i <= n; i++) {
        const x = x0 + ((x1 - x0) * i) / n;
        const u = x / Math.max(1, stage.vw);
        const env = Math.min(1, Math.abs(x - pin.x) / pinR);
        const e = env * env * (3 - 2 * env);
        const y = cy + amp * e * (0.62 * Math.sin(u * Math.PI * 2 * f + ph) + 0.38 * Math.sin(u * Math.PI * 2 * (f * 2.1) - ph * 1.3));
        d += `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
      }
      return d;
    };

    return onFrame(() => {
      const { brands: b, chain: ch, commerce: cm, luviscent: lv, closing: cl } = stage.p;
      const W = stage.vw;
      const H = stage.vh;
      const rtl = stage.rtl;

      // ---- 04–05 · brand light ---------------------------------------------
      const jt = journeyT();
      const lit = b > 0 ? lightness(jt) : 0;
      toneAt(jt, rgb);
      const brandColor = `rgb(${(rgb[0] * 255) | 0},${(rgb[1] * 255) | 0},${(rgb[2] * 255) | 0})`;

      // ---- 06 · digital commerce (cooler, cleaner) --------------------------
      const commerceIn = smooth(range(cm, 0.0, 0.1));
      const X = airProgress();
      const bloomDone = X >= 0.97;
      const lightO = Math.min(1, commerceIn * 2.2) * (bloomDone ? 0 : 1);
      const reveal = 12 + commerceIn * 190;
      const lightMask = `radial-gradient(circle at ${rtl ? 86 : 14}% 50%, #000 ${Math.max(0, reveal - 40).toFixed(1)}%, transparent ${reveal.toFixed(1)}%)`;
      // digital grids disappear first, silver warms
      const gridO = commerceIn * (1 - smooth(range(X, 0.02, 0.3))) * (1 - smooth(range(cm, 0.6, 0.72)) * 0.55);
      const warmO = smooth(range(X, 0.04, 0.42)) * 0.75 * (bloomDone ? 0 : 1);

      // ---- the bloom: emerald emerges from the node ------------------------
      if (!node.x || (cm > 0.5 && lv < 0.5)) {
        node = anchor('[data-chapter="commerce"] [data-node]', 0.5, 0.5);
        prod = anchor('[data-chapter="commerce"] [data-carton]', rtl ? 0.882 : 0.118, 0.5);
      }
      const far = Math.max(
        Math.hypot(node.x, node.y),
        Math.hypot(W - node.x, node.y),
        Math.hypot(node.x, H - node.y),
        Math.hypot(W - node.x, H - node.y)
      );
      const grow = smooth(range(X, 0.2, 0.92));
      const R = far * 1.6 * grow;
      const lvOut = 1 - smooth(range(lv, 0.76, 0.94));
      const forestO = (X > 0 && R > 1 ? smooth(range(X, 0.2, 0.5)) : 0) * lvOut;
      // a wide, very soft dusk rather than a disc: stretched along the air,
      // closing to full cover before the light environments are removed
      const solid = smooth(range(X, 0.66, 0.95));
      const forestMask = bloomDone
        ? "none"
        : `radial-gradient(${(R * 2.1).toFixed(0)}px ${(R * 0.72).toFixed(0)}px at ${node.x.toFixed(0)}px ${node.y.toFixed(0)}px, #000 0%, rgba(0,0,0,${(0.85 + 0.15 * solid).toFixed(3)}) ${(30 + 70 * solid).toFixed(1)}%, rgba(0,0,0,${(0.35 + 0.65 * solid).toFixed(3)}) ${(62 + 38 * solid).toFixed(1)}%, transparent 100%)`;
      const veilO = Math.sin(Math.PI * Math.min(1, Math.max(0, (X - 0.18) / 0.8))) * 0.6;
      const veilBg = `radial-gradient(${(R * 2.3).toFixed(0)}px ${(R * 0.85).toFixed(0)}px at ${node.x.toFixed(0)}px ${node.y.toFixed(0)}px, rgba(241,236,226,0) 40%, rgba(212,193,155,0.12) 62%, rgba(241,236,226,0.4) 84%, rgba(241,236,226,0) 100%)`;

      // ---- LUVISCENT light ---------------------------------------------------
      const key = Math.max(smooth(range(X, 0.55, 1)) * 0.7, smooth(range(lv, 0.1, 0.3))) * (1 - smooth(range(lv, 0.68, 0.88)));
      const haze = smooth(range(lv, 0.1, 0.4)) * (1 - smooth(range(lv, 0.66, 0.86)));
      const dawn = smooth(range(cl, 0.04, 0.6));

      // brand ivory sits under the light environments until the forest covers all
      const brandO = (b > 0 || ch > 0 || cm > 0) && !(bloomDone || lv > 0.3) ? 1 : 0;

      // daylight moves slowly across the room while the brand is built
      const sweep = 0.6 * b + 1.4 * ch + 0.5 * Math.min(1, cm * 4);
      const k = [brandColor, lit, sweep, lightO, reveal, gridO, warmO, forestO, R | 0, veilO, key, haze, dawn, lv, node.x | 0, node.y | 0].map((v) => (typeof v === "number" ? v.toFixed(3) : v)).join("|");
      if (k !== last) {
        last = k;
        brandRef.current!.style.backgroundColor = brandColor;
        set(brandRef.current!, brandO);
        brandTexRef.current!.style.opacity = lit.toFixed(3);
        shaftRef.current!.style.transform = `translate3d(${((rtl ? 1 : -1) * (24 - sweep * 22)).toFixed(2)}vw, 0, 0)`;
        set(lightRef.current!, lightO);
        lightRef.current!.style.maskImage = lightMask;
        lightRef.current!.style.webkitMaskImage = lightMask;
        set(gridRef.current!, gridO);
        set(warmRef.current!, warmO);
        set(forestRef.current!, forestO);
        forestRef.current!.style.maskImage = forestMask;
        forestRef.current!.style.webkitMaskImage = forestMask;
        set(veilRef.current!, veilO);
        veilRef.current!.style.backgroundImage = veilBg;
        set(keyRef.current!, key);
        keyRef.current!.style.transform = `translate3d(${(-4 + lv * 8).toFixed(2)}vw, ${(3 - lv * 6).toFixed(2)}vh, 0)`;
        set(hazeRef.current!, haze * 0.6);
        set(dawnRef.current!, dawn);
      }

      // ---- the air: red connection → organic champagne light ----------------
      const connect = smooth(range(cm, 0.71, 0.79));
      // the air lives only in the transition; once LUVISCENT is established no
      // line other than its horizon may cross the scene (it would cross the copy)
      const airOn = connect > 0 && X < 1;
      if (!airOn) {
        if (air.style.visibility !== "hidden") {
          air.style.visibility = "hidden";
          glow.style.visibility = "hidden";
        }
      } else {
        air.style.visibility = "visible";
        glow.style.visibility = "visible";
        const t = stage.ambientClock ?? performance.now() / 1000;
        const ext = smooth(range(X, 0, 0.32));
        const wave = smooth(range(X, 0.08, 0.42)) * (1 - smooth(range(X, 0.68, 0.96)));
        const color = mix(RED, CHAMPAGNE, smooth(range(X, 0.1, 0.42)));
        const dir = rtl ? -1 : 1;
        // the red line from the product reaches the node, then opens across the viewport
        const reach = prod.x + (node.x - prod.x) * connect;
        const a = prod.x + ((dir > 0 ? -24 : W + 24) - prod.x) * ext;
        const z = reach + ((dir > 0 ? W + 24 : -24) - reach) * ext;
        const ph = X * 5.5 + t * 0.12 * (0.4 + wave);
        const amp = H * 0.05 * wave;
        const pinR = W * 0.22;
        const main = strand(Math.min(a, z), Math.max(a, z), node.y, amp, ph, 1.05, node, pinR);
        // main strand settles into the LUVISCENT horizon, then hands over
        const mainO = (1 - smooth(range(lv, 0.16, 0.26))) * (X < 1 ? 1 : 0);
        crisp[0].setAttribute("d", main);
        crisp[0].style.stroke = rgba(color, 1);
        crisp[0].style.strokeWidth = (1.6 - 0.6 * smooth(range(X, 0.1, 0.4))).toFixed(2);
        crisp[0].style.opacity = mainO.toFixed(3);

        // secondary strands: translucent light, air
        const strands = smooth(range(X, 0.14, 0.4)) * (1 - smooth(range(X, 0.74, 1)));
        const sOp = strands;
        const lines = [
          { off: -0.05, f: 0.7, p: 1.7, amp: 1.1 },
          { off: 0.04, f: 1.15, p: 3.1, amp: 0.8 },
          { off: 0.1, f: 0.55, p: 4.4, amp: 1.3 },
        ];
        lines.forEach((l, i) => {
          const d = strand(-24, W + 24, node.y + H * l.off * strands, H * 0.05 * l.amp * wave, ph * (0.8 + i * 0.15) + l.p, l.f, node, pinR * 0.6);
          const c = mix(CHAMPAGNE, IVORY, i / 3);
          crisp[i + 1].setAttribute("d", d);
          crisp[i + 1].style.stroke = rgba(c, 1);
          crisp[i + 1].style.opacity = (sOp * (0.2 - i * 0.05)).toFixed(3);
          soft[i].setAttribute("d", d);
          soft[i].style.stroke = rgba(c, 1);
          soft[i].style.opacity = (sOp * (0.34 - i * 0.07)).toFixed(3);
        });
        // a soft halo travelling with the main line
        soft[3].setAttribute("d", main);
        soft[3].style.stroke = rgba(mix(color, IVORY, 0.4), 1);
        soft[3].style.opacity = (mainO * smooth(range(X, 0.12, 0.4)) * 0.55).toFixed(3);
      }

      const lightTone = (lit > 0.5 && b > 0 && X < 0.72 && lv < 0.3) || (lightO > 0.45 && X < 0.72);
      const tn = lightTone ? "light" : "dark";
      if (tn !== tone) {
        tone = tn;
        document.documentElement.dataset.tone = tn;
      }
    });
  }, []);

  return (
    <div className={styles.root} aria-hidden="true">
      <div ref={brandRef} className={styles.brand}>
        <div ref={brandTexRef} className={styles.brandTex}>
          <div ref={shaftRef} className={styles.shaft} />
        </div>
      </div>
      <div ref={lightRef} className={styles.light}>
        <div ref={gridRef} className={styles.grid} />
      </div>
      <div ref={warmRef} className={styles.warm} />
      <div ref={forestRef} className={styles.forest} />
      <div ref={veilRef} className={styles.veil} />
      <div ref={keyRef} className={styles.key} />
      <div ref={hazeRef} className={styles.haze} />
      <div ref={dawnRef} className={styles.dawn} />
      <svg ref={glowRef} className={styles.airGlow}>
        <path />
        <path />
        <path />
        <path />
      </svg>
      <svg ref={airRef} className={styles.air}>
        <path />
        <path />
        <path />
        <path />
      </svg>
      <div className={styles.grain} />
    </div>
  );
}
