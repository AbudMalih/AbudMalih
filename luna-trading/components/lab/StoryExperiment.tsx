"use client";

import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";
import { MotionPathPlugin } from "gsap/MotionPathPlugin";
import s from "./StoryExperiment.module.css";

gsap.registerPlugin(ScrollTrigger, DrawSVGPlugin, MotionPathPlugin);

/* ------------------------------------------------------------------ */
/* isometric helpers (viewBox 1000 × 700)                               */
/* ------------------------------------------------------------------ */
const OX = 470, OY = 380, K = 1.42;
const iso = (x: number, y: number, z: number) =>
  [OX + (x - y) * 0.866 * K, OY + ((x + y) * 0.5 - z) * K] as const;
const poly = (pts: (readonly [number, number])[]) =>
  pts.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(" ");

type BoxProps = {
  x: number; y: number; z: number; w: number; d: number; h: number;
  top: string; left: string; right: string; stroke?: string;
  children?: React.ReactNode; className?: string; id?: string;
};
function IsoBox({ x, y, z, w, d, h, top, left, right, stroke = "#121316", children, className, id }: BoxProps) {
  const T = [iso(x, y, z + h), iso(x + w, y, z + h), iso(x + w, y + d, z + h), iso(x, y + d, z + h)];
  const L = [iso(x, y + d, z), iso(x + w, y + d, z), iso(x + w, y + d, z + h), iso(x, y + d, z + h)];
  const R = [iso(x + w, y, z), iso(x + w, y + d, z), iso(x + w, y + d, z + h), iso(x + w, y, z + h)];
  return (
    <g className={className} id={id}>
      <polygon points={poly(L)} fill={left} stroke={stroke} strokeWidth="1.4" strokeLinejoin="round" />
      <polygon points={poly(R)} fill={right} stroke={stroke} strokeWidth="1.4" strokeLinejoin="round" />
      <polygon points={poly(T)} fill={top} stroke={stroke} strokeWidth="1.4" strokeLinejoin="round" />
      {children}
    </g>
  );
}

/** the product: a carton with the Luna "+" on its face */
function Product({ x = -35, y = -35, z = 0, s: k = 70, className = "" }: { x?: number; y?: number; z?: number; s?: number; className?: string }) {
  const c = iso(x + k * 0.5, y + k, z + k * 0.55);
  return (
    <IsoBox x={x} y={y} z={z} w={k} d={k} h={k} top="#f4eee2" left="#e3dbca" right="#cec5b2" className={className}>
      <path d={`M${c[0] - 9} ${c[1] + 4.5} L${c[0] + 9} ${c[1] - 4.5} M${c[0]} ${c[1] - 10} L${c[0]} ${c[1] + 10}`} stroke="#c90216" strokeWidth="3.2" strokeLinecap="round" />
      <polyline points={poly([iso(x + k * 0.5, y, z + k), iso(x + k * 0.5, y + k, z + k)])} fill="none" stroke="#b8ad97" strokeWidth="5" />
    </IsoBox>
  );
}

const CHAPTERS = [
  { n: "01", stop: "Beschaffung", title: "Globale Beschaffung", text: "Passende Hersteller und Materialien finden, bewerten und koordinieren.", meta: ["Herstelleridentifikation", "Kaufmännische Bewertung", "Muster- und Entwicklungskoordination"] },
  { n: "02", stop: "Import", title: "Von China nach Deutschland.", text: "Internationale Warenströme kaufmännisch steuern und nach Europa führen.", meta: ["Herkunft China", "Ziel Deutschland · EU"] },
  { n: "03", stop: "Transport", title: "Nach Europa.", text: "Vom Hafen bis ins Lager. Import, Zollkoordination und Straßentransport als eine durchgehende Bewegung.", meta: ["Seefracht · Richtwert 30 bis 45 Tage"] },
  { n: "04", stop: "Distribution", title: "Deutschland als Basis. Europa als Markt.", text: "Bestellungen zuverlässig an ihr Ziel bringen.", meta: ["Deutschland", "EU-Distribution", "E-Commerce", "B2B"] },
  { n: "05", stop: "E-Commerce", title: "Vom Produkt zur Plattform.", text: "Grenzenlos verkaufen. Wir entwickeln Produkte und Marken für den digitalen Handel und bringen sie in Onlineshops, auf Marktplätze und direkt zum Kunden.", meta: ["Onlineshops", "Marktplätze", "Endkunden · D2C", "Europäische Märkte"] },
];

/* the sea lane on the abstract chart, east (right) to west (left) */
const LANE = "M860 300 C 830 360, 790 420, 720 430 C 640 440, 600 445, 540 430 C 490 418, 470 380, 440 340 C 410 300, 360 296, 300 300 C 250 304, 205 312, 180 290 C 160 270, 175 220, 215 196 C 235 184, 252 178, 262 186";

