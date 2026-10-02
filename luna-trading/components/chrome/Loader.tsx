"use client";

import { useEffect, useRef } from "react";
import { gsap } from "@/lib/motion/gsap";
import { stage } from "@/lib/stage/store";
import { getLenis } from "@/lib/motion/SmoothScroll";
import { LunaLogo } from "@/components/brand/Logos";
import styles from "./Loader.module.css";

const REQUIRED = ["globe"];
const MIN_MS = 1100;
const MAX_MS = 7000;

/**
 * Identity loader. The red "+" holds the screen while the globe and fonts
 * load (the hairline is real progress), then opens into the official logo,
 * which travels to its place in the navigation. Shortened on repeat visits.
 */
export default function Loader() {
  const root = useRef<HTMLDivElement>(null);
  const plus = useRef<HTMLDivElement>(null);
  const lineL = useRef<HTMLDivElement>(null);
  const lineR = useRef<HTMLDivElement>(null);
  const plate = useRef<HTMLDivElement>(null);
  const count = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const html = document.documentElement;
    const finishIntro = () => {
      html.classList.remove("intro-pending");
      window.dispatchEvent(new Event("luna:intro"));
      gsap.to(stage, { intro: 1, duration: 2.4, ease: "power2.inOut", onUpdate: () => void stage.version++ });
    };
    if (!html.classList.contains("cine")) {
      stage.intro = 1;
      window.dispatchEvent(new Event("luna:intro"));
      return;
    }
    const seen = html.classList.contains("intro-seen");
    if (window.scrollY > 10) {
      // deep link / reload mid-page: no ceremony
      root.current?.remove();
      finishIntro();
      return;
    }
    getLenis()?.stop();
    window.scrollTo(0, 0);

    const t0 = performance.now();
    const shown = { v: 0 };
    let done = false;
    const ctx = gsap.context(() => {
      gsap.set(plate.current, { xPercent: -50, yPercent: -50 });
      gsap.fromTo(plus.current, { scale: 0, rotate: -90 }, { scale: 1, rotate: 0, duration: 0.9, ease: "expo.out", delay: 0.15 });
    }, root);

    const fontsReady = document.fonts?.ready.then(() => (stage.ready.fonts = true)) ?? Promise.resolve();
    void fontsReady;

    const tick = () => {
      if (done) return;
      const elapsed = performance.now() - t0;
      const keys = [...REQUIRED, "fonts"];
      const real = keys.filter((k) => stage.ready[k]).length / keys.length;
      const timeGate = Math.min(1, elapsed / MIN_MS);
      const target = Math.min(real, timeGate);
      shown.v += (target - shown.v) * 0.12;
      const v = shown.v;
      if (lineL.current) lineL.current.style.transform = `scaleX(${v})`;
      if (lineR.current) lineR.current.style.transform = `scaleX(${v})`;
      if (count.current) count.current.textContent = String(Math.round(v * 100)).padStart(3, "0");
      if ((v > 0.995 && real === 1) || elapsed > MAX_MS) {
        done = true;
        exit();
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);

    function exit() {
      const brand = document.getElementById("nav-brand");
      const tl = gsap.timeline({
        defaults: { ease: "expo.inOut" },
        onComplete: () => {
          try {
            sessionStorage.setItem("luna:intro", "1");
          } catch {}
          getLenis()?.start();
          root.current?.remove();
        },
      });
      tl.to([lineL.current, lineR.current], { scaleX: 0, duration: 0.7 }, 0);
      tl.to(count.current, { opacity: 0, duration: 0.3 }, 0);
      if (!seen) {
        tl.fromTo(plate.current, { clipPath: "inset(50% 50% 50% 50%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: 1.0 }, 0.45);
        tl.to(plus.current, { scale: 0, duration: 0.5, ease: "power3.in" }, 0.45);
        tl.to({}, { duration: 0.55 });
        if (brand && plate.current) {
          const b = brand.getBoundingClientRect();
          const p = plate.current.getBoundingClientRect();
          tl.to(plate.current, {
            x: b.left + b.width / 2 - (p.left + p.width / 2),
            y: b.top + b.height / 2 - (p.top + p.height / 2),
            scale: b.width / p.width,
            duration: 1.1,
          });
        }
        tl.to(root.current, { backgroundColor: "rgba(6,6,7,0)", duration: 0.8, ease: "power2.out" }, "<0.35");
      } else {
        tl.to(plus.current, { scale: 0, duration: 0.5, ease: "power3.in" }, 0.2);
        tl.to(root.current, { backgroundColor: "rgba(6,6,7,0)", duration: 0.6, ease: "power2.out" }, 0.5);
      }
      tl.add(() => finishIntro(), seen ? 0.55 : "-=0.6");
      if (!seen) tl.set(plate.current, { opacity: 0 });
    }

    return () => {
      done = true;
      ctx.revert();
    };
  }, []);

  return (
    <div ref={root} className={styles.loader} aria-hidden="true">
      <div className={styles.center}>
        <div ref={lineL} className={`${styles.line} ${styles.left}`} />
        <div ref={lineR} className={`${styles.line} ${styles.right}`} />
        <div ref={plus} className={styles.plus}>
          <i />
          <i />
        </div>
        <span ref={count} className={`t-label t-mono ${styles.count}`}>000</span>
      </div>
      <div ref={plate} className={styles.plate}>
        <LunaLogo height="100%" />
      </div>
    </div>
  );
}
