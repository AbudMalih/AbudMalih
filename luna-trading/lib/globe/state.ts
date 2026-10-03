import { stage, range, lerp, smooth, easeInOut, easeIn, easeOut } from "@/lib/stage/store";
import { COMPANY } from "@/content/site";
import type { GlobeFrame } from "./createGlobe";

export type GlobeDerived = GlobeFrame & { opacity: number; labels: number };

const KOELN = COMPANY.coordinates;

/**
 * Pure mapping: chapter progress → globe camera/scene. Three regimes:
 *   hero      — emerge from darkness, route Asia → Europe
 *   source    — dive into Europe (hand-off to the line-world)
 *   closing   — the world returns, calm, the + at Cologne
 */
export function globeState(): GlobeDerived {
  const f = globeStateLtr();
  // In RTL the text sits on the right, so the globe composes to the left.
  if (stage.rtl) f.ox = -f.ox;
  return f;
}

function globeStateLtr(): GlobeDerived {
  const { hero: h, source: s, closing: c } = stage.p;
  const m = stage.mobile;
  const portrait = stage.vw / Math.max(1, stage.vh) < 0.8;
  const distScale = portrait ? 1.75 : m ? 1.35 : 1;

  if (c > 0) {
    const k = easeOut(range(c, 0.0, 1));
    return {
      lon: lerp(30, 14, k),
      lat: lerp(30, 38, k),
      dist: lerp(7.2, 4.9, k) * distScale,
      ox: m ? 0 : 0.2,
      oy: m ? -0.12 : 0.04,
      // arrival keeps its scroll distance; the camera's slow drift (k) runs
      // on through the held CTA
      reveal: smooth(range(c, 0.01, 0.2)) * 0.95,
      route: 1,
      opacity: smooth(range(c, 0.01, 0.16)) * (m ? 0.6 : 0.9),
      labels: range(c, 0.16, 0.22),
    };
  }

  // Hero
  const emerge = Math.max(stage.intro * 0.34, smooth(range(h, 0.0, 0.34)));
  const turnA = easeInOut(range(h, 0.12, 0.6));
  const turnB = easeInOut(range(h, 0.58, 0.98));
  let lon = lerp(lerp(124, 66, turnA), KOELN.lon + 1.5, turnB);
  let lat = lerp(lerp(14, 28, turnA), 45, turnB);
  let dist = lerp(lerp(5.0, 4.15, smooth(range(h, 0, 0.45))), 2.75, easeInOut(range(h, 0.7, 1))) * distScale;
  let ox = m ? 0 : lerp(lerp(0.2, 0.16, smooth(range(h, 0, 0.4))), 0.0, easeInOut(range(h, 0.62, 1)));
  let oy = lerp(m ? 0.34 : 0.46, m ? 0.1 : 0.05, easeOut(range(h, 0.0, 0.42)));
  oy = lerp(oy, 0, easeInOut(range(h, 0.75, 1)));
  let opacity = 1;
  const route = easeInOut(range(h, 0.3, 0.94));

  // Dive (chapter 01 opening)
  if (s > 0) {
    const d = easeIn(range(s, 0, 0.24));
    lon = lerp(lon, KOELN.lon, smooth(range(s, 0, 0.18)));
    lat = lerp(lat, KOELN.lat, smooth(range(s, 0, 0.18)));
    dist = lerp(dist, 1.14, d);
    opacity = 1 - smooth(range(s, 0.1, 0.19));
  }

  return {
    lon,
    lat,
    dist,
    ox,
    oy,
    reveal: emerge,
    route,
    opacity,
    labels: range(h, 0.3, 0.36) * (1 - range(s, 0.04, 0.1)),
  };
}
