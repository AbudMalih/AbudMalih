"use client";

import Link from "next/link";
import { useRef, type CSSProperties } from "react";
import { useI18n } from "@/content/i18n/I18nProvider";
import type { ServiceId } from "@/content/i18n/services/types";
import { PLATFORMS } from "@/content/platforms";
import { BRANDS } from "@/content/site";
import { LuviscentLogo } from "@/components/brand/Logos";
import { usePageMotion } from "./usePageMotion";
import { BrandVisual, DevelopmentVisual, DistributionVisual, SourcingVisual, TradeVisual } from "./Visuals";
import s from "./Services.module.css";

/**
 * LEISTUNGEN / SERVICES: a premium editorial page, not a film.
 * One red route is the thread: it is drawn in the hero, activates across the
 * operating model, runs down the six chapters and completes at MARKET.
 * Tones follow the business story (light mineral → silver → graphite trade →
 * industrial development → warm brand → bright commerce → graphite
 * distribution → emerald LUVISCENT → dark CTA), blended at each seam.
 */

const IDS: ServiceId[] = ["sourcing", "trade", "development", "brand", "ecommerce", "distribution"];

// section grounds (light / dark tone drives type, header and lines)
const TONE: Record<string, { bg: string; tone: "light" | "dark" }> = {
  hero: { bg: "#e4e2dd", tone: "light" },
  model: { bg: "#dcdcda", tone: "light" },
  sourcing: { bg: "#d4d5d4", tone: "light" },
  trade: { bg: "#2b2d31", tone: "dark" },
  development: { bg: "#1c1e21", tone: "dark" },
  brand: { bg: "#ebe6dc", tone: "light" },
  ecommerce: { bg: "#f1f2f1", tone: "light" },
  distribution: { bg: "#26282b", tone: "dark" },
  payoff: { bg: "#18191c", tone: "dark" },
  luviscent: { bg: "#0a1b15", tone: "dark" },
  cta: { bg: "#0f1012", tone: "dark" },
};
const ORDER = ["hero", "model", ...IDS, "payoff", "luviscent", "cta"];
const ground = (key: string): CSSProperties => {
  const i = ORDER.indexOf(key);
  return { ["--bg" as string]: TONE[key].bg, ["--from" as string]: TONE[ORDER[Math.max(0, i - 1)]].bg };
};

