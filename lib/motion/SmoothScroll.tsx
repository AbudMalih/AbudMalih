"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import { gsap, ScrollTrigger } from "./gsap";
import { stage, detectTier, updateViewport } from "@/lib/stage/store";
import { isCine } from "./env";

let lenis: Lenis | null = null;
export const getLenis = () => lenis;

/** Scroll to an element or offset — through Lenis when present. */
export function scrollToTarget(target: string | number | HTMLElement, immediate = false) {
  if (lenis) {
    lenis.scrollTo(target, { immediate, duration: 2.2, easing: (t) => 1 - Math.pow(1 - t, 4) });
    return;
  }
  if (typeof target === "number") window.scrollTo({ top: target });
  else {
    const el = typeof target === "string" ? document.querySelector(target) : target;
    el?.scrollIntoView();
  }
}

/**
 * Owns the scroll engine: Lenis (desktop smooth scroll, native touch scroll),
 * bridged to GSAP's ticker so ScrollTrigger and Lenis update in the same frame.
 */
export default function SmoothScroll() {
  useEffect(() => {
    stage.cine = isCine();
    stage.rtl = document.documentElement.dir === "rtl";
    stage.tier = detectTier();
    updateViewport();

    // Review switches for comparing scroll / text clarity on real hardware.
    // Defaults are unchanged; nothing here applies without a query parameter.
    //   ?scroll=native  no Lenis (native scrolling)
    //   ?scroll=light   lighter interpolation, native wheel distance
    //   ?scroll=hybrid  current smoothing for mouse wheels, native 1:1 for trackpads
    //   ?text=stable    no permanent will-change on typography layers
    const q = new URLSearchParams(location.search);
    const mode = q.get("scroll");
    if (q.get("text") === "stable") document.documentElement.classList.add("text-stable");

    let onTick: ((time: number) => void) | null = null;
    if (stage.cine && mode !== "native") {
      const light = mode === "light";
      lenis = new Lenis({
        // Responsive, not heavy: the page follows input almost at once and
        // settles with a natural deceleration (time constant ≈ 150 ms; was
        // 0.085 ≈ 196 ms), and a wheel/trackpad gesture travels slightly
        // further than native (was 0.9, below native).
        lerp: light ? 0.2 : 0.11,
        wheelMultiplier: light ? 1 : 1.1,
        // Touch keeps native momentum — natural on phones.
        syncTouch: false,
        // hybrid: trackpads already deliver OS momentum; let them scroll natively
        virtualScroll:
          mode === "hybrid"
            ? (data) => {
                const e = data.event as WheelEvent & { wheelDeltaY?: number };
                if (e.type !== "wheel" || !lenis) return true;
                const trackpad = e.deltaMode === 0 && (e.wheelDeltaY === undefined ? !Number.isInteger(e.deltaY) : e.wheelDeltaY % 120 !== 0);
                lenis.options.smoothWheel = !trackpad;
                return true;
              }
            : undefined,
      });
      lenis.on("scroll", ScrollTrigger.update);
      onTick = (time: number) => lenis?.raf(time * 1000);
      gsap.ticker.add(onTick);
      gsap.ticker.lagSmoothing(0);
    }

    // Review hook: ?debug exposes the engine for automated capture.
    if (/[?&]debug\b/.test(location.search)) {
      (window as unknown as { __luna: unknown }).__luna = { lenis, stage, ScrollTrigger };
    }

    let rid = 0;
    const onResize = () => {
      cancelAnimationFrame(rid);
      rid = requestAnimationFrame(() => {
        updateViewport();
      });
    };
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      if (onTick) gsap.ticker.remove(onTick);
      lenis?.destroy();
      lenis = null;
    };
  }, []);

  return null;
}
