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
 * frame position.
 *
 * - Download: frames near the playhead first, then progressively (every 8th,
 *   4th, 2nd, all) so the whole story is scrubbable early.
 * - Draw: only when the visible frame changes, one image per change and the
 *   canvas never larger than the frames themselves (cheap on phones).
 */
export function createFramePlayer(canvas: HTMLCanvasElement, set: FrameSet, format: FrameFormat = "webp") {
  const ctx = canvas.getContext("2d", { alpha: false });
  const images: (HTMLImageElement | null)[] = new Array(FRAME_COUNT).fill(null);
  const requested = new Set<number>();
  let pos = 0;
  let disposed = false;
  let raf = 0;

  const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  const lean = Boolean(conn?.saveData) || /(^|-)2g|3g/.test(conn?.effectiveType ?? "");
  const step = lean ? 2 : 1;

  // progressive order without duplicates
  const order: number[] = [];
  for (const s of lean ? [8, 4, 2] : [8, 4, 2, 1]) {
    for (let i = 0; i < FRAME_COUNT; i += s) if (!order.includes(i)) order.push(i);
  }
  if (!order.includes(FRAME_COUNT - 1)) order.splice(1, 0, FRAME_COUNT - 1);

  /** Next frame to download: anything missing right around the playhead wins. */
  const pick = () => {
    const c = Math.round(pos);
    for (let d = 0; d <= 6; d++) {
      for (const i of [c + d * step, c - d * step]) {
        if (i >= 0 && i < FRAME_COUNT && !requested.has(i)) return i;
      }
    }
    for (const i of order) if (!requested.has(i)) return i;
    return -1;
  };

  const pump = () => {
    if (disposed) return;
    const i = pick();
    if (i < 0) return;
    requested.add(i);
    const img = new Image();
    img.decoding = "async";
    // never compete with the rest of the page for bandwidth
    img.fetchPriority = "low";
    img.src = frameSrc(set, i, format);
    img
      .decode()
      .then(() => {
        if (disposed) return;
        images[i] = img;
        if (Math.abs(i - pos) < 3) schedule();
      })
      .catch(() => {})
      .finally(pump);
  };
  for (let k = 0; k < (lean ? 3 : 6); k++) pump();

  const source = (i: number): HTMLImageElement | null => images[i] ?? null;

  const nearest = (f: number) => {
    const c = Math.round(f);
    for (let d = 0; d < FRAME_COUNT; d++) {
      const a = source(c - d);
      if (a) return a;
      const b = source(c + d);
      if (b) return b;
    }
    return null;
  };

  const resize = () => {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    // never draw larger than the source frames – no quality gain, only cost
    const scale = Math.min(dpr, Math.max(set.width / Math.max(1, r.width), set.height / Math.max(1, r.height), 1));
    const w = Math.max(1, Math.round(r.width * scale));
    const h = Math.max(1, Math.round(r.height * scale));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      shown = -1; // canvas was cleared
    }
    schedule();
  };

  const blit = (img: HTMLImageElement) => {
    if (!ctx) return;
    const cw = canvas.width;
    const ch = canvas.height;
    const s = Math.max(cw / set.width, ch / set.height);
    const w = set.width * s;
    const h = set.height * s;
    ctx.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h);
  };

  // Draw only when the visible frame changes – one image per change, no
  // per-tick redraws (keeps the main thread and compositor free).
  let shown = -1;
  let shownSource: HTMLImageElement | null = null;
  const draw = () => {
    raf = 0;
    if (!ctx) return;
    const i = Math.round(pos);
    const img = source(i) ?? nearest(pos);
    if (!img) return;
    if (i === shown && img === shownSource) return;
    blit(img);
    shown = i;
    shownSource = img;
    canvas.dataset.ready = "true";
  };

  function schedule() {
    if (!raf && !disposed) raf = requestAnimationFrame(draw);
  }

  resize();
  window.addEventListener("resize", resize);

  return {
    seek(f: number) {
      const next = Math.min(FRAME_COUNT - 1, Math.max(0, f));
      const moved = Math.round(next) !== Math.round(pos);
      pos = next;
      if (moved) schedule();
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    },
  };
}
