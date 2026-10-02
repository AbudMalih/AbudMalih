"use client";

import { useEffect, useRef, type RefObject } from "react";
import { gsap } from "@/lib/motion/gsap";
import { stage, range, easeInOut, smooth } from "@/lib/stage/store";
import { onFrame } from "@/lib/stage/ticker";
import { globeAnchor } from "@/lib/globe/shared";
import { isCine } from "@/lib/motion/env";
import styles from "./Hero.module.css";

/**
 * The red period after BORDERS is the origin of the film's trade route.
 * A pure function of hero progress (scroll forward and back are identical):
 *
 *   .004–.07  the period locks as a coordinate: hairline crosshair + one ring
 *   .05–.22   a thin red route is drawn from the period towards the globe
 *   .19–.23   the point detaches as the word leaves
 *   .23–.32   the point travels the route and settles on the globe's origin
 *   .31–.345  hand-over: the globe's own route and red + take over
 */
export default function HeroSignal({ period }: { period: RefObject<HTMLSpanElement | null> }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const pointRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const crossRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isCine()) return;
    const wrap = wrapRef.current!;
    const path = pathRef.current!;
    const point = pointRef.current!;
    const ring = ringRef.current!;
    const cross = crossRef.current!;

    // Period glyph centre relative to its span box, from the real font metrics
    const ctx = document.createElement("canvas").getContext("2d");
    let metricsFor = "";
    let mx = 0.5;
    let my = 0.8;
    let glyphR = 10;
    const metrics = (el: HTMLElement, r: DOMRect) => {
      const cs = getComputedStyle(el);
      const key = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}|${r.width.toFixed(1)}`;
      if (key === metricsFor || !ctx) return;
      metricsFor = key;
      ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      const m = ctx.measureText(".");
      const cx = (m.actualBoundingBoxRight - m.actualBoundingBoxLeft) / 2;
      const cy = m.fontBoundingBoxAscent - (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
      const h = m.fontBoundingBoxAscent + m.fontBoundingBoxDescent;
      glyphR = Math.max(3, (m.actualBoundingBoxRight + m.actualBoundingBoxLeft) / 2);
      if (r.width > 0 && h > 0) {
        mx = cx / r.width;
        // the inline box is the font's content area, scaled to the used size
        my = cy / h;
      }
    };

    let introDone = !document.documentElement.classList.contains("intro-pending");
    const onIntro = () => window.setTimeout(() => (introDone = true), 1900);
    if (!introDone) window.addEventListener("luna:intro", onIntro, { once: true });

    // Period position with the scroll offset of its line, without the exit move
    let ax = 0;
    let ay = 0;
    let measured = false;
    const measure = () => {
      const el = period.current;
      if (!el) return;
      const move = el.closest("[data-move]") as HTMLElement | null;
      const word = el.closest("[data-word]") as HTMLElement | null;
      const r = el.getBoundingClientRect();
      metrics(el, r);
      const sub = (n: HTMLElement | null) => (n ? (Number(gsap.getProperty(n, "yPercent")) || 0) * n.offsetHeight / 100 : 0);
      // glyph centre with the line's scroll offset, but without the
      // entrance / exit moves of the word inside its mask
      ax = r.left + r.width * mx;
      ay = r.top + r.height * my - sub(move) - sub(word);
      measured = true;
    };

    const set = (el: HTMLElement, x: number, y: number, o: number, s = 1) => {
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) scale(${s.toFixed(3)})`;
      el.style.opacity = o.toFixed(3);
    };

    let shown = false;
    const stop = onFrame(() => {
      const h = stage.p.hero;
      const live = introDone && h > 0.004 && h < 0.35 && globeAnchor.ready && globeAnchor.front;
      if (live !== shown) {
        shown = live;
        wrap.style.visibility = live ? "visible" : "hidden";
      }
      const glyph = period.current;
      if (!live) {
        wrap.removeAttribute("data-pulse");
        if (glyph) glyph.style.opacity = "";
        return;
      }
      if (h < 0.215 || !measured) measure();
      const off = wrap.getBoundingClientRect();
      const x0 = ax - off.left;
      const y0 = ay - off.top;
      const x1 = globeAnchor.x - off.left;
      const y1 = globeAnchor.y - off.top;

      // gentle arc: control point lifted perpendicular to the chord
      const dx = x1 - x0;
      const dy = y1 - y0;
      const len = Math.hypot(dx, dy) || 1;
      const bend = Math.min(160, len * 0.22) * (x1 >= x0 ? -1 : 1);
      const cx = (x0 + x1) / 2 + (-dy / len) * bend;
      const cy = (y0 + y1) / 2 + (dx / len) * bend;
      path.setAttribute("d", `M${x0.toFixed(1)} ${y0.toFixed(1)} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)}`);
      const at = (t: number) => {
        const u = 1 - t;
        return [u * u * x0 + 2 * u * t * cx + t * t * x1, u * u * y0 + 2 * u * t * cy + t * t * y1];
      };

      const arm = range(h, 0.004, 0.06);
      const draw = smooth(range(h, 0.035, 0.2));
      const travel = easeInOut(range(h, 0.23, 0.32));
      const out = range(h, 0.31, 0.345);

      // route: drawn from the period, then retracts behind the travelling point
      const head = draw;
      const tail = travel;
      path.style.strokeDasharray = `${Math.max(0, head - tail).toFixed(4)} 2`;
      path.style.strokeDashoffset = (-tail).toFixed(4);
      path.style.opacity = (1 - out).toFixed(3);

      const [px, py] = at(travel);
      // the period itself becomes the point: the glyph hands over and the
      // point contracts from the glyph's size as it sets off
      const swap = range(h, 0.195, 0.225);
      if (glyph) glyph.style.opacity = (1 - swap).toFixed(3);
      const pointO = swap * (1 - out);
      const grow = Math.max(1, glyphR / 3.5);
      set(point, px, py, pointO, 1 + (grow - 1) * (1 - range(h, 0.225, 0.27)));

      // activation ring (scroll-driven, once) around the period
      const ringT = range(h, 0.004, 0.08);
      const ringS = (glyphR * 2 + 6) / 22;
      set(ring, x0, y0, ringT > 0 && ringT < 1 ? 0.55 * (1 - ringT) : 0, ringS * (1 + ringT * 1.6));

      // coordinate crosshair: locks onto the period, rides the route and
      // contracts into the globe's red origin +
      const lock = arm * (1 - out);
      // frames the glyph first, then tightens onto the travelling point
      const gap = (glyphR + 6) + (8 - (glyphR + 6)) * range(h, 0.225, 0.29);
      cross.style.setProperty("--gap", `${gap.toFixed(1)}px`);
      set(cross, px, py, lock * (1 - 0.35 * draw * (1 - travel)), 1.25 - 0.25 * arm);

      // subtle time-based pulse while the point is an active coordinate
      wrap.toggleAttribute("data-pulse", h < 0.3);
      wrap.style.setProperty("--px", `${px.toFixed(1)}px`);
      wrap.style.setProperty("--py", `${py.toFixed(1)}px`);
      wrap.style.setProperty("--ps", (h < 0.225 ? (glyphR * 2 + 4) / 22 : 0.6).toFixed(3));
    });

    return () => {
      stop();
      window.removeEventListener("luna:intro", onIntro);
    };
  }, [period]);

  return (
    <div ref={wrapRef} className={styles.signal} aria-hidden="true" data-cine-only>
      <svg className={styles.signalSvg}>
        <path ref={pathRef} className={styles.signalPath} pathLength={1} />
      </svg>
      <div ref={ringRef} className={styles.signalRing} />
      <div className={styles.signalPulse} />
      <div ref={crossRef} className={styles.signalCross}>
        <i />
        <i />
        <i />
        <i />
      </div>
      <div ref={pointRef} className={styles.signalPoint} />
    </div>
  );
}
