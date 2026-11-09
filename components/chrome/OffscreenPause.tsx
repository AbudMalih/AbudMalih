"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Pauses endless animations nobody can see.
 *
 * Browsers keep running infinite CSS animations and SVG (SMIL) animations
 * even when their element is far outside the viewport, so the compositor
 * keeps producing frames while the visitor reads the footer. That costs CPU,
 * GPU and battery and competes with scrolling (measured: ~45 % CPU while
 * idle at the footer of the homepage).
 *
 * This watches every element that runs an infinite CSS animation, and every
 * <svg> with SMIL animation, and pauses it while it is off-screen (with a
 * 200 px margin, so it is already running when it scrolls into view). Fixed
 * background layers are always "on screen", so for them it also checks
 * whether they are faded out (opacity 0 or hidden). Nothing changes visually:
 * an animation is only paused while it cannot be seen.
 */
export default function OffscreenPause() {
  const pathname = usePathname();

  useEffect(() => {
    if (
      typeof IntersectionObserver === "undefined" ||
      typeof document.getAnimations !== "function"
    )
      return;

    type State = { seen: boolean; fixed: boolean };
    const watched = new Map<Element, State>();

    const fadedOut = (el: Element) => {
      let n: Element | null = el;
      for (let i = 0; n && i < 10; i++, n = n.parentElement) {
        const cs = getComputedStyle(n);
        if (
          cs.display === "none" ||
          cs.visibility === "hidden" ||
          parseFloat(cs.opacity) < 0.01
        )
          return true;
      }
      return false;
    };
    const inFixedLayer = (el: Element) => {
      let n: Element | null = el;
      while (n && n !== document.body) {
        if (getComputedStyle(n).position === "fixed") return true;
        n = n.parentElement;
      }
      return false;
    };
    const apply = (el: Element) => {
      const s = watched.get(el);
      if (!s) return;
      const run = s.seen && !(s.fixed && fadedOut(el));
      if (el instanceof SVGSVGElement) {
        if (run) el.unpauseAnimations();
        else el.pauseAnimations();
      } else el.toggleAttribute("data-offscreen", !run);
    };

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const s = watched.get(e.target);
          if (!s) continue;
          s.seen = e.isIntersecting;
          apply(e.target);
        }
      },
      { rootMargin: "200px 0px" },
    );

    const watch = (el: Element) => {
      if (watched.has(el)) return;
      watched.set(el, { seen: true, fixed: inFixedLayer(el) });
      io.observe(el);
    };
    const scan = () => {
      for (const a of document.getAnimations()) {
        if (!(a instanceof CSSAnimation)) continue;
        if (a.effect?.getComputedTiming().iterations !== Infinity) continue;
        const target = (a.effect as KeyframeEffect | null)?.target;
        if (target) watch(target);
      }
      document
        .querySelectorAll("svg")
        .forEach(
          (svg) =>
            svg.querySelector("animate, animateMotion, animateTransform") &&
            watch(svg),
        );
    };

    // fixed layers fade with the scroll; animations may also start later
    // (reveals, hovers): re-check while scrolling, at most every 200 ms
    let timer = 0;
    let lastScan = performance.now();
    const onScroll = () => {
      if (timer) return;
      timer = window.setTimeout(() => {
        timer = 0;
        watched.forEach((s, el) => s.fixed && apply(el));
        if (performance.now() - lastScan > 1500) {
          lastScan = performance.now();
          scan();
        }
      }, 200);
    };

    scan();
    const t1 = window.setTimeout(scan, 1500);
    const t2 = window.setTimeout(scan, 4000);
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      io.disconnect();
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(timer);
      window.removeEventListener("scroll", onScroll);
      watched.forEach((_, el) => {
        if (el instanceof SVGSVGElement) el.unpauseAnimations();
        else el.removeAttribute("data-offscreen");
      });
      watched.clear();
    };
  }, [pathname]);

  return null;
}
