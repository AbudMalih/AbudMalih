"use client";

import { useEffect, useRef } from "react";
import Chapter, { useChapterTimeline } from "@/components/stage/Chapter";
import { gsap } from "@/lib/motion/gsap";
import { COMPANY } from "@/content/site";
import { formatLat, formatLon } from "@/lib/globe/geo";
import GlobeLayer from "@/components/stage/GlobeLayer";
import styles from "./Hero.module.css";

const INDEX = ["Sourcing", "Import", "Brands", "Distribution"];

export default function Hero() {
  return (
    <Chapter id="hero" title="Trade without borders" stageClassName={styles.stage}>
      <HeroContent />
    </Chapter>
  );
}

function HeroContent() {
  const scope = useRef<HTMLDivElement>(null);

  // Time-based entrance (after the loader hands over)
  useEffect(() => {
    const el = scope.current;
    if (!el || !document.documentElement.classList.contains("cine")) return;
    const q = gsap.utils.selector(el);
    gsap.set(q("[data-word]"), { yPercent: 108 });
    gsap.set(q("[data-meta]"), { opacity: 0 });
    gsap.set(q("[data-hrule]"), { scaleX: 0 });
    const play = () => {
      const tl = gsap.timeline({ defaults: { ease: "expo.out" } });
      tl.to(q("[data-word]"), { yPercent: 0, duration: 1.6, stagger: 0.12 }, 0.1)
        .to(q("[data-hrule]"), { scaleX: 1, duration: 1.4, ease: "expo.inOut" }, 0.2)
        .to(q("[data-meta]"), { opacity: 1, duration: 1.0, stagger: 0.08, ease: "power2.out" }, 0.7);
    };
    if (!document.documentElement.classList.contains("intro-pending")) play();
    else window.addEventListener("luna:intro", play, { once: true });
    return () => window.removeEventListener("luna:intro", play);
  }, []);

  // Scroll choreography — the words part to let the world through
  useChapterTimeline(scope, (tl, q) => {
    tl.to(q("[data-line='2'] [data-move]"), { yPercent: -110, duration: 0.16, ease: "power2.in" }, 0.02)
      .to(q("[data-line='1']"), { y: "-14vh", duration: 0.22, ease: "power1.inOut" }, 0.02)
      .to(q("[data-line='3']"), { y: "12vh", duration: 0.22, ease: "power1.inOut" }, 0.02)
      .to(q("[data-line='1'] [data-move]"), { yPercent: -112, duration: 0.12, ease: "power2.in" }, 0.2)
      .to(q("[data-line='3'] [data-move]"), { yPercent: 112, duration: 0.12, ease: "power2.in" }, 0.22)
      .to(q("[data-hrule]"), { scaleX: 0, transformOrigin: "right", duration: 0.12 }, 0.18)
      .to(q("[data-meta]"), { opacity: 0, duration: 0.08 }, 0.12)
      .fromTo(q("[data-route-head]"), { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.06 }, 0.32)
      .fromTo(q("[data-route-rule]"), { scaleX: 0 }, { scaleX: 1, duration: 0.5, ease: "none" }, 0.34);
    q("[data-index-item]").forEach((item, i) => {
      tl.fromTo(item, { opacity: 0, x: -10 }, { opacity: 1, x: 0, duration: 0.05 }, 0.38 + i * 0.12);
      tl.to(item, { color: "var(--paper)", duration: 0.04 }, 0.38 + i * 0.12);
      if (i > 0) tl.to(q("[data-index-item]")[i - 1], { color: "var(--graphite-400)", duration: 0.04 }, 0.38 + i * 0.12);
    });
    tl.to(q("[data-route]"), { opacity: 0, y: -16, duration: 0.07, ease: "power2.in" }, 0.9);
  });

  return (
    <div ref={scope} className={styles.hero}>
      <h1 className={`t-mega ${styles.title}`}>
        <span className={styles.line} data-line="1">
          <span className="mask">
            <span data-move>
              <span data-word>Trade</span>
            </span>
          </span>
        </span>
        <span className={`${styles.line} ${styles.indent} tone-graphite`} data-line="2">
          <span className="mask">
            <span data-move>
              <span data-word>Without</span>
            </span>
          </span>
        </span>
        <span className={styles.line} data-line="3">
          <span className="mask">
            <span data-move>
              <span data-word>Borders.</span>
            </span>
          </span>
        </span>
      </h1>

      <div className={styles.foot}>
        <span className={styles.hrule} data-hrule />
        <p className={`t-label ${styles.metaL}`} data-meta>
          {COMPANY.legalName} — {COMPANY.cityEn}, {COMPANY.country}
        </p>
        <p className={`t-label t-mono ${styles.metaC}`} data-meta>
          {formatLat(COMPANY.coordinates.lat)} &nbsp;{formatLon(COMPANY.coordinates.lon)}
        </p>
        <p className={`t-label ${styles.metaR}`} data-meta data-cine-only>
          Scroll <span className={styles.scrollCue} aria-hidden="true" />
        </p>
      </div>

      {/* Route index — appears as the red route travels Asia → Europe */}
      <div className={styles.route} data-route data-cine-only aria-hidden="true">
        <p className={`t-label ${styles.routeHead}`} data-route-head>
          Route &nbsp;<span className={styles.dim}>Asia — Europe</span>
        </p>
        <span className={styles.routeRule} data-route-rule />
        <ol className={styles.index}>
          {INDEX.map((t, i) => (
            <li key={t} data-index-item className={styles.indexItem}>
              <span className={styles.dim}>{String(i + 1).padStart(2, "0")}</span> {t}
            </li>
          ))}
        </ol>
      </div>

      <div data-static-only className={styles.staticGlobe}>
        <GlobeLayer mode="static" />
      </div>
    </div>
  );
}
