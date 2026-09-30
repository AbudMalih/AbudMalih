/**
 * Scene geometry for the "Vom Lager zum Ziel" sequence.
 * World units; the stage viewBox is 1600 × 900 (desktop).
 * Everything is deterministic so server and client render identical markup.
 */

export const GROUND_Y = 740;
export const ROAD_TOP = 690;
export const ROAD_BOTTOM = 800;

export const WAREHOUSE = { right: 1330, wall: 60, roofY: 40, doorTop: 400 } as const;
export const TRUCK = { length: 520, startX: 740, endX: 6200, wheelR: 38 } as const;
export const HUB_X = 6800;
export const GANTRY_X = 3200;
export const WORLD_END = 8200;

export const PARALLAX = { far: 0.12, mid: 0.4, fg: 1.35 } as const;

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
export function hillsPath(width = 3400, base = 640): string {
  let d = `M0 ${base + 300} L0 ${base}`;
  for (let x = 0; x <= width; x += 40) {
    const y = base - 38 * Math.sin(x / 520) - 22 * Math.sin(x / 190 + 1.3) - 30;
    d += ` L${x} ${r1(y)}`;
  }
  return `${d} L${width} ${base + 300} Z`;
}

/** Tree line silhouette (mid layer). */
export function treesPath(width = 4200, base = 690): string {
  const rand = rng(7);
  let d = `M0 ${base + 200} L0 ${base}`;
  let x = 0;
  while (x < width) {
    const w = 24 + rand() * 46;
    const h = 30 + rand() * 80;
    const gap = rand() < 0.12 ? 60 + rand() * 180 : 0;
    d += ` Q${r1(x + w * 0.1)} ${r1(base - h)} ${r1(x + w / 2)} ${r1(base - h)} Q${r1(x + w * 0.9)} ${r1(base - h)} ${r1(x + w)} ${base}`;
    x += w;
    if (gap) {
      d += ` L${r1(x + gap)} ${base}`;
      x += gap;
    }
  }
  return `${d} L${r1(x)} ${base + 200} Z`;
}

export const turbines = [
  { x: 420, y: 540, s: 0.62 },
  { x: 560, y: 560, s: 0.46 },
  { x: 1560, y: 548, s: 0.55 },
  { x: 2280, y: 560, s: 0.5 },
  { x: 2400, y: 540, s: 0.64 },
];

