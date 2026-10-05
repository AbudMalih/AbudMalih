import { stage, range, smooth } from "./store";

/**
 * The opening's light: daylight entering the Luna Trading world.
 * One scroll value u = hero + source progress drives everything, so the
 * background, type, header, rail and globe always agree (forward = reverse):
 *
 *   warm mineral off-white → soft silver (globe established)
 *   → medium graphite (global trade) → the near-black of the port, where
 *   the line-world takes over (its first tone is 0x060607).
 */
const KEYS: [number, number][] = [
  [0.0, 0xdedcd6],
  [0.38, 0xd5d5d2],
  [0.55, 0xc3c4c4],
  [0.62, 0xb2b3b4],
  [0.66, 0x9b9c9e],
  // a short pass through mid-grey: type and header flip inside it
  [0.674, 0x67686b],
  [0.71, 0x4d4e52],
  [0.86, 0x2c2d30],
  [1.0, 0x1a1b1e],
  [1.1, 0x0e0f11],
  [1.2, 0x070708],
];

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export type HeroEnv = {
  /** background colour, 0..255 */
  rgb: [number, number, number];
  /** 1 = light environment (dark type, ink header) → 0 = dark environment */
  light: number;
  /** globe material: 1 = smoked graphite for daylight → 0 = the dark-world globe */
  globe: number;
  /** the opening is on screen at all (hero or the start of the dive) */
  active: boolean;
};

export function heroEnv(): HeroEnv {
  const { hero: h, source: s } = stage.p;
  const u = h + s;
  let i = 0;
  while (i < KEYS.length - 2 && KEYS[i + 1][0] <= u) i++;
  const [ua, ca] = KEYS[i];
  const [ub, cb] = KEYS[i + 1];
  const t = smooth(range(u, ua, ub));
  const rgb = [16, 8, 0].map((sh) => Math.round(lerp((ca >> sh) & 255, (cb >> sh) & 255, t))) as [number, number, number];
  return {
    rgb,
    // type and header flip decisively while the ground passes mid-grey,
    // so they never sit at the same luminance as the background
    light: 1 - smooth(range(u, 0.663, 0.673)),
    globe: 1 - smooth(range(u, 0.5, 0.95)),
    active: s < 0.3,
  };
}
