"use client";

import { useRef } from "react";
import { useI18n } from "@/content/i18n/I18nProvider";
import { IMPORT_COPY } from "@/content/importPage";
import { PLATFORMS } from "@/content/platforms";
import { BRANDS } from "@/content/site";
import type { ServiceId } from "@/content/i18n/services/types";
import type { StepId } from "@/content/i18n/types";
import { usePageMotion } from "@/components/services/usePageMotion";
import ChainArt from "@/components/sections/ChainArt";
import RouteCard from "@/components/import/RouteCard";
import { FlagCN, FlagDE, FlagEU } from "@/components/import/Flags";
import { Band, Cta, Tag, RedButton, GhostButton, d, kit as s } from "@/components/kit/Kit";
import h from "./HomeSections.module.css";

/**
 * The homepage after the opening: calm sections in the site's style, in
 * normal scroll (each reveals once). Only verified copy, shared with the
 * Leistungen, Import and Marken pages.
 */
const IDS: ServiceId[] = ["sourcing", "trade", "development", "brand", "ecommerce", "distribution"];
const ART: Record<ServiceId, StepId> = { sourcing: "sourcing", trade: "import", development: "development", brand: "brand", ecommerce: "ecommerce", distribution: "distribution" };
const num = (i: number) => String(i + 1).padStart(2, "0");

