"use client";

import Link from "next/link";
import { Fragment, useRef, type ComponentType, type CSSProperties } from "react";
import { useI18n } from "@/content/i18n/I18nProvider";
import type { OwnedBrandCopy } from "@/content/i18n/brands/types";
import { OWNED_BRANDS, type OwnedBrand } from "@/content/brands";
import { LuviscentLogo } from "@/components/brand/Logos";
import BrandMediaSlot from "@/components/ui/BrandMediaSlot";
import { usePageMotion } from "@/components/services/usePageMotion";
import { usePassage } from "./usePassage";
import svc from "@/components/services/Services.module.css";
import s from "./Brands.module.css";
import "./panchang.css";

/**
 * MARKEN / BRANDS: what can emerge from the Luna Trading system.
 * The page opens in the Luna mineral world (hero, principle), then each
 * owned brand gets a full chapter: a scrubbed passage in which the red
 * Luna route warms into the brand's champagne and the ground turns to its
 * own colour, the brand scene, its world, and the passage back. It closes
 * in Luna Trading again: the system behind it, and the business CTA.
 * Chapters come from OWNED_BRANDS, so further real brands slot in without a
 * redesign; nothing is shown for brands that do not exist.
 */

const LOGOS: Record<string, ComponentType<{ width?: number | string; className?: string }>> = {
  luviscent: LuviscentLogo,
};

// Luna Trading grounds (the brand grounds come from OWNED_BRANDS)
const LUNA = { hero: "#e6e3dd", principle: "#dedbd5", system: "#e2e0db", cta: "#0f1012" };
const ground = (bg: string, from: string): CSSProperties => ({ ["--bg" as string]: bg, ["--from" as string]: from });

export default function BrandsPage() {
  const { dict, href } = useI18n();
  const t = dict.brandsPage;
  const root = useRef<HTMLElement>(null);
  usePageMotion(root);
  usePassage(root);

  return (
    <article ref={root} className={`${svc.page} ${s.page}`}>
      {/* ------------------------------------------------------------ HERO */}
      <section className={`${svc.section} ${s.hero}`} style={ground(LUNA.hero, LUNA.hero)} data-tone="light" aria-labelledby="brands-title">
        <div className={`frame ${s.heroGrid}`}>
          <figure className={s.heroFigure} data-reveal aria-hidden="true">
            <HeroVisual luna={t.hero.luna} brand={t.hero.brand} />
            <HeroVisual luna={t.hero.luna} brand={t.hero.brand} compact />
          </figure>
          <div className={s.heroCopy}>
            <p className={`t-label ${s.eyebrow}`} data-reveal>
              <span className={s.idx}>02</span>
              <span className={s.redRule} />
              {t.hero.eyebrow}
            </p>
            <h1 id="brands-title" className={s.heroTitle}>
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
          </div>
          <p className={`t-lead ${s.heroLead}`} data-reveal style={{ ["--d" as string]: "220ms" }}>
            {t.hero.lead}
          </p>
        </div>
      </section>

      {/* ------------------------------------------------------- PRINCIPLE */}
      <section className={`${svc.section} ${s.principle}`} style={ground(LUNA.principle, LUNA.hero)} data-tone="light" aria-labelledby="brands-principle">
        <div className="frame">
          <p className={`t-label ${svc.tag}`} data-reveal>
            {t.principle.tag}
          </p>
          <h2 id="brands-principle" className={`${svc.h2} ${s.principleTitle}`} data-reveal>
            {t.principle.title1}
            <br />
            <span className={s.dim}>{t.principle.title2}</span>
          </h2>

          <div className={s.plinth} data-reveal>
            <ol className={s.pillars}>
              {t.principle.pillars.map((p, i) => (
                <li key={p.name} className={s.pillar} style={{ ["--i" as string]: i }}>
                  <span className={s.pillarIdx}>{String(i + 1).padStart(2, "0")}</span>
                  <span className={s.pillarName}>{p.name}</span>
                  <span className={s.pillarLine}>{p.line}</span>
                </li>
              ))}
            </ol>
            <div className={s.base}>
              <span className={s.baseLine} aria-hidden="true" />
              <span className={s.basePlus} aria-hidden="true" />
            </div>
            <div className={s.foundation}>
              <p className={`t-label ${s.foundationName}`}>{t.principle.foundation}</p>
              <ul className={s.services}>
                {t.principle.services.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------- OWNED BRAND CHAPTERS */}
      {OWNED_BRANDS.map((b, i) => {
        const copy = t.brands[b.id];
        if (!copy) return null;
        const before = i === 0 ? LUNA.principle : OWNED_BRANDS[i - 1].palette.world;
        return (
          <Fragment key={b.id}>
            <Passage dir="in" brand={b} mineral={before} from={t.passage.from} to={`${b.name}${b.mark} · ${copy.category}`} />
            <BrandScene brand={b} copy={copy} />
            <BrandWorld brand={b} copy={copy} />
            {i === OWNED_BRANDS.length - 1 && <Passage dir="out" brand={b} mineral={LUNA.system} from={t.passage.back} to={`${b.name}${b.mark}`} />}
          </Fragment>
        );
      })}

      {/* -------------------------------------------------------- SYSTEM */}
      <section className={`${svc.section} ${s.system}`} style={ground(LUNA.system, LUNA.system)} data-tone="light" aria-labelledby="brands-system">
        <div className={`frame ${s.systemGrid}`}>
          <div>
            <p className={`t-label ${svc.tag}`} data-reveal>
              {t.system.tag}
            </p>
            <h2 id="brands-system" className={svc.h2} data-reveal>
              {t.system.title1}
              <br />
              <span className={s.dim}>{t.system.title2}</span>
            </h2>
          </div>
          <div className={s.systemSide} data-reveal style={{ ["--d" as string]: "160ms" }}>
            <p className="t-lead">{t.system.body}</p>
            <Link href={href("/what-we-do")} className={s.systemLink} data-cursor="link">
              <span className={s.systemRoute} aria-hidden="true" />
              <span className={s.systemLabel}>{t.system.link}</span>
              <span className={svc.arrow} aria-hidden="true">
                →
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------------- CTA */}
      <section className={`${svc.section} ${svc.cta}`} style={ground(LUNA.cta, LUNA.system)} data-tone="dark" aria-labelledby="brands-cta">
        <div className={`frame ${svc.ctaInner}`}>
          <p className={`t-label ${svc.tag}`} data-reveal>
            {t.cta.tag}
          </p>
          <h2 id="brands-cta" className={svc.ctaTitle}>
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
              <Link href={href("/company")} className={`link-line t-label ${svc.ctaMore}`} data-cursor="link">
                {t.cta.company} <span className={svc.arrow} aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </article>
  );
}

