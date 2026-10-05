"use client";

import Link from "next/link";
import { useEffect, useRef, type CSSProperties, type RefObject } from "react";
import { useI18n } from "@/content/i18n/I18nProvider";
import { LuviscentLogo } from "@/components/brand/Logos";
import { usePageMotion } from "@/components/services/usePageMotion";
import { usePassage } from "@/components/brands/usePassage";
import { HeroStructure, PhysicalIcon, DigitalIcon, BaseRings } from "./Drawings";
import svc from "@/components/services/Services.module.css";
import s from "./Company.module.css";

/**
 * UNTERNEHMEN / COMPANY: architectural, corporate, structural.
 * Light architectural space carries most of the page; the red + appears
 * only where disciplines meet. Rhythm: light hero → mineral profile →
 * the idea and the + → principles → physical (light) + digital (graphite)
 * → Cologne → standards → owned-brand reference → bridges and facts →
 * graphite direction → dark CTA. Only verified company facts are shown.
 */

const GROUNDS = {
  hero: "#e7e5e0",
  profile: "#dcdad5",
  idea: "#ebebe8",
  principles: "#e2e0db",
  physical: "#e9e7e2",
  digital: "#1b1c1f",
  base: "#ecebe6",
  standards: "#dfddd8",
  brand: "#e8e3d9",
  bridges: "#e3e1dc",
  direction: "#1a1b1e",
  cta: "#0f1012",
} as const;
type G = keyof typeof GROUNDS;
const ORDER = Object.keys(GROUNDS) as G[];
const ground = (key: G): CSSProperties => {
  const i = ORDER.indexOf(key);
  return { ["--bg" as string]: GROUNDS[key], ["--from" as string]: GROUNDS[ORDER[Math.max(0, i - 1)]] };
};
const num = (i: number) => String(i + 1).padStart(2, "0");