export default function HomeSections() {
  const { dict, locale, href } = useI18n();
  const sv = dict.services;
  const im = IMPORT_COPY[locale];
  const cm = dict.commerce;
  const root = useRef<HTMLDivElement>(null);
  usePageMotion(root as unknown as React.RefObject<HTMLElement>);
  const channels = PLATFORMS.filter((p) => p.useMark);
  const lvHref = BRANDS.luviscent.url ?? href("/brands");

  return (
    <div ref={root} className={`${s.page} ${h.wrap}`}>
      <Band title={im.lanesTitle} items={im.lanes} />

      {/* what we do */}
      <section className={s.light} data-tone="light" aria-labelledby="home-model">
        <div className="frame">
          <Tag>{sv.model.tag}</Tag>
          <h2 id="home-model" className={s.h2} data-reveal>
            {sv.model.title}
          </h2>
          <p className={s.body} data-reveal>
            {sv.model.intro}
          </p>
          <div className={s.bento}>
            {IDS.map((id, i) => (
              <a key={id} href={href(`/what-we-do#${id}`)} className={i === 0 ? s.bentoHero : s.card} data-reveal style={d(i * 60)}>
                <span className={s.num}>{num(i)}</span>
                {i > 0 && (
                  <div style={{ marginTop: 18 }}>
                    <ChainArt id={ART[id]} className={s.cardArt} redClass={s.cardArtRed} />
                  </div>
                )}
                <h3 className={s.h3}>{sv.chapters[id].title.replace(/­/g, "")}</h3>
                <p className={i === 0 ? s.textDark : s.text}>{sv.model.lines[id]}</p>
                <span className={s.link}>{sv.model.jump}</span>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* import: the lane */}
      <section className={s.dark} data-tone="dark" aria-labelledby="home-import">
        <div className={`frame ${s.split}`}>
          <div>
            <p className={`t-label ${s.eyebrow}`} data-reveal>
              <span className={s.dot} />
              {im.eyebrow}
            </p>
            <h2 id="home-import" className={`${s.h2} ${s.h2Dark}`} data-reveal style={{ marginTop: 22 }}>
              {im.h1a} <span className={s.titleRed}>{im.h1b}</span>
            </h2>
            <div className={s.flags} data-reveal>
              <span className={s.flagChip}>
                <FlagCN className={s.flag} />
                <span>
                  <small>{im.from}</small>
                  {locale === "ar" ? "الصين" : "China"}
                </span>
              </span>
              <span className={s.flagArrow} aria-hidden="true" />
              <span className={s.flagChip}>
                <FlagDE className={s.flag} />
                <span>
                  <small>{im.to}</small>
                  {locale === "de" ? "Deutschland" : locale === "en" ? "Germany" : "ألمانيا"}
                </span>
              </span>
              <span className={s.flagChip}>
                <FlagEU className={s.flag} />
                <span>
                  <small>&nbsp;</small>
                  {locale === "ar" ? "الاتحاد الأوروبي" : "EU"}
                </span>
              </span>
            </div>
            <p className={s.bodyDark} data-reveal>
              {im.lead}
            </p>
            <div className={s.actions} data-reveal>
              <RedButton href={href("/import")}>{dict.hero.ctaImport}</RedButton>
              <GhostButton href={href("/contact")}>{im.ctaPrimary}</GhostButton>
            </div>
          </div>
          <div data-reveal style={d(120)}>
            <RouteCard t={im} />
          </div>
        </div>
      </section>

      {/* e-commerce */}
      <section className={`${s.light} ${s.alt}`} data-tone="light" aria-labelledby="home-commerce">
        <div className={`frame ${s.split}`}>
          <div>
            <Tag>{cm.tag}</Tag>
            <h2 id="home-commerce" className={s.h2} data-reveal>
              {cm.h1} <span className={s.titleRed}>{cm.h2}</span>
            </h2>
            <p className={s.body} data-reveal>
              {cm.body}
            </p>
            <div className={s.actions} data-reveal>
              <a href={href("/what-we-do#ecommerce")} className={s.btnGhostInk}>
                {sv.model.jump}
              </a>
            </div>
          </div>
          <div className={s.card} data-reveal style={d(100)}>
            <p className={`t-label ${s.tag}`} style={{ marginBottom: 16 }}>
              {cm.channels}
            </p>
            <ul className={s.channels}>
              {channels.map((p) => (
                <li key={p.id} className={s.channel}>
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d={p.path} />
                  </svg>
                  <span>{p.name}</span>
                </li>
              ))}
            </ul>
            <p className={s.note}>{im.channelsNote}</p>
          </div>
        </div>
      </section>

      {/* LUVISCENT */}
      <section className={s.emerald} data-tone="dark" aria-labelledby="home-lv">
        <div className={`frame ${s.split}`}>
          <div>
            <p className={`t-label ${s.tag} ${s.gold}`} data-reveal>
              <span className={s.tagRule} /> {sv.luviscent.tag}
            </p>
            <h2 id="home-lv" className={`${s.h2} ${s.h2Dark}`} data-reveal>
              {sv.luviscent.title1} <span className={s.gold}>{sv.luviscent.title2}</span>
            </h2>
            <p className={s.bodyDark} data-reveal>
              {sv.luviscent.body}
            </p>
            <div className={s.actions} data-reveal>
              <a href={lvHref} className={s.btnGold} {...(BRANDS.luviscent.url ? { target: "_blank", rel: "noopener" } : {})}>
                {sv.luviscent.cta}
                <span className={s.badge} aria-hidden="true" />
              </a>
              <a href={href("/brands")} className={s.btnGhostGold}>
                {sv.luviscent.brands}
              </a>
            </div>
          </div>
          <figure className={s.media} data-reveal style={d(120)}>
            <img src="/brand/luviscent/diffuser-tower.webp" alt="LUVISCENT" width={778} height={1400} loading="lazy" style={{ maxHeight: 440 }} />
          </figure>
        </div>
      </section>

      {/* why Luna Trading */}
      <section className={s.dark} data-tone="dark" aria-labelledby="home-values">
        <div className="frame">
          <Tag dark>{im.valuesTag}</Tag>
          <h2 id="home-values" className={`${s.h2} ${s.h2Dark}`} data-reveal>
            {im.valuesTitle}
          </h2>
          <div className={s.values}>
            {im.values.map((v, i) => (
              <div key={i} className={s.value} data-reveal style={d(i * 80)}>
                <span className={s.check} aria-hidden="true" />
                <h3 className={s.valueTitle}>{v.title}</h3>
                <p className={s.valueText}>{v.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Cta id="home-cta" title={`${sv.cta.h1} ${sv.cta.h2}`} text={sv.cta.lead} button={sv.cta.button} href={href("/contact")} more={{ label: sv.cta.company, href: href("/company") }} />
    </div>
  );
}
