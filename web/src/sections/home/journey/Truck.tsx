import { TRUCK } from "./geometry";

/**
 * JARBOU 40-t Sattelzug (tractor unit + 13.6 m box semi-trailer), side view,
 * facing right. Scale 1 m = 64 units. Local origin: rear of the trailer at
 * road level (y = 0 is the road, negative y is up).
 *
 * Generic modern European cab-over tractor – deliberately not modelled on any
 * specific manufacturer. Gradients are defined in JourneyScene <defs>.
 *
 * ASSET NOTE: This is a vector illustration, not a photograph of a real
 * JARBOU vehicle. An approved render can replace the body via `asset`
 * (transparent side view, ~1070 × 256 units); wheels and lights stay live.
 */
export type TruckAsset = { href: string; width: number; height: number };

const R = TRUCK.wheelR;

/** Trailer: 13.6 m box, x 0 → 870. */
const TRAILER_AXLES = [130, 214, 298];
/** Tractor: drive axle under the fifth wheel, front axle 3.7 m ahead. */
const DRIVE_AXLE = 740;
const FRONT_AXLE = 977;

function Wheel({ cx, id }: { cx: number; id: string }) {
  return (
    <g>
      <circle cx={cx} cy={-R} r={R} fill="url(#t-tyre)" />
      <circle cx={cx} cy={-R} r={R - 3} fill="none" stroke="#1c1e21" strokeWidth="1.5" />
      <circle cx={cx} cy={-R} r={21.5} fill="#0c0d0f" />
      <g data-wheel={id} transform={`rotate(0 ${cx} ${-R})`}>
        <circle cx={cx} cy={-R} r={20} fill="url(#t-rim)" />
        {Array.from({ length: 10 }, (_, i) => (
          <ellipse
            key={i}
            cx={cx}
            cy={-R - 13.5}
            rx={2.6}
            ry={3.6}
            fill="#30343a"
            transform={`rotate(${i * 36} ${cx} ${-R})`}
          />
        ))}
        <circle cx={cx} cy={-R} r={8.5} fill="#8d939a" />
        {Array.from({ length: 10 }, (_, i) => (
          <circle key={`n${i}`} cx={cx} cy={-R - 6.2} r={1.1} fill="#4a4f56" transform={`rotate(${i * 36} ${cx} ${-R})`} />
        ))}
        <circle cx={cx} cy={-R} r={3.2} fill="#5a6068" />
      </g>
    </g>
  );
}

function Trailer() {
  return (
    <g>
      {/* Chassis + running gear */}
      <rect x={16} y={-80} width={846} height={14} fill="#111215" />
      <rect x={84} y={-80} width={262} height={10} fill="#0b0c0e" />
      {/* Side under-run protection */}
      <rect x={352} y={-60} width={236} height={4} fill="#2a2e33" />
      <rect x={352} y={-47} width={236} height={4} fill="#2a2e33" />
      {[352, 470, 584].map((x) => (
        <rect key={x} x={x} y={-66} width={4} height={24} fill="#1d2024" />
      ))}
      {/* Landing gear */}
      <rect x={612} y={-66} width={10} height={52} fill="#23272c" />
      <rect x={606} y={-16} width={22} height={5} fill="#1a1c1f" />
      <rect x={622} y={-52} width={12} height={3} fill="#3a3f45" />
      {/* Mudguard over the tridem */}
      <path d="M86 -70 H344 V-64 H86 Z" fill="#141518" />
      <rect x={342} y={-66} width={6} height={42} fill="#0d0e10" />
      {/* Rear under-run bar + lights */}
      <rect x={4} y={-62} width={8} height={30} fill="#1b1d20" />
      <rect x={0} y={-36} width={40} height={7} fill="#26292e" />
      <rect x={-1} y={-78} width={6} height={15} rx={1} fill="#7c0508" />
      <circle data-tail cx={2} cy={-70} r={24} fill="url(#t-tailglow)" opacity="0.35" />

      {/* Box body */}
      <rect x={0} y={-256} width={870} height={176} rx={2} fill="url(#t-trailer)" />
      <rect x={0} y={-256} width={870} height={5} fill="#fbfaf7" />
      <rect x={0} y={-251} width={870} height={2} fill="#d9d8d2" />
      <rect x={0} y={-88} width={870} height={8} fill="#c8c7c1" />
      {/* JARBOU red pinstripe */}
      <rect x={10} y={-92} width={850} height={2.5} fill="#f0080f" />
      {/* Panel seams */}
      {Array.from({ length: 11 }, (_, i) => 72 + i * 72).map((x) => (
        <line key={x} x1={x} y1={-249} x2={x} y2={-92} stroke="#dfded8" strokeWidth={1.2} />
      ))}
      {/* Rear door frame */}
      <rect x={0} y={-256} width={10} height={176} fill="#d6d5cf" />
      <rect x={10} y={-256} width={1.5} height={176} fill="#bdbcb6" />
      {/* Front corner shading */}
      <rect x={858} y={-256} width={12} height={176} fill="#000" opacity="0.06" />
      {/* Brand – official logo */}
      <image href="/brand/jarbou-logo.svg" x={220} y={-213} width={430} height={120} preserveAspectRatio="xMidYMid meet" />
      {/* Side marker lights */}
      {[70, 430, 560, 720, 840].map((x) => (
        <g key={x}>
          <rect x={x} y={-78} width={7} height={4} fill="#b86a0c" />
          <circle data-marker cx={x + 3.5} cy={-76} r={7} fill="url(#t-amber)" opacity="0" />
        </g>
      ))}
    </g>
  );
}

