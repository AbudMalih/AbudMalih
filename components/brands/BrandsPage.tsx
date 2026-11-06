"use client";

import { useRef } from "react";
import { useI18n } from "@/content/i18n/I18nProvider";
import { OWNED_BRANDS } from "@/content/brands";
import { LuviscentLogo } from "@/components/brand/Logos";
import { usePageMotion } from "@/components/services/usePageMotion";
import { PageHero, Band, Cta, Tag, RedButton, GhostButton, d, kit as s } from "@/components/kit/Kit";
import svc from "@/components/services/Services.module.css";

/**
 * MARKEN / BRANDS on the site kit: port hero with the brand card, the
 * principle, one emerald chapter per owned brand with its real product
 * photography and categories (never invented products), the system behind
 * it and the call to action.
 */
const num = (i: number) => String(i + 1).padStart(2, "0");

export default function BrandsPage() {
  const { dict, href } = useI18n();
  const t = dict.brandsPage;
  const root = useRef<HTMLElement>(null);
  usePageMotion(root);
  const first = OWNED_BRANDS[0];

  return (
    <article ref={root} className={`${svc.page} ${s.page}`}>
      <PageHero
        id="br-title"
        eyebrow={t.hero.eyebrow}
        a={t.hero.h1a}
        b={t.hero.h1b}
        lead={t.hero.lead}
        actions={
          <>
            <RedButton href={href("/contact")}>{t.cta.button}</RedButton>
            <GhostButton href={`#${first.id}`}>{first.name}</GhostButton>
          </>
        }
        aside={
          <a href={`#${first.id}`} className={s.glass} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,0.8fr)", gap: 20, alignItems: "center", background: "linear-gradient(160deg, rgba(13,34,27,.86), rgba(5,17,13,.86))" }}>
            <div>
              <p className={s.chips} style={{ marginTop: 0 }}>
                <span className={s.chipDark}>{t.hero.luna}</span>
              </p>
              <div style={{ margin: "22px 0 10px", maxWidth: 220 }}>
                <LuviscentLogo />
              </div>
              <p className={s.textDark}>{t.brands[first.id]?.category}</p>
              <span className={`${s.link} ${s.gold}`}>{t.hero.brand}</span>
            </div>
            {first.media.hero?.type === "image" && (
              <img src={first.media.hero.src} alt={first.media.hero.alt} width={first.media.hero.width} height={first.media.hero.height} style={{ width: "100%", height: "auto", maxHeight: 380, objectFit: "contain" }} />
            )}
          </a>
        }
      />

      <Band title={t.principle.foundation} items={t.principle.services} />

      {/* principle */}
      <section className={s.light} data-tone="light" aria-labelledby="br-principle">
        <div className="frame">
          <Tag>{t.principle.tag}</Tag>
          <h2 id="br-principle" className={s.h2} data-reveal>
            {t.principle.title1} <span className={s.titleRed}>{t.principle.title2}</span>
          </h2>
          <div className={s.grid4}>
            {t.principle.pillars.map((p, i) => (
              <div key={p.name} className={`${s.card} ${s.cardHover}`} data-reveal style={d(i * 80)}>
                <span className={s.num}>{num(i)}</span>
                <h3 className={s.h3}>{p.name}</h3>
                <p className={s.text}>{p.line}</p>
              </div>
            ))}
          </div>
          <p className={s.note} data-reveal>
            {t.principle.foundation}
          </p>
          <ul className={s.chips} data-reveal>
            {t.principle.services.map((x) => (
              <li key={x} className={s.chip}>
                {x}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* one chapter per owned brand */}
      {OWNED_BRANDS.map((brand) => {
        const c = t.brands[brand.id];
        if (!c) return null;
        const discover = brand.url ?? `#${brand.id}-world`;
        return (
          <div key={brand.id}>
            <section id={brand.id} className={s.emerald} data-tone="dark" aria-labelledby={`br-${brand.id}`}>
              <div className={`frame ${s.split}`}>
                <div>
                  <p className={s.chips} style={{ marginTop: 0 }} data-reveal>
                    <span className={s.chipDark}>{c.owner}</span>
                    <span className={s.chipDark}>{c.category}</span>
                  </p>
                  <h2 id={`br-${brand.id}`} className={s.h2} style={{ maxWidth: 360, marginTop: 30 }} data-reveal>
                    {brand.id === "luviscent" ? <LuviscentLogo /> : brand.name}
                  </h2>
                  <p className={`${s.big} ${s.gold}`} lang={brand.claimLang} style={{ marginTop: 26 }} data-reveal>
                    {brand.claim}
                  </p>
                  <p className={s.bodyDark} data-reveal>
                    {c.statement}
                  </p>
                  <div className={s.actions} data-reveal>
                    <a href={discover} className={s.btnGold} {...(brand.url ? { target: "_blank", rel: "noopener" } : {})}>
                      {c.cta}
                      <span className={s.badge} aria-hidden="true" />
                    </a>
                  </div>
                </div>
                {brand.media.hero?.type === "image" && (
                  <figure className={s.media} data-reveal style={d(120)}>
                    <img src={brand.media.hero.src} alt={c.world.productAlts.tower ?? brand.media.hero.alt} width={brand.media.hero.width} height={brand.media.hero.height} loading="lazy" />
                  </figure>
                )}
              </div>
            </section>

            <section id={`${brand.id}-world`} className={s.light} data-tone="light" aria-labelledby={`br-${brand.id}-world`}>
              <div className="frame">
                <Tag>{c.world.tag}</Tag>
                <h2 id={`br-${brand.id}-world`} className={s.h2} data-reveal>
                  {c.world.title1} <span className={s.titleRed}>{c.world.title2}</span>
                </h2>
                <p className={s.body} data-reveal>
                  {c.world.intro}
                </p>
                <p className={s.note} data-reveal>
                  {c.world.areas}
                </p>
                <div className={s.grid3} style={{ marginTop: 16 }}>
                  {c.world.categories.map((cat, i) => (
                    <div key={cat.id} className={`${s.card} ${s.cardHover}`} data-reveal style={d(i * 80)}>
                      <span className={s.num}>{num(i)}</span>
                      <h3 className={s.h3}>{cat.name}</h3>
                      <p className={s.text}>{cat.note}</p>
                    </div>
                  ))}
                </div>
                {brand.media.products.length > 0 && (
                  <>
                    <p className={s.note} style={{ marginTop: 56 }} data-reveal>
                      {c.world.collection} · {c.world.categories.find((x) => x.id === brand.media.products[0].category)?.name}
                    </p>
                    <div className={s.grid4} style={{ marginTop: 16 }}>
                      {brand.media.products.map((p, i) => (
                        <figure key={p.id} data-reveal style={{ ...d(i * 70), margin: 0 }}>
                          <div className={`${s.media} ${p.tone === "light" ? s.mediaLight : ""}`} style={{ aspectRatio: "4 / 5" }}>
                            <img src={p.src} alt={c.world.productAlts[p.id] ?? c.world.productAlt} width={p.width} height={p.height} loading="lazy" style={{ maxHeight: 300 }} />
                          </div>
                        </figure>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </section>
          </div>
        );
      })}

      {/* the system behind */}
      <section className={s.dark} data-tone="dark" aria-labelledby="br-system">
        <div className={`frame ${s.split}`}>
          <div>
            <Tag dark>{t.system.tag}</Tag>
            <h2 id="br-system" className={`${s.h2} ${s.h2Dark}`} data-reveal>
              {t.system.title1} <span className={s.titleRed}>{t.system.title2}</span>
            </h2>
            <p className={s.bodyDark} data-reveal>
              {t.system.body}
            </p>
            <div className={s.actions} data-reveal>
              <GhostButton href={href("/what-we-do")}>{t.system.link}</GhostButton>
            </div>
          </div>
          <div className={s.glass} data-reveal>
            <ol className={s.stack}>
              {t.principle.services.map((x, i) => (
                <li key={x} className={s.stackItem} style={{ ["--i" as string]: i }}>
                  <span className={s.num}>{num(i)}</span>
                  {x}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <Cta id="br-cta" title={`${t.cta.h1} ${t.cta.h2}`} text={t.cta.lead} button={t.cta.button} href={href("/contact")} more={{ label: t.cta.company, href: href("/company") }} />
    </article>
  );
}
