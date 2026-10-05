import type { ServicesCopy } from "@/content/i18n/services/types";
import s from "./Services.module.css";

/**
 * Technical drawings for the capability chapters. Decorative: the same
 * information is in the text, so each drawing is aria-hidden. Lines draw on
 * when their figure is revealed ([data-in]); the single red accent is the
 * route. Colours come from the section's tone (--v-ink / --v-line).
 */

const D = ({ d, className }: { d: string; className?: string }) => <path d={d} pathLength={1} className={`${s.draw} ${className ?? ""}`} />;

export function SourcingVisual({ c }: { c: ServicesCopy["sourcing"] }) {
  return (
    <svg viewBox="0 0 520 400" className={s.visual} aria-hidden="true" direction="ltr">
      <defs>
        <pattern id="hatch-a" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" className={s.patLine} />
        </pattern>
        <pattern id="dots-a" width="6" height="6" patternUnits="userSpaceOnUse">
          <circle cx="3" cy="3" r="0.9" className={s.patDot} />
        </pattern>
      </defs>
      {/* specification sheet */}
      <D d="M196 40 H488 V250 H196 Z" />
      <D d="M196 82 H488" className={s.faint} />
      <text x="212" y="68" className={s.vLabel}>{c.spec.toUpperCase()}</text>
      <text x="472" y="68" className={s.vData} textAnchor="end">SPEC-01</text>
      {c.rows.map(([k, v], i) => (
        <g key={k}>
          <text x="212" y={114 + i * 36} className={s.vText}>{k}</text>
          <text x="472" y={114 + i * 36} className={s.vData} textAnchor="end">{v}</text>
          <D d={`M212 ${128 + i * 36} H472`} className={s.faint} />
        </g>
      ))}
      {/* materials */}
      <circle cx="236" cy="318" r="22" className={s.shape} fill="url(#hatch-a)" />
      <circle cx="292" cy="318" r="22" className={s.shape} fill="url(#dots-a)" />
      <circle cx="348" cy="318" r="22" className={`${s.shape} ${s.solid}`} />
      <D d="M236 346 V362 M292 346 V362 M348 346 V362" className={s.faint} />
      <text x="214" y="380" className={s.vData}>M-01</text>
      <text x="270" y="380" className={s.vData}>M-02</text>
      <text x="326" y="380" className={s.vData}>M-03</text>
      {/* origin coordinate: the first node of the route */}
      <D d="M70 290 m-30 0 a30 30 0 1 0 60 0 a30 30 0 1 0 -60 0" />
      <D d="M70 248 V268 M70 312 V332 M28 290 H48 M92 290 H112" className={s.faint} />
      <path d="M62 290 H78 M70 282 V298" className={s.redStroke} />
      <text x="28" y="356" className={s.vLabel}>{c.origin.toUpperCase()}</text>
      <text x="28" y="374" className={s.vData}>00</text>
      <D d="M100 290 C 140 290, 150 160, 196 150" className={s.faint} />
      {/* the route leaves the source */}
      <D d="M100 290 C 136 290, 150 396, 196 396 H520" className={s.red} />
    </svg>
  );
}

export function TradeVisual({ c }: { c: ServicesCopy["trade"] }) {
  const corr = Array.from({ length: 15 }, (_, i) => 54 + i * 15);
  return (
    <svg viewBox="0 0 520 400" className={s.visual} aria-hidden="true" direction="ltr">
      {/* container, isometric */}
      <D d="M40 140 H270 V250 H40 Z" />
      <D d="M40 140 L100 100 H330 L270 140" />
      <D d="M270 140 L330 100 V210 L270 250" />
      <D d={corr.map((x) => `M${x} 146 V244`).join(" ")} className={s.faint} />
      <D d="M288 128 V238 M306 116 V226" className={s.faint} />
      <text x="40" y="282" className={s.vLabel}>{c.container.toUpperCase()}</text>
      <text x="40" y="300" className={s.vData}>C-01</text>
      {/* trade document */}
      <D d="M344 236 H492 L512 256 V392 H344 Z" />
      <D d="M492 236 V256 H512" className={s.faint} />
      <text x="358" y="266" className={s.vLabel}>{c.document.toUpperCase()}</text>
      {c.docRows.map((r, i) => (
        <g key={r}>
          <text x="378" y={300 + i * 26} className={s.vText}>{r}</text>
          <path d={`M359 ${295 + i * 26} l4 4 l7 -9`} className={i === c.docRows.length - 1 ? s.redStroke : s.tick} />
        </g>
      ))}
      {/* trade route into Europe: under the goods, up past the paperwork */}
      <D d="M24 330 H282 C 322 330, 336 300, 337 236 C 338 150, 470 170, 470 74" className={s.red} />
      <circle cx="24" cy="330" r="4" className={s.nodeDot} />
      <D d="M470 60 m-14 0 a14 14 0 1 0 28 0 a14 14 0 1 0 -28 0" />
      <rect x="466" y="56" width="8" height="8" className={s.redFill} />
      <text x="444" y="52" className={s.vLabel} textAnchor="end">{c.market.toUpperCase()}</text>
      <text x="444" y="70" className={s.vData} textAnchor="end">EU</text>
    </svg>
  );
}