/* ------------------------------------------------------------------------ */

/** Luna Trading (the red +) → a route → an arched brand space, still unlit. */
function HeroVisual({ luna, brand, compact }: { luna: string; brand: string; compact?: boolean }) {
  // the compact (phone) drawing keeps the same elements, closer together
  const w = compact ? 390 : 1320;
  const ax = compact ? 200 : 1080; // arch left edge
  const ticks = Array.from({ length: compact ? 3 : 8 }, (_, i) => 70 + i * (compact ? 44 : 120) + (compact ? 0 : 60));
  const end = ax + 110;
  return (
    <svg
      viewBox={`0 0 ${w} 430`}
      className={`${s.heroSvg} ${compact ? s.heroSvgCompact : s.heroSvgWide}`}
      direction="ltr"
      preserveAspectRatio="xMinYMax meet"
    >
      <defs>
        <linearGradient id="br-route" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="var(--luna-red)" />
          <stop offset="0.72" stopColor="var(--luna-red)" />
          <stop offset="1" stopColor="#a8875a" />
        </linearGradient>
        <radialGradient id="br-light" cx="0.5" cy="0.05" r="0.9">
          <stop offset="0" stopColor="#fbf6ea" stopOpacity="0.95" />
          <stop offset="0.55" stopColor="#efe6d4" stopOpacity="0.35" />
          <stop offset="1" stopColor="#efe6d4" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* survey ticks under the route */}
      <path d={ticks.map((x) => `M${x} 392 V401`).join(" ")} className={s.hvTick} />
      {/* the brand space: an arch, warm light already inside */}
      <path d={`M${ax} 376 V156 A110 110 0 0 1 ${ax + 220} 156 V376 Z`} fill="url(#br-light)" className={s.hvGlow} />
      <path d={`M${ax} 376 V156 A110 110 0 0 1 ${ax + 220} 156 V376`} pathLength={1} className={`${s.hvDraw} ${s.hvArch}`} />
      <path d={`M${ax + 22} 376 V164 A88 88 0 0 1 ${ax + 198} 164 V376`} pathLength={1} className={`${s.hvDraw} ${s.hvArchInner}`} />
      <path d={`M${ax - 30} 376 H${w}`} pathLength={1} className={`${s.hvDraw} ${s.hvFloor}`} />
      {/* the route: Luna red, warming as it reaches the brand */}
      <path d={`M14 376 H${end}`} pathLength={1} className={`${s.hvDraw} ${s.hvRoute}`} stroke="url(#br-route)" />
      <circle cx={end} cy="376" r="5" className={s.hvEnd} />
      {/* Luna Trading */}
      <g className={s.hvPlus}>
        <rect x="0" y="374" width="28" height="4" />
        <rect x="12" y="362" width="4" height="28" />
      </g>
      <text x="0" y="340" className={s.hvLabel}>
        {luna.toUpperCase()}
      </text>
      <text x="0" y="424" className={s.hvData}>
        50.94° N · 6.96° E
      </text>
      <text x={end} y="424" className={s.hvLabel} textAnchor="middle">
        {brand.toUpperCase()}
      </text>
    </svg>
  );
}

