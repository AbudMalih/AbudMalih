"use client";

import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { SplitText } from "gsap/SplitText";
import { InertiaPlugin } from "gsap/InertiaPlugin";
import { ROUTE_WAYPOINTS } from "@/lib/globe/coords";
import { createGlobe2, type Globe2, type Lane, type Marker } from "@/lib/lab/globe2";
import s from "./GlobeExperiment.module.css";

gsap.registerPlugin(SplitText, InertiaPlugin);

/* Lanes: the typical trade routes named in the import content */
const SEA: [number, number][] = [
  ...ROUTE_WAYPOINTS.slice(0, ROUTE_WAYPOINTS.findIndex(([lo, la]) => lo === 1.4 && la === 50.6) + 1),
  [3.2, 52.4],
  [6.2, 54.0],
  [8.4, 54.0],
  [9.97, 53.55],
];
const RAIL: [number, number][] = [
  [108.94, 34.34], [96.0, 40.2], [87.6, 43.8], [76.9, 43.3], [71.4, 51.2],
  [55.0, 54.8], [37.6, 55.75], [27.56, 53.9], [21.0, 52.2], [13.4, 52.5], [6.76, 51.43],
];
const AIR: [number, number][] = [
  [113.26, 23.13], [8.68, 50.11],
];

const LANES: (Lane & { mode: string; route: string; time: string; view: { lon: number; lat: number; dist: number } })[] = [
  { id: "sea", points: SEA, color: "#c90216", width: 0.0042, arc: 0.0, mode: "Seefracht", route: "Shanghai → Hamburg", time: "30 bis 45 Tage", view: { lon: 66, lat: 24, dist: 4.55 } },
  { id: "rail", points: RAIL, color: "#efe7d6", width: 0.0032, arc: 0.012, mode: "Schienenfracht", route: "Xi’an → Duisburg", time: "18 bis 25 Tage", view: { lon: 60, lat: 36, dist: 4.45 } },
  { id: "air", points: AIR, color: "#c9b68e", width: 0.0028, arc: 0.16, mode: "Luftfracht", route: "Guangzhou → Frankfurt", time: "3 bis 7 Tage", view: { lon: 62, lat: 32, dist: 4.5 } },
];
const MARKERS: (Marker & { label: string; lane?: string })[] = [
  { id: "sha", lon: 121.47, lat: 31.23, label: "Shanghai", lane: "sea" },
  { id: "ham", lon: 9.99, lat: 53.55, label: "Hamburg", lane: "sea" },
  { id: "xia", lon: 108.94, lat: 34.34, label: "Xi’an", lane: "rail" },
  { id: "dui", lon: 6.76, lat: 51.43, label: "Duisburg", lane: "rail" },
  { id: "gz", lon: 113.26, lat: 23.13, label: "Guangzhou", lane: "air" },
  { id: "fra", lon: 8.68, lat: 50.11, label: "Frankfurt", lane: "air" },
  { id: "koe", lon: 6.9603, lat: 50.9375, label: "Köln", strong: true },
];
const OVERVIEW = { lon: 70, lat: 30, dist: 5.1 };

