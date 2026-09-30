import type { ServiceMediaKey } from "@/content/types";

/**
 * PLACEHOLDER ARTWORK – schematic line drawings shown until approved JARBOU
 * photography is added in /src/content/media.ts. They depict processes, not
 * real sites, vehicles or people.
 */
const INK = "#1a1d21";
const MUTED = "#b9bcc0";
const RED = "#f0080f";

function Disposition() {
  const rows = ["F-01", "F-02", "F-03", "F-04", "F-05"];
  const blocks = [
    [0, 1, 3], [1, 0, 2], [2, 2, 3], [3, 1, 2], [4, 0, 4],
  ];
  return (
    <g fontFamily="var(--font-geist-mono), monospace" fontSize="13" fill={INK}>
      {["06:00", "09:00", "12:00", "15:00", "18:00"].map((t, i) => (
        <g key={t}>
          <text x={130 + i * 100} y={110} fill="#6b7179">{t}</text>
          <line x1={130 + i * 100} y1={124} x2={130 + i * 100} y2={500} stroke={MUTED} strokeDasharray="2 6" />
        </g>
      ))}
      {rows.map((r, i) => (
        <g key={r}>
          <text x={60} y={170 + i * 70}>{r}</text>
          <line x1={120} y1={180 + i * 70} x2={560} y2={180 + i * 70} stroke={MUTED} />
        </g>
      ))}
      {blocks.map(([row, start, len], i) => (
        <rect key={i} x={132 + start! * 100} y={146 + row! * 70} width={len! * 100 - 8} height={26} fill={i === 2 ? RED : INK} />
      ))}
    </g>
  );
}

function Routes() {
  const pts = [
    [90, 470], [160, 380], [260, 410], [300, 300], [410, 330], [450, 220], [540, 160],
  ];
  const others = [[120, 200], [220, 150], [360, 170], [520, 420], [430, 470], [220, 260], [560, 300]];
  return (
    <g>
      {others.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={6} fill="none" stroke={MUTED} strokeWidth="2" />
      ))}
      <polyline points={pts.map((p) => p.join(",")).join(" ")} fill="none" stroke={INK} strokeWidth="3" />
      {pts.map(([x, y], i) => (
        <g key={i}>
          <rect x={x! - 9} y={y! - 9} width={18} height={18} fill={i === pts.length - 1 ? RED : "#f5f4f0"} stroke={INK} strokeWidth="2" />
        </g>
      ))}
    </g>
  );
}

function Delivery() {
  return (
    <g>
      {[140, 260, 380, 500].map((x) => (
        <line key={`v${x}`} x1={x} y1={80} x2={x} y2={540} stroke={MUTED} strokeWidth="14" />
      ))}
      {[160, 300, 440].map((y) => (
        <line key={`h${y}`} x1={60} y1={y} x2={580} y2={y} stroke={MUTED} strokeWidth="14" />
      ))}
      <path d="M140 540 L140 300 L260 300 L260 160 L500 160 L500 440" fill="none" stroke={INK} strokeWidth="4" />
      {[[140, 380], [200, 300], [260, 220], [380, 160], [500, 300], [500, 440]].map(([x, y], i) => (
        <g key={i} fontFamily="var(--font-geist-mono), monospace" fontSize="12">
          <circle cx={x} cy={y} r={14} fill={i === 5 ? RED : INK} />
          <text x={x} y={y! + 4} textAnchor="middle" fill="#fff">{i + 1}</text>
        </g>
      ))}
    </g>
  );
}

