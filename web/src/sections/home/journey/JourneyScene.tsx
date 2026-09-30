import { Slashes } from "@/components/brand/Slashes";
import { GROUND_Y, HUB, hillsPath, M, ROAD, ROAD_END, SIGN_X, TRUCK, treesPath, turbines, WAREHOUSE } from "./geometry";
import { Truck, type TruckAsset } from "./Truck";

const HILLS = hillsPath();
const TREES = treesPath();
const W = WAREHOUSE;
const LAMPS = [120, 470, 820, 1170];
/** The lit dock sits just ahead of the parked Sattelzug so it stays visible. */
const LIT_DOCK = 6;
const LIT_DOCK_X = TRUCK.endX + TRUCK.length + 60;
const HUB_DOCKS = Array.from({ length: 9 }, (_, i) => LIT_DOCK_X + (i - LIT_DOCK) * 4.2 * M);
const FONT = "var(--font-inter-tight), sans-serif";

/**
 * The static SVG stage (server-rendered). Every moving part carries a
 * `data-*` hook animated by JourneySequence. The viewBox is set by the
 * client controller per breakpoint; the default suits desktop.
 */
export function JourneyScene({ truckAsset }: { truckAsset?: TruckAsset }) {
  return (
    <svg
      data-scene
      viewBox="0 -2 1600 1000"
      preserveAspectRatio="xMidYMax slice"
      className="absolute inset-0 h-full w-full"
      role="img"
      aria-label="Illustration: Ein JARBOU-Sattelzug verlässt das Lager, fährt über die Autobahn und erreicht sein Ziel."
    >
      <defs>
        {/* Sky & atmosphere */}
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#08090b" />
          <stop offset="0.55" stopColor="#111317" />
          <stop offset="1" stopColor="#262a30" />
        </linearGradient>
        <radialGradient id="horizon" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#5a5147" stopOpacity="0.28" />
          <stop offset="1" stopColor="#5a5147" stopOpacity="0" />
        </radialGradient>
        {/* Road */}
        <linearGradient id="asphalt" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#24272c" />
          <stop offset="0.5" stopColor="#1c1f23" />
          <stop offset="1" stopColor="#15171a" />
        </linearGradient>
        <linearGradient id="asphalt-far" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1b1d21" />
          <stop offset="1" stopColor="#15171a" />
        </linearGradient>
        <linearGradient id="verge" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#101214" />
          <stop offset="1" stopColor="#08090a" />
        </linearGradient>
        {/* Warehouse */}
        <linearGradient id="hall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#141619" />
          <stop offset="1" stopColor="#1c1f23" />
        </linearGradient>
        <linearGradient id="hallfloor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1d2024" />
          <stop offset="1" stopColor="#0c0d0f" />
        </linearGradient>
        <linearGradient id="cone" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f4f1e6" stopOpacity="0.16" />
          <stop offset="1" stopColor="#f4f1e6" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="floorpool" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#f4f1e6" stopOpacity="0.14" />
          <stop offset="1" stopColor="#f4f1e6" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="doorlight" x1="1" y1="0" x2="0" y2="0">
          <stop offset="0" stopColor="#9fb0c2" stopOpacity="0.22" />
          <stop offset="1" stopColor="#9fb0c2" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="docklight" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff4d8" stopOpacity="0.95" />
          <stop offset="1" stopColor="#fff4d8" stopOpacity="0.4" />
        </linearGradient>
        <linearGradient id="hubwall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1f2226" />
          <stop offset="1" stopColor="#16181b" />
        </linearGradient>
        {/* Truck materials */}
        <linearGradient id="t-trailer" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f6f5f1" />
          <stop offset="0.7" stopColor="#ebeae5" />
          <stop offset="1" stopColor="#dcdbd5" />
        </linearGradient>
        <linearGradient id="t-cab" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3b4047" />
          <stop offset="0.4" stopColor="#272b31" />
          <stop offset="1" stopColor="#17191d" />
        </linearGradient>
        <linearGradient id="t-glass" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1c232b" />
          <stop offset="1" stopColor="#07090b" />
        </linearGradient>
        <linearGradient id="t-tank" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#b9bec4" />
          <stop offset="0.5" stopColor="#8a9098" />
          <stop offset="1" stopColor="#4f545a" />
        </linearGradient>
        <radialGradient id="t-tyre" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0.6" stopColor="#1b1c1f" />
          <stop offset="1" stopColor="#060607" />
        </radialGradient>
        <radialGradient id="t-rim" cx="0.42" cy="0.38" r="0.65">
          <stop offset="0" stopColor="#c3c7cc" />
          <stop offset="1" stopColor="#6a7078" />
        </radialGradient>
        <radialGradient id="t-shadow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#000" stopOpacity="0.75" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="t-headglow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fffbe9" stopOpacity="0.95" />
          <stop offset="0.25" stopColor="#fffbe9" stopOpacity="0.35" />
          <stop offset="1" stopColor="#fffbe9" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="t-tailglow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ff2a2a" stopOpacity="0.9" />
          <stop offset="1" stopColor="#ff2a2a" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="t-amber" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffb13b" stopOpacity="0.9" />
          <stop offset="1" stopColor="#ffb13b" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="t-beam" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fffbe9" stopOpacity="0.32" />
          <stop offset="1" stopColor="#fffbe9" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="t-pool" cx="0.35" cy="0.5" r="0.6">
          <stop offset="0" stopColor="#fffbe9" stopOpacity="0.22" />
          <stop offset="1" stopColor="#fffbe9" stopOpacity="0" />
        </radialGradient>

        {/* Repeating scenery as patterns keeps the DOM small (metric spacing). */}
        <pattern id="p-lane" patternUnits="userSpaceOnUse" x={1500} y={ROAD.laneDash} width={18 * M} height={4}>
          <rect width={6 * M} height={4} fill="#c9ccd0" />
        </pattern>
        <pattern id="p-lane-far" patternUnits="userSpaceOnUse" x={1500} y={658} width={18 * M} height={2}>
          <rect width={6 * M} height={2} fill="#9aa0a7" />
        </pattern>
        <pattern id="p-rail" patternUnits="userSpaceOnUse" x={1500} y={662} width={2 * M} height={26}>
          <rect x={0} width={5} height={26} fill="#2a2e33" />
        </pattern>
        <pattern id="p-post" patternUnits="userSpaceOnUse" x={1700} y={806} width={50 * M} height={64}>
          <rect width={10} height={64} fill="#c7cacd" />
          <rect y={18} width={10} height={14} fill="#0b0c0e" />
          <rect x={2.5} y={8} width={5} height={7} fill="#e38b12" />
        </pattern>
        <pattern id="p-truss" patternUnits="userSpaceOnUse" x={-1200} y={W.roofY} width={96} height={84}>
          <path d="M0 0 L48 84 L96 0" fill="none" stroke="#1e2125" strokeWidth="3" />
        </pattern>
        {/* Pallet racking: near row (with gaps) and far row seen through them */}
        <pattern id="p-rack" patternUnits="userSpaceOnUse" x={-1200} y={228} width={346} height={512}>
          <rect x={0} width={7} height={512} fill="#2b2f35" />
          <rect x={173} width={7} height={512} fill="#2b2f35" />
          {[102, 204, 306, 408].map((y) => (
            <rect key={y} x={0} y={y} width={346} height={7} fill="#3b4148" />
          ))}
          {/* loads: [x, beamY, w, h, tone] */}
          {(
            [
              [14, 102, 70, 72, 0],
              [92, 102, 72, 58, 1],
              [190, 204, 70, 80, 1],
              [270, 204, 66, 64, 0],
              [14, 306, 150, 76, 2],
              [190, 306, 72, 60, 0],
              [96, 408, 68, 84, 1],
              [190, 408, 146, 70, 2],
              [270, 102, 68, 76, 2],
            ] as const
          ).map(([x, y, w, h, t], i) => (
            <g key={i}>
              <rect x={x} y={y - h} width={w} height={h} fill={["#3a342d", "#2f3338", "#353a40"][t]} />
              <rect x={x} y={y - h} width={w} height={3} fill="#4a4f56" opacity="0.8" />
              <rect x={x} y={y - 8} width={w} height={6} fill="#4b4136" />
            </g>
          ))}
        </pattern>
        <pattern id="p-rack-far" patternUnits="userSpaceOnUse" x={-1100} y={300} width={240} height={440}>
          <rect x={0} width={5} height={440} fill="#1d2024" />
          {[88, 176, 264, 352].map((y) => (
            <rect key={y} x={0} y={y} width={240} height={5} fill="#23272c" />
          ))}
          {[
            [10, 88, 100, 60],
            [124, 176, 104, 54],
            [10, 264, 104, 62],
            [130, 352, 96, 58],
            [16, 440, 100, 64],
          ].map(([x, y, w, h], i) => (
            <rect key={i} x={x} y={y! - h!} width={w} height={h} fill="#22262b" />
          ))}
        </pattern>
        <pattern id="p-hazard" patternUnits="userSpaceOnUse" width={24} height={24} patternTransform="rotate(45)">
          <rect width={12} height={24} fill="#b98a1c" />
          <rect x={12} width={12} height={24} fill="#15171a" />
        </pattern>
        <pattern id="p-cladding" patternUnits="userSpaceOnUse" x={HUB.x} y={HUB.top} width={64} height={36}>
          <rect y={35} width={64} height={1.5} fill="#191b1f" />
        </pattern>

        <clipPath id="door-clip">
          <rect x={W.right} y={W.doorTop} width={W.wall} height={GROUND_Y - W.doorTop} />
        </clipPath>
      </defs>

      {/* ── Sky (static) ───────────────────────────── */}
      <rect x="-3000" y="-3000" width="9000" height="6000" fill="url(#sky)" />
      <ellipse cx="800" cy="640" rx="1400" ry="140" fill="url(#horizon)" />

      {/* ── Far layer: hills + wind turbines ───────── */}
      <g data-layer="far">
        <path d={HILLS} fill="#17191d" />
        {turbines.map((t, i) => (
          <g key={i} transform={`translate(${t.x} ${t.y}) scale(${t.s})`} className="motion-reduce:hidden">
            <path d="M-2.5 0 L-4 170 L4 170 L2.5 0 Z" fill="#262a2f" />
            <g data-blades transform={`rotate(${i * 37})`}>
              <path d="M0 0 L-3 -78 L0 -86 L3 -78 Z" fill="#2b3035" />
              <path d="M0 0 L-3 -78 L0 -86 L3 -78 Z" fill="#2b3035" transform="rotate(120)" />
              <path d="M0 0 L-3 -78 L0 -86 L3 -78 Z" fill="#2b3035" transform="rotate(240)" />
            </g>
            <circle r="4" fill="#33383e" />
            <circle cy="-2" r="2" fill="#c01818" opacity="0.8" />
          </g>
        ))}
      </g>

      {/* ── Mid layer: tree line ───────────────────── */}
      <g data-layer="mid">
        <path d={TREES} fill="#0f1113" />
      </g>

      {/* ── Opposite carriageway + median (slightly slower = depth) ── */}
      <g data-layer="roadfar">
        <rect x={1390} y={ROAD.farTop} width={ROAD_END} height={ROAD.farBottom - ROAD.farTop} fill="url(#asphalt-far)" />
        <rect x={1390} y={ROAD.farTop + 2} width={ROAD_END} height={1.5} fill="#8a9098" opacity="0.5" />
        <rect x={1500} y={658} width={ROAD_END} height={2} fill="url(#p-lane-far)" opacity="0.55" />
        <rect x={1390} y={ROAD.farBottom} width={ROAD_END} height={ROAD.medianBottom - ROAD.farBottom} fill="#0e0f11" />
        {/* Median guard rail (W-beam) */}
        <rect x={1500} y={662} width={ROAD_END} height={26} fill="url(#p-rail)" />
        <rect x={1500} y={664} width={ROAD_END} height={10} fill="#3e444b" />
        <rect x={1500} y={664} width={ROAD_END} height={2} fill="#79808a" />
        <rect x={1500} y={672} width={ROAD_END} height={2} fill="#23272c" />
        {/* Autobahn direction sign on the median (A 7 links Hannover and Kassel) */}
        {/* On the median, i.e. farther away: drawn at 70 % for perspective */}
        <g transform={`translate(${SIGN_X} 60) scale(0.7)`}>
          <rect x={40} y={560} width={9} height={337} fill="#2f343a" />
          <rect x={250} y={560} width={9} height={337} fill="#2f343a" />
          <rect x={0} y={400} width={300} height={170} rx={4} fill="#1d4a8c" />
          <rect x={6} y={406} width={288} height={158} rx={3} fill="none" stroke="#e6eaef" strokeWidth="2.5" />
          <rect x={22} y={422} width={54} height={32} rx={5} fill="#e6eaef" />
          <text x={49} y={445} textAnchor="middle" fontSize="21" fontWeight="700" fill="#1d4a8c" fontFamily={FONT}>A7</text>
          <text x={22} y={496} fontSize="28" fontWeight="600" fill="#e6eaef" fontFamily={FONT}>Hannover</text>
          <text x={22} y={538} fontSize="28" fontWeight="600" fill="#e6eaef" fontFamily={FONT}>Kassel</text>
          <path d="M254 488 l14 -14 l14 14 M268 474 v44" fill="none" stroke="#e6eaef" strokeWidth="3.5" />
        </g>
      </g>

      {/* ── World layer (moves 1:1 with the camera) ── */}
      <g data-layer="world">
        {/* Own carriageway */}
        <rect x={W.right} y={ROAD.nearTop} width={ROAD_END - W.right + 300} height={ROAD.nearBottom - ROAD.nearTop} fill="url(#asphalt)" />
        <rect x={1460} y={ROAD.nearTop + 3} width={ROAD_END - 1460} height={3} fill="#c9ccd0" opacity="0.55" />
        <rect x={1500} y={ROAD.laneDash} width={ROAD_END - 1500} height={4} fill="url(#p-lane)" opacity="0.7" />
        <rect x={1460} y={ROAD.edgeLine} width={ROAD_END - 1460} height={5} fill="#d6d9dc" opacity="0.75" />
        <rect x={W.right} y={ROAD.nearBottom} width={ROAD_END + 3000} height={3000} fill="url(#verge)" />

        {/* Route trail – the slashes become the route line */}
        <g data-trail-start opacity="0">
          <Slashes x={W.right + 120} y={764} width={30} height={24} className="text-red" />
        </g>
        <line
          data-trail
          x1={W.right + 164}
          y1={776}
          x2={TRUCK.endX}
          y2={776}
          stroke="#f0080f"
          strokeWidth="3"
          pathLength={1}
          strokeDasharray="1 1"
          strokeDashoffset="1"
        />

        {/* Destination hub (behind the yard) */}
        <g>
          <rect x={HUB.x} y={HUB.top} width={HUB.width} height={ROAD.nearTop - HUB.top} fill="url(#hubwall)" />
          <rect x={HUB.x} y={HUB.top} width={HUB.width} height={ROAD.nearTop - HUB.top} fill="url(#p-cladding)" />
          <rect x={HUB.x - 10} y={HUB.top - 18} width={HUB.width + 20} height={18} fill="#24282d" />
          <rect x={HUB.x} y={HUB.top + 30} width={HUB.width} height={10} fill="#101215" />
          {HUB_DOCKS.map((x, i) => (
            <g key={x}>
              {/* Dock shelter + door */}
              <rect x={x - 14} y={472} width={200} height={216} fill="#0c0d0f" />
              <rect x={x} y={486} width={172} height={188} fill={i === LIT_DOCK ? "#0e0f11" : "#15171a"} />
              {i !== LIT_DOCK &&
                Array.from({ length: 7 }, (_, j) => (
                  <rect key={j} x={x} y={496 + j * 26} width={172} height={1.5} fill="#1f2226" />
                ))}
              {i === LIT_DOCK && <rect data-dock x={x} y={486} width={172} height={188} fill="url(#docklight)" opacity="0.12" />}
              {/* Dock number light + floodlight */}
              <rect x={x + 70} y={448} width={32} height={10} fill={i === LIT_DOCK ? "#f0080f" : "#262a2f"} />
              <rect x={x + 76} y={HUB.top + 48} width={20} height={6} fill="#2b2f35" />
              <path d={`M${x + 78} ${HUB.top + 54} L${x + 94} ${HUB.top + 54} L${x + 150} 470 L${x + 22} 470 Z`} fill="url(#cone)" opacity="0.7" />
              {/* Dock bumpers */}
              <rect x={x + 10} y={662} width={14} height={22} fill="#0a0b0c" />
              <rect x={x + 148} y={662} width={14} height={22} fill="#0a0b0c" />
            </g>
          ))}
          {/* Yard surface */}
          <rect x={ROAD_END} y={ROAD.nearTop} width={HUB.width + 400} height={ROAD.nearBottom - ROAD.nearTop} fill="#1b1d21" />
          <rect x={ROAD_END} y={ROAD.nearTop} width={HUB.width + 400} height={3} fill="#2a2e33" />
        </g>

        {/* Yard light outside the warehouse */}
        <rect x={W.right + W.wall + 200} y={380} width={6} height={ROAD.farTop - 380} fill="#2c3136" />
        <rect x={W.right + W.wall + 176} y={374} width={48} height={8} fill="#383d43" />
        <path d={`M${W.right + W.wall + 184} 382 L${W.right + W.wall + 216} 382 L${W.right + W.wall + 330} ${ROAD.nearBottom} L${W.right + W.wall + 70} ${ROAD.nearBottom} Z`} fill="url(#cone)" opacity="0.6" />

        {/* ── Warehouse (interior cut-away) ──────────── */}
        <g>
          <rect x={-1400} y={W.roofY} width={1400 + W.right} height={GROUND_Y - W.roofY} fill="url(#hall)" />
          {/* Back-wall panels */}
          <rect x={-1400} y={W.roofY} width={1400 + W.right} height={GROUND_Y - W.roofY} fill="url(#p-cladding)" opacity="0.6" />
          <rect x={-1400} y={W.roofY + 84} width={1400 + W.right} height={GROUND_Y - W.roofY - 84} fill="url(#p-rack-far)" />
          <rect x={-1400} y={228} width={1400 + W.right - 90} height={GROUND_Y - 228} fill="url(#p-rack)" />
          {/* Floor */}
          <rect x={-1400} y={GROUND_Y} width={1400 + W.right + W.wall} height={3000} fill="url(#hallfloor)" />
          {LAMPS.map((x) => (
            <ellipse key={x} cx={x} cy={GROUND_Y + 22} rx={220} ry={20} fill="url(#floorpool)" />
          ))}
          <rect x={-1400} y={GROUND_Y + 34} width={1400 + W.right} height={3} fill="#8a6d1f" opacity="0.5" />
          {/* Roof + truss */}
          <rect x={-1400} y={W.roofY - 26} width={1400 + W.right + W.wall + 20} height={26} fill="#202328" />
          <rect x={-1400} y={W.roofY} width={1400 + W.right} height={84} fill="url(#p-truss)" />
          <rect x={-1400} y={W.roofY + 82} width={1400 + W.right} height={4} fill="#1e2125" />
          {/* Gate sign */}
          <rect x={W.right - 150} y={W.doorTop - 64} width={104} height={32} fill="#0e0f11" stroke="#3a3f45" />
          <text x={W.right - 98} y={W.doorTop - 42} textAnchor="middle" fontSize="15" fontWeight="600" letterSpacing="2" fill="#bfc3c8" fontFamily="var(--font-geist-mono), monospace">
            TOR 03
          </text>
          {/* Wall, door frame with hazard marking, roller door */}
          <rect x={W.right} y={W.roofY - 26} width={W.wall} height={W.doorTop - W.roofY + 26} fill="#22262b" />
          <rect x={W.right - 8} y={W.doorTop - 26} width={W.wall + 16} height={26} fill="#2b2f35" />
          <rect x={W.right - 14} y={W.doorTop} width={10} height={GROUND_Y - W.doorTop} fill="url(#p-hazard)" />
          <rect data-door-light x={W.right - 520} y={W.doorTop} width={520} height={GROUND_Y - W.doorTop + 40} fill="url(#doorlight)" opacity="0" />
          <g clipPath="url(#door-clip)">
            <g data-door>
              <rect x={W.right} y={W.doorTop} width={W.wall} height={GROUND_Y - W.doorTop} fill="#2a2e33" />
              {Array.from({ length: 12 }, (_, i) => (
                <rect key={i} x={W.right} y={W.doorTop + 16 + i * 26} width={W.wall} height={2} fill="#1a1d21" />
              ))}
            </g>
          </g>
        </g>
      </g>

      {/* ── High-bay light cones (world, behind the truck) ── */}
      <g data-layer="lamps">
        {LAMPS.map((x, i) => (
          <g key={x} data-lamp={i} opacity="0">
            <path d={`M${x - 28} 183 L${x + 28} 183 L${x + 230} ${GROUND_Y} L${x - 230} ${GROUND_Y} Z`} fill="url(#cone)" />
          </g>
        ))}
      </g>

      {/* ── Truck (screen-relative) ────────────────── */}
      <g data-truck transform={`translate(${TRUCK.startX} ${GROUND_Y})`}>
        <Truck asset={truckAsset} />
      </g>

      {/* ── Interior shade + high-bay lamps (world) ── */}
      <g data-layer="shade">
        <rect data-dark x={-1400} y={W.roofY} width={1400 + W.right + W.wall} height={GROUND_Y - W.roofY + 900} fill="#030405" opacity="0.9" />
        {LAMPS.map((x, i) => (
          <g key={`f${x}`}>
            <line x1={x} y1={W.roofY + 86} x2={x} y2={168} stroke="#2c3035" strokeWidth="2" />
            <path d={`M${x - 30} 182 L${x - 16} 168 L${x + 16} 168 L${x + 30} 182 Z`} fill="#2c3035" />
            <rect data-lamp={i} x={x - 26} y={180} width={52} height={3} fill="#fbf8ee" opacity="0" />
          </g>
        ))}
      </g>

      {/* ── Foreground layer: Leitpfosten every 50 m ─ */}
      <g data-layer="fg">
        <rect x={1700} y={806} width={6800} height={64} fill="url(#p-post)" />
      </g>
    </svg>
  );
}
