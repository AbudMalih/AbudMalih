"use client";

import Link from "next/link";
import { Fragment, useEffect, useRef } from "react";
import Chapter, { useChapterTimeline } from "@/components/stage/Chapter";
import { gsap } from "@/lib/motion/gsap";
import { COMPANY } from "@/content/site";
import { formatLat, formatLon } from "@/lib/globe/coords";
import GlobeLayer from "@/components/stage/GlobeLayer";
import HeroSignal from "./HeroSignal";
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
  const { dict, locale, href } = useI18n();
  const scope = useRef<HTMLDivElement>(null);
  const period = useRef<HTMLSpanElement>(null);
  const lines = dict.hero.lines;

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
      tl.to(q("[data-word]"), { yPercent: 0, duration: 1.1, stagger: 0.08 }, 0)
        .to(
          q("[data-hrule]"),
          { scaleX: 1, duration: 1.0, ease: "expo.inOut" },
          0.1,
        )
        .to(
          q("[data-meta]"),
          { opacity: 1, duration: 0.7, stagger: 0.06, ease: "power2.out" },
          0.4,
        );
    };
    if (!document.documentElement.classList.contains("intro-pending")) play();
    else window.addEventListener("luna:intro", play, { once: true });
    return () => window.removeEventListener("luna:intro", play);
  }, []);

  // Scroll: one calm move. The opening block lifts and fades as the world
  // turns; nothing splits or flies.
  useChapterTimeline(
    scope,
    (tl, q) => {
      tl.to(
        q("[data-block]"),
        { y: "-6vh", opacity: 0, duration: 0.26, ease: "power1.in" },
        0.04,
      ).to(q("[data-meta]"), { opacity: 0, duration: 0.1 }, 0.04);
    },
    [locale],
  );

  return (
    <div ref={scope} className={styles.hero}>
      <div className={styles.block} data-block>
        <p className={`t-label ${styles.eyebrow}`} data-meta>
          <span className={styles.eyeDot} />
          {dict.hero.eyebrow}
        </p>
        <h1 className={`t-mega ${styles.title}`}>
          {lines.map((w, i) => {
            // only the closing period carries the red: it is the route's origin
            const last = i === lines.length - 1 && w.endsWith(".");
            return (
              <Fragment key={i}>
                {i > 0 && " "}
                <span
                  className={`${styles.line} ${i === 1 ? styles.red : ""}`}
                  data-line={i + 1}
                >
                  <span className="mask">
                    <span data-move>
                      <span data-word>
                        {last ? w.slice(0, -1) : w}
                        {last && (
                          <span
                            ref={period}
                            className={styles.period}
                            data-period
                          >
                            .
                          </span>
                        )}
                      </span>
                    </span>
                  </span>
                </span>
              </Fragment>
            );
          })}
        </h1>
        <p className={`t-lead ${styles.lead}`} data-meta>
          {dict.hero.lead}
        </p>
        <div className={`${styles.actions} interactive`} data-meta>
          <Link
            href={href("/contact")}
            className={styles.btnRed}
            data-cursor="invert"
          >
            {dict.nav.cta}
            <span className={styles.badge} aria-hidden="true" />
          </Link>
          <Link
            href={href("/import")}
            className={styles.btnGhost}
            data-cursor="link"
          >
            {dict.hero.ctaImport}
          </Link>
        </div>
      </div>

      <div className={styles.foot}>
        <span className={styles.hrule} data-hrule />
        <p className={`t-label ${styles.metaL}`} data-meta>
          {COMPANY.name} · {dict.company.place}
        </p>
        <p className={`t-label t-mono ${styles.metaC}`} data-meta dir="ltr">
          {formatLat(COMPANY.coordinates.lat)} &nbsp;
          {formatLon(COMPANY.coordinates.lon)}
        </p>
        <p className={`t-label ${styles.metaR}`} data-meta data-cine-only>
          {dict.a11y.scroll}{" "}
          <span className={styles.scrollCue} aria-hidden="true" />
        </p>
      </div>

      <HeroSignal period={period} />

      <div data-static-only className={styles.staticGlobe}>
        <GlobeLayer mode="static" />
      </div>
    </div>
  );
}
