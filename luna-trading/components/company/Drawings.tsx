import s from "./Company.module.css";

/**
 * Architectural drawings for the company page. Decorative (aria-hidden on
 * the figure); lines draw on when the figure is revealed ([data-in]).
 * Strokes come from the section tone; red is used only at intersections.
 */

const D = ({ d, className, style }: { d: string; className?: string; style?: React.CSSProperties }) => (
  <path d={d} pathLength={1} className={`${s.draw} ${className ?? ""}`} style={style} />
);

/**
 * Five stacked planes (trade, product, brand, e-commerce, distribution) seen
 * in axonometry, pierced by one vertical axis. Where the axis meets the top
 * plane sits the red +: the point where the disciplines intersect.
 */
export function HeroStructure({ layers, base }: { layers: string[]; base: string }) {
  const cx = 580;
  const a = 330; // half width
  const b = 112; // half depth
  const top = 150;
  const gap = 78;
  return (
    <svg viewBox="0 0 1000 720" className={s.heroSvg} direction="ltr">
      <defs>
        <linearGradient id="co-plane" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.62" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0.08" />
        </linearGradient>
      </defs>
      {/* survey grid on the ground */}
      <g className={s.grid}>
        {Array.from({ length: 9 }, (_, i) => (
          <line key={`g${i}`} x1={cx - a + i * (a / 4)} y1={top + 4 * gap + b} x2={cx + i * (a / 4)} y2={top + 4 * gap} />
        ))}
      </g>
      {layers.map((l, i) => {
        const cy = top + i * gap;
        const pts = `${cx - a},${cy} ${cx},${cy - b} ${cx + a},${cy} ${cx},${cy + b}`;
        return (
          <g key={l} className={s.plane} style={{ ["--i" as string]: i, ["--z" as string]: i - 2 }}>
            <polygon points={pts} fill="url(#co-plane)" className={s.planeFill} />
            <D d={`M${cx - a} ${cy} L${cx} ${cy - b} L${cx + a} ${cy} L${cx} ${cy + b} Z`} style={{ transitionDelay: `${0.25 + i * 0.16}s` }} />
            <D d={`M${cx - a} ${cy} L${cx - a} ${cy + 6} L${cx} ${cy + b + 6} L${cx + a} ${cy + 6} L${cx + a} ${cy}`} className={s.faint} style={{ transitionDelay: `${0.35 + i * 0.16}s` }} />
            <line x1={cx - a - 18} y1={cy} x2={cx - a - 64} y2={cy} className={s.leader} />
            <text x={cx - a - 72} y={cy + 4} className={s.planeLabel} textAnchor="end">
              {l.toUpperCase()}
            </text>
            <text x={cx + a + 18} y={cy + 4} className={s.planeData}>
              {`L-0${i + 1}`}
            </text>
            {/* where the axis passes through the plane */}
            <circle cx={cx} cy={cy} r={i === 0 ? 0 : 3.2} className={s.pierce} />
          </g>
        );
      })}
      {/* the axis */}
      <D d={`M${cx} ${top - 120} V${top + 4 * gap + 34}`} className={s.axis} />
      <D d={`M${cx} ${top + 4 * gap + 34} V${top + 4 * gap + 150}`} className={s.axisFaint} />
      {/* the red + at the top intersection */}
      <g className={s.heroPlus}>
        <rect x={cx - 20} y={top - 2.5} width="40" height="5" />
        <rect x={cx - 2.5} y={top - 20} width="5" height="40" />
      </g>
      {/* origin */}
      <text x={cx + 14} y={top + 4 * gap + 150} className={s.planeData}>
        50.94° N · 6.96° E
      </text>
      <text x={cx + 14} y={top + 4 * gap + 132} className={s.planeLabel}>
        {base.toUpperCase()}
      </text>
    </svg>
  );
}

