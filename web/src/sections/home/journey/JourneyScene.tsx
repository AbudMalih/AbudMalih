import { Slashes } from "@/components/brand/Slashes";
import {
  GANTRY_X,
  GROUND_Y,
  hillsPath,
  HUB_X,
  ROAD_BOTTOM,
  ROAD_TOP,
  treesPath,
  turbines,
  WAREHOUSE,
  TRUCK,
  WORLD_END,
} from "./geometry";
import { Truck, type TruckAsset } from "./Truck";

const HILLS = hillsPath();
const TREES = treesPath();
const W = WAREHOUSE;
const LAMPS = [180, 520, 860, 1180];
const RACK_X = [-240, 0, 240, 480, 720, 960];

/**
 * The static SVG stage. All moving parts carry `data-*` hooks that the
 * client controller (JourneySequence) animates. No state, no effects –
 * renders identically on server and client.
 */
export function JourneyScene({ truckAsset }: { truckAsset?: TruckAsset }) {
  return (
    <svg
      data-scene
      viewBox="0 0 1600 900"
      preserveAspectRatio="xMidYMax slice"
      className="absolute inset-0 h-full w-full"
      role="img"
      aria-label="Illustration: Ein JARBOU-LKW verlässt das Lager, fährt über die Autobahn und erreicht sein Ziel."
    >
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0b0c0e" />
          <stop offset="1" stopColor="#23272c" />
        </linearGradient>
        <linearGradient id="beam" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fffbe8" stopOpacity="0.55" />
          <stop offset="1" stopColor="#fffbe8" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="cone" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f4f2ea" stopOpacity="0.2" />
          <stop offset="1" stopColor="#f4f2ea" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="doorlight" x1="1" y1="0" x2="0" y2="0">
          <stop offset="0" stopColor="#9fb3c8" stopOpacity="0.28" />
          <stop offset="1" stopColor="#9fb3c8" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="docklight" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff6dc" stopOpacity="0.9" />
          <stop offset="1" stopColor="#fff6dc" stopOpacity="0.35" />
        </linearGradient>
        {/* Repeating scenery as patterns keeps the DOM small. */}
        <pattern id="p-lane" patternUnits="userSpaceOnUse" x={1500} y={716} width={140} height={3}>
          <rect width={64} height={3} fill="#c9ccd0" />
        </pattern>
        <pattern id="p-rail" patternUnits="userSpaceOnUse" x={1500} y={664} width={90} height={28}>
          <rect width={4} height={28} fill="#30353b" />
        </pattern>
        <pattern id="p-post" patternUnits="userSpaceOnUse" x={1700} y={808} width={160} height={62}>
          <rect width={9} height={62} fill="#c7cacd" />
          <rect y={18} width={9} height={14} fill="#0b0c0e" />
          <rect x={2} y={8} width={5} height={6} fill="#e38b12" />
        </pattern>
        <pattern id="p-truss" patternUnits="userSpaceOnUse" x={-1200} y={WAREHOUSE.roofY} width={90} height={80}>
          <path d="M0 0 L45 80 L90 0" fill="none" stroke="#1f2226" strokeWidth="3" />
        </pattern>
        <clipPath id="door-clip">
          <rect x={W.right} y={W.doorTop} width={W.wall} height={GROUND_Y - W.doorTop} />
        </clipPath>
      </defs>

      {/* ── Sky (static) ───────────────────────────── */}
      <rect x="-2000" y="-600" width="6000" height="2000" fill="url(#sky)" />

      {/* ── Far layer: hills + wind turbines ───────── */}
      <g data-layer="far">
        <path d={HILLS} fill="#191c20" />
        {turbines.map((t, i) => (
          <g key={i} transform={`translate(${t.x} ${t.y}) scale(${t.s})`} className="motion-reduce:hidden">
            <path d="M-2.5 0 L-4 170 L4 170 L2.5 0 Z" fill="#2a2e33" />
            <g data-blades transform={`rotate(${i * 37})`}>
              <path d="M0 0 L-3 -78 L0 -86 L3 -78 Z" fill="#2f3439" />
              <path d="M0 0 L-3 -78 L0 -86 L3 -78 Z" fill="#2f3439" transform="rotate(120)" />
              <path d="M0 0 L-3 -78 L0 -86 L3 -78 Z" fill="#2f3439" transform="rotate(240)" />
            </g>
            <circle r="4" fill="#383d43" />
          </g>
        ))}
      </g>

      {/* ── Mid layer: tree line ───────────────────── */}
      <g data-layer="mid">
        <path d={TREES} fill="#121417" />
      </g>

      {/* ── World layer (moves 1:1 with the camera) ── */}
      <g data-layer="world">
        {/* Autobahn */}
        <rect x={W.right} y={ROAD_TOP} width={WORLD_END} height={ROAD_BOTTOM - ROAD_TOP} fill="#1d2024" />
        <rect x={W.right} y={ROAD_BOTTOM} width={WORLD_END} height={700} fill="#0e1012" />
        <rect x={W.right} y={ROAD_BOTTOM - 10} width={WORLD_END} height={3} fill="#c9ccd0" opacity="0.8" />
        <rect x={W.right} y={ROAD_TOP + 6} width={WORLD_END} height={2} fill="#c9ccd0" opacity="0.5" />
        <rect x={1500} y={716} width={WORLD_END} height={3} fill="url(#p-lane)" opacity="0.6" />
        {/* Guard rail */}
        <rect x={1500} y={664} width={WORLD_END} height={28} fill="url(#p-rail)" />
        <rect x={1500} y={666} width={WORLD_END} height={9} fill="#454b52" />
        <rect x={1500} y={666} width={WORLD_END} height={2} fill="#6b7179" />

        {/* Route trail – the slashes become the route line */}
        <g data-trail-start opacity="0">
          <Slashes x={W.right + 90} y={757} width={36} height={29} className="text-red" />
        </g>
        <line data-trail x1={W.right + 140} y1={772} x2={TRUCK.endX} y2={772} stroke="#f0080f" strokeWidth="3" pathLength={1} strokeDasharray="1 1" strokeDashoffset="1" />

        {/* Autobahn sign (A 7 connects Hannover and Kassel) */}
        <g transform={`translate(${GANTRY_X} 0)`}>
          <rect x={120} y={430} width={8} height={240} fill="#3a3f45" />
          <rect x={0} y={330} width={250} height={130} fill="#1d4a8c" />
          <rect x={5} y={335} width={240} height={120} fill="none" stroke="#e8ecf1" strokeWidth="2" />
          <rect x={18} y={348} width={42} height={26} rx={4} fill="#e8ecf1" />
          <text x={39} y={367} textAnchor="middle" fontSize="17" fontWeight="700" fill="#1d4a8c" fontFamily="var(--font-inter-tight), sans-serif">A7</text>
          <text x={18} y={404} fontSize="22" fontWeight="600" fill="#e8ecf1" fontFamily="var(--font-inter-tight), sans-serif">Hannover</text>
          <text x={18} y={436} fontSize="22" fontWeight="600" fill="#e8ecf1" fontFamily="var(--font-inter-tight), sans-serif">Kassel</text>
          <path d="M214 390 l12 -12 l12 12 M226 378 v36" fill="none" stroke="#e8ecf1" strokeWidth="3" />
        </g>

        {/* Destination hub */}
        <g transform={`translate(${HUB_X} 0)`}>
          <rect x={0} y={360} width={1400} height={GROUND_Y - 360 + 60} fill="#1a1d21" />
          <rect x={0} y={350} width={1400} height={14} fill="#262a2f" />
          {Array.from({ length: 12 }, (_, i) => (
            <line key={i} x1={0} y1={390 + i * 28} x2={1400} y2={390 + i * 28} stroke="#202428" strokeWidth="2" />
          ))}
          {[80, 330, 580].map((x, i) => (
            <g key={x}>
              <rect x={x} y={520} width={190} height={220} fill="#101214" />
              {i === 0 ? (
                <rect data-dock x={x} y={520} width={190} height={220} fill="url(#docklight)" opacity="0.15" />
              ) : (
                Array.from({ length: 8 }, (_, j) => <line key={j} x1={x} y1={530 + j * 26} x2={x + 190} y2={530 + j * 26} stroke="#1b1e22" strokeWidth="2" />)
              )}
              <rect x={x - 10} y={500} width={210} height={12} fill="#2b2f35" />
              <rect x={x + 70} y={482} width={50} height={12} fill={i === 0 ? "#f0080f" : "#2b2f35"} />
            </g>
          ))}
          <rect x={0} y={GROUND_Y} width={1400} height={600} fill="#0e1012" />
        </g>

        {/* ── Warehouse (interior cut-away) ──────────── */}
        <g>
          <rect x={-1200} y={W.roofY} width={1200 + W.right} height={GROUND_Y - W.roofY} fill="#17191c" />
          <rect x={-1200} y={GROUND_Y} width={1200 + W.right + W.wall} height={800} fill="#0f1113" />
          <rect x={-1200} y={W.roofY - 24} width={1200 + W.right + W.wall + 20} height={24} fill="#22262b" />
          {/* Roof truss */}
          <line x1={-1200} y1={120} x2={W.right} y2={120} stroke="#23272c" strokeWidth="4" />
          <rect x={-1200} y={W.roofY} width={1200 + W.right} height={80} fill="url(#p-truss)" />
          {/* Pallet racks */}
          {RACK_X.map((x) => (
            <g key={x}>
              <rect x={x} y={250} width={6} height={GROUND_Y - 250} fill="#2c3035" />
              <rect x={x + 220} y={250} width={6} height={GROUND_Y - 250} fill="#2c3035" />
              {[380, 540].map((y) => (
                <rect key={y} x={x} y={y} width={226} height={8} fill="#3a3f45" />
              ))}
              {[380, 540].map((y, j) => (
                <g key={`b${y}`}>
                  <rect x={x + 14} y={y - 92} width={92} height={92} fill={j ? "#34383e" : "#3b3530"} />
                  <rect x={x + 116} y={y - 70} width={96} height={70} fill={j ? "#3b3530" : "#2e3237"} />
                  <rect x={x + 14} y={y - 92} width={92} height={3} fill="#4a4f56" />
                </g>
              ))}
            </g>
          ))}
          {/* Floor lane marking */}
          <rect x={-1200} y={GROUND_Y + 22} width={1200 + W.right} height={3} fill="#3a3f45" />
          {/* Gate sign */}
          <rect x={W.right - 140} y={W.doorTop - 58} width={96} height={30} fill="#0f1113" stroke="#3a3f45" />
          <text x={W.right - 92} y={W.doorTop - 37} textAnchor="middle" fontSize="15" fontWeight="600" letterSpacing="2" fill="#bfc3c8" fontFamily="var(--font-geist-mono), monospace">TOR 03</text>
          {/* Wall + roller door */}
          <rect x={W.right} y={W.roofY - 24} width={W.wall} height={W.doorTop - W.roofY + 24} fill="#22262b" />
          <rect x={W.right - 6} y={W.doorTop - 20} width={W.wall + 12} height={20} fill="#2b2f35" />
          <rect data-door-light x={W.right - 420} y={W.doorTop} width={420} height={GROUND_Y - W.doorTop + 30} fill="url(#doorlight)" opacity="0" />
          <g clipPath="url(#door-clip)">
            <g data-door>
              <rect x={W.right} y={W.doorTop} width={W.wall} height={GROUND_Y - W.doorTop} fill="#2a2e33" />
              {Array.from({ length: 13 }, (_, i) => (
                <line key={i} x1={W.right} y1={W.doorTop + 14 + i * 26} x2={W.right + W.wall} y2={W.doorTop + 14 + i * 26} stroke="#1a1d21" strokeWidth="2" />
              ))}
            </g>
          </g>
          {/* Yard light outside */}
          <rect x={W.right + W.wall + 120} y={430} width={5} height={GROUND_Y - 430 - 50} fill="#2f3439" />
          <rect x={W.right + W.wall + 104} y={424} width={38} height={8} fill="#3a3f45" />
        </g>
      </g>

      {/* ── Truck (screen-relative) ────────────────── */}
      <g data-truck transform={`translate(740 ${GROUND_Y})`}>
        <Truck asset={truckAsset} />
      </g>

      {/* ── Interior shade + lamps (move with world) ─ */}
      <g data-layer="shade">
        <rect data-dark x={-1200} y={W.roofY} width={1200 + W.right + W.wall} height={GROUND_Y - W.roofY + 900} fill="#040506" opacity="0.9" />
        {LAMPS.map((x, i) => (
          <g key={x}>
            <line x1={x} y1={120} x2={x} y2={150} stroke="#2c3035" strokeWidth="2" />
            <path d={`M${x - 26} 162 L${x - 14} 150 L${x + 14} 150 L${x + 26} 162 Z`} fill="#2c3035" />
            <g data-lamp={i} opacity="0">
              <rect x={x - 22} y={160} width={44} height={3} fill="#fbf8ee" />
              <path d={`M${x - 24} 163 L${x + 24} 163 L${x + 190} ${GROUND_Y} L${x - 190} ${GROUND_Y} Z`} fill="url(#cone)" />
            </g>
          </g>
        ))}
      </g>

      {/* ── Foreground layer: Leitpfosten ─────────── */}
      <g data-layer="fg">
        <rect x={1700} y={808} width={11200} height={62} fill="url(#p-post)" />
      </g>
    </svg>
  );
}
