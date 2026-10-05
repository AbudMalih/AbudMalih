"use client";

import { useEffect, type RefObject } from "react";
import { ScrollTrigger, gsap } from "@/lib/motion/gsap";

/**
 * Scroll-scrubbed passages between Luna Trading and a brand world.
 *  - [data-passage="in" | "out"]: a tall section with a sticky stage. Its
 *    progress is written to --p (0 = Luna Trading, 1 = brand world; "out"
 *    runs the same scene backwards) and its header tone flips at the middle,
 *    once, where the ground has really turned.
 *  - [data-parallax]: a gentle depth offset (--q, 0..1 across the viewport).
 * Pure functions of scroll position: fast, reverse and deep-linked scrolling
 * always land on the right state. Reduced motion: CSS shows a short static
 * passage instead (html.static), nothing is scrubbed.
 */
export function usePassage(root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const passages = Array.from(el.querySelectorAll<HTMLElement>("[data-passage]"));
    if (document.documentElement.classList.contains("static")) {
      passages.forEach((sec) => {
        // a short static band: its upper part still carries the ground it comes from
        sec.dataset.tone = sec.dataset.passage === "out" ? "dark" : "light";
      });
      return;
    }
    const ctx = gsap.context(() => {
      passages.forEach((sec) => {
        const out = sec.dataset.passage === "out";
        const set = (v: number) => {
          const p = out ? 1 - v : v;
          sec.style.setProperty("--p", p.toFixed(4));
          // the band covers the header at p ≈ 0.6 (see .pEmerald)
          const tone = p > 0.6 ? "dark" : "light";
          if (sec.dataset.tone !== tone) {
            sec.dataset.tone = tone;
            window.dispatchEvent(new Event("luna:tone"));
          }
        };
        ScrollTrigger.create({
          trigger: sec,
          start: "top top",
          end: "bottom bottom",
          onUpdate: (st) => set(st.progress),
          onRefresh: (st) => set(st.progress),
        });
      });
      el.querySelectorAll<HTMLElement>("[data-parallax]").forEach((n) => {
        const sec = (n.closest("section") as HTMLElement) ?? n;
        const set = (v: number) => n.style.setProperty("--q", v.toFixed(4));
        ScrollTrigger.create({
          trigger: sec,
          start: "top bottom",
          end: "bottom top",
          onUpdate: (st) => set(st.progress),
          onRefresh: (st) => set(st.progress),
        });
      });
    }, el);
    return () => ctx.revert();
  }, [root]);
}
