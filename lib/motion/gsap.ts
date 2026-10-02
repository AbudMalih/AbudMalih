"use client";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

let registered = false;
if (typeof window !== "undefined" && !registered) {
  gsap.registerPlugin(ScrollTrigger);
  gsap.defaults({ ease: "power3.out" });
  // Lenis drives scroll; tell ScrollTrigger not to fight mobile address bar resizes.
  ScrollTrigger.config({ ignoreMobileResize: true });
  registered = true;
}

export { gsap, ScrollTrigger };

/** Brand eases, mirrored from styles/tokens.css */
export const EASE = {
  out: "expo.out",
  inOut: "power3.inOut",
  in: "power3.in",
} as const;
