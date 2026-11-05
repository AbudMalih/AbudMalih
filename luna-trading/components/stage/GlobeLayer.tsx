"use client";

import { useEffect, useRef } from "react";
import type { GlobeHandle, GlobeFrame } from "@/lib/globe/createGlobe";
import { globeState, type GlobeDerived } from "@/lib/globe/state";
import { formatLat, formatLon, ROUTE_WAYPOINTS } from "@/lib/globe/coords";
import { stage, tierSettled, range, smooth } from "@/lib/stage/store";
import { onFrame, damp, markReady } from "@/lib/stage/ticker";
import { COMPANY } from "@/content/site";
import { isCine } from "@/lib/motion/env";
import { globeAnchor } from "@/lib/globe/shared";
import { useI18n } from "@/content/i18n/I18nProvider";
import styles from "./GlobeLayer.module.css";

const KEYS: (keyof GlobeFrame)[] = ["lon", "lat", "dist", "ox", "oy", "reveal", "route", "env"];

/**
 * Fixed WebGL layer for the Earth (hero + closing). The renderer only draws
 * when the derived state actually changes, and stops entirely while invisible.
 * `mode="static"` renders a single composed frame (reduced motion / review).
 */
export default function GlobeLayer({ mode = "fixed" }: { mode?: "fixed" | "static" }) {
  const { dict } = useI18n();
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const originRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const headTextRef = useRef<HTMLSpanElement>(null);
  const homeRef = useRef<HTMLDivElement>(null);
  const orbitBackRef = useRef<SVGSVGElement>(null);
  const orbitFrontRef = useRef<SVGSVGElement>(null);
  const orbitPlusRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (mode === "fixed" && !isCine()) return;
    let disposed = false;
    let globe: GlobeHandle | null = null;
    let stopFrame: (() => void) | null = null;
    let ro: ResizeObserver | null = null;
    const canvas = canvasRef.current!;
    const wrap = wrapRef.current!;

    const cur: GlobeDerived = { ...globeState() };
    let dirty = true;
    let lastVersion = -1;
    let lastHeadText = "";

    let vw = 1;
    let vh = 1;
    const size = () => {
      if (!globe) return;
      const r = wrap.getBoundingClientRect();
      vw = Math.max(1, r.width);
      vh = Math.max(1, r.height);
      const dpr = Math.min(window.devicePixelRatio || 1, stage.tier === "high" ? 2 : 1.5);
      globe.setSize(Math.max(1, r.width), Math.max(1, r.height), dpr);
      dirty = true;
    };

    /*
     * The opening's orbits: three hairline rings around the planet, like trade
     * lanes around the world, with the red + travelling the outer one. Sized
     * and centred from the globe's real camera framing (26° fov, view offset),
     * so they stay locked to the planet on every screen. Back halves behind
     * the globe, front halves in front. They fade out as the story begins.
     */
    const TILT = (-16 * Math.PI) / 180;
    const RINGS = [1.08, 1.2, 1.34];
    let lastOrbit = "";
    let lastGlobe = "";
    const drawOrbits = (f: GlobeDerived) => {
      const back = orbitBackRef.current;
      const front = orbitFrontRef.current;
      const plus = orbitPlusRef.current;
      if (!back || !front || !plus) return;
      const show = (1 - smooth(range(stage.p.hero, 0, 0.3))) * f.reveal * (stage.p.closing > 0 ? 0 : 1);
      const r = ((vh / 2) * Math.tan(Math.asin(Math.min(1, 1 / f.dist)))) / Math.tan((13 * Math.PI) / 180);
      const cx = vw * (0.5 + f.ox);
      const cy = vh * (0.5 + f.oy);
      // the sky behind the planet (Atmosphere) follows the globe's framing
      const gk = `${cx.toFixed(0)}|${cy.toFixed(0)}|${r.toFixed(0)}`;
      if (gk !== lastGlobe && stage.p.closing <= 0) {
        lastGlobe = gk;
        const rs = document.documentElement.style;
        rs.setProperty("--gx", `${cx.toFixed(0)}px`);
        rs.setProperty("--gy", `${cy.toFixed(0)}px`);
        rs.setProperty("--gr", `${r.toFixed(0)}px`);
      }
      if (show < 0.002) {
        if (lastOrbit !== "off") {
          lastOrbit = "off";
          back.style.opacity = front.style.opacity = plus.style.opacity = "0";
        }
        return;
      }
      const key = `${cx.toFixed(1)}|${cy.toFixed(1)}|${r.toFixed(1)}|${show.toFixed(3)}`;
      if (key !== lastOrbit) {
        lastOrbit = key;
        for (const svg of [back, front]) {
          svg.querySelector("g")!.setAttribute("transform", `translate(${cx.toFixed(1)} ${cy.toFixed(1)}) rotate(${((TILT * 180) / Math.PI).toFixed(1)})`);
          svg.querySelectorAll("ellipse").forEach((e, i) => {
            e.setAttribute("rx", (r * RINGS[i]).toFixed(1));
            e.setAttribute("ry", (r * RINGS[i] * 0.3).toFixed(1));
          });
          const clip = svg.querySelector("clipPath rect");
          if (clip) clip.setAttribute("width", String(r * 4)), clip.setAttribute("x", String(-r * 2)), clip.setAttribute("height", String(r * 2));
        }
        back.style.opacity = (show * 0.9).toFixed(3);
        front.style.opacity = show.toFixed(3);
      }
      // the red +: one slow lap of the outer lane (48 s), front half bright
      // phones: the + would cross the headline and the footer line, so only the rings
      if (stage.tier === "low" || stage.mobile) {
        plus.style.opacity = "0";
        return;
      }
      const t = stage.ambientClock ?? performance.now() / 1000;
      const a = (t * Math.PI * 2) / 48;
      const rx = r * RINGS[2];
      const ry = rx * 0.3;
      const ex = rx * Math.cos(a);
      const ey = ry * Math.sin(a);
      const x = cx + ex * Math.cos(TILT) - ey * Math.sin(TILT);
      const y = cy + ex * Math.sin(TILT) + ey * Math.cos(TILT);
      const inFront = Math.sin(a) > 0;
      plus.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      plus.style.opacity = (show * (inFront ? 1 : 0.28)).toFixed(3);
      plus.style.zIndex = inFront ? "2" : "0";
    };

    const place = (el: HTMLElement | null, x: number, y: number, show: boolean) => {
      if (!el) return;
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      el.style.opacity = show ? "1" : "0";
    };

    const drawMarkers = (f: GlobeDerived) => {
      if (!globe) return;
      const vis = f.opacity > 0.05 && f.reveal > 0.3;
      const [olon, olat] = ROUTE_WAYPOINTS[0];
      const o = globe.project(olon, olat);
      place(originRef.current, o.x, o.y, vis && o.front && f.route > 0.002);
      if (mode === "fixed") {
        const r = wrap.getBoundingClientRect();
        globeAnchor.x = r.left + o.x;
        globeAnchor.y = r.top + o.y;
        globeAnchor.front = o.front;
        globeAnchor.ready = true;
      }
      const hd = globe.routeHead();
      const hp = globe.project(hd.lon, hd.lat);
      place(headRef.current, hp.x, hp.y, vis && hp.front && f.route > 0.01 && f.route < 0.95 && f.labels > 0.5);
      const txt = `${formatLat(hd.lat)}  ${formatLon(hd.lon)}`;
      if (txt !== lastHeadText && headTextRef.current) {
        headTextRef.current.textContent = txt;
        lastHeadText = txt;
      }
      const k = globe.project(COMPANY.coordinates.lon, COMPANY.coordinates.lat);
      place(homeRef.current, k.x, k.y, vis && k.front && f.route > 0.97);
      homeRef.current?.toggleAttribute("data-quiet", stage.p.closing > 0);
    };

    (async () => {
      const [{ createGlobe }] = await Promise.all([import("@/lib/globe/createGlobe"), tierSettled()]);
      if (disposed) return;
      globe = createGlobe(canvas, { hiRes: stage.tier === "high" && !stage.mobile });
      size();
      ro = new ResizeObserver(size);
      ro.observe(wrap);
      await globe.ready;
      if (disposed) return;
      markReady("globe");

      if (mode === "static") {
        const f: GlobeDerived = { lon: 62, lat: 26, dist: stage.mobile ? 6 : 4.4, ox: 0, oy: 0, reveal: 1, route: 1, env: 0, opacity: 1, labels: 1 };
        globe.render(f);
        drawMarkers(f);
        return;
      }

      stopFrame = onFrame((dt) => {
        if (!globe) return;
        const tgt = globeState();
        if (stage.version !== lastVersion) {
          lastVersion = stage.version;
          dirty = true;
        }
        // light follow of the scroll-driven targets
        const k = damp(stage.mobile ? 10 : 9, dt);
        let moving = false;
        for (const key of KEYS) {
          const d = tgt[key] - cur[key];
          if (Math.abs(d) > 1e-5) {
            cur[key] += d * k;
            moving = true;
          } else cur[key] = tgt[key];
        }
        cur.opacity += (tgt.opacity - cur.opacity) * Math.min(1, k * 1.6);
        cur.labels = tgt.labels;
        const visible = cur.opacity > 0.002;
        wrap.style.opacity = cur.opacity.toFixed(3);
        wrap.style.visibility = visible ? "visible" : "hidden";
        if (!visible) return;
        if (moving || dirty) {
          globe.render(cur);
          drawMarkers(cur);
          dirty = false;
        }
        drawOrbits(cur);
      });
    })();

    return () => {
      disposed = true;
      stopFrame?.();
      ro?.disconnect();
      globe?.dispose();
    };
  }, [mode]);

  return (
    <div
      ref={wrapRef}
      className={mode === "fixed" ? `stage-layer ${styles.fixed}` : styles.static}
      aria-hidden="true"
      dir="ltr"
    >
      {mode === "fixed" && (
        <svg ref={orbitBackRef} className={styles.orbits} aria-hidden="true">
          <g>
            <ellipse className={styles.ring} />
            <ellipse className={styles.ring} />
            <ellipse className={styles.ring} />
          </g>
        </svg>
      )}
      <canvas ref={canvasRef} className={styles.canvas} />
      {mode === "fixed" && (
        <svg ref={orbitFrontRef} className={`${styles.orbits} ${styles.front}`} aria-hidden="true">
          <defs>
            <clipPath id="orbit-front">
              <rect y="0" />
            </clipPath>
          </defs>
          <g clipPath="url(#orbit-front)">
            <ellipse className={styles.ring} />
            <ellipse className={styles.ring} />
            <ellipse className={styles.ring} />
          </g>
        </svg>
      )}
      {mode === "fixed" && (
        <div ref={orbitPlusRef} className={styles.orbitPlus}>
          <i className={styles.plus} />
        </div>
      )}
      <div ref={originRef} className={styles.marker}>
        <i className={styles.plus} />
      </div>
      <div ref={headRef} className={`${styles.marker} ${styles.head}`}>
        <i className={styles.plus} />
        <span ref={headTextRef} className={`t-label t-mono ${styles.coord}`} />
      </div>
      <div ref={homeRef} className={`${styles.marker} ${styles.home}`}>
        <i className={styles.plus} />
        <span className={`t-label ${styles.coord}`}>
          {dict.company.city} &nbsp;{formatLat(COMPANY.coordinates.lat)} {formatLon(COMPANY.coordinates.lon)}
        </span>
      </div>
    </div>
  );
}