export default function ServicesPage() {
  const { dict, href } = useI18n();
  const t = dict.services;
  const root = useRef<HTMLElement>(null);
  usePageMotion(root);
  const luviscent = BRANDS.luviscent;
  const luviscentHref = luviscent.url ?? href(luviscent.internal);
  const num = (i: number) => String(i + 1).padStart(2, "0");

  return (
    <article ref={root} className={s.page}>
      {/* ------------------------------------------------------------ HERO */}
      <section className={`${s.section} ${s.hero}`} style={ground("hero")} data-tone="light" aria-labelledby="svc-title">
        <div className={`frame ${s.heroInner}`}>
          <p className={`t-label ${s.eyebrow}`} data-reveal>
            <span className={s.idx}>01</span>
            <span className={s.redRule} />
            {t.hero.eyebrow}
            <a href="#modell" className={s.scrollCue} data-cursor="link">
              {t.hero.scroll}
              <span className={s.cueLine} aria-hidden="true" />
            </a>
          </p>
          <h1 id="svc-title" className={s.heroTitle}>
            <span className="mask">
              <span className={s.rise} data-reveal>
                {t.hero.h1a}
              </span>
            </span>
            <span className="mask">
              <span className={`${s.rise} ${s.dimLine}`} data-reveal style={{ ["--d" as string]: "90ms" }}>
                {t.hero.h1b.replace(/\.$/, "")}
                <span className={s.period}>.</span>
              </span>
            </span>
          </h1>
          <p className={`t-lead ${s.heroLead}`} data-reveal style={{ ["--d" as string]: "220ms" }}>
            {t.hero.lead}
          </p>
        </div>

        {/* the route: source → market, drawn once */}
        <div className={`frame ${s.heroRoute}`} data-reveal aria-hidden="true">
          <ol className={s.stops}>
            {t.route.map((r, i) => (
              <li key={r} className={s.stop} style={{ ["--i" as string]: i }}>
                <span className={s.stopNode} data-first={i === 0 ? "" : undefined} data-last={i === t.route.length - 1 ? "" : undefined} />
                <span className={s.stopIdx}>{String(i).padStart(2, "0")}</span>
                <span className={s.stopName}>{r}</span>
              </li>
            ))}
          </ol>
          <span className={s.heroLine} />
          <span className={s.heroLineRed} />
        </div>
      </section>

      {/* -------------------------------------------------- OPERATING MODEL */}
      <section id="modell" className={`${s.section} ${s.model}`} style={ground("model")} data-tone="light" aria-labelledby="svc-model">
        <div className={`frame ${s.modelHead}`}>
          <p className={`t-label ${s.tag}`} data-reveal>
            {t.model.tag}
          </p>
          <h2 id="svc-model" className={s.h2} data-reveal>
            {t.model.title}
          </h2>
          <p className={`t-lead ${s.intro}`} data-reveal>
            {t.model.intro}
          </p>
        </div>
        <div className={`frame ${s.map}`} data-track>
          <div className={s.mapLine} aria-hidden="true">
            <span className={s.mapFill} data-fill data-start="top 70%" data-end="bottom 70%" />
          </div>
          <ol className={s.mapList}>
            {IDS.map((id, i) => (
              <li key={id} className={s.mapItem} data-node data-at={`top ${78 - i * 3}%`}>
                <span className={s.mapNode} aria-hidden="true" />
                <span className={s.mapNum} aria-hidden="true">
                  {num(i)}
                </span>
                <h3 className={s.mapTitle}>{t.chapters[id].title}</h3>
                <p className={s.mapText}>{t.model.lines[id]}</p>
                <a href={`#${id}`} className={`t-label ${s.mapJump}`} data-cursor="link" aria-label={`${t.model.jump}: ${t.chapters[id].title}`}>
                  {t.model.jump} <span aria-hidden="true">↓</span>
                </a>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ------------------------------------------------------- CHAPTERS */}
      <div className={s.chapters} data-track>
        <div className={s.thread} aria-hidden="true">
          <span className={s.threadFill} data-fill data-start="top 60%" data-end="bottom 60%" />
        </div>

        {IDS.map((id, i) => {
          const ch = t.chapters[id];
          const tone = TONE[id].tone;
          return (
            <section key={id} id={id} className={`${s.section} ${s.chapter} ${s[`c_${id}`] ?? ""}`} style={ground(id)} data-tone={tone} aria-labelledby={`svc-${id}`}>
              <span className={s.threadNode} data-node aria-hidden="true" />
              <div className={`frame ${s.chapterGrid} ${i % 2 ? s.flip : ""}`}>
                <div className={s.copy}>
                  <p className={`t-label ${s.tag}`} data-reveal>
                    <span className={s.tagNum}>{num(i)}</span> / 06 <span className={s.tagStop}>· {ch.stop}</span>
                  </p>
                  <h2 id={`svc-${id}`} className={s.h2} data-reveal>
                    {ch.title}
                  </h2>
                  <p className={s.statement} data-reveal>
                    {ch.statement}
                  </p>
                  <p className={s.body} data-reveal>
                    {ch.body}
                  </p>
                  <ul className={s.focus} data-reveal>
                    {ch.focus.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                </div>

                {id !== "ecommerce" && (
                  <figure className={s.figure} data-reveal>
                    {id === "sourcing" && <SourcingVisual c={t.sourcing} />}
                    {id === "trade" && <TradeVisual c={t.trade} />}
                    {id === "development" && <DevelopmentVisual c={t.development} />}
                    {id === "brand" && <BrandVisual c={t.brand} />}
                    {id === "distribution" && <DistributionVisual c={t.distribution} />}
                  </figure>
                )}

                {id === "ecommerce" && (
                  <div className={s.commerce} data-reveal>
                    <ol className={s.flow} aria-label={t.ecommerce.flow.join(" → ")}>
                      {t.ecommerce.flow.map((f, k) => (
                        <li key={f} className={s.flowStep} style={{ ["--i" as string]: k }}>
                          <span className={s.flowNode} aria-hidden="true" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ol>
                    <ul className={s.channels}>
                      {t.ecommerce.channels.map((c, k) => (
                        <li key={c} style={{ ["--i" as string]: k }}>
                          <span className={s.channelIdx} aria-hidden="true">
                            {`K-0${k + 1}`}
                          </span>
                          {c}
                        </li>
                      ))}
                    </ul>
                    <div className={s.platforms}>
                      <p className={`t-label ${s.platformsTitle}`}>
                        <span className={s.plus} aria-hidden="true" />
                        {t.ecommerce.platforms}
                      </p>
                      {(["store", "marketplace"] as const).map((g) => (
                        <div key={g} className={s.platformGroup}>
                          <p className={`t-label ${s.groupName}`}>{t.ecommerce.groups[g]}</p>
                          <ul>
                            {PLATFORMS.filter((p) => p.group === g).map((p) => (
                              <li key={p.id} className={s.platform}>
                                {p.name}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {/* ------------------------------------------------- COMPLETE ROUTE */}
      <section className={`${s.section} ${s.payoff}`} style={ground("payoff")} data-tone="dark" aria-labelledby="svc-payoff">
        <div className={`frame ${s.payoffGrid}`}>
          <div className={s.payoffCopy}>
            <p className={`t-label ${s.tag}`} data-reveal>
              {t.payoff.tag}
            </p>
            <h2 id="svc-payoff" className={s.h2} data-reveal>
              {t.payoff.title}
            </h2>
            <p className={`t-lead ${s.intro}`} data-reveal>
              {t.payoff.body}
            </p>
          </div>
          <ol className={s.complete} data-reveal aria-label={t.route.join(" → ")}>
            {t.route.map((r, i) => (
              <li key={r} className={s.completeStop} style={{ ["--i" as string]: i }} data-end={i === t.route.length - 1 ? "" : undefined}>
                <span className={s.completeNode} aria-hidden="true" />
                <span className={s.completeIdx} aria-hidden="true">
                  {String(i).padStart(2, "0")}
                </span>
                <span className={s.completeName}>{r}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ------------------------------------------------------ LUVISCENT */}
      <section className={`${s.section} ${s.luviscent}`} style={ground("luviscent")} data-tone="dark" aria-labelledby="svc-lv">
        <div className={`frame ${s.lvGrid}`}>
          <div className={s.lvArch} aria-hidden="true" data-reveal>
            <span className={s.lvLight} />
            <span className={s.lvLedge} />
          </div>
          <div className={s.lvCopy}>
            <p className={`t-label ${s.lvTag}`} data-reveal>
              {t.luviscent.tag}
            </p>
            <div className={s.lvLogo} data-reveal>
              <LuviscentLogo />
            </div>
            <h2 id="svc-lv" className={s.lvTitle} data-reveal>
              {t.luviscent.title1} <span>{t.luviscent.title2}</span>
            </h2>
            <p className={s.lvBody} data-reveal>
              {t.luviscent.body}
            </p>
            <div className={s.lvLinks} data-reveal>
              <a href={luviscentHref} className={s.lvCta} data-cursor="link" {...(luviscent.url ? { target: "_blank", rel: "noopener" } : {})}>
                <span>{t.luviscent.cta}</span>
                <span className={s.lvPlus} aria-hidden="true" />
              </a>
              <Link href={href("/brands")} className={`link-line t-label ${s.lvMore}`} data-cursor="link">
                {t.luviscent.brands}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ CTA */}
      <section className={`${s.section} ${s.cta}`} style={ground("cta")} data-tone="dark" aria-labelledby="svc-cta">
        <div className={`frame ${s.ctaInner}`}>
          <p className={`t-label ${s.tag}`} data-reveal>
            {t.cta.tag}
          </p>
          <h2 id="svc-cta" className={s.ctaTitle}>
            <span className="mask">
              <span className={s.rise} data-reveal>
                {t.cta.h1}
              </span>
            </span>
            <span className="mask">
              <span className={`${s.rise} ${s.dimLine}`} data-reveal style={{ ["--d" as string]: "90ms" }}>
                {t.cta.h2.replace(/\.$/, "")}
                <span className={s.period}>.</span>
              </span>
            </span>
          </h2>
          <div className={s.ctaRow} data-reveal>
            <p className={`t-lead ${s.ctaLead}`}>{t.cta.lead}</p>
            <div className={s.ctaActions}>
              <Link href={href("/contact")} className={s.ctaButton} data-cursor="invert">
                <span className={s.ctaLabel}>{t.cta.button}</span>
                <span className={s.ctaPlus} aria-hidden="true" />
              </Link>
              <Link href={href("/company")} className={`link-line t-label ${s.ctaMore}`} data-cursor="link">
                {t.cta.company} <span className={s.arrow} aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </article>
  );
}
