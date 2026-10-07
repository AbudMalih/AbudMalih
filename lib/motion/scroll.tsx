"use client";

import { useEffect } from "react";
import "./gsap"; // registers ScrollTrigger once for the whole app
import { stage, detectTier, updateViewport } from "@/lib/stage/store";
import { isCine } from "./env";

/**
 * Scrolling is the browser's own (native) on every device: the document
 * follows the trackpad, wheel or finger 1:1 with the operating system's
 * momentum. GSAP ScrollTrigger reads that native scroll position, so all
 * scene choreography stays scroll-driven and deterministic in both
 * directions. (Lenis smooth scrolling was removed after on-device testing.)
 */

/** Pause / resume page scrolling (intro, open menu). */
export function lockScroll(locked: boolean) {
  document.documentElement.style.overflow = locked ? "hidden" : "";
}

/** Scroll to an element or offset (smoothly unless immediate). */
export function scrollToTarget(target: string | number | HTMLElement, immediate = false) {
  const behavior: ScrollBehavior = immediate ? "auto" : "smooth";
  if (typeof target === "number") window.scrollTo({ top: target, behavior });
  else {
    const el = typeof target === "string" ? document.querySelector(target) : target;
    el?.scrollIntoView({ behavior });
  }
}

/** Initialises the shared stage (environment, viewport) for scroll-driven scenes. */
export default function ScrollSetup() {
  useEffect(() => {
    stage.cine = isCine();
    stage.rtl = document.documentElement.dir === "rtl";
    stage.tier = detectTier();
    updateViewport();

    let rid = 0;
    const onResize = () => {
      cancelAnimationFrame(rid);
      rid = requestAnimationFrame(() => updateViewport());
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return null;
}
