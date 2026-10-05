"use client";

import { useEffect, type RefObject } from "react";
import { gsap, ScrollTrigger } from "@/lib/motion/gsap";

/**
 * Motion for editorial (non-cinematic) pages. Light and deterministic:
 *  - [data-reveal]: revealed once when it enters the viewport (CSS does the rest)
 *  - [data-fill]: a route fill scrubbed by scroll (scaleX / scaleY via --p)
 *  - [data-node]: a route node that switches on once its point is passed
 *  - header tone follows the section under the header ([data-tone])
 * Reduced motion / static: everything is shown complete (CSS on html.static).
 */
export function usePageMotion(root: RefObject<HTMLElement | null>) {
  // reveals
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const items = Array.from(el.querySelectorAll<HTMLElement>("[data-reveal]"));
    if (!("IntersectionObserver" in window) || document.documentElement.classList.contains("static")) {
      items.forEach((i) => i.setAttribute("data-in", ""));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          e.target.setAttribute("data-in", "");
          io.unobserve(e.target);
        });
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.12 }
    );
    items.forEach((i) => {
      // anything already in the first viewport (the hero route sits low) reveals at once
      if (window.scrollY < 10 && i.getBoundingClientRect().top < window.innerHeight) i.setAttribute("data-in", "");
      else io.observe(i);
    });
    return () => io.disconnect();
  }, [root]);

  // scrubbed route fills + node activation (a pure function of scroll)
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    if (document.documentElement.classList.contains("static")) {
      el.querySelectorAll<HTMLElement>("[data-fill]").forEach((f) => f.style.setProperty("--p", "1"));
      el.querySelectorAll<HTMLElement>("[data-node]").forEach((n) => n.setAttribute("data-on", ""));
      return;
    }
    const ctx = gsap.context(() => {
      el.querySelectorAll<HTMLElement>("[data-fill]").forEach((f) => {
        const track = (f.closest("[data-track]") as HTMLElement) ?? f;
        ScrollTrigger.create({
          trigger: track,
          start: f.dataset.start ?? "top 72%",
          end: f.dataset.end ?? "bottom 55%",
          onUpdate: (st) => f.style.setProperty("--p", st.progress.toFixed(4)),
          onRefresh: (st) => f.style.setProperty("--p", st.progress.toFixed(4)),
        });
      });
      el.querySelectorAll<HTMLElement>("[data-node]").forEach((n) => {
        ScrollTrigger.create({
          trigger: n,
          start: n.dataset.at ?? "top 62%",
          onToggle: (st) => n.toggleAttribute("data-on", st.isActive || st.progress > 0),
          onUpdate: (st) => n.toggleAttribute("data-on", st.progress > 0),
          end: "max",
        });
      });
    }, el);
    return () => ctx.revert();
  }, [root]);

  // header tone follows the section under the header
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const html = document.documentElement;
    const sections = Array.from(el.querySelectorAll<HTMLElement>("[data-tone]"));
    let last = "";
    const probe = () => {
      // each section fades in from the previous ground over its seam, so the
      // header flips tone at the seam's midpoint, where the colour really turns
      const vh = window.innerHeight;
      const seam = Math.min(240, Math.max(120, vh * 0.2));
      const y = Math.min(60, vh * 0.06) - seam / 2;
      let tone = "dark";
      for (const s of sections) {
        if (s.getBoundingClientRect().top <= y || s === sections[0]) tone = s.dataset.tone === "light" ? "light" : "dark";
      }
      if (tone !== last) {
        last = tone;
        html.dataset.tone = tone;
      }
    };
    probe();
    window.addEventListener("scroll", probe, { passive: true });
    window.addEventListener("resize", probe);
    return () => {
      window.removeEventListener("scroll", probe);
      window.removeEventListener("resize", probe);
      delete html.dataset.tone;
    };
  }, [root]);
}
