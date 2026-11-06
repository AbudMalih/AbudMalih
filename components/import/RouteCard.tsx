"use client";

import { useEffect, useState } from "react";
import type { ImportCopy } from "@/content/importPage";
import s from "@/components/kit/Kit.module.css";

/** The live route: a container travels the Shenzhen → Hamburg sea lane (dotted rail to Duisburg). */
const SEA = "M548 118 C 520 150, 470 178, 420 182 C 360 186, 330 170, 300 150 C 270 128, 250 112, 228 104 C 200 94, 170 88, 150 74 C 132 62, 112 52, 86 50";
const RAIL = "M520 92 C 440 62, 300 58, 112 76";

export default function RouteCard({ t }: { t: ImportCopy }) {
  const [moving, setMoving] = useState(false);
  useEffect(() => {
    const still = document.documentElement.classList.contains("static") || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setMoving(!still);
  }, []);
  return (
    <figure className={s.routeCard} data-reveal style={{ ["--d" as string]: "200ms" }}>
      <svg viewBox="0 0 600 240" className={s.routeSvg} aria-hidden="true">
        <defs>
          <linearGradient id="imp-sea" x1="1" x2="0">
            <stop offset="0" stopColor="#ff3b4e" />
            <stop offset="1" stopColor="#c90216" />
          </linearGradient>
        </defs>
        {/* graticule */}
        {[40, 80, 120, 160, 200].map((y) => (
          <line key={y} x1="20" x2="580" y1={y} y2={y} className={s.grid} />
        ))}
        {[80, 160, 240, 320, 400, 480].map((x) => (
          <line key={x} y1="16" y2="224" x1={x} x2={x} className={s.grid} />
        ))}
        <path d={RAIL} className={s.rail} />
        <path d={SEA} className={s.seaBase} />
        <path d={SEA} className={s.sea} stroke="url(#imp-sea)" />
        {/* ports */}
        {[
          [548, 118, "Shenzhen"],
          [522, 92, "Shanghai"],
          [228, 104, "Suez"],
          [86, 50, "Hamburg"],
        ].map(([x, y, n]) => (
          <g key={n as string}>
            <circle cx={x as number} cy={y as number} r="4.5" className={s.port} />
            <text x={(x as number) + (n === "Hamburg" ? -8 : 8)} y={(y as number) - 10} className={s.portName} textAnchor={n === "Hamburg" ? "start" : "middle"}>
              {n}
            </text>
          </g>
        ))}
        <circle cx="112" cy="76" r="3" className={s.portSoft} />
        <text x="112" y="96" className={s.portNameSoft} textAnchor="middle">Duisburg</text>
        {/* the container */}
        {moving && (
          <g>
            <rect x="-9" y="-5" width="18" height="10" rx="1.5" className={s.box} />
            <line x1="-3" x2="-3" y1="-5" y2="5" className={s.boxLine} />
            <line x1="3" x2="3" y1="-5" y2="5" className={s.boxLine} />
            <animateMotion dur="14s" repeatCount="indefinite" rotate="auto-reverse" path={SEA} keyPoints="0;1" keyTimes="0;1" calcMode="linear" />
          </g>
        )}
      </svg>
      <figcaption className={s.routeCap}>
        <span className={s.live}>
          <i />
          {t.routeLabel}
        </span>
        <span dir="ltr">Shenzhen → Hamburg</span>
        <span className={s.capNote}>{t.routeNote}</span>
      </figcaption>
    </figure>
  );
}
