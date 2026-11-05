/**
 * Tonal rhythm of the journey (fog / horizon colour), shared by the
 * line-world and the DOM atmosphere so both always agree:
 *   port and road under an open sky (the sky itself is a DOM layer behind
 *   the transparent line-world; this is its hazy horizon) → the dim, lit
 *   industrial interior of the warehouse → warm ivory as the carton becomes
 *   a brand, the first light moment of the film.
 * Keyed by journey t (chapters 01–04, brands = 0.82–1.0).
 */
export const TONES: [number, number][] = [
  [0.0, 0x8a8682],
  [0.26, 0x928d86],
  [0.4, 0x9a9890],
  [0.56, 0x8e8f8f],
  [0.62, 0x3b3f46],
  [0.8, 0x41454c],
  [0.86, 0x4a4d53],
  [0.9, 0x86878a],
  [0.918, 0xb2b1ae],
  [0.932, 0xcfcbc3],
  [0.946, 0xdcd8cf],
  [0.962, 0xe8e3d8],
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

/** 0 → open sky / interior, 1 → the light brand world (lines turn to ink). */
/** 1 while the journey is under the open sky (port, road), 0 indoors. */
export const skyAt = (t: number) => 1 - sm(cl((t - 0.555) / 0.06));

export const lightness = (t: number) => sm(cl((t - 0.895) / 0.05));
