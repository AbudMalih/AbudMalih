/**
 * PRODUCTION CINEMATIC SEQUENCES
 * ---------------------------------------------------------------------------
 * Each journey segment can be replaced by a pre-rendered, scroll-scrubbed
 * image sequence (Blender / CGI / AI-assisted renders). While a manifest is
 * `null`, the procedural line-world placeholder is shown for that segment.
 *
 * Mapping: segment progress 0 → frame 1, 1 → frame `frames`. Scrolling back
 * reverses; stopping scroll stops the sequence (no autoplay).
 *
 * File convention (recommended):
 *   /public/sequences/<id>/<tier>/<id>_0001.avif  (+ .webp fallback)
 *   tiers: "desktop" (2560w), "laptop" (1920w), "mobile" (1080w portrait crop)
 *
 * Budget guidance: ≤ 300 frames per segment desktop, ≤ 150 mobile,
 * AVIF q≈55 → ~60–120 KB per desktop frame.
 */
import type { ChapterId } from "./chapters";

export type SequenceTier = "desktop" | "laptop" | "mobile";

export type SequenceManifest = {
  id: string;
  /** Journey segment this sequence replaces. */
  segment: Extract<ChapterId, "source" | "transport" | "warehouse" | "brands">;
  frames: Record<SequenceTier, number>;
  /** Frame URL builder (1-based index). */
  src: (index: number, tier: SequenceTier, format: "avif" | "webp") => string;
  /** Intrinsic aspect of the renders — drawn with object-fit: cover. */
  aspect: Record<SequenceTier, number>;
  /** Encoded formats available on the server (default: AVIF with WebP fallback). */
  formats?: ("avif" | "webp")[];
  /** Optional focal point for cover cropping (0..1). */
  focus?: { x: number; y: number };
};

const pad = (n: number) => String(n).padStart(4, "0");
export const conventionalSrc =
  (id: string) => (i: number, tier: SequenceTier, format: "avif" | "webp") =>
    `/sequences/${id}/${tier}/${id}_${pad(i)}.${format}`;

export const SEQUENCES: Record<"terminal" | "transport" | "warehouse" | "product", SequenceManifest | null> = {
  // Example of a production manifest (enable when renders are delivered):
  // terminal: {
  //   id: "terminal",
  //   segment: "source",
  //   frames: { desktop: 300, laptop: 300, mobile: 150 },
  //   src: conventionalSrc("terminal"),
  //   aspect: { desktop: 16 / 9, laptop: 16 / 9, mobile: 9 / 16 },
  // },
  terminal: null,
  transport: null,
  warehouse: null,
  product: null,
};
