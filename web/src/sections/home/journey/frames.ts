/**
 * Pre-rendered cinematic frame sequences for the scroll story.
 * Source scene: /render/journey (Blender, path-traced). Regenerate with
 * `render/journey/run_all.sh`, `post.py` and `encode.mjs` (see README there).
 */
/** Scroll timeline span (0–100) covered by the film; the finale wipe follows. */
export const FILM_END = 88;

/**
 * `count` frames per set; `still` is the reduced-motion image (the full
 * Sattelzug on the Autobahn), frame 0 doubles as the opening poster.
 */
export type FrameSet = { dir: string; width: number; height: number; count: number; still: number };

export const FRAME_SETS: Record<"desktop" | "mobile", FrameSet> = {
  desktop: { dir: "/journey/d", width: 1440, height: 810, count: 239, still: 120 },
  mobile: { dir: "/journey/m", width: 576, height: 1024, count: 239, still: 120 },
};

export type FrameFormat = "avif" | "webp";

export const frameSrc = (set: FrameSet, i: number, format: FrameFormat = "webp") =>
  `${set.dir}/${String(i).padStart(3, "0")}.${format}`;

/** Opening frame shown until the film has loaded. */
export const POSTER_FRAME = 0;

/** 1×1 AVIF used to feature-detect AVIF decoding. */
export const AVIF_PROBE =
  "data:image/avif;base64,AAAAHGZ0eXBhdmlmAAAAAG1pZjFhdmlmbWlhZgAAANZtZXRhAAAAAAAAACFoZGxyAAAAAAAAAABwaWN0AAAAAAAAAAAAAAAAAAAAACJpbG9jAAAAAERAAAEAAQAAAAAA+gABAAAAAAAAAB0AAAAjaWluZgAAAAAAAQAAABVpbmZlAgAAAAABAABhdjAxAAAAAA5waXRtAAAAAAABAAAAVmlwcnAAAAA4aXBjbwAAAAxhdjFDgSACAAAAABRpc3BlAAAAAAAAAAEAAAABAAAAEHBpeGkAAAAAAwgICAAAABZpcG1hAAAAAAAAAAEAAQOBAgMAAAAlbWRhdBIACgc4AAaQENBpMhAZQmMEwAA0AACQQM6Xt10S";
