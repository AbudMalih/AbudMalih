/**
 * Pre-rendered cinematic frame sequences for the scroll story.
 * Source scene: /render/journey (Blender, path-traced). Regenerate with
 * `render/journey/run_all.sh`, `post.py` and `encode.mjs` (see README there).
 */
export const FRAME_COUNT = 120;

/** Scroll timeline span (0–100) covered by the film; the finale wipe follows. */
export const FILM_END = 88;

export type FrameSet = { dir: string; width: number; height: number };

export const FRAME_SETS: Record<"desktop" | "mobile", FrameSet> = {
  desktop: { dir: "/journey/d", width: 1440, height: 810 },
  mobile: { dir: "/journey/m", width: 720, height: 1280 },
};

export type FrameFormat = "avif" | "webp";

export const frameSrc = (set: FrameSet, i: number, format: FrameFormat = "webp") =>
  `${set.dir}/${String(i).padStart(3, "0")}.${format}`;

/** Still used for reduced motion: the full Sattelzug on the Autobahn. */
export const STILL_FRAME = 60;

/** Opening frame shown until the film has loaded. */
export const POSTER_FRAME = 0;

/** 1×1 AVIF used to feature-detect AVIF decoding. */
export const AVIF_PROBE =
  "data:image/avif;base64,AAAAHGZ0eXBhdmlmAAAAAG1pZjFhdmlmbWlhZgAAANZtZXRhAAAAAAAAACFoZGxyAAAAAAAAAABwaWN0AAAAAAAAAAAAAAAAAAAAACJpbG9jAAAAAERAAAEAAQAAAAAA+gABAAAAAAAAAB0AAAAjaWluZgAAAAAAAQAAABVpbmZlAgAAAAABAABhdjAxAAAAAA5waXRtAAAAAAABAAAAVmlwcnAAAAA4aXBjbwAAAAxhdjFDgSACAAAAABRpc3BlAAAAAAAAAAEAAAABAAAAEHBpeGkAAAAAAwgICAAAABZpcG1hAAAAAAAAAAEAAQOBAgMAAAAlbWRhdBIACgc4AAaQENBpMhAZQmMEwAA0AACQQM6Xt10S";
