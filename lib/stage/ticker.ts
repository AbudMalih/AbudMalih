"use client";
import { gsap } from "@/lib/motion/gsap";
import { stage } from "./store";

/** Subscribe to the shared GSAP ticker (same frame as Lenis + ScrollTrigger). */
export function onFrame(cb: (dt: number) => void) {
  let last = performance.now();
  const fn = () => {
    const now = performance.now();
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    cb(dt);
  };
  gsap.ticker.add(fn);
  return () => gsap.ticker.remove(fn);
}

/** Frame-rate independent damping factor. */
export const damp = (lambda: number, dt: number) => 1 - Math.exp(-lambda * dt);

export function markReady(key: string) {
  if (typeof window === "undefined") return;
  stage.ready[key] = true;
  window.dispatchEvent(new CustomEvent("luna:ready", { detail: key }));
}
