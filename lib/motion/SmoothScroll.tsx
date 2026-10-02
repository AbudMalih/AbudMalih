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
    stage.tier = detectTier();
    updateViewport();

    let onTick: ((time: number) => void) | null = null;
    if (stage.cine) {
      lenis = new Lenis({
        lerp: 0.085,
        wheelMultiplier: 0.9,
        // Touch keeps native momentum — natural on phones.
        syncTouch: false,
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
