import type { SequenceManifest, SequenceTier } from "@/content/sequences";

/**
 * Scroll-scrubbed image sequence player.
 *  - Progressive loading: keyframes first (every 16th, then 8th, 4th, 2nd, all)
 *    so scrubbing is usable almost immediately and sharpens as frames arrive.
 *  - Draws the nearest *loaded* frame — never blocks, never shows blank.
 *  - Decodes off the main thread via createImageBitmap where available.
 *  - Bounded concurrency, abortable, explicit dispose (frees bitmaps).
 */
export class FrameSequence {
  private frames: (ImageBitmap | HTMLImageElement | null)[];
  private queue: number[] = [];
  private inflight = 0;
  private aborted = false;
  private format: "avif" | "webp" = "webp";
  private lastDrawn = -1;
  loaded = 0;
  onProgress?: (ratio: number) => void;

  constructor(private manifest: SequenceManifest, private tier: SequenceTier, private concurrency = 6) {
    this.frames = new Array(manifest.frames[tier]).fill(null);
  }

  get count() {
    return this.frames.length;
  }

  async start() {
    const formats = this.manifest.formats ?? ["avif", "webp"];
    this.format = formats.includes("avif") && (await supportsAvif()) ? "avif" : "webp";
    const n = this.count;
    const seen = new Set<number>();
    for (const step of [16, 8, 4, 2, 1]) {
      for (let i = 0; i < n; i += step) if (!seen.has(i)) (seen.add(i), this.queue.push(i));
    }
    if (!seen.has(n - 1)) this.queue.push(n - 1);
    this.pump();
  }

  private pump() {
    while (!this.aborted && this.inflight < this.concurrency && this.queue.length) {
      const i = this.queue.shift()!;
      this.inflight++;
      this.load(i).finally(() => {
        this.inflight--;
        this.pump();
      });
    }
  }

  private async load(i: number) {
    try {
      let res = await fetch(this.manifest.src(i + 1, this.tier, this.format));
      // AVIF missing for this frame → fall back to the WebP rendition
      if (!res.ok && this.format === "avif" && (this.manifest.formats ?? ["avif", "webp"]).includes("webp")) res = await fetch(this.manifest.src(i + 1, this.tier, "webp"));
      if (!res.ok || this.aborted) return;
      const blob = await res.blob();
      const img = "createImageBitmap" in window ? await createImageBitmap(blob) : await blobToImage(blob);
      if (this.aborted) {
        if ("close" in img) img.close();
        return;
      }
      this.frames[i] = img;
      this.loaded++;
      this.onProgress?.(this.loaded / this.count);
    } catch {
      /* a missing frame falls back to its nearest neighbour */
    }
  }

  /** Nearest loaded frame to index i. */
  private nearest(i: number) {
    if (this.frames[i]) return i;
    for (let d = 1; d < this.count; d++) {
      if (i - d >= 0 && this.frames[i - d]) return i - d;
      if (i + d < this.count && this.frames[i + d]) return i + d;
    }
    return -1;
  }

  /** Draw progress p ∈ [0,1] into ctx with cover-fit. Returns false if nothing is loaded yet. */
  draw(ctx: CanvasRenderingContext2D, p: number, focus = { x: 0.5, y: 0.5 }) {
    const i = this.nearest(Math.round(Math.min(1, Math.max(0, p)) * (this.count - 1)));
    if (i < 0) return false;
    if (i === this.lastDrawn) return true;
    const img = this.frames[i]!;
    const cw = ctx.canvas.width, ch = ctx.canvas.height;
    const iw = img.width, ih = img.height;
    const s = Math.max(cw / iw, ch / ih);
    const dw = iw * s, dh = ih * s;
    ctx.drawImage(img, (cw - dw) * focus.x, (ch - dh) * focus.y, dw, dh);
    this.lastDrawn = i;
    return true;
  }

  invalidate() {
    this.lastDrawn = -1;
  }

  dispose() {
    this.aborted = true;
    this.queue = [];
    this.frames.forEach((f) => f && "close" in f && f.close());
    this.frames = [];
  }
}

let avif: Promise<boolean> | null = null;
function supportsAvif() {
  avif ??= new Promise((res) => {
    const img = new Image();
    img.onload = () => res(img.width > 0);
    img.onerror = () => res(false);
    img.src =
      "data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAAB0AAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAIAAAACAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQ0MAAAAABNjb2xybmNseAACAAIAAYAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAACVtZGF0EgAKCBgANogQEAwgMg8f8D///8WfhwB8+ErK42A=";
  });
  return avif;
}

function blobToImage(blob: Blob) {
  return new Promise<HTMLImageElement>((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = URL.createObjectURL(blob);
  });
}
