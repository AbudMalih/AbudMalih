import { stage, range, smooth } from "./store";

/**
 * The opening's light: daylight entering the Luna Trading world.
 * One scroll value u = hero + source progress drives everything, so the
 * background, type, header, rail and globe always agree (forward = reverse):
 *
 *   graphite steel with a silver daylight sheen (light from the upper left)
 *   → the dive into Europe settles into the slate top of the dusk sky over
 *   the port, where the sky layer and the line-world take over.
 */
const KEYS: [number, number][] = [
  // graphite steel with a silver daylight sheen (texture in Atmosphere)
  [0.0, 0x46484c],
  [0.38, 0x414347],
  [0.6, 0x3e4147],
  [0.8, 0x373b42],
  [1.0, 0x343941],
  [1.1, 0x323741],
  [1.2, 0x30353e],
];

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export type HeroEnv = {
  /** background colour, 0..255 */
  rgb: [number, number, number];
  /** 1 = light environment (dark type, ink header) → 0 = dark environment */
  light: number;
  /** the steel's daylight sheen and brushing: present on the opening, gone in the port */
  sheen: number;
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
    // a dark ground throughout the opening: light type and header
    light: 0,
    sheen: 1 - smooth(range(u, 0.55, 1.0)),
    // the globe stays a lit, metallic graphite throughout the opening and dive
    globe: 0.45,
    active: s < 0.3,
  };
}
