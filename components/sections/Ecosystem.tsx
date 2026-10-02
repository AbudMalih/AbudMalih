"use client";

import { useRef, useState } from "react";
import Chapter, { useChapterTimeline } from "@/components/stage/Chapter";
import ChapterTag from "@/components/ui/ChapterTag";
import { CAPABILITIES, OWNED_BRANDS } from "@/content/ecosystem";
import s from "./Ecosystem.module.css";

/**
 * 07 — THE LUNA INSTRUMENT
 * A precision dial instead of an org chart: the red "+" is the origin;
 * capabilities sit on the measured ring; owned brands are bound to the
 * origin by red lines on an outer arc. Fully data-driven — adding a
 * capability or a brand re-lays the instrument.
 */
const R = 300;
const BRAND_R = 410;
const deg = (d: number) => (d * Math.PI) / 180;

function layoutCapabilities() {
  const n = CAPABILITIES.length;
  // distribute around the ring, keeping the bottom (owned brands) and top clear
  return CAPABILITIES.map((c, i) => {
    const a = -60 + (i * 360) / n;
    const x = Math.cos(deg(a)) * R;
    const y = Math.sin(deg(a)) * R;
    const cos = Math.cos(deg(a));
    const anchor = cos > 0.25 ? "start" : cos < -0.25 ? "end" : "middle";
    const lx = Math.cos(deg(a)) * (R + 56);
    const ly = Math.sin(deg(a)) * (R + 56);
    return { ...c, a, x, y, lx, ly, anchor, i };
  });
}

function layoutBrands() {
  const n = OWNED_BRANDS.length;
  const span = Math.min(60, 26 * n);
  return OWNED_BRANDS.map((b, i) => {
    const a = 90 + (n === 1 ? 0 : -span / 2 + (i * span) / (n - 1));
    return { ...b, a, x: Math.cos(deg(a)) * BRAND_R, y: Math.sin(deg(a)) * BRAND_R };
  });
}

export default function Ecosystem() {
  return (
    <Chapter id="ecosystem" title="One company. Multiple markets.">
      <Content />
    </Chapter>
  );
}