const SHELF = [
  [-170, -60], [-110, -60], [-50, -60],
  [-170, -60], [-110, -60], [-50, -60],
] as const;
const NODES = [
  { label: "Onlineshops", x: 830, y: 150 },
  { label: "Marktplätze", x: 860, y: 270 },
  { label: "Endkunden · D2C", x: 860, y: 400 },
  { label: "Europäische Märkte", x: 830, y: 520 },
];

export default function StoryExperiment() {
  const root = useRef<HTMLDivElement>(null);
  const [ch, setCh] = useState(0);
  const tlRef = useRef<gsap.core.Timeline | null>(null);
  const stRef = useRef<ScrollTrigger | null>(null);

  useEffect(() => {
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ctx = gsap.context(() => {
      const q = gsap.utils.selector(root);
      const tl = gsap.timeline({ paused: true, defaults: { ease: "power2.inOut" } });
      tlRef.current = tl;
      gsap.set(q("[data-ring], [data-lane], [data-rack] *, [data-link]"), { drawSVG: "0%" });
      gsap.set(q("[data-map], [data-house], [data-nodes], [data-cont], [data-ship], [data-shelfbox], [data-check], [data-door]"), { autoAlpha: 0 });

      // 01 · sourcing: the product is inspected
      tl.addLabel("c0", 0)
        .to(q("[data-ring]"), { drawSVG: "100%", duration: 0.5 }, 0.05)
        .to(q("[data-check]"), { autoAlpha: 1, y: 0, stagger: 0.12, duration: 0.25 }, 0.25)
        // 02 · import: the container arrives and takes the product
        .addLabel("c1", 1)
        .to(q("[data-check], [data-ring]"), { autoAlpha: 0, duration: 0.2 }, 1)
        .to(q("[data-hero]"), { x: 150, y: 62, scale: 0.6, transformOrigin: "50% 50%", duration: 0.3 }, 1.0)
        .fromTo(q("[data-cont]"), { autoAlpha: 0, x: -420, y: -240 }, { autoAlpha: 1, x: 0, y: 0, duration: 0.45, ease: "power3.out" }, 1.1)
        .to(q("[data-hero]"), { x: 110, y: 40, autoAlpha: 0, duration: 0.22 }, 1.55)
        .fromTo(q("[data-door]"), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.15 }, 1.7)
        // 03 · transport: zoom out to the chart; the container travels the lane
        .addLabel("c2", 2)
        .to(q("[data-world]"), { scale: 0.16, x: 360, y: -60, transformOrigin: "50% 50%", duration: 0.4, ease: "power3.in" }, 2)
        .to(q("[data-world]"), { autoAlpha: 0, duration: 0.1 }, 2.34)
        .to(q("[data-map]"), { autoAlpha: 1, duration: 0.2 }, 2.25)
        .set(q("[data-ship]"), { autoAlpha: 1 }, 2.4)
        .to(q("[data-lane]"), { drawSVG: "100%", duration: 0.55, ease: "none" }, 2.4)
        .to(q("[data-ship]"), { motionPath: { path: q("[data-lane]")[0] as unknown as SVGPathElement, align: q("[data-lane]")[0] as unknown as SVGPathElement, alignOrigin: [0.5, 0.5] }, duration: 0.55, ease: "none" }, 2.4)
        // 04 · distribution: into the warehouse; the goods go onto the shelves
        .addLabel("c3", 3)
        .to(q("[data-map]"), { autoAlpha: 0, duration: 0.2 }, 3)
        .to(q("[data-house]"), { autoAlpha: 1, duration: 0.2 }, 3.05)
        .to(q("[data-rack] *"), { drawSVG: "100%", stagger: 0.02, duration: 0.3 }, 3.1)
        .fromTo(q("[data-shelfbox]"), { autoAlpha: 0, y: -60 }, { autoAlpha: 1, y: 0, stagger: 0.06, duration: 0.25, ease: "back.out(1.6)" }, 3.35)
        // 05 · e-commerce: from the shelves to the channels
        .addLabel("c4", 4)
        .to(q("[data-chips]"), { autoAlpha: 0, duration: 0.15 }, 4)
        .to(q("[data-nodes]"), { autoAlpha: 1, duration: 0.2 }, 4)
        .to(q("[data-link]"), { drawSVG: "100%", stagger: 0.06, duration: 0.35 }, 4.05)
        .to(q("[data-flyer]"), { motionPath: (i: number) => ({ path: q("[data-link]")[i] as unknown as SVGPathElement, align: q("[data-link]")[i] as unknown as SVGPathElement, alignOrigin: [0.5, 0.5] }), autoAlpha: 1, stagger: 0.06, duration: 0.4, ease: "power1.inOut" } as unknown as gsap.TweenVars, 4.15)
        .to({}, { duration: 0.4 });

      const total = tl.duration();
      const marks = [0, 1, 2, 3, 4].map((i) => tl.labels[`c${i}`] / total);
      stRef.current = ScrollTrigger.create({
        trigger: q("[data-scroll]")[0],
        start: "top top",
        end: "bottom bottom",
        scrub: still ? false : 0.7,
        animation: still ? undefined : tl,
        onUpdate: (self) => {
          const p = self.progress;
          let c = 0;
          marks.forEach((m, i) => { if (p >= m + 0.015) c = i; });
          setCh(c);
          // reduced motion: no movement, the scene shows each chapter's end state
          if (still) tl.progress(Math.min(1, (marks[c + 1] ?? 1) - 0.001));
        },
      });
      if (still) tl.progress(marks[1] - 0.001);
    }, root);
    return () => ctx.revert();
  }, []);

  /** chapter buttons: scroll to the chapter (native scroll, smooth) */
  const go = (i: number) => {
    const st = stRef.current, tl = tlRef.current;
    if (!st || !tl) return;
    const p = tl.labels[`c${i}`] / tl.duration() + 0.01;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: st.start + (st.end - st.start) * p, behavior: still ? "auto" : "smooth" });
  };

  const c = CHAPTERS[ch];
  const contA = { x: -150, y: -60, z: 0 };

  return (
    <div ref={root} className={s.root}>
      <header className={s.intro}>
        <p className="mono" style={{ color: "var(--red)" }}>03 · Scroll-Story</p>
        <h1 className={s.title}>Eine Ware. <em>Eine Reise.</em></h1>
        <p className={s.sub}>Von der Quelle bis zum Markt: eine Szene, die sich beim Scrollen verwandelt. Beschaffung, Import, Transport, Distribution, E-Commerce.</p>
        <p className={`mono ${s.down}`} aria-hidden="true">Scrollen ↓</p>
      </header>

      <section className={s.scroll} data-scroll aria-label="Von der Quelle bis zum Markt">
        <div className={s.sticky}>
          {/* text: the current chapter, and all chapters as a list */}
          <div className={s.panel}>
            <ol className={s.rail}>
              {CHAPTERS.map((k, i) => (
                <li key={k.n}>
                  <button className={s.stop} aria-current={i === ch ? "step" : undefined} onClick={() => go(i)}>
                    <span className="mono">{k.n}</span> {k.stop}
                  </button>
                </li>
              ))}
            </ol>
            <div className={s.copy} key={ch} aria-live="polite">
              <h2 className={s.h2}>{c.title}</h2>
              <p className={s.text}>{c.text}</p>
              <ul className={s.meta}>{c.meta.map((m) => <li key={m}>{m}</li>)}</ul>
            </div>
          </div>

          <svg className={s.stage} viewBox="0 0 1000 700" aria-hidden="true">
            {/* ground grid */}
            <g opacity=".5">
              {Array.from({ length: 11 }, (_, i) => {
                const a = iso(-300 + i * 60, -300, 0), b = iso(-300 + i * 60, 300, 0);
                const c2 = iso(-300, -300 + i * 60, 0), d = iso(300, -300 + i * 60, 0);
                return (
                  <g key={i} stroke="#d9d2c4" strokeWidth="1">
                    <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />
                    <line x1={c2[0]} y1={c2[1]} x2={d[0]} y2={d[1]} />
                  </g>
                );
              })}
            </g>

            {/* the iso world: product, inspection, container */}
            <g data-world>
              <ellipse data-ring cx={iso(0, 0, 0)[0]} cy={iso(0, 0, 0)[1] - 6} rx="150" ry="82" fill="none" stroke="#c90216" strokeWidth="1.6" strokeDasharray="4 7" />
              {CHAPTERS[0].meta.map((m, i) => {
                const [x, y] = [[680, 250], [700, 330], [670, 410]][i];
                return (
                  <g key={m} data-check transform={`translate(${x} ${y})`}>
                    <circle r="11" fill="#c90216" />
                    <path d="M-5 0l3.5 3.5L5.5 -4" stroke="#fff" strokeWidth="2.2" fill="none" />
                    <text x="22" y="5" className={s.svgLabel}>{m}</text>
                  </g>
                );
              })}
              <g data-cont>
                <IsoBox {...contA} w={300} d={120} h={120} top="#d61a2a" left="#c90216" right="#9b0011">
                  {Array.from({ length: 14 }, (_, i) => {
                    const a = iso(contA.x + 10 + i * 20, contA.y + 120, 8), b = iso(contA.x + 10 + i * 20, contA.y + 120, 112);
                    return <line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#8f0010" strokeWidth="1.6" />;
                  })}
                </IsoBox>
              </g>
              <g data-hero>
                <Product />
              </g>
              <g data-door>
                <polygon
                  points={poly([iso(contA.x + 300, contA.y, 0), iso(contA.x + 300, contA.y + 120, 0), iso(contA.x + 300, contA.y + 120, 120), iso(contA.x + 300, contA.y, 120)])}
                  fill="#b10014" stroke="#121316" strokeWidth="1.4"
                />
              </g>
            </g>

            {/* the chart: an abstract sea lane from China to Germany */}
            <g data-map>
              <path d={LANE} fill="none" stroke="#d9d2c4" strokeWidth="2" strokeDasharray="2 8" strokeLinecap="round" />
              <path data-lane d={LANE} fill="none" stroke="#c90216" strokeWidth="3" strokeLinecap="round" />
              {[["Shanghai", 860, 300], ["Hamburg", 262, 186], ["Köln", 286, 214]].map(([n, x, y]) => (
                <g key={n as string} transform={`translate(${x} ${y})`}>
                  <circle r={n === "Köln" ? 7 : 5.5} fill={n === "Köln" ? "#c90216" : "#f5f2eb"} stroke="#121316" strokeWidth="1.6" />
                  <text x={n === "Shanghai" ? 14 : n === "Köln" ? 14 : -14} y={n === "Hamburg" ? -10 : 5} textAnchor={n === "Hamburg" ? "end" : "start"} className={s.svgLabel}>{n as string}</text>
                </g>
              ))}
              <text x="560" y="480" className={s.svgSmall}>Seefracht · Richtwert 30 bis 45 Tage</text>
              <g data-ship>
                <rect x="-16" y="-8" width="32" height="16" rx="2" fill="#c90216" stroke="#121316" strokeWidth="1.4" />
              </g>
            </g>

            {/* the warehouse: racks and shelved goods */}
            <g data-house>
              <g data-rack fill="none" stroke="#121316" strokeWidth="1.5" strokeLinecap="round">
                {[0, 1].map((lvl) =>
                  [0, 1].map((side) => {
                    const z = lvl * 110;
                    const a = iso(-200, -100 + side * 0, z), b = iso(40, -100, z);
                    return <line key={`${lvl}-${side}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />;
                  }),
                )}
                {[-200, -80, 40].map((x) => {
                  const a = iso(x, -100, 0), b = iso(x, -100, 230);
                  return <line key={x} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />;
                })}
                {(() => {
                  const a = iso(-200, -100, 230), b = iso(40, -100, 230);
                  return <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />;
                })()}
              </g>
              {SHELF.map(([x, y], i) => (
                <g key={i} data-shelfbox>
                  <Product x={x} y={y - 40} z={i < 3 ? 2 : 112} s={52} />
                </g>
              ))}
              <g data-chips>
              {CHAPTERS[3].meta.map((m, i) => (
                <g key={m} transform={`translate(${700} ${200 + i * 62})`}>
                  <rect x="0" y="-18" width={m.length * 9.2 + 36} height="36" rx="18" fill="#fff" stroke="#121316" strokeWidth="1.2" />
                  <text x="18" y="5" className={s.svgLabel}>{m}</text>
                </g>
              ))}
              </g>
            </g>

            {/* channels */}
            <g data-nodes>
              {NODES.map((n, i) => {
                const from = iso(SHELF[i][0] + 26, SHELF[i][1] - 14, i < 3 ? 60 : 170);
                return (
                  <g key={n.label}>
                    <path data-link d={`M${from[0]} ${from[1]} C ${from[0] + 160} ${from[1]}, ${n.x - 220} ${n.y}, ${n.x - 20} ${n.y}`} fill="none" stroke="#c90216" strokeWidth="1.8" />
                    <g transform={`translate(${n.x} ${n.y})`}>
                      <rect x="-18" y="-20" width={n.label.length * 9.6 + 40} height="40" rx="20" fill="#121316" />
                      <text x="2" y="5" className={s.svgLabelInv}>{n.label}</text>
                    </g>
                  </g>
                );
              })}
              {NODES.map((n) => (
                <g key={n.label} data-flyer opacity="0">
                  <rect x="-9" y="-9" width="18" height="18" rx="2" fill="#f4eee2" stroke="#121316" strokeWidth="1.4" />
                  <path d="M-4 0h8M0 -4v8" stroke="#c90216" strokeWidth="2" />
                </g>
              ))}
            </g>
          </svg>
        </div>
      </section>

      <footer className={s.outro}>
        <p className={s.sub}>Ende der Reise. Die Szene funktioniert vor- und rückwärts, jede Station ist per Klick erreichbar.</p>
      </footer>
    </div>
  );
}