/** Physical world: product, packaging, container, movement, distribution. */
export function PhysicalIcon({ i }: { i: number }) {
  const paths = [
    // product: a dimensioned body
    ["M18 16 H46 V56 H18 Z", "M24 24 H40", "M12 16 V56 M10 16 H14 M10 56 H14"],
    // packaging: a box, opened flaps
    ["M14 30 L32 22 L50 30 L32 38 Z", "M14 30 V50 L32 58 L50 50 V30", "M32 38 V58", "M14 30 L8 22 M50 30 L56 22"],
    // container: corrugated box
    ["M8 22 H56 V52 H8 Z", "M16 26 V48 M24 26 V48 M32 26 V48 M40 26 V48 M48 26 V48"],
    // movement: a route with an arrow
    ["M8 44 C 22 44, 26 20, 40 20 H54", "M48 14 L56 20 L48 26", "M8 50 H20"],
    // distribution: one node branching to three
    ["M10 32 H24", "M24 32 L52 16 M24 32 H52 M24 32 L52 48", "M24 32 m-3 0 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0"],
  ][i];
  return (
    <svg viewBox="0 0 64 64" className={s.icon} aria-hidden="true">
      {paths.map((d) => (
        <D key={d} d={d} />
      ))}
    </svg>
  );
}

/** Digital world: online store, marketplace, data, customer, commerce. */
export function DigitalIcon({ i }: { i: number }) {
  const paths = [
    // online store: a window with a storefront
    ["M8 14 H56 V50 H8 Z", "M8 22 H56", "M18 32 H46 V44 H18 Z"],
    // marketplace: a grid of listings
    ["M8 12 H28 V30 H8 Z", "M36 12 H56 V30 H36 Z", "M8 36 H28 V54 H8 Z", "M36 36 H56 V54 H36 Z"],
    // data: bars on an axis
    ["M10 54 H56", "M16 54 V36 M26 54 V24 M36 54 V30 M46 54 V14"],
    // customer
    ["M32 26 m-9 0 a9 9 0 1 0 18 0 a9 9 0 1 0 -18 0", "M14 56 C 16 42, 48 42, 50 56"],
    // commerce: a basket
    ["M10 22 H54 L48 48 H16 Z", "M22 22 L28 10 M42 22 L36 10", "M24 30 V40 M32 30 V40 M40 30 V40"],
  ][i];
  return (
    <svg viewBox="0 0 64 64" className={s.icon} aria-hidden="true">
      {paths.map((d) => (
        <D key={d} d={d} />
      ))}
    </svg>
  );
}

/** Cologne as the origin of three scale rings: base, market, sourcing. No map, no invented locations. */
export function BaseRings({ rings }: { rings: { name: string; note: string }[] }) {
  const c = 300;
  const radii = [62, 140, 222];
  return (
    <svg viewBox="0 0 600 600" className={s.ringsSvg} direction="ltr">
      {/* meridian and parallel through Cologne */}
      <D d={`M${c} 20 V580`} className={s.faint} />
      <D d={`M20 ${c} H580`} className={s.faint} />
      {radii.map((r, i) => (
        <g key={r}>
          <D
            d={`M${c} ${c} m-${r} 0 a${r} ${r} 0 1 0 ${2 * r} 0 a${r} ${r} 0 1 0 -${2 * r} 0`}
            className={i === 0 ? s.ringInner : s.ring}
            style={{ transitionDelay: `${0.2 + i * 0.3}s` }}
          />
          <line x1={c + r * 0.707} y1={c - r * 0.707} x2={c + r * 0.707 + 18} y2={c - r * 0.707 - 18} className={s.leader} />
          <text x={c + r * 0.707 + 24} y={c - r * 0.707 - 22} className={s.ringName}>
            {rings[i].name.toUpperCase()}
          </text>
          <text x={c + r * 0.707 + 24} y={c - r * 0.707 - 6} className={s.planeData}>
            {rings[i].note.toUpperCase()}
          </text>
        </g>
      ))}
      {/* scale ticks on the parallel */}
      {Array.from({ length: 23 }, (_, k) => 20 + k * 25).map((x) => (
        <line key={x} x1={x} y1={c - 4} x2={x} y2={c + 4} className={s.tick} />
      ))}
      <g className={s.heroPlus}>
        <rect x={c - 16} y={c - 2} width="32" height="4" />
        <rect x={c - 2} y={c - 16} width="4" height="32" />
      </g>
      <text x={c + 76} y={c + 30} className={s.planeData}>
        50.94° N
      </text>
      <text x={c + 76} y={c + 46} className={s.planeData}>
        6.96° E
      </text>
    </svg>
  );
}
