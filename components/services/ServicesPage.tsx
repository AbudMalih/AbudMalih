"use client";

import { useRef } from "react";
import { useI18n } from "@/content/i18n/I18nProvider";
import { PLATFORMS } from "@/content/platforms";
import { BRANDS } from "@/content/site";
import type { ServiceId } from "@/content/i18n/services/types";
import type { StepId } from "@/content/i18n/types";
import { usePageMotion } from "./usePageMotion";
import ChainArt from "@/components/sections/ChainArt";
import Showcase from "@/components/kit/Showcase";
import {
  PageHero,
  Band,
  Cta,
  Tag,
  RedButton,
  GhostButton,
  d,
  kit as s,
} from "@/components/kit/Kit";
import svc from "./Services.module.css";
import { Photo, Carton } from "@/components/kit/Ambient";
import a from "@/components/kit/Ambient.module.css";
import { STORY } from "@/content/story";

/**
 * LEISTUNGEN / SERVICES on the site kit: port hero with the route, a band of
 * what we do, the six disciplines as cards, one section per discipline,
 * the whole route, LUVISCENT as the proof, and the call to action.
 */
const IDS: ServiceId[] = [
  "sourcing",
  "trade",
  "development",
  "brand",
  "ecommerce",
  "distribution",
];
const ART: Record<ServiceId, StepId> = {
  sourcing: "sourcing",
  trade: "import",
  development: "development",
  brand: "brand",
  ecommerce: "ecommerce",
  distribution: "distribution",
};
const num = (i: number) => String(i + 1).padStart(2, "0");

export default function ServicesPage() {
  const { dict, href, locale } = useI18n();
  const t = dict.services;
  const story = STORY[locale];
  const root = useRef<HTMLElement>(null);
  usePageMotion(root);
  const lvHref = BRANDS.luviscent.url ?? href("/brands");
  const channels = PLATFORMS.filter((p) => p.useMark);

  return (
    <article ref={root} className={`${svc.page} ${s.page}`}>
      <PageHero
        id="svc-title"
        eyebrow={t.hero.eyebrow}
        a={t.hero.h1a}
        b={t.hero.h1b}
        lead={t.hero.lead}
        actions={
          <>
            <RedButton href={href("/contact")}>{t.cta.button}</RedButton>
            <GhostButton href="#modell">{t.hero.scroll}</GhostButton>
          </>
        }
        aside={
          <Photo
            src="warehouse"
            alt={story.steps[2].alt}
            note={story.note}
            caption={
              <span className={a.routeBar}>
                {t.route.map((stop) => (
                  <span key={stop}>{stop}</span>
                ))}
              </span>
            }
          />
        }
      />

      <Band
        title={t.model.tag}
        items={IDS.flatMap((id) => t.chapters[id].focus)}
      />

      {/* the six disciplines */}
      <section
        id="modell"
        className={s.light}
        data-tone="light"
        aria-labelledby="svc-model"
      >
        <div className="frame">
          <Tag>{t.model.tag}</Tag>
          <h2 id="svc-model" className={s.h2} data-reveal>
            {t.model.title}
          </h2>
          <p className={s.body} data-reveal>
            {t.model.intro}
          </p>
          <div className={s.bento}>
            {IDS.map((id, i) => (
              <a
                key={id}
                href={`#${id}`}
                className={i === 0 ? s.bentoHero : s.card}
                data-reveal
                style={d(i * 70)}
              >
                <span className={s.num}>{num(i)}</span>
                {i > 0 && (
                  <div style={{ marginTop: 18 }}>
                    <ChainArt
                      id={ART[id]}
                      className={s.cardArt}
                      redClass={s.cardArtRed}
                    />
                  </div>
                )}
                <h3 className={s.h3}>{t.chapters[id].title}</h3>
                <p className={i === 0 ? s.textDark : s.text}>
                  {t.model.lines[id]}
                </p>
                <span className={s.link}>{t.model.jump}</span>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* the disciplines, one panel */}
      <section
        id="disziplinen"
        className={`${s.light} ${s.alt}`}
        data-tone="light"
        aria-labelledby="svc-disc"
      >
        <div className="frame">
          <Tag>{t.model.tag}</Tag>
          <h2 id="svc-disc" className={s.h2} data-reveal>
            {t.payoff.title}
          </h2>
          <div data-reveal>
            <Showcase
              label={t.model.tag}
              items={IDS.map((id, n) => ({
                key: id,
                label: t.chapters[id].stop,
                title: t.chapters[id].title.replace(/\u00AD/g, ""),
                statement: t.chapters[id].statement,
                body: t.chapters[id].body,
                chips:
                  id === "distribution"
                    ? [...t.chapters[id].focus, ...t.distribution.destinations]
                    : t.chapters[id].focus,
                art: <ChainArt id={ART[id]} redClass={s.cardArtRed} />,
                pos: `center, ${[12, 30, 48, 62, 78, 94][n]}% ${[70, 45, 60, 35, 55, 40][n]}%`,
                extra:
                  id === "ecommerce" ? (
                    <ul className={s.chips}>
                      {channels.map((p) => (
                        <li key={p.id} className={s.chipDark}>
                          {p.name}
                        </li>
                      ))}
                    </ul>
                  ) : undefined,
              }))}
            />
          </div>
        </div>
      </section>

      {/* LUVISCENT */}
      <section className={s.emerald} aria-labelledby="svc-lv" data-tone="dark">
        <div className={`frame ${s.split}`}>
          <div>
            <p className={`t-label ${s.tag} ${s.gold}`} data-reveal>
              <span className={s.tagRule} /> {t.luviscent.tag}
            </p>
            <h2 id="svc-lv" className={`${s.h2} ${s.h2Dark}`} data-reveal>
              {t.luviscent.title1}{" "}
              <span className={s.gold}>{t.luviscent.title2}</span>
            </h2>
            <p className={s.bodyDark} data-reveal>
              {t.luviscent.body}
            </p>
            <div className={s.actions} data-reveal>
              <a
                href={lvHref}
                className={s.btnGold}
                {...(BRANDS.luviscent.url
                  ? { target: "_blank", rel: "noopener" }
                  : {})}
              >
                {t.luviscent.cta}
                <span className={s.badge} aria-hidden="true" />
              </a>
              <a href={href("/brands")} className={s.btnGhostGold}>
                {t.luviscent.brands}
              </a>
            </div>
          </div>
          <figure className={s.media} data-reveal style={d(120)}>
            <img
              src="/brand/luviscent/diffuser-tower.webp"
              alt="LUVISCENT"
              width={778}
              height={1400}
              loading="lazy"
              style={{ maxHeight: 440 }}
            />
          </figure>
        </div>
      </section>

      <Cta
        id="svc-cta"
        title={`${t.cta.h1} ${t.cta.h2}`}
        text={t.cta.lead}
        button={t.cta.button}
        href={href("/contact")}
        more={{ label: t.cta.company, href: href("/company") }}
        visual={<Carton label={story.visual.carton} />}
      />
    </article>
  );
}