function Tractor() {
  return (
    <g>
      {/* Chassis, fifth wheel, tank, battery box */}
      <rect x={700} y={-72} width={236} height={14} fill="#111215" />
      <rect x={716} y={-84} width={96} height={10} fill="#1b1d21" />
      <rect x={792} y={-66} width={112} height={36} rx={9} fill="url(#t-tank)" />
      <rect x={792} y={-60} width={112} height={1.5} fill="#e4e7ea" opacity="0.5" />
      <rect x={906} y={-64} width={16} height={28} fill="#16181b" />
      {/* Drive-axle quarter fender */}
      <path d="M700 -40 A42 42 0 0 1 782 -40" fill="none" stroke="#101113" strokeWidth={7} />

      {/* Roof deflector + side collar, flush with trailer height */}
      <path d="M924 -240 L1030 -240 Q996 -252 948 -257 L924 -257 Z" fill="url(#t-cab)" />
      <rect x={914} y={-252} width={10} height={196} fill="#15171a" />

      {/* Cab body */}
      <path
        d="M922 -46 L922 -234 Q922 -242 930 -242 L1036 -242 Q1055 -242 1059 -223 L1064 -128 L1067 -62 L1071 -57 L1071 -26 L1018 -26 A41 41 0 0 0 936 -26 L930 -26 L930 -46 Z"
        fill="url(#t-cab)"
      />
      {/* Rim light on the front edge */}
      <path d="M1057 -226 L1062 -130 L1065 -64" fill="none" stroke="#5d646d" strokeWidth={2} />
      {/* Highlight along the roof edge */}
      <path d="M930 -240 L1036 -240 Q1052 -240 1056 -224" fill="none" stroke="#4b5159" strokeWidth={1.5} />
      {/* Sun visor */}
      <path d="M1028 -246 L1066 -246 L1062 -236 L1030 -236 Z" fill="#101113" />
      {/* Windscreen edge */}
      <path d="M1057 -222 L1063 -222 L1066 -146 L1061 -146 Z" fill="url(#t-glass)" />
      {/* Door + side window */}
      <path d="M982 -232 L1050 -232 L1057 -58 L982 -58 Z" fill="none" stroke="#30353c" strokeWidth={1.4} />
      <path d="M988 -226 L1047 -226 L1053 -156 L988 -156 Z" fill="url(#t-glass)" />
      <path d="M1004 -226 L1020 -226 L996 -156 L988 -156 L988 -170 Z" fill="#fff" opacity="0.06" />
      <rect x={992} y={-146} width={20} height={4} rx={1} fill="#3b4047" />
      {/* Sleeper vent */}
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={938} y={-200 + i * 8} width={30} height={3} fill="#15171a" />
      ))}
      {/* JARBOU red details: lower trim + slashes */}
      <rect x={930} y={-52} width={134} height={3} fill="#f0080f" />
      <path d="M1022 -122 H1031 L1019 -98 H1010 Z M1036 -122 H1045 L1033 -98 H1024 Z" fill="#f0080f" />
      {/* Steps */}
      <rect x={990} y={-44} width={44} height={4} fill="#0e0f11" />
      <rect x={990} y={-34} width={40} height={4} fill="#0e0f11" />
      {/* Mirror */}
      <rect x={1060} y={-206} width={22} height={3} fill="#16181b" />
      <rect x={1076} y={-226} width={11} height={62} rx={3} fill="#15171a" />
      <rect x={1078} y={-222} width={3} height={54} fill="#2a2e34" />
      {/* Bumper, headlight, DRL, indicator */}
      <rect x={1040} y={-42} width={32} height={17} fill="#121315" />
      <rect x={1061} y={-76} width={10} height={14} rx={2} fill="#e9e7df" />
      <rect x={1062} y={-80} width={9} height={3} fill="#f5f3ea" />
      <rect x={1063} y={-60} width={8} height={4} fill="#c7780f" />
    </g>
  );
}

export function Truck({ asset }: { asset?: TruckAsset }) {
  return (
    <g>
      {/* Light pool + beam ahead of the truck */}
      <g data-beam opacity="0">
        <ellipse cx={1330} cy={3} rx={240} ry={9} fill="url(#t-pool)" opacity="0.8" />
        <polygon points="1071,-70 1720,-4 1720,-140" fill="url(#t-beam)" />
      </g>
      {/* Contact shadow */}
      <ellipse cx={540} cy={1} rx={580} ry={11} fill="url(#t-shadow)" />

      {asset ? (
        <image href={asset.href} x={0} y={-asset.height} width={asset.width} height={asset.height} />
      ) : (
        <>
          <Trailer />
          <Tractor />
        </>
      )}

      {TRAILER_AXLES.map((x, i) => (
        <Wheel key={x} cx={x} id={`t${i}`} />
      ))}
      <Wheel cx={DRIVE_AXLE} id="drive" />
      <Wheel cx={FRONT_AXLE} id="front" />

      {/* Headlight glow (on top of body) */}
      <circle data-headlight cx={1068} cy={-69} r={30} fill="url(#t-headglow)" opacity="0" />
    </g>
  );
}
