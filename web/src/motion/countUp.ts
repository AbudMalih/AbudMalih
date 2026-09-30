const fmt = new Intl.NumberFormat("de-DE", { useGrouping: false });

/**
 * Count an element up to its `data-count` value exactly once.
 * The final value is already in the server-rendered HTML; this only animates
 * from 0 and always ends on the exact integer – never NaN.
 */
export function countUp(el: HTMLElement, duration = 1400) {
  if (el.dataset.counted === "true") return;
  const target = Number(el.dataset.count);
  const suffix = el.dataset.suffix ?? "";
  el.dataset.counted = "true";
  if (!Number.isFinite(target)) return;
  const start = performance.now();
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 4);
    el.textContent = `${fmt.format(Math.round(target * eased))}${suffix}`;
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
