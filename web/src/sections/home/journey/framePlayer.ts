import { FRAME_COUNT, frameSrc, type FrameSet } from "./frames";

/**
 * Draws a pre-rendered frame sequence onto a canvas, driven by a fractional
 * frame position. Frames load progressively (every 8th first, then 4th, 2nd,
 * all) so the story is scrubbable early; missing frames fall back to the
 * nearest loaded one and neighbours are cross-faded for smooth motion.
 */
export function createFramePlayer(canvas: HTMLCanvasElement, set: FrameSet) {
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
    img.src = frameSrc(set, i);
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
  for (let k = 0; k < 6; k++) pump();

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

  const draw = () => {
    raf = 0;
    if (!ctx) return;
    const i0 = Math.floor(pos);
    const t = pos - i0;
    const a = frames[i0];
    const b = frames[Math.min(FRAME_COUNT - 1, i0 + 1)];
    if (a && b) {
      blit(a, 1);
      if (t > 0.02) blit(b, t);
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
      schedule();
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    },
  };
}