export default function CompanyPage() {
  const { dict, href } = useI18n();
  const t = dict.companyPage;
  const root = useRef<HTMLElement>(null);
  usePageMotion(root);
  usePassage(root);
  useSeam(root);

  return (
    <article ref={root} className={`${svc.page} ${s.page}`}>
      {/* ------------------------------------------------------------ HERO */}
      <section className={`${svc.section} ${s.hero}`} style={ground("hero")} data-tone="light" aria-labelledby="co-title">
        <div className={`frame ${s.heroGrid}`}>
          <div className={s.heroCopy}>
            <p className={`t-label ${s.eyebrow}`} data-reveal>
              <span className={s.idx}>03</span>
              <span className={s.redRule} />
              {t.hero.eyebrow}
            </p>
            <h1 id="co-title" className={s.heroTitle}>
              <span className="mask">
                <span className={svc.rise} data-reveal>
                  {t.hero.h1a}
                </span>
              </span>
              <span className="mask">
                <span className={`${svc.rise} ${s.dim}`} data-reveal style={{ ["--d" as string]: "90ms" }}>
                  {t.hero.h1b.replace(/\.$/, "")}
                  <span className={s.period}>.</span>
                </span>
              </span>
            </h1>
            <p className={`t-lead ${s.heroLead}`} data-reveal style={{ ["--d" as string]: "220ms" }}>
              {t.hero.lead}
            </p>
          </div>
          <figure className={s.heroFigure} data-reveal aria-hidden="true" data-parallax>
            <HeroStructure layers={t.hero.layers} base={t.hero.base} />
          </figure>
        </div>
      </section>

      {/* --------------------------------------------------------- PROFILE */}
      <section className={`${svc.section} ${s.profile}`} style={ground("profile")} data-tone="light" aria-labelledby="co-profile">
        <div className={`frame ${s.profileGrid}`}>
          <div className={s.card} data-reveal>
            <p className={`t-label ${s.cardTag}`}>{t.profile.tag}</p>
            <h2 id="co-profile" className={s.cardName}>
              {t.profile.name}
            </h2>
            <div className={s.cardRule} aria-hidden="true">
              <span className={s.plusSm} />
            </div>
            <p className={s.cardCity}>{t.profile.city}</p>
            <p className={s.cardCountry}>{t.profile.country}</p>
            <p className={s.cardCoord} dir="ltr">
              50.94° N · 6.96° E
            </p>
          </div>
          <div className={s.profileText}>
            <p className={s.statement} data-reveal>
              {t.profile.statement}
            </p>
            <p className={`t-lead ${s.profileBody}`} data-reveal style={{ ["--d" as string]: "120ms" }}>
              {t.profile.body}
            </p>
            <p className={`t-label ${s.areasTag}`} data-reveal style={{ ["--d" as string]: "200ms" }}>
              {t.profile.areasTag}
            </p>
            <ol className={s.areas} data-reveal style={{ ["--d" as string]: "260ms" }}>
              {t.profile.areas.map((a, i) => (
                <li key={a} style={{ ["--i" as string]: i }}>
                  <span className={s.areaIdx}>{num(i)}</span>
                  <span>{a}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* ----------------------------------------------- IDEA + THE PLUS */}
      <section className={`${svc.section} ${s.idea}`} style={ground("idea")} data-tone="light" aria-labelledby="co-idea">
        <div className={`frame ${s.ideaHead}`}>
          <div>
            <p className={`t-label ${svc.tag}`} data-reveal>
              {t.idea.tag}
            </p>
            <h2 id="co-idea" className={svc.h2} data-reveal>
              {t.idea.title1}
              <br />
              <span className={s.dim}>{t.idea.title2}</span>
            </h2>
          </div>
          <p className={`t-lead ${s.ideaBody}`} data-reveal style={{ ["--d" as string]: "140ms" }}>
            {t.idea.body}
          </p>
        </div>

        {/* then: two points. now: a connected route */}
        <div className={`frame ${s.compare}`} data-track>
          <div className={s.compareRow} data-reveal>
            <span className={`t-label ${s.compareTag}`}>{t.idea.before}</span>
            <div className={s.lineOld}>
              {t.idea.beforeSteps.map((x) => (
                <span key={x} className={s.oldStep}>
                  <i aria-hidden="true" />
                  {x}
                </span>
              ))}
            </div>
          </div>
          <div className={s.compareRow} data-reveal style={{ ["--d" as string]: "160ms" }}>
            <span className={`t-label ${s.compareTag} ${s.compareNow}`}>{t.idea.now}</span>
            <div className={s.lineNew}>
              <span className={s.newTrack} aria-hidden="true" />
              <span className={s.newFill} data-fill data-start="top 80%" data-end="top 35%" aria-hidden="true" />
              {t.idea.nowSteps.map((x, i) => (
                <span key={x} className={s.newStep} style={{ ["--i" as string]: i }}>
                  <i aria-hidden="true" />
                  {x}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* the + : where two disciplines meet */}
        <ul className={`frame ${s.pairs}`} aria-label={t.idea.pairs.map(([a, b]) => `${a} + ${b}`).join(", ")}>
          {t.idea.pairs.map(([a, b], i) => (
            <li key={a + b} className={s.pair} data-reveal style={{ ["--d" as string]: `${i * 90}ms` }}>
              <span className={s.pairA}>{a}</span>
              <span className={s.pairPlus} aria-hidden="true" />
              <span className={s.pairB}>{b}</span>
            </li>
          ))}
        </ul>
        <p className={`frame ${s.final}`} data-reveal>
          <span className={s.finalName}>{t.idea.final}</span>
          <span className={s.finalPlus} aria-hidden="true" />
        </p>
      </section>

      {/* ------------------------------------------------------ PRINCIPLES */}
      <section className={`${svc.section} ${s.principles}`} style={ground("principles")} data-tone="light" aria-labelledby="co-principles">
        <div className="frame">
          <p className={`t-label ${svc.tag}`} data-reveal>
            {t.principles.tag}
          </p>
          <h2 id="co-principles" className={svc.h2} data-reveal>
            {t.principles.title}
          </h2>
          <ol className={s.principleList}>
            {t.principles.items.map((p, i) => (
              <li key={p.title} className={s.principle} data-reveal style={{ ["--d" as string]: `${(i % 2) * 120}ms` }}>
                <span className={s.principleIdx}>{num(i)}</span>
                <h3 className={s.principleTitle}>{p.title}</h3>
                <p className={s.principleBody}>{p.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ------------------------------------------- PHYSICAL + DIGITAL */}
      <section className={`${svc.section} ${s.physical}`} style={ground("physical")} data-tone="light" aria-labelledby="co-pd">
        <div className={`frame ${s.pdHead}`}>
          <div>
            <p className={`t-label ${svc.tag}`} data-reveal>
              {t.pd.tag}
            </p>
            <h2 id="co-pd" className={svc.h2} data-reveal>
              {t.pd.title1}
              <br />
              <span className={s.dim}>{t.pd.title2}</span>
            </h2>
          </div>
          <p className={`t-lead ${s.pdLead}`} data-reveal style={{ ["--d" as string]: "140ms" }}>
            {t.pd.lead}
          </p>
        </div>
        <World name={t.pd.physical.name} items={t.pd.physical.items} kind="physical" />
      </section>
      <section className={`${svc.section} ${s.digital}`} style={ground("digital")} data-tone="dark" aria-label={t.pd.digital.name}>
        <span className={s.seamLink} aria-hidden="true">
          <span className={s.seamPlus} />
        </span>
        <World name={t.pd.digital.name} items={t.pd.digital.items} kind="digital" />
        <p className={`frame ${s.pdNote}`} data-reveal>
          {t.pd.note}
        </p>
      </section>

      {/* ------------------------------------------------------- COLOGNE */}
      <section className={`${svc.section} ${s.base}`} style={ground("base")} data-tone="light" aria-labelledby="co-base">
        <div className={`frame ${s.baseGrid}`}>
          <div className={s.baseCopy}>
            <p className={`t-label ${svc.tag}`} data-reveal>
              {t.base.tag}
            </p>
            <h2 id="co-base" className={s.baseTitle} data-reveal>
              {t.base.title1}
              <br />
              <span className={s.dim}>{t.base.title2}</span>
            </h2>
            <p className={`t-lead ${s.baseBody}`} data-reveal style={{ ["--d" as string]: "140ms" }}>
              {t.base.body}
            </p>
            <p className={s.baseCoord} dir="ltr" data-reveal style={{ ["--d" as string]: "220ms" }}>
              <span>50.9375° N</span>
              <span>6.9603° E</span>
            </p>
          </div>
          <figure className={s.baseFigure} data-reveal aria-hidden="true">
            <BaseRings rings={t.base.rings} />
          </figure>
        </div>
      </section>

      {/* ----------------------------------------------------- STANDARDS */}
      <section className={`${svc.section} ${s.standards}`} style={ground("standards")} data-tone="light" aria-labelledby="co-std">
        <div className={`frame ${s.stdGrid}`}>
          <div>
            <p className={`t-label ${svc.tag}`} data-reveal>
              {t.standards.tag}
            </p>
            <h2 id="co-std" className={svc.h2} data-reveal>
              {t.standards.title1}
              <br />
              <span className={s.dim}>{t.standards.title2}</span>
            </h2>
            <p className={`t-lead ${s.stdBody}`} data-reveal style={{ ["--d" as string]: "140ms" }}>
              {t.standards.body}
            </p>
          </div>
          <div className={s.doc} data-reveal style={{ ["--d" as string]: "200ms" }}>
            <div className={s.docHead}>
              <span className={`t-label ${s.docName}`}>{t.standards.doc}</span>
              <span className={s.docRef} dir="ltr">
                LT · EU
              </span>
            </div>
            <ol className={s.docRows}>
              {t.standards.rows.map((r, i) => (
                <li key={r.name} style={{ ["--i" as string]: i }}>
                  <span className={s.docIdx}>{num(i)}</span>
                  <span className={s.docRowName}>{r.name}</span>
                  <span className={s.docRowLine}>{r.line}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* -------------------------------------------- OWNED-BRAND REFERENCE */}
      <section className={`${svc.section} ${s.brand}`} style={ground("brand")} data-tone="light" aria-labelledby="co-brand">
        <div className={`frame ${s.brandGrid}`}>
          <div>
            <p className={`t-label ${svc.tag}`} data-reveal>
              {t.brand.tag}
            </p>
            <h2 id="co-brand" className={s.brandTitle} data-reveal>
              {t.brand.title}
            </h2>
          </div>
          <div className={s.brandSide}>
            <ol className={s.chain} data-reveal>
              <li>{t.brand.chain[0]}</li>
              <li>{t.brand.chain[1]}</li>
              <li className={s.chainLv}>
                <LuviscentLogo className={s.chainLogo} />
              </li>
            </ol>
            <p className={s.brandBody} data-reveal style={{ ["--d" as string]: "140ms" }}>
              {t.brand.body}
            </p>
            <Link href={href("/brands")} className={s.textLink} data-cursor="link" data-reveal style={{ ["--d" as string]: "200ms" }}>
              {t.brand.link} <span className={svc.arrow} aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ----------------------------------------------- BRIDGES + FACTS */}
      <section className={`${svc.section} ${s.bridges}`} style={ground("bridges")} data-tone="light" aria-labelledby="co-facts">
        <div className={`frame ${s.bridgeGrid}`}>
          <Link href={href("/what-we-do")} className={s.bridge} data-cursor="link" data-reveal>
            <span className={`t-label ${s.bridgeKicker}`}>{t.bridges.what.kicker}</span>
            <span className={s.bridgeLabel}>
              {t.bridges.what.label} <span className={`${svc.arrow} ${s.bridgeArrow}`} aria-hidden="true">→</span>
            </span>
            <span className={s.bridgeLine} aria-hidden="true" />
          </Link>
          <Link href={href("/brands")} className={s.bridge} data-cursor="link" data-reveal style={{ ["--d" as string]: "120ms" }}>
            <span className={`t-label ${s.bridgeKicker}`}>{t.bridges.build.kicker}</span>
            <span className={s.bridgeLabel}>
              {t.bridges.build.label} <span className={`${svc.arrow} ${s.bridgeArrow}`} aria-hidden="true">→</span>
            </span>
            <span className={s.bridgeLine} aria-hidden="true" />
          </Link>
        </div>
        <div className={`frame ${s.facts}`} data-reveal>
          <h2 id="co-facts" className={`t-label ${s.factsTag}`}>
            {t.facts.tag}
          </h2>
          <dl className={s.factList}>
            {t.facts.rows.map((r) => (
              <div key={r.k}>
                <dt>{r.k}</dt>
                <dd dir={/^[\x00-\x7F°·\s.]+$/.test(r.v) ? "ltr" : undefined}>{r.v}</dd>
              </div>
            ))}
          </dl>
          <Link href={href("/impressum")} className={s.textLink} data-cursor="link">
            {t.facts.legal} <span className={svc.arrow} aria-hidden="true">→</span>
          </Link>
        </div>
      </section>

      {/* ----------------------------------------------------- DIRECTION */}
      <section className={`${svc.section} ${s.direction}`} style={ground("direction")} data-tone="dark" aria-labelledby="co-dir">
        <div className={`frame ${s.dirGrid}`}>
          <div>
            <p className={`t-label ${svc.tag}`} data-reveal>
              {t.direction.tag}
            </p>
            <h2 id="co-dir" className={svc.h2} data-reveal>
              {t.direction.title1}
              <br />
              <span className={s.dimDark}>{t.direction.title2}</span>
            </h2>
            <p className={`t-lead ${s.dirBody}`} data-reveal style={{ ["--d" as string]: "140ms" }}>
              {t.direction.body}
            </p>
          </div>
          <div className={s.dirWrap} data-track>
            <span className={s.dirAxis} aria-hidden="true" />
            <span className={s.dirFill} data-fill data-start="top 75%" data-end="bottom 60%" aria-hidden="true" />
            <ol className={s.dirLines}>
            {t.direction.lines.map((l, i) => (
              <li key={l} className={s.dirLine} data-reveal style={{ ["--d" as string]: `${i * 140}ms`, ["--i" as string]: i }}>
                <span className={s.dirNode} aria-hidden="true" />
                {l}
              </li>
            ))}
            </ol>
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------------- CTA */}
      <section className={`${svc.section} ${svc.cta}`} style={ground("cta")} data-tone="dark" aria-labelledby="co-cta">
        <div className={`frame ${svc.ctaInner}`}>
          <p className={`t-label ${svc.tag}`} data-reveal>
            {t.cta.tag}
          </p>
          <h2 id="co-cta" className={svc.ctaTitle}>
            <span className="mask">
              <span className={svc.rise} data-reveal>
                {t.cta.h1}
              </span>
            </span>
            <span className="mask">
              <span className={`${svc.rise} ${svc.dimLine}`} data-reveal style={{ ["--d" as string]: "90ms" }}>
                {t.cta.h2.replace(/\.$/, "")}
                <span className={svc.period}>.</span>
              </span>
            </span>
          </h2>
          <div className={svc.ctaRow} data-reveal>
            <p className={`t-lead ${svc.ctaLead}`}>{t.cta.lead}</p>
            <div className={svc.ctaActions}>
              <Link href={href("/contact")} className={svc.ctaButton} data-cursor="invert">
                <span className={svc.ctaLabel}>{t.cta.button}</span>
                <span className={svc.ctaPlus} aria-hidden="true" />
              </Link>
              <Link href={href("/what-we-do")} className={`link-line t-label ${svc.ctaMore}`} data-cursor="link">
                {t.cta.more} <span className={svc.arrow} aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </article>
  );
}

/**
 * The red link across the seam between the two worlds: from the last
 * station of the physical route down to the first point of the digital
 * route. Measured from layout, so it holds on desktop (horizontal routes,
 * joined at their inline end) and on phones (vertical routes).
 */
function useSeam(root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const digital = el.querySelector<HTMLElement>(`.${s.digital}`);
    const link = el.querySelector<HTMLElement>(`.${s.seamLink}`);
    const a = el.querySelector<HTMLElement>(`.${s.physical} .${s.stationTrack}`);
    const b = el.querySelector<HTMLElement>(`.${s.digital} .${s.stationTrack}`);
    if (!digital || !link || !a || !b) return;
    const place = () => {
      const d = digital.getBoundingClientRect();
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      const vertical = ra.height > ra.width;
      const rtl = document.documentElement.dir === "rtl";
      const x = vertical ? ra.left + ra.width / 2 : rtl ? ra.left : ra.right;
      const y1 = vertical ? ra.bottom : ra.top + ra.height / 2;
      const y2 = vertical ? rb.top : rb.top + rb.height / 2;
      link.style.setProperty("--seam-x", `${(x - d.left).toFixed(1)}px`);
      link.style.setProperty("--seam-y", `${(y1 - d.top).toFixed(1)}px`);
      link.style.setProperty("--seam-h", `${(y2 - y1).toFixed(1)}px`);
      link.style.setProperty("--seam-at", `${(d.top - y1).toFixed(1)}px`);
    };
    place();
    const ro = new ResizeObserver(place);
    ro.observe(el);
    document.fonts?.ready.then(place);
    return () => ro.disconnect();
  }, [root]);
}

/** One of the two worlds: five stations on a route that runs to the seam. */
function World({ name, items, kind }: { name: string; items: string[]; kind: "physical" | "digital" }) {
  const Icon = kind === "physical" ? PhysicalIcon : DigitalIcon;
  return (
    <div className={`frame ${s.world} ${kind === "digital" ? s.worldDigital : ""}`} data-track>
      <p className={`t-label ${s.worldName}`} data-reveal>
        {name}
      </p>
      <div className={s.stationsWrap}>
        <span className={s.stationTrack} aria-hidden="true" />
        <span className={s.stationFill} data-fill data-start="top 78%" data-end="top 30%" aria-hidden="true" />
        <ol className={s.stations}>
        {items.map((it, i) => (
          <li key={it} className={s.station} data-reveal style={{ ["--d" as string]: `${i * 90}ms` }}>
            <Icon i={i} />
            <span className={s.stationNode} aria-hidden="true" />
            <span className={s.stationIdx}>{`${kind === "physical" ? "P" : "D"}-0${i + 1}`}</span>
            <span className={s.stationName}>{it}</span>
          </li>
        ))}
        </ol>
      </div>
    </div>
  );
}