function Quality() {
  const line = [[80, 380], [150, 330], [220, 350], [290, 280], [360, 300], [430, 240], [500, 250], [560, 200]];
  return (
    <g fontFamily="var(--font-geist-mono), monospace" fontSize="12" fill="#6b7179">
      {[160, 240, 320, 400, 480].map((y) => (
        <line key={y} x1={60} y1={y} x2={580} y2={y} stroke={MUTED} strokeDasharray="2 6" />
      ))}
      <line x1={60} y1={260} x2={580} y2={260} stroke={RED} strokeWidth="2" />
      <text x={584} y={264} fill={RED} textAnchor="end" dy="-10">ZIEL</text>
      <polyline points={line.map((p) => p.join(",")).join(" ")} fill="none" stroke={INK} strokeWidth="3" />
      {line.map(([x, y], i) => (
        <rect key={i} x={x! - 5} y={y! - 5} width={10} height={10} fill={INK} />
      ))}
      {[0, 1, 2].map((i) => (
        <g key={i} transform={`translate(${80 + i * 170} 440)`}>
          <rect width={20} height={20} fill="none" stroke={INK} strokeWidth="2" />
          <path d="M4 10 l5 5 l8 -10" fill="none" stroke={i === 2 ? RED : INK} strokeWidth="2.5" />
          <rect x={32} y={6} width={90} height={8} fill={MUTED} />
        </g>
      ))}
    </g>
  );
}

function Fleet() {
  const van = (x: number, y: number, hi = false) => (
    <g transform={`translate(${x} ${y})`} key={`${x}-${y}`}>
      <path d="M0 0 H70 L96 22 V46 H0 Z" fill={hi ? RED : INK} />
      <path d="M72 6 L90 22 H72 Z" fill="#f5f4f0" opacity="0.5" />
      <circle cx={20} cy={48} r={9} fill="#f5f4f0" stroke={INK} strokeWidth="4" />
      <circle cx={74} cy={48} r={9} fill="#f5f4f0" stroke={INK} strokeWidth="4" />
    </g>
  );
  return (
    <g>
      {[0, 1, 2].map((r) => [0, 1, 2, 3].map((c) => van(70 + c * 125, 110 + r * 95, r === 1 && c === 2)))}
      <g transform="translate(70 420)">
        <rect width={300} height={80} fill="none" stroke={INK} strokeWidth="3" />
        <path d="M306 20 H360 L396 50 V80 H306 Z" fill={INK} />
        <circle cx={80} cy={86} r={14} fill="#f5f4f0" stroke={INK} strokeWidth="5" />
        <circle cx={350} cy={86} r={14} fill="#f5f4f0" stroke={INK} strokeWidth="5" />
      </g>
    </g>
  );
}

function Operations() {
  return (
    <g fontFamily="var(--font-geist-mono), monospace" fontSize="12">
      <rect x={220} y={90} width={200} height={54} fill={INK} />
      <text x={320} y={122} textAnchor="middle" fill="#fff">STANDORTLEITUNG</text>
      <line x1={320} y1={144} x2={320} y2={200} stroke={INK} strokeWidth="2" />
      <rect x={220} y={200} width={200} height={54} fill="none" stroke={INK} strokeWidth="2" />
      <text x={320} y={232} textAnchor="middle" fill={INK}>DISPOSITION</text>
      <path d="M320 254 V300 M120 300 H520 M120 300 V340 M320 300 V340 M520 300 V340" fill="none" stroke={INK} strokeWidth="2" />
      {[120, 320, 520].map((x, i) => (
        <g key={x}>
          <rect x={x - 80} y={340} width={160} height={54} fill="none" stroke={i === 1 ? RED : INK} strokeWidth="2" />
          <text x={x} y={372} textAnchor="middle" fill={INK}>TEAM {String.fromCharCode(65 + i)}</text>
          {[0, 1, 2, 3].map((j) => (
            <rect key={j} x={x - 60 + j * 32} y={420} width={22} height={22} fill={i === 1 && j === 0 ? RED : MUTED} />
          ))}
        </g>
      ))}
    </g>
  );
}

const MAP: Record<ServiceMediaKey, () => React.JSX.Element> = {
  "service-disposition": Disposition,
  "service-routes": Routes,
  "service-delivery": Delivery,
  "service-quality": Quality,
  "service-fleet": Fleet,
  "service-operations": Operations,
};

export function ServiceIllustration({ id, label }: { id: ServiceMediaKey; label: string }) {
  const Art = MAP[id];
  return (
    <svg viewBox="0 0 640 600" role="img" aria-label={label} className="h-full w-full" preserveAspectRatio="xMidYMid meet">
      <Art />
    </svg>
  );
}
