"use client";

import { useEffect, useRef } from "react";
import Chapter, { useChapterTimeline } from "@/components/stage/Chapter";
import { gsap } from "@/lib/motion/gsap";
import { COMPANY } from "@/content/site";
import { formatLat, formatLon } from "@/lib/globe/geo";
import GlobeLayer from "@/components/stage/GlobeLayer";
import { useI18n } from "@/content/i18n/I18nProvider";
import styles from "./Hero.module.css";

export default function Hero() {
  return (
    <Chapter id="hero" stageClassName={styles.stage}>
      <HeroContent />
    </Chapter>
  );
}

function HeroContent() {
  const { dict, locale } = useI18n();
  const scope = useRef<HTMLDivElement>(null);
  const index = dict.hero.index;

  // Time-based entrance (after the loader hands over)
  useEffect(() => {
    const el = scope.current;
    if (!el || !document.documentElement.classList.contains("cine")) return;
    const q = gsap.utils.selector(el);
    gsap.set(q("[data-word]"), { yPercent: 135 });
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

  // Scroll choreography: the words part to let the world through
  useChapterTimeline(
    scope,
    (tl, q) => {
      tl.to(q("[data-line='2'] [data-move]"), { yPercent: -135, duration: 0.16, ease: "power2.in" }, 0.02)
        .to(q("[data-line='1']"), { y: "-7vh", duration: 0.2, ease: "power1.inOut" }, 0.02)
        .to(q("[data-line='3']"), { y: "11vh", duration: 0.22, ease: "power1.inOut" }, 0.02)
        .to(q("[data-line='1'] [data-move]"), { yPercent: -135, duration: 0.11, ease: "power2.in" }, 0.17)
        .to(q("[data-line='3'] [data-move]"), { yPercent: 135, duration: 0.12, ease: "power2.in" }, 0.22)
        .to(q("[data-hrule]"), { scaleX: 0, duration: 0.12 }, 0.18)
        .to(q("[data-meta]"), { opacity: 0, duration: 0.08 }, 0.12)
        .fromTo(q("[data-route-head]"), { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.06 }, 0.32)
        .fromTo(q("[data-route-rule]"), { scaleX: 0 }, { scaleX: 1, duration: 0.52, ease: "none" }, 0.34);
      const items = q("[data-index-item]");
      const step = 0.5 / items.length;
      items.forEach((item, i) => {
        const at = 0.37 + i * step;
        tl.fromTo(item, { opacity: 0, x: 0 }, { opacity: 1, duration: 0.04 }, at);
        tl.to(item, { color: "var(--paper)", duration: 0.03 }, at);
        if (i > 0) tl.to(items[i - 1], { color: "var(--graphite-400)", duration: 0.03 }, at);
      });
      tl.to(q("[data-route]"), { opacity: 0, y: -16, duration: 0.07, ease: "power2.in" }, 0.91);
    },
    [locale]
  );

  return (
    <div ref={scope} className={styles.hero}>
      <h1 className={`t-mega ${styles.title}`}>
        {dict.hero.lines.map((w, i) => (
          <span key={i} className={`${styles.line} ${i === 1 ? `${styles.indent} tone-graphite` : ""}`} data-line={i + 1}>
            <span className="mask">
              <span data-move>
                <span data-word>{w}</span>
              </span>
            </span>
          </span>
        ))}
      </h1>

      <div className={styles.foot}>
        <span className={styles.hrule} data-hrule />
        <p className={`t-label ${styles.metaL}`} data-meta>
          {COMPANY.legalName} · {dict.company.place}
        </p>
        <p className={`t-label t-mono ${styles.metaC}`} data-meta dir="ltr">
          {formatLat(COMPANY.coordinates.lat)} &nbsp;{formatLon(COMPANY.coordinates.lon)}
        </p>
        <p className={`t-label ${styles.metaR}`} data-meta data-cine-only>
          {dict.a11y.scroll} <span className={styles.scrollCue} aria-hidden="true" />
        </p>
      </div>

      {/* Route index: appears as the red route travels Asia → Europe */}
      <div className={styles.route} data-route data-cine-only aria-hidden="true">
        <p className={`t-label ${styles.routeHead}`} data-route-head>
          {dict.hero.route} &nbsp;<span className={styles.dim}>{dict.hero.routeSpan}</span>
        </p>
        <span className={styles.routeRule} data-route-rule />
        <ol className={styles.index}>
          {index.map((t, i) => (
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
