"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import VariableProximity from "@/components/lab/rb/VariableProximity";
import ScrollReveal from "@/components/lab/rb/ScrollReveal";
import ScrambledText from "@/components/lab/rb/ScrambledText";
import s from "./TypeExperiment.module.css";

gsap.registerPlugin(ScrollTrigger, SplitText);

/**
 * Five typographic moments, all with existing Luna Trading copy:
 * 1 the headline parts like two doors and lets the lead through (SplitText + scrub)
 * 2 weight follows the pointer (React Bits VariableProximity, Inter Tight wght axis)
 * 3 a paragraph sharpens as it is read (React Bits ScrollReveal)
 * 4 outline → solid fill, tied to scroll (background-clip text)
 * 5 the word EUROPA as a window onto the port, opening to full bleed
 * + trade lanes that decode under the pointer (React Bits ScrambledText)
 * + the same opening in Arabic, split by words, right to left
 */
export default function TypeExperiment() {
  const root = useRef<HTMLDivElement>(null);
  const vpBox = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (still) return;
    const ctx = gsap.context(() => {
      // 1 · opening: characters rise out of their mask, then the lines part
      const h = SplitText.create("[data-open] [data-chars]", { type: "chars,words", mask: "chars" });
      gsap.from(h.chars, { yPercent: 120, rotate: 8, duration: 1.3, ease: "expo.out", stagger: 0.025, delay: 0.15 });
      gsap.from("[data-open] [data-sub]", { opacity: 0, y: 16, duration: 1, delay: 0.9, ease: "expo.out" });
      const part = gsap.timeline({
        scrollTrigger: { trigger: "[data-open]", start: "top top", end: "bottom bottom", scrub: 0.8 },
      });
      part
        .to("[data-l1]", { xPercent: -22, yPercent: -120, ease: "power2.inOut" }, 0)
        .to("[data-l2]", { xPercent: 22, yPercent: 120, ease: "power2.inOut" }, 0)
        .to("[data-l3]", { scale: 0.42, opacity: 0, ease: "power2.inOut" }, 0)
        .fromTo("[data-between]", { opacity: 0, scale: 0.92, filter: "blur(10px)" }, { opacity: 1, scale: 1, filter: "blur(0px)", ease: "power2.out" }, 0.25)
        .to("[data-open] [data-sub]", { opacity: 0 }, 0);

      // 4 · outline → fill, tied to the reading position
      gsap.fromTo("[data-fill]", { "--fill": "0%" }, {
        "--fill": "100%",
        ease: "none",
        scrollTrigger: { trigger: "[data-fillwrap]", start: "top 75%", end: "bottom 40%", scrub: true },
      });
      const items = gsap.utils.toArray<HTMLElement>("[data-disc] li");
      gsap.from(items, {
        yPercent: 60, opacity: 0, stagger: 0.06, ease: "expo.out", duration: 1,
        scrollTrigger: { trigger: "[data-disc]", start: "top 80%" },
      });

      // 5 · EUROPA: the type is a window; it opens until the port fills the screen
      const win = gsap.timeline({
        scrollTrigger: { trigger: "[data-window]", start: "top top", end: "bottom bottom", scrub: 0.6 },
      });
      win
        .fromTo("[data-word]", { scale: 1 }, { scale: 11, ease: "power2.in", transformOrigin: "47% 52%" }, 0)
        .fromTo("[data-word]", { backgroundPosition: "50% 40%" }, { backgroundPosition: "50% 60%", ease: "none" }, 0)
        .to("[data-photo]", { opacity: 1, ease: "none", duration: 0.25 }, 0.5)
        .from("[data-caption]", { opacity: 0, y: 30, duration: 0.2 }, 0.7);

      // Arabic: words (never letters: Arabic glyphs join), right to left
      const ar = SplitText.create("[data-ar]", { type: "words", mask: "words" });
      gsap.from(ar.words, {
        yPercent: 110, duration: 1.2, ease: "expo.out", stagger: { each: 0.08 },
        scrollTrigger: { trigger: "[data-ar]", start: "top 80%" },
      });
    }, root);
    return () => ctx.revert();
  }, []);

  return (
    <div ref={root} className={s.root}>
      {/* 1 · the headline parts and lets the lead through */}
      <section className={s.open} data-open aria-labelledby="t-open">
        <div className={s.sticky}>
          <p className={`mono ${s.kicker}`} data-sub>01 · SplitText · Maske · Scroll-Scrub</p>
          <h1 id="t-open" className={s.h1} data-chars>
            <span className={s.line} data-l1>Handel</span>
            <span className={`${s.line} ${s.serif}`} data-l3>ohne</span>
            <span className={s.line} data-l2>Grenzen.</span>
          </h1>
          <p className={s.between} data-between>
            Beschaffung, Import, Marken und E-Commerce aus einer Hand. Von Köln aus verbinden wir Hersteller in Asien mit dem europäischen Markt.
          </p>
          <p className={`mono ${s.scrollHint}`} data-sub aria-hidden="true">Scrollen ↓</p>
        </div>
      </section>

      {/* 2 · variable weight follows the pointer */}
      <section className={s.vp} aria-labelledby="t-vp">
        <p className={`mono ${s.kicker}`}>02 · React Bits VariableProximity · variable Schriftachse</p>
        <div ref={vpBox} className={s.vpBox}>
          <h2 id="t-vp" className={s.vpText}>
            <VariableProximity
              label="Von der Quelle bis zum Markt."
              containerRef={vpBox}
              fromFontVariationSettings="'wght' 250"
              toFontVariationSettings="'wght' 900"
              radius={180}
              falloff="gaussian"
              fromColor="#a6a7ac"
              toColor="#f4f1ea"
              idleWave
            />
          </h2>
        </div>
        <p className={s.note}>Bewegen Sie den Zeiger über die Zeile. Auf Touch-Geräten läuft eine ruhige Welle.</p>
      </section>

      {/* 3 · the paragraph sharpens as it is read */}
      <section className={s.read} aria-labelledby="t-read">
        <p className={`mono ${s.kicker}`}>03 · React Bits ScrollReveal · Unschärfe zu Klarheit</p>
        <h2 id="t-read" className={s.readHead}>Menschen, die Ware <em>in die Hand nehmen.</em></h2>
        <ScrollReveal enableBlur baseOpacity={0.12} baseRotation={2} blurStrength={6} textClassName={s.readText}>
          Hinter jedem Container stehen Entscheidungen. Wir prüfen Muster, stimmen Details ab und begleiten die Ware, bis sie im Markt ankommt. Persönlich und aus Köln.
        </ScrollReveal>
      </section>

      {/* 4 · outline to fill */}
      <section className={s.fill} data-fillwrap aria-labelledby="t-fill">
        <p className={`mono ${s.kicker}`}>04 · Kontur → Fläche, an die Leseposition gebunden</p>
        <h2 id="t-fill" className={s.fillText} data-fill>
          Sechs Disziplinen. Eine Kette.
        </h2>
        <ol className={s.disc} data-disc>
          {["Globale Beschaffung", "Import & Export", "Produktentwicklung", "Markenentwicklung", "E-Commerce", "Distribution"].map((d, i) => (
            <li key={d}><span className="mono">0{i + 1}</span>{d}</li>
          ))}
        </ol>
      </section>

      {/* 5 · EUROPA as a window */}
      <section className={s.window} data-window aria-labelledby="t-win">
        <div className={s.sticky}>
          <p className={`mono ${s.kicker} ${s.kickerAbs}`}>05 · Bild im Text · Maske öffnet sich</p>
          <h2 id="t-win" className={s.word} data-word>EUROPA</h2>
          <div className={s.photo} data-photo aria-hidden="true" />
          <p className={s.caption} data-caption>
            Deutschland als Basis. <em>Europa als Markt.</em>
          </p>
        </div>
      </section>

      {/* + lanes that decode under the pointer */}
      <section className={s.lanes} aria-labelledby="t-lanes">
        <p className={`mono ${s.kicker}`}>+ React Bits ScrambledText · Routen entschlüsseln sich unter dem Zeiger</p>
        <h2 id="t-lanes" className="sr-only">Typische Handelsrouten</h2>
        <div className={s.laneBox}>
          <ScrambledText radius={110} duration={1.1} speed={0.5} scrambleChars=".:/-+" className={s.scramble}>
            Shanghai → Hamburg · Ningbo → Rotterdam · Shenzhen → Antwerpen · Qingdao → Bremerhaven · Xi’an → Duisburg · Schiene · Guangzhou → Frankfurt · Luft · Köln 50.94° N 006.96° E
          </ScrambledText>
        </div>
      </section>

      {/* + Arabic, right to left */}
      <section className={s.arabic} dir="rtl" lang="ar" aria-labelledby="t-ar">
        <p className={`mono ${s.kicker}`} dir="ltr">+ Arabisch · Wörter statt Buchstaben · von rechts nach links</p>
        <h2 id="t-ar" className={s.arH} data-ar>
          تجارة <span className={s.arRed}>بلا</span> حدود.
        </h2>
        <p className={s.arLead}>التوريد والاستيراد والعلامات التجارية والتجارة الإلكترونية من مصدر واحد. من كولونيا نربط المصنّعين في آسيا بالسوق الأوروبية.</p>
      </section>
    </div>
  );
}