export function DevelopmentVisual({ c }: { c: ServicesCopy["development"] }) {
  const xs = [52, 156, 260, 364, 468];
  return (
    <svg viewBox="0 0 520 400" className={s.visual} aria-hidden="true" direction="ltr">
      {/* dimensioned final product, large */}
      <D d="M300 40 H460 V170 H300 Z" />
      <D d="M300 40 L330 18 H490 L460 40 M460 170 L490 148 V18" />
      <rect x="318" y="96" width="34" height="8" className={s.redFill} />
      <D d="M318 116 H430 M318 128 H404" className={s.faint} />
      <D d="M300 190 H460 M300 184 V196 M460 184 V196" className={s.faint} />
      <text x="380" y="210" className={s.vData} textAnchor="middle">160 mm</text>
      <D d="M280 40 V170 M274 40 H286 M274 170 H286" className={s.faint} />
      <text x="266" y="110" className={s.vData} textAnchor="end">130</text>
      {/* the process */}
      <D d={`M${xs[0]} 300 H${xs[4]}`} className={s.faint} />
      <D d={`M${xs[0]} 300 H${xs[4]}`} className={s.red} />
      {/* idea */}
      <D d={`M${xs[0]} 262 m-12 0 a12 12 0 1 0 24 0 a12 12 0 1 0 -24 0`} />
      <circle cx={xs[0]} cy={262} r="3" className={s.nodeDot} />
      {/* specification */}
      <D d={`M${xs[1] - 16} 244 H${xs[1] + 16} V278 H${xs[1] - 16} Z M${xs[1] - 10} 254 H${xs[1] + 10} M${xs[1] - 10} 262 H${xs[1] + 10} M${xs[1] - 10} 270 H${xs[1] + 4}`} />
      {/* sample */}
      <D d={`M${xs[2] - 16} 252 H${xs[2] + 10} V278 H${xs[2] - 16} Z M${xs[2] - 16} 252 L${xs[2] - 8} 244 H${xs[2] + 18} L${xs[2] + 10} 252 M${xs[2] + 10} 278 L${xs[2] + 18} 270 V244`} />
      {/* packaging net */}
      <D d={`M${xs[3] - 20} 254 H${xs[3] + 20} V272 H${xs[3] - 20} Z M${xs[3] - 10} 254 V272 M${xs[3]} 254 V272 M${xs[3] + 10} 254 V272 M${xs[3] - 10} 254 V244 H${xs[3]} V254 M${xs[3]} 272 V282 H${xs[3] + 10} V272`} />
      {/* market-ready */}
      <D d={`M${xs[4] - 14} 248 H${xs[4] + 14} V278 H${xs[4] - 14} Z`} />
      <rect x={xs[4] - 8} y={260} width="16" height="5" className={s.redFill} />
      {xs.map((x, i) => (
        <g key={x}>
          <circle cx={x} cy={300} r={i === 4 ? 5 : 3.5} className={i === 4 ? s.redFill : s.nodeDot} />
          <text x={x} y={330} className={s.vText} textAnchor="middle">{c.process[i]}</text>
          <text x={x} y={348} className={s.vData} textAnchor="middle">{String(i + 1).padStart(2, "0")}</text>
        </g>
      ))}
    </svg>
  );
}

