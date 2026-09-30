import { TRUCK } from "./geometry";

/**
 * JARBOU box truck (LKW), side view, facing right.
 * Local origin: rear end of the vehicle at ground level (y = 0 is the road).
 *
 * ASSET NOTE: This is a vector illustration, not a photograph of a real
 * JARBOU vehicle. To use an approved vehicle render instead, pass `asset`
 * (a transparent PNG/SVG side view, ~520 units long). The wheels, lights and
 * beam stay animatable because they are separate groups.
 */
export type TruckAsset = { href: string; width: number; height: number };

const R = TRUCK.wheelR;

function Wheel({ cx, id }: { cx: number; id: string }) {
  return (
    <g>
      <circle cx={cx} cy={-R} r={R} fill="#0a0b0c" />
      <circle cx={cx} cy={-R} r={R - 5} fill="none" stroke="#1d2024" strokeWidth="3" />
      <g data-wheel={id} transform={`rotate(0 ${cx} ${-R})`}>
        <circle cx={cx} cy={-R} r={21} fill="#8a9098" />
        <circle cx={cx} cy={-R} r={17} fill="#6d737b" />
        {[0, 60, 120, 180, 240, 300].map((a) => (
          <rect key={a} x={cx - 2} y={-R - 16} width={4} height={9} rx={1} fill="#2c3035" transform={`rotate(${a} ${cx} ${-R})`} />
        ))}
        <circle cx={cx} cy={-R} r={6} fill="#2c3035" />
      </g>
    </g>
  );
}

export function Truck({ asset }: { asset?: TruckAsset }) {
  return (
    <g>
      {/* Headlight beam – opacity driven by the timeline. */}
      <polygon data-beam points="510,-98 980,-10 980,-170" fill="url(#beam)" opacity="0" />
      <ellipse cx={TRUCK.length / 2} cy={2} rx={280} ry={9} fill="#000" opacity="0.55" />

      {asset ? (
        <image href={asset.href} x={0} y={-asset.height} width={asset.width} height={asset.height} />
      ) : (
        <>
          {/* Chassis */}
          <rect x={16} y={-86} width={494} height={20} fill="#0d0e10" />
          {/* Box body */}
          <rect x={0} y={-292} width={362} height={206} fill="#edece8" />
          <rect x={0} y={-292} width={362} height={6} fill="#f7f6f3" />
          <rect x={0} y={-94} width={362} height={8} fill="#c9c8c3" />
          {[60, 120, 180, 240, 300].map((x) => (
            <line key={x} x1={x} y1={-286} x2={x} y2={-94} stroke="#dddcd6" strokeWidth={1.5} />
          ))}
          <rect x={0} y={-292} width={5} height={206} fill="#d4d3ce" />
          {/* Brand */}
          <image href="/brand/jarbou-logo.svg" x={46} y={-232} width={270} height={75} />
          {/* Rear under-run guard + mud flap */}
          <rect x={8} y={-66} width={40} height={8} fill="#1a1c1f" />
          <rect x={196} y={-66} width={8} height={40} fill="#15171a" />
          {/* Rear light */}
          <rect x={-2} y={-116} width={6} height={18} fill="#b0060b" />
          {/* Cab */}
          <path d="M368 -60 L368 -250 Q368 -256 374 -256 L446 -256 Q454 -256 458 -249 L500 -178 Q504 -171 505 -163 L512 -76 L516 -60 Z" fill="#1c1f23" />
          <path d="M374 -250 L446 -250 L452 -244 L374 -244 Z" fill="#2b2f35" />
          {/* Side window */}
          <path d="M386 -236 L444 -236 L480 -180 L386 -180 Z" fill="#0b0d10" />
          <path d="M404 -236 L420 -236 L394 -180 L386 -180 L386 -200 Z" fill="#ffffff" opacity="0.06" />
          {/* Door */}
          <path d="M382 -174 L486 -174 L490 -84 L382 -84 Z" fill="none" stroke="#2e3238" strokeWidth={1.5} />
          <rect x={396} y={-162} width={16} height={3} fill="#3a3f45" />
          {/* Cab brand accent – the two slashes */}
          <path d="M452 -120 H462 L452 -100 H442 Z M466 -120 H476 L466 -100 H456 Z" fill="#f0080f" />
          {/* Mirror */}
          <path d="M498 -214 L512 -214 L512 -186 L506 -186 L506 -196 L498 -196 Z" fill="#15171a" />
          {/* Front */}
          <rect x={506} y={-104} width={10} height={18} fill="#e9e8e2" />
          <rect data-headlight x={506} y={-104} width={10} height={18} fill="#fffbe8" opacity="0" />
          <rect x={508} y={-80} width={10} height={20} fill="#0d0e10" />
          <rect x={498} y={-128} width={6} height={4} fill="#e38b12" />
          {/* Mudguards */}
          <path d="M390 -66 A52 52 0 0 1 490 -66" fill="#1c1f23" stroke="#0d0e10" strokeWidth={8} />
        </>
      )}
      <Wheel cx={250} id="rear" />
      <Wheel cx={440} id="front" />
    </g>
  );
}
