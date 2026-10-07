"use client";

import { useRef } from "react";
import { useI18n } from "@/content/i18n/I18nProvider";
import { CONTACT_EMAIL, COMPANY } from "@/content/site";
import { usePageMotion } from "@/components/services/usePageMotion";
import ContactForm from "./ContactForm";
import svc from "@/components/services/Services.module.css";
import s from "./Contact.module.css";

/**
 * KONTAKT / CONTACT: the end point of the visitor journey, a conversion page.
 * Bright, quiet, architectural. One connection drawn as the page opens: two
 * graphite lines (your business, Luna Trading) meet at the red +, and a single
 * line continues down into the contact area. Direct e-mail and the structured
 * inquiry stand side by side; a quiet signature closes the page. Typography is
 * planted: only lines and the + move.
 */
export default function ContactPage() {
  const { dict, locale, href } = useI18n();
  const t = dict.contactPage;
  const root = useRef<HTMLElement>(null);
  usePageMotion(root);

  return (
    <article ref={root} className={`${svc.page} ${s.page}`}>
      {/* ------------------------------------------------------------ HERO */}
      <section className={`${svc.section} ${s.hero}`} style={{ ["--bg" as string]: "#e9e7e2", ["--from" as string]: "#e9e7e2" }} data-tone="light" aria-labelledby="ct-title">
        <div className={`frame ${s.heroCopy}`}>
          <p className={`t-label ${s.eyebrow}`} data-reveal>
            <span className={s.idx}>04</span>
            <span className={s.redRule} />
            {t.hero.eyebrow}
          </p>
          <h1 id="ct-title" className={s.heroTitle}>
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
          <p className={`t-lead ${s.heroLead}`} data-reveal style={{ ["--d" as string]: "200ms" }}>
            {t.hero.lead}
          </p>
        </div>

        {/* the connection: two sides meet at the +, one line continues */}
        <div className={s.connect} data-reveal aria-hidden="true">
          <span className={`${s.side} ${s.sideStart}`} />
          <span className={`${s.side} ${s.sideEnd}`} />
          <span className={s.cross} />
          <span className={s.down} />
          <span className={`t-label ${s.cLabel} ${s.labelStart}`}>{t.hero.you}</span>
          <span className={`t-label ${s.cLabel} ${s.labelEnd}`}>{t.hero.luna}</span>
        </div>
      </section>

      {/* --------------------------------------------------------- CONTACT */}
      <section className={`${svc.section} ${s.contact}`} style={{ ["--bg" as string]: "#e9e7e2", ["--from" as string]: "#e9e7e2" }} data-tone="light" aria-label={t.hero.eyebrow}>
        <span className={s.downEnd} aria-hidden="true" />
        <div className={`frame ${s.grid}`}>
          {/* direct */}
          <div className={s.direct} data-reveal>
            <h2 className={`t-label ${s.tag}`}>
              <span className={s.tagNum}>A</span> {t.direct.tag}
            </h2>
            <p className={s.directTitle}>{t.direct.title}</p>
            <a href={`mailto:${CONTACT_EMAIL}`} className={s.mail} dir="ltr" data-cursor="link">
              <span className={s.mailText}>{CONTACT_EMAIL}</span>
              <span className={s.mailArrow} aria-hidden="true">
                →
              </span>
            </a>
            <p className={s.directNote}>{t.direct.note}</p>

            <dl className={s.sig}>
              <div>
                <dt className="sr-only">{dict.companyPage.facts.rows[0].k}</dt>
                <dd className={s.sigName}>{COMPANY.legalName}</dd>
              </div>
              <div>
                <dt className="sr-only">{dict.companyPage.facts.rows[1].k}</dt>
                <dd>{dict.companyPage.profile.city}</dd>
              </div>
              <div>
                <dt className="sr-only">{dict.companyPage.facts.rows[2].k}</dt>
                <dd>{dict.companyPage.profile.country}</dd>
              </div>
            </dl>
            <p className={s.reply}>{t.direct.reply}</p>
          </div>

          {/* structured inquiry */}
          <div className={s.inquiry}>
            <h2 className={`t-label ${s.tag}`} data-reveal>
              <span className={s.tagNum}>B</span> {t.inquiry.tag}
            </h2>
            <ContactForm copy={t} locale={locale} privacyHref={href("/datenschutz")} />
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------- CLOSING */}
      <section className={`${svc.section} ${s.closing}`} style={{ ["--bg" as string]: "#e9e7e2", ["--from" as string]: "#e9e7e2" }} data-tone="light" aria-label={COMPANY.legalName}>
        <div className={`frame ${s.closeRow}`} data-reveal>
          <span className={s.closeLine} aria-hidden="true" />
          <span className={s.closePlus} aria-hidden="true" />
          <p className={s.closeName}>{COMPANY.legalName}</p>
          <p className={s.closeMeta}>{t.closing.line}</p>
          <a href={`mailto:${CONTACT_EMAIL}`} className={s.closeMail} dir="ltr">
            {CONTACT_EMAIL}
          </a>
          <p className={s.closeCoord} dir="ltr" aria-hidden="true">
            50.94° N · 6.96° E
          </p>
        </div>
      </section>
    </article>
  );
}
