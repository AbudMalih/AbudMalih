"use client";

import { useRef, useState } from "react";
import Chapter, { useChapterTimeline } from "@/components/stage/Chapter";
import ChapterTag from "@/components/ui/ChapterTag";
import { CAPABILITIES, OWNED_BRANDS } from "@/content/ecosystem";
import { useI18n } from "@/content/i18n/I18nProvider";
import s from "./Ecosystem.module.css";

/**
 * 08 · LUNA CONNECTS THE ENTIRE COMMERCIAL CHAIN
 * Centre: the Luna "+". Around it the six capabilities in operating order,
 * joined clockwise by one red arc (the chain). The gap at the bottom carries
 * the owned-brand line down to LUVISCENT®.
 * Every tween is an explicit fromTo, so forward and reverse entry resolve to
 * the identical state. No SVG <title>: the accessible name comes from
 * aria-labelledby on visually hidden HTML (no native tooltip).
 */
const R = 270;
const START_DEG = 120; // first capability (lower left), then clockwise
const STEP_DEG = 60;
const deg = (d: number) => (d * Math.PI) / 180;
const pt = (a: number, r = R): [number, number] => [Math.cos(deg(a)) * r, Math.sin(deg(a)) * r];

export default function Ecosystem() {
  return (
    <Chapter id="ecosystem">
      <Content />
    </Chapter>
  );
}

