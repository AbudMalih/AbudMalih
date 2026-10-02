/**
 * Tonal rhythm of the journey (background = fog = occluder colour), shared by
 * the line-world and the DOM atmosphere so both always agree:
 *   terminal near-black → road graphite → warehouse industrial metallic →
 *   the isolated carton: metallic grey → silver → warm ivory. "We build
 *   brands" is the first light moment of the film.
 * Keyed by journey t (chapters 01–04, brands = 0.82–1.0).
 */
export const TONES: [number, number][] = [
  [0.0, 0x060607],
  [0.26, 0x08090a],
  [0.4, 0x0f1012],
  [0.6, 0x141518],
  [0.68, 0x1c1d21],
  [0.8, 0x202125],
  [0.86, 0x26272b],
  [0.9, 0x4a4b4f],
  [0.918, 0x86878a],
  [0.932, 0xb8b8b5],
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

/** 0 → dark world, 1 → the light brand world (lines turn to ink). */
export const lightness = (t: number) => sm(cl((t - 0.895) / 0.05));
