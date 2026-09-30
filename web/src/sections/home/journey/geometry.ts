/**
 * Scene geometry for the "Vom Lager zum Ziel" sequence.
 *
 * Real-world scale: 1 m = 64 world units. The 40-t Sattelzug is ~16.7 m long
 * and 4 m high, so every surrounding element (door, guard rail, lane
 * markings, delineators) is sized in the same metric system.
 *
 * Everything is deterministic so server and client render identical markup.
 */

export const M = 64;

/** Road contact line of the truck (right lane). */
export const GROUND_Y = 740;

/** Y bands (top → bottom) of the Autobahn cross-section as seen from the side. */
export const ROAD = {
  farTop: 646, // opposite carriageway, compressed by distance
  farBottom: 672,
  medianBottom: 688,
  nearTop: 688, // own carriageway
  laneDash: 712,
  edgeLine: 784,
  nearBottom: 800,
} as const;

export const WAREHOUSE = { right: 1330, wall: 60, roofY: 40, doorTop: 420 } as const;

export const TRUCK = {
  /** Overall length, rear of trailer → front bumper (≈16.7 m). */
  length: 1070,
  height: 256,
  /** Rear of trailer, world x, parked inside the warehouse. */
  startX: 200,
  /** Rear of trailer, world x, parked in front of the destination hub. */
  endX: 7000,
  wheelR: 33,
} as const;

/** Autobahn section ends here; the hub yard begins. */
export const ROAD_END = 6500;
export const HUB = { x: 6420, width: 2600, top: 330 } as const;
export const SIGN_X = 3700;

export const PARALLAX = { far: 0.1, mid: 0.35, roadFar: 0.86, fg: 1.25 } as const;

/** Tiny seeded PRNG (mulberry32) for deterministic scenery. */
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Low rolling hills on the horizon. */
export function hillsPath(width = 3600, base = 632): string {
  let d = `M-400 ${base + 400} L-400 ${base}`;
  for (let x = -400; x <= width; x += 40) {
    const y = base - 30 * Math.sin(x / 560) - 16 * Math.sin(x / 210 + 1.3) - 26;
    d += ` L${x} ${r1(y)}`;
  }
  return `${d} L${width} ${base + 400} Z`;
}

/** Tree line silhouette behind the opposite carriageway (mid layer). */
export function treesPath(width = 5200, base = 648): string {
  const rand = rng(7);
  let d = `M-400 ${base + 300} L-400 ${base}`;
  let x = -400;
  while (x < width) {
    const w = 22 + rand() * 40;
    const h = 22 + rand() * 62;
    const gap = rand() < 0.1 ? 60 + rand() * 200 : 0;
    d += ` Q${r1(x + w * 0.1)} ${r1(base - h)} ${r1(x + w / 2)} ${r1(base - h)} Q${r1(x + w * 0.9)} ${r1(base - h)} ${r1(x + w)} ${base}`;
    x += w;
    if (gap) {
      d += ` L${r1(x + gap)} ${base}`;
      x += gap;
    }
  }
  return `${d} L${r1(x)} ${base + 300} Z`;
}

export const turbines = [
  { x: 380, y: 566, s: 0.42 },
  { x: 520, y: 578, s: 0.32 },
  { x: 1520, y: 570, s: 0.38 },
  { x: 2240, y: 580, s: 0.3 },
  { x: 2360, y: 566, s: 0.42 },
];