export function BrandVisual({ c }: { c: ServicesCopy["brand"] }) {
  return (
    <svg viewBox="0 0 520 400" className={s.visual} aria-hidden="true" direction="ltr">
      <D d="M260 20 V380 M20 200 H500" className={s.faint} />
      {/* positioning */}
      <text x="24" y="40" className={s.vLabel}>{c.positioning.toUpperCase()}</text>
      <D d="M140 76 V170 M48 123 H232" />
      <text x="140" y="68" className={s.vData} textAnchor="middle">{c.axes[3]}</text>
      <text x="140" y="186" className={s.vData} textAnchor="middle">{c.axes[2]}</text>
      <text x="48" y="140" className={s.vData}>{c.axes[0]}</text>
      <text x="232" y="140" className={s.vData} textAnchor="end">{c.axes[1]}</text>
      <circle cx="180" cy="100" r="6" className={s.redFill} />
      <D d="M180 100 m-14 0 a14 14 0 1 0 28 0 a14 14 0 1 0 -28 0" className={s.faint} />
      {/* typography */}
      <text x="284" y="40" className={s.vLabel}>{c.type.toUpperCase()}</text>
      <text x="284" y="168" className={s.specimen}>Aa</text>
      <text x="436" y="96" className={s.vData}>700</text>
      <text x="436" y="114" className={s.vData}>−0.05</text>
      <D d="M430 126 H490" className={s.faint} />
      {/* palette */}
      <text x="24" y="240" className={s.vLabel}>{c.palette.toUpperCase()}</text>
      <rect x="24" y="262" width="52" height="84" className={s.chipInk} />
      <rect x="84" y="262" width="52" height="84" className={s.chipGraphite} />
      <rect x="144" y="262" width="52" height="84" className={s.chipIvory} />
      <rect x="204" y="262" width="20" height="84" className={s.redFill} />
      {/* packaging front */}
      <text x="284" y="240" className={s.vLabel}>{c.pack.toUpperCase()}</text>
      <D d="M330 260 H450 V372 H330 Z M330 260 L346 248 H466 L450 260 M450 372 L466 360 V248" />
      <D d="M350 296 H430 M362 312 H418" className={s.faint} />
      <circle cx="390" cy="340" r="4" className={s.redFill} />
    </svg>
  );
}

export function DistributionVisual({ c }: { c: ServicesCopy["distribution"] }) {
  const xs = [40, 170, 300, 430];
  const dests = [300, 210, 120];
  return (
    <svg viewBox="0 0 520 400" className={s.visual} aria-hidden="true" direction="ltr">
      <D d={`M${xs[0]} 110 H${xs[3]}`} className={s.faint} />
      <D d={`M${xs[0]} 110 H${xs[3]}`} className={s.red} />
      {xs.map((x, i) => (
        <g key={x}>
          <circle cx={x} cy={110} r={i === 3 ? 6 : 4} className={i === 3 ? s.redFill : s.nodeDot} />
          <text x={x} y={88} className={s.vText} textAnchor={i === 0 ? "start" : i === 3 ? "end" : "middle"}>{c.flow[i]}</text>
          <text x={x} y={62} className={s.vData} textAnchor={i === 0 ? "start" : i === 3 ? "end" : "middle"}>{String(i + 1).padStart(2, "0")}</text>
        </g>
      ))}
      {/* the parcel in motion */}
      <g className={s.parcel}>
        <rect x="-11" y="-11" width="22" height="22" className={s.shape} />
        <path d="M-11 -3 H11" className={s.redStroke} />
      </g>
      {/* destinations */}
      {dests.map((x, i) => (
        <g key={x}>
          <D d={`M${xs[3]} 116 C ${xs[3]} 200, ${x} 220, ${x} 300`} className={i === 0 ? s.red : s.faint} />
          <D d={`M${x} 312 m-12 0 a12 12 0 1 0 24 0 a12 12 0 1 0 -24 0`} />
          <circle cx={x} cy={312} r="3" className={i === 0 ? s.redFill : s.nodeDot} />
          <text x={x} y={350} className={s.vText} textAnchor="middle">{c.destinations[i]}</text>
          <text x={x} y={368} className={s.vData} textAnchor="middle">{`Z-0${i + 1}`}</text>
        </g>
      ))}
    </svg>
  );
}
