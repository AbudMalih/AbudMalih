/**
 * Stage store — the single source of truth shared between the DOM chapters
 * (ScrollTrigger) and the render layers (WebGL, canvas, DOM overlays).
 *
 * Chapters only WRITE their own local progress (0..1).
 * Render layers only READ and DERIVE their state from those progress values
 * through pure functions. No two systems ever write the same value, which is
 * what makes scrubbing perfectly reversible.
 */
import { CHAPTERS, type ChapterId } from "@/content/chapters";

export type Tier = "high" | "medium" | "low";

type StageState = {
  p: Record<ChapterId, number>;
  /** Monotonic counter: increments whenever any progress changes. */
  version: number;
  vw: number;
  vh: number;
  mobile: boolean;
  tier: Tier;
  cine: boolean;
  /** 0..1 — time-based intro after the loader (hero entrance). */
  intro: number;
  /** Assets the loader waits for (globe texture, fonts, …). */
  ready: Record<string, boolean>;
};

export const stage: StageState = {
  p: Object.fromEntries(CHAPTERS.map((c) => [c.id, 0])) as Record<ChapterId, number>,
  version: 0,
  vw: 1440,
  vh: 900,
  mobile: false,
  tier: "high",
  cine: false,
  intro: 0,
  ready: {},
};

export function setProgress(id: ChapterId, p: number) {
  if (stage.p[id] === p) return;
  stage.p[id] = p;
  stage.version++;
}

/* ------------------------------------------------------------------------ */
/* Pure helpers                                                              */
/* ------------------------------------------------------------------------ */

export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** Local progress of `p` inside the window [a, b], clamped. */
export const range = (p: number, a: number, b: number) => clamp((p - a) / (b - a));
export const smooth = (t: number) => t * t * (3 - 2 * t);
export const easeInOut = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
export const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
export const easeIn = (t: number) => t * t * t;

/**
 * The continuous "journey" parameter for the line-world (and later for the
 * production image sequences). It spans four chapters back-to-back.
 */
export const JOURNEY_SEGMENTS: { id: ChapterId; from: number; to: number }[] = [
  { id: "source", from: 0.0, to: 0.28 },
  { id: "transport", from: 0.28, to: 0.62 },
  { id: "warehouse", from: 0.62, to: 0.82 },
  { id: "brands", from: 0.82, to: 1.0 },
];

export function journeyT() {
  let t = 0;
  for (const s of JOURNEY_SEGMENTS) t += (s.to - s.from) * stage.p[s.id];
  return t;
}

/* ------------------------------------------------------------------------ */
/* Device tier                                                               */
/* ------------------------------------------------------------------------ */

export function detectTier(): Tier {
  if (typeof window === "undefined") return "high";
  const nav = navigator as Navigator & { deviceMemory?: number };
  const cores = nav.hardwareConcurrency ?? 8;
  const mem = nav.deviceMemory ?? 8;
  const small = window.matchMedia("(max-width: 767px)").matches;
  if (cores <= 4 || mem <= 3) return "low";
  if (small || cores <= 6) return "medium";
  return "high";
}

export function updateViewport() {
  if (typeof window === "undefined") return;
  stage.vw = window.innerWidth;
  stage.vh = window.innerHeight;
  stage.mobile = window.matchMedia("(max-width: 767px)").matches;
  stage.version++;
}
