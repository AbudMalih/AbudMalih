"use client";

import { useEffect, useRef } from "react";
import type { GlobeHandle, GlobeFrame } from "@/lib/globe/createGlobe";
import { globeState, type GlobeDerived } from "@/lib/globe/state";
import { formatLat, formatLon, ROUTE_WAYPOINTS } from "@/lib/globe/geo";
import { stage } from "@/lib/stage/store";
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

    const size = () => {
      if (!globe) return;
      const r = wrap.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, stage.tier === "high" ? 2 : 1.5);
      globe.setSize(Math.max(1, r.width), Math.max(1, r.height), dpr);
      dirty = true;
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
      const { createGlobe } = await import("@/lib/globe/createGlobe");
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
        // light follow on top of Lenis (it already smooths): no second heavy glide
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
      <canvas ref={canvasRef} className={styles.canvas} />
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