function Content() {
  const scope = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<string | null>(null);
  const caps = layoutCapabilities();
  const brands = layoutBrands();
  const ticks = Array.from({ length: 120 }, (_, i) => i * 3);

  useChapterTimeline(scope, (tl, q) => {
    tl.fromTo(q("[data-tag]"), { opacity: 0 }, { opacity: 1, duration: 0.04 }, 0.03)
      .fromTo(q("[data-tag-rule]"), { scaleX: 0 }, { scaleX: 1, duration: 0.06 }, 0.03)
      .fromTo(q("[data-h] > span > span"), { yPercent: 110 }, { yPercent: 0, duration: 0.08, stagger: 0.03, ease: "power3.out" }, 0.05)
      .fromTo(q("[data-origin]"), { attr: { transform: "scale(0) rotate(-90)" } }, { attr: { transform: "scale(1) rotate(0)" }, duration: 0.08, ease: "back.out(2)" }, 0.1)
      .fromTo(q("[data-ring]"), { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.2, ease: "power2.inOut" }, 0.12)
      .fromTo(q("[data-ticks]"), { opacity: 0, attr: { transform: "rotate(-30)" } }, { opacity: 1, attr: { transform: "rotate(0)" }, duration: 0.24, ease: "power2.out" }, 0.14)
      .fromTo(q("[data-spoke]"), { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.07, stagger: 0.025 }, 0.26)
      .fromTo(q("[data-node]"), { opacity: 0 }, { opacity: 1, duration: 0.05, stagger: 0.025 }, 0.3)
      .fromTo(q("[data-brand-arc]"), { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.1 }, 0.46)
      .fromTo(q("[data-brand-link]"), { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.08 }, 0.48)
      .fromTo(q("[data-brand]"), { opacity: 0 }, { opacity: 1, duration: 0.06 }, 0.54)
      .fromTo(q("[data-legend]"), { opacity: 0 }, { opacity: 1, duration: 0.06 }, 0.56)
      .to(q("[data-ticks]"), { attr: { transform: "rotate(12)" }, duration: 0.4, ease: "none" }, 0.38)
      // converge into the origin
      .fromTo(q("[data-converge]"), { attr: { transform: "scale(1)" } }, { attr: { transform: "scale(0.02)" }, opacity: 0, duration: 0.14, ease: "power3.in", immediateRender: false }, 0.8)
      .to(q("[data-h] > span > span"), { yPercent: -110, duration: 0.08, ease: "power2.in", stagger: 0.02 }, 0.8)
      .to(q("[data-tag], [data-legend], [data-list]"), { opacity: 0, duration: 0.05 }, 0.8)
      .to(q("[data-origin]"), { attr: { transform: "scale(0.55) rotate(0)" }, duration: 0.1 }, 0.88);
  });

  return (
    <div ref={scope} className={s.wrap}>
      <ChapterTag index="07" label="Ecosystem" className={s.tag} />
      <h2 className={`t-headline ${s.h}`} data-h>
        <span className="mask">
          <span>One company.</span>
        </span>
        <span className="mask tone-graphite">
          <span>Multiple markets.</span>
        </span>
      </h2>

      <svg className={`${s.svg} interactive`} viewBox="-760 -540 1520 1080" role="img" aria-labelledby="eco-title eco-desc">
        <title id="eco-title">Luna Trading ecosystem</title>
        <desc id="eco-desc">
          Luna Trading at the centre, connected to six capabilities: {CAPABILITIES.map((c) => c.label).join(", ")}; and to its owned
          brands: {OWNED_BRANDS.map((b) => b.name).join(", ")}.
        </desc>

        <g data-converge>
          <g data-ticks className={s.ticks}>
            {ticks.map((t) => {
              const major = t % 30 === 0;
              const r0 = R + 8, r1 = R + (major ? 26 : 14);
              return (
                <line
                  key={t}
                  x1={Math.cos(deg(t)) * r0}
                  y1={Math.sin(deg(t)) * r0}
                  x2={Math.cos(deg(t)) * r1}
                  y2={Math.sin(deg(t)) * r1}
                  className={major ? s.major : undefined}
                />
              );
            })}
          </g>
          <circle r={R} className={s.ring} data-ring pathLength={1} strokeDasharray="1 1" />
          <circle r={R * 0.42} className={s.inner} />

          {caps.map((c) => (
            <line
              key={`sp-${c.id}`}
              x1={0}
              y1={0}
              x2={c.x}
              y2={c.y}
              className={`${s.spoke} ${active === c.id ? s.spokeOn : ""}`}
              data-spoke
              pathLength={1}
              strokeDasharray="1 1"
            />
          ))}

          {caps.map((c) => (
            <g
              key={c.id}
              data-node
              className={`${s.node} ${active && active !== c.id ? s.dim : ""} ${active === c.id ? s.on : ""}`}
              tabIndex={0}
              role="button"
              aria-label={c.label}
              onPointerEnter={() => setActive(c.id)}
              onPointerLeave={() => setActive(null)}
              onFocus={() => setActive(c.id)}
              onBlur={() => setActive(null)}
              data-cursor="link"
            >
              <circle cx={c.x} cy={c.y} r={34} className={s.hit} />
              <rect x={c.x - 5} y={c.y - 5} width={10} height={10} className={s.sq} />
              <line x1={Math.cos(deg(c.a)) * (R + 10)} y1={Math.sin(deg(c.a)) * (R + 10)} x2={Math.cos(deg(c.a)) * (R + 42)} y2={Math.sin(deg(c.a)) * (R + 42)} className={s.leader} />
              <text x={Math.cos(deg(c.a)) * (R + 44)} y={Math.sin(deg(c.a)) * (R + 44)} textAnchor="middle" dominantBaseline="middle" className={s.numMobile}>
                {String(c.i + 1).padStart(2, "0")}
              </text>
              <text x={c.lx} y={c.ly} textAnchor={c.anchor as "start" | "end" | "middle"} dominantBaseline="middle" className={s.label}>
                <tspan className={s.num}>{String(c.i + 1).padStart(2, "0")}&#8194;</tspan>
                {c.label.toUpperCase()}
              </text>
            </g>
          ))}

          {/* owned brands */}
          <path
            d={`M ${Math.cos(deg(62)) * BRAND_R} ${Math.sin(deg(62)) * BRAND_R} A ${BRAND_R} ${BRAND_R} 0 0 1 ${Math.cos(deg(118)) * BRAND_R} ${Math.sin(deg(118)) * BRAND_R}`}
            className={s.brandArc}
            data-brand-arc
            pathLength={1}
            strokeDasharray="1 1"
          />
          <text x={Math.cos(deg(118)) * BRAND_R - 14} y={Math.sin(deg(118)) * BRAND_R} textAnchor="end" dominantBaseline="middle" className={s.arcLabel} data-brand>
            OWNED BRANDS
          </text>
          {brands.map((b) => (
            <g key={b.id}>
              <line x1={0} y1={0} x2={b.x} y2={b.y} className={s.brandLink} data-brand-link pathLength={1} strokeDasharray="1 1" />
              <a href={b.href} data-brand className={s.brand} data-cursor="link" aria-label={`${b.name} — owned brand`}>
                <rect x={b.x - 5} y={b.y - 5} width={10} height={10} className={s.brandSq} />
                <image href={b.logo} x={b.x - 120} y={b.y + 26} width={240} height={240 / b.logoRatio} preserveAspectRatio="xMidYMid meet" />
              </a>
            </g>
          ))}
        </g>

        {/* the origin: the Luna "+" */}
        <g data-origin className={s.origin}>
          <rect x={-18} y={-4} width={36} height={8} />
          <rect x={-4} y={-18} width={8} height={36} />
        </g>
        <text y={44} textAnchor="middle" className={s.originLabel} data-converge>
          LUNA TRADING
        </text>
      </svg>

      <p className={`t-label ${s.legend}`} data-legend>
        <span className={s.lgPlus} /> Origin &nbsp;&nbsp; <span className={s.lgSq} /> Capability &nbsp;&nbsp; <span className={s.lgRed} /> Owned brand
      </p>

      <ol className={s.list} data-list>
        {CAPABILITIES.map((c, i) => (
          <li key={c.id} className={active === c.id ? s.listOn : ""}>
            <span className="t-label t-mono">{String(i + 1).padStart(2, "0")}</span> {c.label}
          </li>
        ))}
      </ol>
    </div>
  );
}