function Content() {
  const { dict, locale, href } = useI18n();
  const t = dict.ecosystem;
  const ar = locale === "ar";
  const scope = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<string | null>(null);

  const caps = CAPABILITIES.map((id, i) => {
    const a = START_DEG + i * STEP_DEG;
    const [x, y] = pt(a);
    const cos = Math.cos(deg(a));
    const sin = Math.sin(deg(a));
    const anchor = cos > 0.3 ? "start" : cos < -0.3 ? "end" : "middle";
    const [lx, ly] = pt(a, R + (Math.abs(cos) > 0.3 ? 44 : 56));
    return { id, i, a, x, y, lx, ly: ly + (sin < -0.3 ? -14 : sin > 0.3 ? 14 : 0), anchor, label: t.capabilities[id] };
  });
  const [ax, ay] = pt(START_DEG);
  const [bx, by] = pt(START_DEG + (CAPABILITIES.length - 1) * STEP_DEG);
  const chainArc = `M ${ax} ${ay} A ${R} ${R} 0 1 1 ${bx} ${by}`;
  const brand = OWNED_BRANDS[0];

  useChapterTimeline(
    scope,
    (tl, q) => {
      // HTML typography: ordinary scrubbed tweens
      tl.fromTo(q("[data-tag]"), { opacity: 0 }, { opacity: 1, duration: 0.04 }, 0)
        .fromTo(q("[data-tag-rule]"), { scaleX: 0 }, { scaleX: 1, duration: 0.06 }, 0)
        .fromTo(q("[data-h] > span > span"), { yPercent: 135 }, { yPercent: 0, duration: 0.07, stagger: 0.025, ease: "power3.out" }, 0.01)
        .fromTo(q("[data-caption]"), { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.05 }, 0.07)
        .fromTo(q("[data-legend]"), { opacity: 0 }, { opacity: 1, duration: 0.06 }, 0.46)
        .to(q("[data-h] > span > span"), { yPercent: -135, duration: 0.07, ease: "power2.in", stagger: 0.02 }, 0.78)
        .to(q("[data-tag], [data-legend], [data-list], [data-caption]"), { opacity: 0, duration: 0.05 }, 0.78);

      // SVG instrument: a pure function of timeline time (direction-independent)
      const el = <T extends Element>(sel: string) => q(sel) as T[];
      const converge = el<SVGElement>("[data-converge]");
      const origin = el<SVGGElement>("[data-origin]")[0];
      const rings = el<SVGElement>("[data-ring]");
      const spokes = el<SVGElement>("[data-spoke]");
      const nodes = el<SVGElement>("[data-node]");
      const chain = el<SVGPathElement>("[data-chain]")[0];
      const brandLink = el<SVGLineElement>("[data-brand-link]")[0];
      const brandEls = el<SVGElement>("[data-brand]");
      const centerLabel = el<SVGElement>("[data-center-label]")[0];
      const pulse = el<SVGCircleElement>("[data-pulse]")[0];
      const span = (CAPABILITIES.length - 1) * STEP_DEG;
      const r = (x: number, a: number, b: number) => Math.min(1, Math.max(0, (x - a) / (b - a)));
      const ease = (x: number) => 1 - Math.pow(1 - x, 3);
      const back = (x: number) => {
        const c1 = 1.70158 * 1.4, c3 = c1 + 1;
        return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
      };

      const render = (p: number) => {
        const conv = Math.pow(r(p, 0.78, 0.91), 3);
        const k = 1 - conv * 0.98;
        converge.forEach((e) => {
          e.setAttribute("transform", `scale(${k.toFixed(4)})`);
          e.style.opacity = (1 - conv).toFixed(3);
        });
        const oIn = r(p, 0.03, 0.11);
        const oScale = (oIn < 1 ? back(oIn) : 1) * (1 - r(p, 0.88, 0.96) * 0.4);
        origin.setAttribute("transform", `scale(${Math.max(0, oScale).toFixed(4)}) rotate(${(-90 * (1 - ease(oIn))).toFixed(2)})`);
        centerLabel.style.opacity = (r(p, 0.08, 0.13) * (1 - conv)).toFixed(3);
        rings.forEach((e) => (e.style.opacity = r(p, 0.08, 0.16).toFixed(3)));
        spokes.forEach((e, i) => (e.style.opacity = r(p, 0.1 + i * 0.015, 0.14 + i * 0.015).toFixed(3)));
        nodes.forEach((e, i) => (e.style.opacity = r(p, 0.13 + i * 0.025, 0.18 + i * 0.025).toFixed(3)));
        chain.style.strokeDashoffset = (1 - r(p, 0.22, 0.42)).toFixed(4);
        brandLink.style.strokeDashoffset = (1 - r(p, 0.38, 0.46)).toFixed(4);
        brandEls.forEach((e) => (e.style.opacity = r(p, 0.44, 0.5).toFixed(3)));
        const u = r(p, 0.42, 0.76);
        const [x, y] = pt(START_DEG + span * u);
        pulse.setAttribute("cx", x.toFixed(1));
        pulse.setAttribute("cy", y.toFixed(1));
        pulse.style.opacity = u > 0.001 && u < 0.999 ? "1" : "0";
      };
      tl.eventCallback("onUpdate", () => render(tl.time()));
      render(0);
    },
    [locale]
  );

  return (
    <div ref={scope} className={s.wrap}>
      <ChapterTag index="08" label={t.tag} className={s.tag} />
      <div className={s.headBlock}>
      <h2 className={`t-headline ${s.h}`} data-h id="eco-title">
        <span className="mask">
          <span>{t.h1}</span>
        </span>
        <span className="mask tone-graphite">
          <span>{t.h2}</span>
        </span>
      </h2>
      <p className={`t-lead ${s.caption}`} data-caption id="eco-desc">
        {t.caption}
      </p>
      </div>

      <svg
        className={`${s.svg} interactive`}
        viewBox="-760 -560 1520 1120"
        direction="ltr"
        role="img"
        aria-labelledby="eco-title"
        aria-describedby="eco-desc eco-list"
      >
        <g data-converge>
          <circle r={R} className={s.ring} data-ring />
          <circle r={R * 0.5} className={s.inner} data-ring />

          {caps.map((c) => (
            <line key={`sp-${c.id}`} x1={0} y1={0} x2={c.x} y2={c.y} className={`${s.spoke} ${active === c.id ? s.spokeOn : ""}`} data-spoke />
          ))}

          {/* the commercial chain: one red arc through all capabilities */}
          <path d={chainArc} className={s.chain} data-chain pathLength={1} strokeDasharray="1 1" />
          <circle r={7} className={s.pulse} data-pulse />

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
              <circle cx={c.x} cy={c.y} r={46} className={s.hit} />
              <circle cx={c.x} cy={c.y} r={9} className={s.dot} />
              <text x={c.lx} y={c.ly} textAnchor={c.anchor as "start" | "end" | "middle"} className={s.label}>
                <tspan x={c.lx} dy="-0.55em" className={s.num}>
                  {String(c.i + 1).padStart(2, "0")}
                </tspan>
                <tspan x={c.lx} dy="1.25em">
                  {ar ? c.label : c.label.toUpperCase()}
                </tspan>
              </text>
              <text x={pt(c.a, R + 36)[0]} y={pt(c.a, R + 36)[1]} textAnchor="middle" dominantBaseline="middle" className={s.numMobile}>
                {String(c.i + 1).padStart(2, "0")}
              </text>
            </g>
          ))}

          {/* owned brand, through the gap in the chain */}
          <line x1={0} y1={0} x2={0} y2={R + 118} className={s.brandLink} data-brand-link pathLength={1} strokeDasharray="1 1" />
          <a href={href(brand.href)} data-brand className={s.brand} data-cursor="link" aria-label={`${brand.name}, ${t.legend.brand}`}>
            <rect x={-6} y={R + 112} width={12} height={12} className={s.brandSq} />
            <image href={brand.logo} x={-140} y={R + 146} width={280} height={280 / brand.logoRatio} preserveAspectRatio="xMidYMid meet" />
            <text y={R + 212} textAnchor="middle" className={s.arcLabel}>
              {ar ? t.ownedBrands : t.ownedBrands.toUpperCase()}
            </text>
          </a>
        </g>

        <g data-origin className={s.origin}>
          <rect x={-26} y={-6} width={52} height={12} />
          <rect x={-6} y={-26} width={12} height={52} />
        </g>
        <text y={64} textAnchor="middle" className={s.originLabel} data-converge data-center-label>
          {ar ? t.center : t.center.toUpperCase()}
        </text>
      </svg>

      <p className={`t-label ${s.legend}`} data-legend>
        <span className={s.lgPlus} /> {t.legend.origin} &nbsp;&nbsp; <span className={s.lgSq} /> {t.legend.capability} &nbsp;&nbsp;{" "}
        <span className={s.lgRed} /> {t.legend.brand}
      </p>

      <ol className={s.list} data-list id="eco-list">
        {caps.map((c) => (
          <li key={c.id} className={active === c.id ? s.listOn : ""}>
            <span className="t-label t-mono">{String(c.i + 1).padStart(2, "0")}</span> {c.label}
          </li>
        ))}
      </ol>
    </div>
  );
}
