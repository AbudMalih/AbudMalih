"use client";

import { useEffect, type RefObject } from "react";
import { gsap, ScrollTrigger } from "@/lib/motion/gsap";

/**
 * Motion for the 2027 homepage. GSAP + ScrollTrigger only, native scrolling.
 *
 *  [data-split]      headline whose [data-wi] words rise out of a mask once
 *  [data-rule]       hairline that draws once when it enters
 *  [data-lane]       route whose [data-lane-path] draws with scroll and whose
 *                    [data-stop] markers switch on as the line passes them
 *  [data-parallax]   image that drifts a few percent against the scroll
 *  [data-lit]        card lit by the pointer (CSS vars --px/--py/--lit)
 *  [data-magnet]     button that leans slightly towards the pointer
 *
 * Reduced motion or the static presentation: nothing is hidden or moved;
 * the page is complete without JavaScript. Every trigger is created inside
 * one gsap.context and reverted on unmount (language switch, navigation).
 */
export function useMotion27(root: RefObject<HTMLElement | null>, key: string) {
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const html = document.documentElement;
    const still =
      html.classList.contains("static") ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (still) {
      el.querySelectorAll("[data-stop]").forEach((s) =>
        s.setAttribute("data-on", ""),
      );
      return;
    }

    const ctx = gsap.context(() => {
      // headlines: words rise out of their mask
      el.querySelectorAll<HTMLElement>("[data-split]").forEach((h) => {
        const words = h.querySelectorAll("[data-wi]");
        gsap.set(words, { yPercent: 118 });
        ScrollTrigger.create({
          trigger: h,
          start: "top 88%",
          once: true,
          onEnter: () =>
            gsap.to(words, {
              yPercent: 0,
              duration: 1.15,
              ease: "expo.out",
              stagger: 0.055,
            }),
        });
      });

      // hairlines
      el.querySelectorAll<HTMLElement>("[data-rule]").forEach((r) => {
        gsap.set(r, { scaleX: 0 });
        ScrollTrigger.create({
          trigger: r,
          start: "top 92%",
          once: true,
          onEnter: () =>
            gsap.to(r, { scaleX: 1, duration: 1.2, ease: "expo.inOut" }),
        });
      });

      // the lane: drawn by scroll, stops light up as it passes them
      el.querySelectorAll<HTMLElement>("[data-lane]").forEach((lane) => {
        const path = lane.querySelector<SVGPathElement>("[data-lane-path]");
        const stops = Array.from(lane.querySelectorAll("[data-stop]"));
        const svgShown =
          path && getComputedStyle(path.ownerSVGElement!).display !== "none";
        const setStops = (p: number) =>
          stops.forEach((s, i) =>
            s.toggleAttribute("data-on", p >= i / stops.length - 0.001),
          );
        setStops(0);
        if (path && svgShown)
          gsap.set(path, { strokeDasharray: 1, strokeDashoffset: 1 });
        ScrollTrigger.create({
          trigger: lane,
          start: "top 82%",
          end: "bottom 50%",
          scrub: 0.6,
          onUpdate: (self) => {
            if (path && svgShown)
              path.style.strokeDashoffset = String(1 - self.progress);
            setStops(self.progress);
          },
        });
      });

      // photographs drift a little against the scroll
      el.querySelectorAll<HTMLElement>("[data-parallax]").forEach((img) => {
        gsap.fromTo(
          img,
          { yPercent: -4 },
          {
            yPercent: 4,
            ease: "none",
            scrollTrigger: {
              trigger: img.parentElement,
              start: "top bottom",
              end: "bottom top",
              scrub: true,
            },
          },
        );
      });
    }, el);

    // pointer effects: only for a real pointer that can hover
    const offs: (() => void)[] = [];
    if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      const on = <K extends keyof HTMLElementEventMap>(
        t: HTMLElement,
        type: K,
        fn: (e: HTMLElementEventMap[K]) => void,
      ) => {
        t.addEventListener(type, fn as EventListener, { passive: true });
        offs.push(() => t.removeEventListener(type, fn as EventListener));
      };
      el.querySelectorAll<HTMLElement>("[data-lit]").forEach((card) => {
        let raf = 0;
        on(card, "pointermove", (e) => {
          cancelAnimationFrame(raf);
          raf = requestAnimationFrame(() => {
            const r = card.getBoundingClientRect();
            card.style.setProperty("--px", `${e.clientX - r.left}px`);
            card.style.setProperty("--py", `${e.clientY - r.top}px`);
            card.style.setProperty("--lit", "1");
          });
        });
        on(card, "pointerleave", () => {
          cancelAnimationFrame(raf);
          card.style.setProperty("--lit", "0");
        });
      });
      el.querySelectorAll<HTMLElement>("[data-magnet]").forEach((btn) => {
        let raf = 0;
        on(btn, "pointermove", (e) => {
          cancelAnimationFrame(raf);
          raf = requestAnimationFrame(() => {
            const r = btn.getBoundingClientRect();
            const dx = (e.clientX - (r.left + r.width / 2)) / r.width;
            const dy = (e.clientY - (r.top + r.height / 2)) / r.height;
            btn.style.setProperty("--mx", `${(dx * 10).toFixed(1)}px`);
            btn.style.setProperty("--my", `${(dy * 8).toFixed(1)}px`);
          });
        });
        on(btn, "pointerleave", () => {
          cancelAnimationFrame(raf);
          btn.style.setProperty("--mx", "0px");
          btn.style.setProperty("--my", "0px");
        });
      });
    }

    // fonts can change line breaks: measure again once they are ready
    document.fonts?.ready.then(() => ScrollTrigger.refresh());

    return () => {
      offs.forEach((f) => f());
      ctx.revert();
    };
  }, [root, key]);
}
