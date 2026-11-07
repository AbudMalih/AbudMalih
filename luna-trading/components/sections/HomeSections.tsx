"use client";

import { useRef } from "react";
import { useI18n } from "@/content/i18n/I18nProvider";
import { IMPORT_COPY } from "@/content/importPage";
import type { ServiceId } from "@/content/i18n/services/types";
import type { StepId } from "@/content/i18n/types";
import { usePageMotion } from "@/components/services/usePageMotion";
import ChainArt from "@/components/sections/ChainArt";
import RouteCard from "@/components/import/RouteCard";
import CommerceFlow from "./CommerceFlow";
import { FlagCN, FlagDE, FlagEU } from "@/components/import/Flags";
import {
  Cta,
  Tag,
  RedButton,
  GhostButton,
  d,
  kit as s,
} from "@/components/kit/Kit";
import h from "./HomeSections.module.css";
import { Carton } from "@/components/kit/Ambient";
import a from "@/components/kit/Ambient.module.css";
import Story from "@/components/kit/Story";
import { STORY } from "@/content/story";

/**
 * The homepage after the opening: calm sections in the site's style, in
 * normal scroll (each reveals once). Only verified copy, shared with the
 * Leistungen, Import and Marken pages.
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

export default function HomeSections() {
  const { dict, locale, href } = useI18n();
  const sv = dict.services;
  const im = IMPORT_COPY[locale];
  const root = useRef<HTMLDivElement>(null);
  usePageMotion(root as unknown as React.RefObject<HTMLElement>);

  return (
    <div ref={root} className={`${s.page} ${h.wrap}`}>
      {true && (
        <>
          {/* 01 · from the source to the market */}
          <section
            className={s.light}
            data-tone="light"
            aria-labelledby="home-source"
          >
            <div className={`frame ${s.split}`}>
              <div>
                <Tag>{dict.source.tag}</Tag>
                <h2 id="home-source" className={s.h2} data-reveal>
                  {dict.source.l1}{" "}
                  <span className={s.titleRed}>{dict.source.l2}</span>
                </h2>
                <ul className={s.chips} data-reveal>
                  {dict.source.supporting.map((x) => (
                    <li key={x} className={s.chip}>
                      {x}
                    </li>
                  ))}
                </ul>
              </div>
              <div
                className={s.bentoHero}
                style={{ minHeight: 360 }}
                data-reveal
                aria-hidden="true"
              >
                <span
                  className={s.chipDark}
                  style={{ alignSelf: "flex-start" }}
                >
                  {im.lanes[0]}
                </span>
              </div>
            </div>
          </section>

          {/* import: the lane */}
          <section
            className={s.dark}
            data-tone="dark"
            aria-labelledby="home-import"
          >
            <div className={`frame ${s.split}`}>
              <div>
                <p className={`t-label ${s.eyebrow}`} data-reveal>
                  <span className={s.dot} />
                  {im.eyebrow}
                </p>
                <h2
                  id="home-import"
                  className={`${s.h2} ${s.h2Dark}`}
                  data-reveal
                  style={{ marginTop: 22 }}
                >
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
                      {locale === "de"
                        ? "Deutschland"
                        : locale === "en"
                          ? "Germany"
                          : "ألمانيا"}
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
                  <RedButton href={href("/import")}>
                    {dict.hero.ctaImport}
                  </RedButton>
                  <GhostButton href={href("/quote")}>
                    {im.ctaPrimary}
                  </GhostButton>
                </div>
              </div>
              <div data-reveal style={d(120)}>
                <RouteCard t={im} />
              </div>
            </div>
          </section>
          {/* 02 · to Europe */}
          <section
            className={s.dark}
            data-tone="dark"
            aria-labelledby="home-transport"
          >
            <div className={`frame ${s.split}`}>
              <div>
                <Tag dark>{dict.transport.tag}</Tag>
                <h2
                  id="home-transport"
                  className={`${s.h2} ${s.h2Dark}`}
                  data-reveal
                >
                  {dict.transport.l1}{" "}
                  <span className={s.titleRed}>{dict.transport.l2}</span>
                </h2>
                <p className={`${s.big}`} style={{ marginTop: 22 }} data-reveal>
                  {dict.transport.leadStrong}
                </p>
                <p className={s.bodyDark} data-reveal>
                  {dict.transport.lead}
                </p>
              </div>
              <div className={s.cardDark} data-reveal style={d(100)}>
                <ol className={h.steps}>
                  {sv.trade.docRows.map((r, n) => (
                    <li key={r}>
                      <span className={h.stepNum}>{num(n)}</span>
                      <span className={h.stepName}>{r}</span>
                    </li>
                  ))}
                </ol>
                <p className={h.stepFoot}>
                  <span className={h.hubPlus} aria-hidden="true" />
                  {sv.trade.market}
                </p>
              </div>
            </div>
          </section>

          {/* 03 · distribution */}
          <section
            className={s.light}
            data-tone="light"
            aria-labelledby="home-warehouse"
          >
            <div className="frame">
              <Tag>{dict.warehouse.tag}</Tag>
              <h2 id="home-warehouse" className={s.h2} data-reveal>
                {dict.warehouse.l1}{" "}
                <span className={s.titleRed}>{dict.warehouse.l2}</span>
              </h2>
              <div className={s.grid4}>
                {(["germany", "eu", "ecommerce", "b2b"] as const).map(
                  (k, i) => (
                    <div
                      key={k}
                      className={`${s.card} ${s.cardHover}`}
                      data-reveal
                      style={{
                        ...d(i * 70),
                        display: "flex",
                        alignItems: "center",
                        gap: 14,
                      }}
                    >
                      {k === "germany" ? (
                        <FlagDE className={s.flag} />
                      ) : k === "eu" ? (
                        <FlagEU className={s.flag} />
                      ) : (
                        <span className={s.num}>{num(i)}</span>
                      )}
                      <h3 className={s.h3} style={{ marginTop: 0 }}>
                        {dict.warehouse.labels[k]}
                      </h3>
                    </div>
                  ),
                )}
              </div>
            </div>
          </section>

          {/* 04 · we build brands */}
          <section
            className={s.dark}
            data-tone="dark"
            aria-labelledby="home-brands"
          >
            <div className={`frame ${a.sideGrid}`}>
              <div>
                <h2
                  id="home-brands"
                  className={`${s.h2} ${s.h2Dark}`}
                  style={{ maxWidth: "none" }}
                  data-reveal
                >
                  <span style={{ color: "#8d8e93" }}>
                    {dict.brands.a1} {dict.brands.a2}
                  </span>
                  <br />
                  {dict.brands.b1}{" "}
                  <span className={s.titleRed}>{dict.brands.b2}.</span>
                </h2>
                <div className={s.actions} data-reveal>
                  <GhostButton href={href("/brands")}>
                    {dict.nav.brands}
                  </GhostButton>
                </div>
              </div>
              <div className={a.sideVisual} data-reveal style={d(160)}>
                <Carton label={STORY[locale].visual.carton} />
              </div>
            </div>
          </section>

          {/* what we do */}
          <section
            className={s.light}
            data-tone="light"
            aria-labelledby="home-model"
          >
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
                  <a
                    key={id}
                    href={href(`/what-we-do#${id}`)}
                    className={i === 0 ? s.bentoHero : s.card}
                    data-reveal
                    style={d(i * 60)}
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
                    <h3 className={s.h3}>
                      {sv.chapters[id].title.replace(/­/g, "")}
                    </h3>
                    <p className={i === 0 ? s.textDark : s.text}>
                      {sv.model.lines[id]}
                    </p>
                    <span className={s.link}>{sv.model.jump}</span>
                  </a>
                ))}
              </div>
            </div>
          </section>

          {/* e-commerce */}
          <section
            className={`${s.light} ${s.alt}`}
            data-tone="light"
            aria-labelledby="home-commerce"
          >
            <div className="frame">
              <Tag>{dict.commerce.tag}</Tag>
              <h2 id="home-commerce" className={s.h2} data-reveal>
                {dict.commerce.h1}{" "}
                <span className={s.titleRed}>{dict.commerce.h2}</span>
              </h2>
              <p className={s.body} data-reveal>
                <strong>{dict.commerce.secondary}</strong> {dict.commerce.body}
              </p>
              <CommerceFlow copy={dict.commerce} />
              <p className={s.note}>{im.channelsNote}</p>
            </div>
          </section>
        </>
      )}

      {true && (
        <>
          <Story id="home-story" />

          <Cta
            id="home-cta"
            title={`${sv.cta.h1} ${sv.cta.h2}`}
            text={sv.cta.lead}
            button={sv.cta.button}
            href={href("/contact")}
            more={{ label: sv.cta.company, href: href("/company") }}
          />
        </>
      )}
    </div>
  );
}
