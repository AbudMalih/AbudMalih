/**
 * Pre-rendered cinematic frame sequences for the scroll story.
 * Source scene: /render/journey (Blender, path-traced). Regenerate with
 * `render/journey/run_all.sh` + `node render/journey/encode.mjs`.
 */
export const FRAME_COUNT = 150;

/** Scroll timeline span (0–100) covered by the film; the finale wipe follows. */
export const FILM_END = 88;

export type FrameSet = { dir: string; width: number; height: number };

export const FRAME_SETS: Record<"desktop" | "mobile", FrameSet> = {
  desktop: { dir: "/journey/d", width: 1280, height: 720 },
  mobile: { dir: "/journey/m", width: 640, height: 1136 },
};

export const frameSrc = (set: FrameSet, i: number) => `${set.dir}/${String(i).padStart(3, "0")}.webp`;

/** Still used for reduced motion: the full Sattelzug on the Autobahn. */
export const STILL_FRAME = 76;
