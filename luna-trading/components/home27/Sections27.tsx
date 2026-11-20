"use client";

import Link from "next/link";
import { useRef, type ReactNode } from "react";
import { useI18n } from "@/content/i18n/I18nProvider";
import { IMPORT_COPY } from "@/content/importPage";
import { STORY } from "@/content/story";
import type { ServiceId } from "@/content/i18n/services/types";
import type { StepId } from "@/content/i18n/types";
import { usePageMotion } from "@/components/services/usePageMotion";
import ChainArt from "@/components/sections/ChainArt";
import RouteCard from "@/components/import/RouteCard";
import CommerceFlow from "@/components/sections/CommerceFlow";
import { FlagCN, FlagDE, FlagEU } from "@/components/import/Flags";
import { BrandCube } from "@/components/kit/Ambient";
import { useMotion27 } from "./motion27";
import s from "./Home27.module.css";

/**
 * The 2027 homepage after the opening. Same sections, same words and links
 * as the current homepage (all copy comes from the shared content files);
 * only layout, styling and motion are new.
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
const d = (ms: number) => ({ ["--d" as string]: `${ms}ms` });

/** Text split into masked words (animated by [data-split] on the parent). */
function Words({ text }: { text: string }) {
  const parts = text.split(" ").filter(Boolean);
  return (
    <>
      {parts.map((w, i) => (
        <span key={i}>
          <span className={s.w}>
            <span data-wi>{w}</span>
          </span>
          {i < parts.length - 1 ? " " : ""}
        </span>
      ))}
    </>
  );
}

function Index({ n, children }: { n: string; children: ReactNode }) {
  return (
    <p className={s.index}>
      <span className={s.indexNum}>{n}</span>
      <span className={s.indexRule} data-rule aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

const Arrow = ({ className = s.arrow }: { className?: string }) => (
  <svg viewBox="0 0 16 16" className={className} aria-hidden="true">
    <path
      d="M1 8h13M9 3l5 5-5 5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    />
  </svg>
);

function PrimaryButton({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={s.btn} data-magnet>
      {children}
      <span className={s.btnIcon} aria-hidden="true">
        <Arrow className="" />
      </span>
    </Link>
  );
}

function TextLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className={s.link}>
      {children}
      <Arrow />
    </Link>
  );
}