/** The scrubbed passage between Luna Trading and a brand world (and back). */
function Passage({ dir, brand, mineral, from, to }: { dir: "in" | "out"; brand: OwnedBrand; mineral: string; from: string; to: string }) {
  const style = {
    ["--min" as string]: mineral,
    ["--em" as string]: dir === "in" ? brand.palette.ground : brand.palette.world,
    ["--deep" as string]: brand.palette.deep,
    ["--accent" as string]: brand.palette.accent,
    ["--light" as string]: brand.palette.light,
    ["--bg" as string]: mineral,
    ["--from" as string]: mineral,
  } as CSSProperties;
  return (
    <section className={`${svc.section} ${s.passage}`} data-passage={dir} data-tone={dir === "in" ? "light" : "dark"} style={style} aria-hidden="true">
      <div className={s.stage}>
        <span className={s.pMineral} />
        <span className={s.pGrid} />
        <span className={s.pEmerald} />
        <span className={s.pLight} />
        <div className={s.pRoute}>
          <span className={s.pTicks} />
          <span className={s.pRed} />
          <span className={s.pGold} />
          <span className={s.pGlow} />
          <span className={s.pTraveler}>
            <i className={s.pPlus} />
            <i className={s.pDot} />
          </span>
        </div>
        <svg className={s.pArch} viewBox="0 0 220 300" preserveAspectRatio="xMidYMax meet">
          <path d="M10 300 V110 A100 100 0 0 1 210 110 V300" pathLength={1} />
        </svg>
        <p className={`${s.pLabel} ${s.pFrom}`}>
          <span>{from}</span>
          <span className={s.pCoord}>50.94° N · 6.96° E</span>
        </p>
        <p className={`${s.pLabel} ${s.pTo}`}>{to}</p>
      </div>
    </section>
  );
}

