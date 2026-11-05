/**
 * Tonal rhythm of the journey (background = fog = occluder colour), shared by
 * the line-world and the DOM atmosphere so both always agree. A light,
 * architectural world drawn in graphite ink: port and road in warm mineral
 * daylight → a cooler, slightly deeper industrial grey in the warehouse →
 * warm ivory as the carton becomes a brand.
 * Keyed by journey t (chapters 01–04, brands = 0.82–1.0).
 */
export const TONES: [number, number][] = [
  [0.0, 0xdcdad5],
  [0.26, 0xdedcd7],
  [0.4, 0xe1dfda],
  [0.6, 0xd8d7d3],
  [0.68, 0xd5d4d0],
  [0.8, 0xdad8d3],
  [0.86, 0xdfdcd5],
  [0.9, 0xe3e0d8],
  [0.932, 0xe6e2d9],
  [0.946, 0xe8e3d8],
  [0.962, 0xeae5da],
  [1.0, 0xece7dd],
];

const sm = (x: number) => x * x * (3 - 2 * x);
const cl = (x: number) => Math.min(1, Math.max(0, x));

/** Journey tone as 0..1 rgb. */
export function toneAt(t: number, out: [number, number, number] = [0, 0, 0]) {
  let i = 0;
  while (i < TONES.length - 2 && TONES[i + 1][0] <= t) i++;
  const [ta, ca] = TONES[i];
  const [tb, cb] = TONES[i + 1];
  const u = sm(cl((t - ta) / (tb - ta)));
  for (let k = 0; k < 3; k++) {
    const sh = 16 - k * 8;
    const a = ((ca >> sh) & 255) / 255;
    const b = ((cb >> sh) & 255) / 255;
    out[k] = a + (b - a) * u;
  }
  return out;
}

/** 0 → dark world, 1 → the light brand world (lines turn to ink). */
export const lightness = (t: number) => sm(cl((t - 0.895) / 0.05));
