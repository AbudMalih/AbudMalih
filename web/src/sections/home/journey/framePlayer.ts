import { AVIF_PROBE, FRAME_COUNT, frameSrc, type FrameFormat, type FrameSet } from "./frames";

let avif: Promise<boolean> | null = null;
/** Resolves once whether the browser decodes AVIF (cached). */
export function supportsAvif() {
  avif ??= new Promise<boolean>((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img.width > 0);
    img.onerror = () => resolve(false);
    img.src = AVIF_PROBE;
  });
  return avif;
}

/**
 * Draws a pre-rendered frame sequence onto a canvas, driven by a fractional
 * frame position. Frames load progressively (every 8th first, then 4th, 2nd,
 * all) so the story is scrubbable early; missing frames fall back to the
 * nearest loaded one and neighbours are cross-faded for smooth motion.
 */
export function createFramePlayer(canvas: HTMLCanvasElement, set: FrameSet, format: FrameFormat = "webp") {
  const ctx = canvas.getContext("2d", { alpha: false });
  const frames: (HTMLImageElement | null)[] = new Array(FRAME_COUNT).fill(null);
  let pos = 0;
  let disposed = false;
  let raf = 0;

  const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  const lean = Boolean(conn?.saveData) || /(^|-)2g|3g/.test(conn?.effectiveType ?? "");

  // progressive order without duplicates
  const order: number[] = [];
  const seen = new Set<number>();
  for (const step of lean ? [8, 4, 2] : [8, 4, 2, 1]) {
    for (let i = 0; i < FRAME_COUNT; i += step) {
      if (!seen.has(i)) {
        seen.add(i);
        order.push(i);
      }
    }
  }
  if (!seen.has(FRAME_COUNT - 1)) order.splice(1, 0, FRAME_COUNT - 1);

  let next = 0;
  const pump = () => {
    if (disposed || next >= order.length) return;
    const i = order[next++]!;
    const img = new Image();
    img.decoding = "async";
    // never compete with the rest of the page for bandwidth
    img.fetchPriority = "low";
    img.src = frameSrc(set, i, format);
    img
      .decode()
      .then(() => {
        if (disposed) return;
        frames[i] = img;
        // repaint if the new frame is closer to the current position
        if (Math.abs(i - pos) < 3) schedule();
      })
      .catch(() => {})
      .finally(pump);
  };
  for (let k = 0; k < (lean ? 3 : 6); k++) pump();

  const nearest = (f: number) => {
    const c = Math.round(f);
    for (let d = 0; d < FRAME_COUNT; d++) {
      const a = frames[c - d];
      if (a) return a;
      const b = frames[c + d];
      if (b) return b;
    }
    return null;
  };

  const resize = () => {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = Math.max(1, Math.round(r.width * dpr));
    const h = Math.max(1, Math.round(r.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    schedule();
  };

  const blit = (img: HTMLImageElement, alpha: number) => {
    if (!ctx) return;
    const cw = canvas.width;
    const ch = canvas.height;
    const s = Math.max(cw / set.width, ch / set.height);
    const w = set.width * s;
    const h = set.height * s;
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h);
  };

  // Blend only through the middle of a step (short dissolve) and show a
  // clean frame once scrolling pauses – never a static double exposure.
  let settled = true;
  let settleTimer = 0;
  const draw = () => {
    raf = 0;
    if (!ctx) return;
    const i0 = Math.floor(pos);
    const t = pos - i0;
    const a = frames[i0];
    const b = frames[Math.min(FRAME_COUNT - 1, i0 + 1)];
    if (a && b) {
      const w = settled ? (t < 0.5 ? 0 : 1) : Math.min(1, Math.max(0, (t - 0.35) / 0.3));
      if (w <= 0.001) blit(a, 1);
      else if (w >= 0.999) blit(b, 1);
      else {
        blit(a, 1);
        blit(b, w * w * (3 - 2 * w));
      }
    } else {
      const n = nearest(pos);
      if (!n) return;
      blit(n, 1);
    }
    ctx.globalAlpha = 1;
    canvas.dataset.ready = "true";
  };

  function schedule() {
    if (!raf && !disposed) raf = requestAnimationFrame(draw);
  }

  resize();
  window.addEventListener("resize", resize);

  return {
    seek(f: number) {
      pos = Math.min(FRAME_COUNT - 1, Math.max(0, f));
      settled = false;
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(() => {
        settled = true;
        schedule();
      }, 140);
      schedule();
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      window.clearTimeout(settleTimer);
      window.removeEventListener("resize", resize);
    },
  };
}