/** The established brand scene: its own type, light and rhythm. */
function BrandScene({ brand, copy }: { brand: OwnedBrand; copy: OwnedBrandCopy }) {
  const Logo = LOGOS[brand.id];
  const discover = brand.url ?? `#${brand.id}-world`;
  const vars = {
    ["--bg" as string]: brand.palette.ground,
    ["--from" as string]: brand.palette.ground,
    ["--lv-a" as string]: brand.palette.accent,
    ["--lv-l" as string]: brand.palette.light,
    ["--lv-i" as string]: brand.palette.ink,
  } as CSSProperties;
  return (
    <section id={brand.id} className={`${svc.section} ${s.scene}`} style={vars} data-tone="dark" aria-labelledby={`${brand.id}-name`}>
      <span className={s.sceneLight} aria-hidden="true" />
      <div className={`frame ${s.sceneGrid}`}>
        <div className={s.sceneRoom} data-parallax>
          <BrandMediaSlot media={brand.media.hero ? { ...brand.media.hero, alt: copy.world.productAlts.tower ?? copy.world.productAlt } : null} className={s.sceneNiche} />
        </div>
        <div className={s.sceneCopy}>
          <p className={s.owner} data-reveal>
            {copy.owner}
          </p>
          <h2 id={`${brand.id}-name`} className={s.sceneLogo} data-reveal style={{ ["--d" as string]: "120ms" }}>
            {Logo ? <Logo /> : `${brand.name}${brand.mark}`}
          </h2>
          <p className={s.category} data-reveal style={{ ["--d" as string]: "200ms" }}>
            {copy.category}
          </p>
          <p className={s.claim} lang={brand.claimLang} dir="ltr" data-reveal style={{ ["--d" as string]: "280ms" }}>
            {brand.claim}
          </p>
          <p className={s.statement} data-reveal style={{ ["--d" as string]: "360ms" }}>
            {copy.statement}
          </p>
          <div data-reveal style={{ ["--d" as string]: "440ms" }}>
            {brand.url ? (
              <a href={discover} className={s.lvCta} target="_blank" rel="noopener" data-cursor="link">
                <span>{copy.cta}</span>
                <span className={s.lvPlus} aria-hidden="true" />
              </a>
            ) : (
              <a href={discover} className={s.lvCta} data-cursor="link">
                <span>{copy.cta}</span>
                <span className={s.lvPlus} aria-hidden="true" />
              </a>
            )}
          </div>
        </div>
      </div>
      {/* the one structural thread back to Luna Trading: the route, in the brand's own colour */}
      <div className={`frame ${s.thread}`} aria-hidden="true">
        <span className={s.threadLine} />
        <span className={s.threadNode} />
        <span className={s.threadLabel}>LT · 50.94° N · 6.96° E</span>
      </div>
    </section>
  );
}

/**
 * The brand world: approved product photography on warm ivory plates, in an
 * editorial grid. Only categories with real images show products; the
 * others are named as areas of the brand, never as empty slots.
 */
function BrandWorld({ brand, copy }: { brand: OwnedBrand; copy: OwnedBrandCopy }) {
  const w = copy.world;
  const vars = {
    ["--bg" as string]: brand.palette.world,
    ["--from" as string]: brand.palette.ground,
    ["--lv-a" as string]: brand.palette.accent,
    ["--lv-l" as string]: brand.palette.light,
    ["--lv-i" as string]: brand.palette.ink,
  } as CSSProperties;
  const products = brand.media.products;
  const shown = w.categories.find((c) => products.some((p) => p.category === c.id));
  return (
    <section id={`${brand.id}-world`} className={`${svc.section} ${s.world}`} style={vars} data-tone="dark" aria-labelledby={`${brand.id}-world-title`}>
      <div className={`frame ${s.worldHead}`}>
        <p className={s.owner} data-reveal>
          {w.tag}
        </p>
        <h3 id={`${brand.id}-world-title`} className={s.worldTitle} data-reveal>
          {w.title1} <em>{w.title2}</em>
        </h3>
        <p className={s.worldIntro} data-reveal style={{ ["--d" as string]: "160ms" }}>
          {w.intro}
        </p>
      </div>
      {products.length > 0 && (
        <div className={`frame ${s.gallery}`}>
          {products.map((p, i) => (
            <figure key={p.id} className={`${s.tile} ${s[`tile_${p.id}`] ?? ""}`} data-reveal style={{ ["--d" as string]: `${(i % 2) * 140}ms` }}>
              <span className={s.tileLight} aria-hidden="true" />
              <span className={s.tileFloor} aria-hidden="true" />
              <img
                src={p.src}
                width={p.width}
                height={p.height}
                alt={w.productAlts[p.id] ?? `${w.productAlt} ${String(i + 1).padStart(2, "0")}`}
                className={s.tileImg}
                loading="lazy"
                decoding="async"
              />
              <figcaption className={s.tileIdx}>{`LV · ${String(i + 1).padStart(2, "0")}`}</figcaption>
            </figure>
          ))}
          <div className={s.collection} data-reveal style={{ ["--d" as string]: "280ms" }}>
            {shown && (
              <>
                <p className={s.owner}>{w.collection}</p>
                <p className={s.collectionName}>{shown.name}</p>
              </>
            )}
            <p className={`${s.owner} ${s.areasTag}`}>{w.areas}</p>
            <ul className={s.areas}>
              {w.categories.map((c) => (
                <li key={c.id} data-on={c.id === shown?.id ? "" : undefined}>
                  {c.name}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}