export default function GlobeExperiment() {
  const [mode, setMode] = useState<"v2" | "v1">("v2");
  const [active, setActive] = useState<string | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const c2 = useRef<HTMLCanvasElement>(null);
  const c1 = useRef<HTMLCanvasElement>(null);
  const labels = useRef<Record<string, HTMLSpanElement | null>>({});
  const activeRef = useRef<string | null>(null);
  const g2 = useRef<Globe2 | null>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const still = useRef(false);
  const idle = useRef<gsap.core.Tween | null>(null);

  // V2 globe + intro + interaction
  useEffect(() => {
    const canvas = c2.current!;
    const small = window.matchMedia("(max-width: 820px)").matches;
    still.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const g = createGlobe2(canvas, { lanes: LANES, markers: MARKERS, small, still: still.current });
    g2.current = g;
    const layout = () => {
      const mob = window.matchMedia("(max-width: 820px)").matches;
      g.offset.x = mob ? 0 : 0.95;
      g.offset.y = mob ? 0.42 : -0.04;
      g.zoom.k = mob ? 1.85 : 1;
      g.resize();
    };
    layout();
    window.addEventListener("resize", layout);
    Object.assign(g.view, OVERVIEW);

    const ctx = gsap.context(() => {
      if (still.current) {
        g.reveal.v = 1;
        LANES.forEach((l) => (g.lanes[l.id].progress = 1));
        return;
      }
      const split = SplitText.create("[data-split]", { type: "lines,words", mask: "lines" });
      const tl = gsap.timeline({ defaults: { ease: "expo.out" } });
      tl.fromTo(g.view, { lon: 170, lat: 8, dist: 6.2 }, { ...OVERVIEW, duration: 3.2, ease: "power3.inOut" }, 0)
        .to(g.reveal, { v: 1, duration: 1.8, ease: "power2.out" }, 0)
        .from(split.words, { yPercent: 110, duration: 1.2, stagger: 0.05 }, 0.5)
        .from("[data-fade]", { opacity: 0, y: 18, duration: 1, stagger: 0.08 }, 1.1)
        .to(g.lanes.sea, { progress: 1, duration: 2.4, ease: "power2.inOut" }, 1.6)
        .to(g.lanes.rail, { progress: 1, duration: 2.2, ease: "power2.inOut" }, 2.3)
        .to(g.lanes.air, { progress: 1, duration: 1.8, ease: "power2.inOut" }, 2.7);
    }, wrap);

    // drag with momentum (GSAP InertiaPlugin tracks the velocity)
    const el = wrap.current!;
    InertiaPlugin.track(g.view, "lon,lat");
    let down = false, px = 0, py = 0;
    const resumeLater = () => {
      idle.current?.kill();
      idle.current = gsap.delayedCall(5, () => g.setSpin(true)) as unknown as gsap.core.Tween;
    };
    const onDown = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest("button, a")) return;
      down = true; px = e.clientX; py = e.clientY;
      g.setSpin(false);
      gsap.killTweensOf(g.view);
      el.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!down) return;
      g.view.lon -= (e.clientX - px) * 0.22;
      g.view.lat = gsap.utils.clamp(-60, 60, g.view.lat + (e.clientY - py) * 0.18);
      px = e.clientX; py = e.clientY;
    };
    const onUp = () => {
      if (!down) return;
      down = false;
      if (!still.current)
        gsap.to(g.view, { inertia: { lon: "auto", lat: { velocity: "auto", min: -60, max: 60 } }, duration: { min: 0.4, max: 2.2 } } as unknown as gsap.TweenVars);
      resumeLater();
    };
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);

    // HTML labels follow the globe (crisp text, readable by screen readers)
    const tick = () => {
      const gg = g2.current;
      if (!gg) return;
      for (const m of MARKERS) {
        const node = labels.current[m.id];
        if (!node) continue;
        const p = gg.project(m.lon, m.lat);
        // the destination always; the ports only for the lane in focus
        const shown = m.strong || (activeRef.current !== null && m.lane === activeRef.current);
        node.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0)`;
        node.style.opacity = String(shown ? gsap.utils.clamp(0, 1, (p.front - 0.15) * 4) * gg.reveal.v : 0);
      }
    };
    gsap.ticker.add(tick);

    return () => {
      gsap.ticker.remove(tick);
      window.removeEventListener("resize", layout);
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      InertiaPlugin.untrack(g.view);
      idle.current?.kill();
      ctx.revert();
      g.dispose();
      g2.current = null;
    };
  }, []);

  // V1: the existing renderer, driven by the same view (comparison only)
  useEffect(() => {
    if (mode !== "v1") return;
    let disposed = false;
    let stop = () => {};
    (async () => {
      const { createGlobe } = await import("@/lib/globe/createGlobe");
      if (disposed) return;
      const canvas = c1.current!;
      const g1 = createGlobe(canvas, { hiRes: true });
      const size = () => {
        const r = canvas.getBoundingClientRect();
        g1.setSize(r.width, r.height, Math.min(devicePixelRatio || 1, 2));
      };
      size();
      window.addEventListener("resize", size);
      await g1.ready;
      const tick = () => {
        const v = g2.current?.view ?? OVERVIEW;
        const mob = innerWidth <= 820;
        g1.render({ lon: v.lon, lat: v.lat, dist: v.dist * 1.05, ox: mob ? 0 : 0.2, oy: mob ? -0.15 : 0, reveal: 1, route: 1, env: 0 });
      };
      gsap.ticker.add(tick);
      stop = () => {
        gsap.ticker.remove(tick);
        window.removeEventListener("resize", size);
        g1.dispose();
      };
    })();
    return () => {
      disposed = true;
      stop();
    };
  }, [mode]);

  const pick = (id: string | null) => {
    const g = g2.current;
    if (!g) return;
    setActive(id);
    activeRef.current = id;
    g.setSpin(false);
    idle.current?.kill();
    const lane = LANES.find((l) => l.id === id);
    const d = still.current ? 0 : 1.6;
    gsap.to(g.view, { ...(lane ? lane.view : OVERVIEW), duration: d, ease: "power3.inOut" });
    // desktop: the globe slides towards the centre while a lane is in focus
    if (window.innerWidth > 820)
      gsap.to(g.offset, { x: lane ? 0.62 : 0.95, duration: d, ease: "power3.inOut", onUpdate: () => g.invalidate() });
    LANES.forEach((l) => {
      const on = !id || l.id === id;
      gsap.to(g.lanes[l.id], { opacity: on ? 1 : 0.14, duration: d * 0.5 });
      if (id === l.id && !still.current)
        gsap.fromTo(g.lanes[l.id], { progress: 0 }, { progress: 1, duration: 1.8, ease: "power2.inOut", delay: 0.3 });
    });
  };

  return (
    <div className={s.stage} ref={wrap}>
      <canvas ref={c2} className={s.canvas} hidden={mode !== "v2"} aria-hidden="true" />
      <canvas ref={c1} className={s.canvas} hidden={mode !== "v1"} aria-hidden="true" />
      <div className={s.labels} hidden={mode !== "v2"} aria-hidden="true">
        {MARKERS.map((m) => (
          <span key={m.id} ref={(n) => { labels.current[m.id] = n; }} className={m.strong ? `${s.label} ${s.strong}` : s.label}>
            {m.label}
          </span>
        ))}
      </div>

      <div className={s.text} ref={textRef}>
        <p className={`mono ${s.kicker}`} data-fade>Import · Marken · E-Commerce</p>
        <h1 className={s.h1} data-split>
          Handel <em>ohne</em> Grenzen.
        </h1>
        <p className={s.lead} data-fade>
          Beschaffung, Import, Marken und E-Commerce aus einer Hand. Von Köln aus verbinden wir Hersteller in Asien mit dem europäischen Markt.
        </p>
        <div className={s.ctas} data-fade>
          <a className={s.primary} href="#">Angebot anfragen</a>
          <a className={s.secondary} href="#">Leistungen</a>
        </div>
      </div>

      <div className={s.lanes} data-fade>
        <p className="mono">Typische Handelsrouten</p>
        <div className={s.laneList} role="group" aria-label="Handelsroute auf dem Globus zeigen">
          {LANES.map((l) => (
            <button key={l.id} className={s.lane} aria-pressed={active === l.id} onClick={() => pick(active === l.id ? null : l.id)}>
              <span className={s.swatch} style={{ background: l.color }} />
              <span className={s.laneMode}>{l.mode}</span>
              <span className={s.laneRoute}>{l.route}</span>
              <span className={s.laneTime}>Richtwert {l.time}</span>
            </button>
          ))}
        </div>
        <p className={s.foot}>Transitzeiten sind Richtwerte und hängen von Route, Saison und Abfertigung ab.</p>
      </div>

      <div className={s.toggle} role="group" aria-label="Globus-Version vergleichen">
        <button aria-pressed={mode === "v2"} onClick={() => setMode("v2")}>V2 · neu</button>
        <button aria-pressed={mode === "v1"} onClick={() => setMode("v1")}>V1 · bestehend</button>
      </div>
      <p className={`mono ${s.hint}`} aria-hidden="true">Ziehen zum Drehen</p>
    </div>
  );
}