export default function Sections27() {
  const { dict, locale, href } = useI18n();
  const sv = dict.services;
  const im = IMPORT_COPY[locale];
  const story = STORY[locale];
  const root = useRef<HTMLDivElement>(null);
  usePageMotion(root as unknown as React.RefObject<HTMLElement>, {
    hardEdges: true,
  });
  useMotion27(root, locale);

  const china = locale === "ar" ? "الصين" : "China";
  const germany =
    locale === "de" ? "Deutschland" : locale === "en" ? "Germany" : "ألمانيا";
  const eu = locale === "ar" ? "الاتحاد الأوروبي" : "EU";

  return (
    <div ref={root} className={s.root}>
      {/* 01 · from the source to the market */}
      <section
        className={`${s.sec} ${s.ivory}`}
        data-tone="light"
        aria-labelledby="h27-source"
      >
        <div className="frame">
          <Index n="01">{dict.source.tag}</Index>
          <div className={s.sourceHead}>
            <h2 id="h27-source" className={s.display} data-split>
              <Words text={dict.source.l1} />{" "}
              <span className={s.accent}>
                <Words text={dict.source.l2} />
              </span>
            </h2>
            <p className={s.sourceNote} data-reveal>
              {im.lanesTitle}
              <br />
              {im.lanes.slice(0, 3).map((l) => (
                <span key={l} dir="ltr" style={{ display: "block" }}>
                  {l}
                </span>
              ))}
            </p>
          </div>

          <div className={s.lane} data-lane>
            <svg
              className={s.laneSvg}
              viewBox="0 0 1200 120"
              aria-hidden="true"
            >
              <path
                className={s.laneBase}
                d="M6 92 C 220 92, 300 30, 480 34 S 760 98, 960 70 S 1140 24, 1194 30"
              />
              <path
                className={s.laneRed}
                data-lane-path
                pathLength={1}
                d="M6 92 C 220 92, 300 30, 480 34 S 760 98, 960 70 S 1140 24, 1194 30"
              />
            </svg>
            <ol className={s.laneStops}>
              <li className={`${s.stop} ${s.stopEnd}`} data-stop>
                <span className={s.stopKick}>{im.from}</span>
                <span className={s.stopName}>{china}</span>
              </li>
              {dict.source.supporting.map((x, i) => (
                <li key={x} className={s.stop} data-stop>
                  <span className={s.stopKick}>{num(i)}</span>
                  <span className={s.stopName}>{x}</span>
                </li>
              ))}
              <li className={`${s.stop} ${s.stopEnd}`} data-stop>
                <span className={s.stopKick}>{im.to}</span>
                <span className={s.stopName}>
                  {germany} · {eu}
                </span>
              </li>
            </ol>
          </div>
        </div>
      </section>

      {/* 02 · the import lane, then transport: one continuous dark band */}
      <section
        className={`${s.sec} ${s.char} ${s.grid}`}
        data-tone="dark"
        aria-labelledby="h27-import"
      >
        <div className="frame">
          <Index n="02">{im.eyebrow}</Index>
          <div className={s.split}>
            <div>
              <h2 id="h27-import" className={s.display} data-split>
                <Words text={im.h1a} />{" "}
                <span className={s.accent}>
                  <Words text={im.h1b} />
                </span>
              </h2>
              <div className={s.ticket} data-reveal>
                <span className={s.ticketCell}>
                  <FlagCN className={s.flag} />
                  <span>
                    <small>{im.from}</small>
                    <strong>{china}</strong>
                  </span>
                </span>
                <span className={s.ticketCell}>
                  <FlagDE className={s.flag} />
                  <span>
                    <small>{im.to}</small>
                    <strong>{germany}</strong>
                  </span>
                </span>
                <span className={s.ticketCell}>
                  <FlagEU className={s.flag} />
                  <span>
                    <small>&nbsp;</small>
                    <strong>{eu}</strong>
                  </span>
                </span>
              </div>
              <p className={s.lead} data-reveal>
                {im.lead}
              </p>
              <div className={s.actions} data-reveal>
                <PrimaryButton href={href("/import")}>
                  {dict.hero.ctaImport}
                </PrimaryButton>
                <TextLink href={href("/quote")}>{im.ctaPrimary}</TextLink>
              </div>
            </div>
            <div className={`${s.panel} ${s.ticks}`} data-reveal style={d(120)}>
              <RouteCard t={im} />
            </div>
          </div>

          <div
            className={s.transport}
            aria-labelledby="h27-transport"
            role="group"
          >
            <div>
              <Index n="03">{dict.transport.tag}</Index>
              <h2 id="h27-transport" className={s.display} data-split>
                <Words text={dict.transport.l1} />{" "}
                <span className={s.accent}>
                  <Words text={dict.transport.l2} />
                </span>
              </h2>
              <p className={s.serifLine} data-reveal>
                {dict.transport.leadStrong}
              </p>
              <p className={s.lead} data-reveal>
                {dict.transport.lead}
              </p>
            </div>
            <div data-reveal style={d(100)}>
              <ol className={s.manifest}>
                {sv.trade.docRows.map((r, n) => (
                  <li key={r}>
                    <span className={s.mNum}>{num(n)}</span>
                    <span className={s.mName}>{r}</span>
                    <svg
                      viewBox="0 0 22 22"
                      className={s.mTick}
                      aria-hidden="true"
                    >
                      <path
                        d="M5 11.5l4 4 8-9"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      />
                    </svg>
                  </li>
                ))}
              </ol>
              <p className={s.market}>
                <span className={s.plus} aria-hidden="true" />
                {sv.trade.market}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 04 · distribution */}
      <section
        className={`${s.sec} ${s.ivory}`}
        data-tone="light"
        aria-labelledby="h27-warehouse"
      >
        <div className="frame">
          <Index n="04">{dict.warehouse.tag}</Index>
          <div className={s.distHead}>
            <h2
              id="h27-warehouse"
              className={`${s.display} ${s.displayWide}`}
              data-split
            >
              <Words text={dict.warehouse.l1} />{" "}
              <span className={s.accent}>
                <Words text={dict.warehouse.l2} />
              </span>
            </h2>
          </div>
          <div className={s.tiles}>
            {(["germany", "eu", "ecommerce", "b2b"] as const).map((k, i) => (
              <div
                key={k}
                className={`${s.tile} ${s.lit}`}
                data-lit
                data-reveal
                style={d(i * 80)}
              >
                <div className={s.tileTop}>
                  <span className={s.tileNum}>{num(i)}</span>
                  <span className={s.tileMark} aria-hidden="true">
                    {k === "germany" ? (
                      <FlagDE className={s.flag} />
                    ) : k === "eu" ? (
                      <FlagEU className={s.flag} />
                    ) : (
                      <span className={s.plus} />
                    )}
                  </span>
                </div>
                <div>
                  <h3 className={s.tileName}>{dict.warehouse.labels[k]}</h3>
                  <span className={s.tileBar} aria-hidden="true" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 05 · the operating model: six disciplines */}
      <section
        className={`${s.sec} ${s.ivory2}`}
        data-tone="light"
        aria-labelledby="h27-model"
      >
        <div className="frame">
          <Index n="05">{sv.model.tag}</Index>
          <div className={s.atlasHead}>
            <h2 id="h27-model" className={s.display} data-split>
              <Words text={sv.model.title} />
            </h2>
            <p className={s.lead} data-reveal>
              {sv.model.intro}
            </p>
          </div>
          <div className={s.atlas}>
            {IDS.map((id, i) => (
              <Link
                key={id}
                href={href(`/what-we-do#${id}`)}
                className={`${s.svc} ${s.lit}`}
                data-lit
                data-reveal
                style={d((i % 3) * 80)}
              >
                <span className={s.svcTop}>
                  <span>{num(i)}</span>
                  <span aria-hidden="true">/ 06</span>
                </span>
                <span className={s.svcArt} aria-hidden="true">
                  <ChainArt id={ART[id]} className="" redClass={s.svcArtRed} />
                </span>
                <h3 className={s.svcTitle}>
                  {sv.chapters[id].title.replace(/­/g, "")}
                </h3>
                <p className={s.svcText}>{sv.model.lines[id]}</p>
                <span className={s.svcMore}>
                  {sv.model.jump}
                  <Arrow />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* 06 · we build brands */}
      <section
        className={`${s.sec} ${s.char} ${s.grid}`}
        data-tone="dark"
        aria-labelledby="h27-brands"
      >
        <div className={`frame ${s.brands}`}>
          <div>
            <Index n="06">{dict.nav.brands}</Index>
            <h2 id="h27-brands" className={s.brandsTitle} data-split>
              <span className={s.muted}>
                <Words text={`${dict.brands.a1} ${dict.brands.a2}`} />
              </span>{" "}
              <Words text={dict.brands.b1} />{" "}
              <span className={s.accent}>
                <Words text={`${dict.brands.b2}.`} />
              </span>
            </h2>
            <div className={s.actions} data-reveal>
              <TextLink href={href("/brands")}>{dict.nav.brands}</TextLink>
            </div>
          </div>
          <div className={s.brandsVisual} data-reveal style={d(160)}>
            <span className={s.halo} aria-hidden="true" />
            <BrandCube label={story.visual.carton} />
          </div>
        </div>
      </section>

      {/* 07 · e-commerce */}
      <section
        className={`${s.sec} ${s.ivory}`}
        data-tone="light"
        aria-labelledby="h27-commerce"
      >
        <div className="frame">
          <Index n="07">{dict.commerce.tag}</Index>
          <div className={s.commerceHead}>
            <h2 id="h27-commerce" className={s.display} data-split>
              <Words text={dict.commerce.h1} />{" "}
              <span className={s.accent}>
                <Words text={dict.commerce.h2} />
              </span>
            </h2>
            <p className={s.lead} data-reveal>
              <span className={s.strong}>{dict.commerce.secondary}</span>{" "}
              {dict.commerce.body}
            </p>
          </div>
          <div className={s.plate} data-reveal>
            <CommerceFlow copy={dict.commerce} />
          </div>
          <div className={s.notes}>
            <p className={s.note}>{im.channelsNote}</p>
            <p className={`${s.note} ${s.noteFine}`}>{im.trademarkNote}</p>
          </div>
        </div>
      </section>

      {/* 08 · how we work */}
      <section
        className={`${s.sec} ${s.char2}`}
        data-tone="dark"
        aria-labelledby="h27-story"
      >
        <div className="frame">
          <Index n="08">{story.tag}</Index>
          <div className={s.storyHead}>
            <div>
              <h2 id="h27-story" className={s.display} data-split>
                <Words text={story.title1} />{" "}
                <span className={s.muted}>
                  <Words text={story.title2} />
                </span>
              </h2>
              <p className={s.lead} data-reveal>
                {story.lead}
              </p>
            </div>
            <blockquote className={s.quote} data-reveal style={d(120)}>
              <p>{story.quote}</p>
              <footer>{story.quoteBy}</footer>
            </blockquote>
          </div>
          <ol className={s.storyGrid}>
            {story.steps.map((st, i) => (
              <li key={st.img} data-reveal style={d(i * 100)}>
                <figure className={s.photo}>
                  <img
                    src={`/story/${st.img}-1600.webp`}
                    srcSet={`/story/${st.img}-960.webp 960w, /story/${st.img}-1600.webp 1600w`}
                    sizes="(max-width: 900px) 100vw, 33vw"
                    alt={st.alt}
                    width={1600}
                    height={1195}
                    loading="lazy"
                    decoding="async"
                    data-parallax
                  />
                  <span className={s.photoNote}>{story.note}</span>
                  <span className={s.photoKick}>
                    {num(i)} · {st.kicker}
                  </span>
                </figure>
                <h3 className={s.storyTitle}>{st.title}</h3>
                <p className={s.storyBody}>{st.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* closing: talk to us */}
      <section
        className={`${s.sec} ${s.char} ${s.cta}`}
        data-tone="dark"
        aria-labelledby="h27-cta"
      >
        <div className={`frame ${s.ctaInner}`}>
          <Index n="09">{sv.cta.tag}</Index>
          <h2 id="h27-cta" className={s.ctaTitle} data-split>
            <Words text={sv.cta.h1} />{" "}
            <span className={s.accent}>
              <Words text={sv.cta.h2} />
            </span>
          </h2>
          <p className={s.lead} data-reveal>
            {sv.cta.lead}
          </p>
          <div className={s.actions} data-reveal>
            <PrimaryButton href={href("/contact")}>
              {sv.cta.button}
            </PrimaryButton>
            <TextLink href={href("/company")}>{sv.cta.company}</TextLink>
          </div>
        </div>
      </section>
    </div>
  );
}
