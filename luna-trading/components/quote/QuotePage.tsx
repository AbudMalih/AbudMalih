"use client";

import { useRef } from "react";
import { useI18n } from "@/content/i18n/I18nProvider";
import { QUOTE_COPY } from "@/content/quotePage";
import { IMPORT_COPY } from "@/content/importPage";
import { usePageMotion } from "@/components/services/usePageMotion";
import RouteCard from "@/components/import/RouteCard";
import { PageHero, Tag, RedButton, GhostButton, d, kit as k } from "@/components/kit/Kit";
import QuoteForm from "./QuoteForm";
import svc from "@/components/services/Services.module.css";

/**
 * ANGEBOT / QUOTE: freight from China to Germany. Port hero with the live
 * lane and typical transit ranges, the quote form with a live summary,
 * the process, and what a precise quote needs.
 */
export default function QuotePage() {
  const { locale, href } = useI18n();
  const t = QUOTE_COPY[locale];
  const im = IMPORT_COPY[locale];
  const root = useRef<HTMLElement>(null);
  usePageMotion(root);

  return (
    <article ref={root} className={`${svc.page} ${k.page}`}>
      <PageHero
        id="qt-title"
        eyebrow={t.hero.eyebrow}
        a={t.hero.h1a}
        b={t.hero.h1b}
        lead={t.hero.lead}
        actions={
          <>
            <RedButton href="#anfrage">{t.hero.primary}</RedButton>
            <GhostButton href="#ablauf">{t.hero.secondary}</GhostButton>
          </>
        }
        aside={
          <div style={{ display: "grid", gap: 12 }}>
            <RouteCard t={im} />
            <div className={k.grid3} style={{ marginTop: 0, gap: 10 }}>
              {t.facts.map((f) => (
                <div key={f.k} className={k.glass} style={{ padding: "16px 18px" }}>
                  <p className={k.textDark} style={{ margin: 0, fontSize: "0.8rem" }}>
                    {f.k}
                  </p>
                  <p style={{ margin: "4px 0 0", fontWeight: 650 }}>{f.v}</p>
                </div>
              ))}
            </div>
          </div>
        }
      />

      <section id="anfrage" className={`${k.light} ${k.alt}`} data-tone="light" aria-labelledby="qt-form">
        <div className="frame">
          <Tag>{t.form.tag}</Tag>
          <h2 id="qt-form" className={k.h2} data-reveal>
            {t.form.title}
          </h2>
          <p className={k.body} data-reveal>
            {t.form.intro}
          </p>
          <QuoteForm t={t.form} locale={locale} privacyHref={href("/datenschutz")} />
        </div>
      </section>

      <section id="ablauf" className={k.dark} data-tone="dark" aria-labelledby="qt-next">
        <div className="frame">
          <Tag dark>{t.next.tag}</Tag>
          <h2 id="qt-next" className={`${k.h2} ${k.h2Dark}`} data-reveal>
            {t.next.title}
          </h2>
          <div className={k.values}>
            {t.next.steps.map((st, i) => (
              <div key={i} className={k.value} data-reveal style={d(i * 80)}>
                <span className={k.num}>{String(i + 1).padStart(2, "0")}</span>
                <h3 className={k.valueTitle}>{st.title}</h3>
                <p className={k.valueText}>{st.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={k.light} data-tone="light" aria-labelledby="qt-needs">
        <div className={`frame ${k.split}`}>
          <div>
            <Tag>{t.needs.tag}</Tag>
            <h2 id="qt-needs" className={k.h2} data-reveal>
              {t.needs.title}
            </h2>
            <div className={k.actions} data-reveal>
              <RedButton href="#anfrage">{t.hero.primary}</RedButton>
            </div>
          </div>
          <ul className={k.rows} data-reveal>
            {t.needs.items.map((x, i) => (
              <li key={x} style={{ alignItems: "center" }}>
                <span className={k.num}>{String(i + 1).padStart(2, "0")}</span>
                <strong>{x}</strong>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </article>
  );
}
