"use client";

import { useEffect, useRef } from "react";
import { useI18n } from "@/content/i18n/I18nProvider";
import { CONTACT_EMAIL, COMPANY } from "@/content/site";
import { usePageMotion } from "@/components/services/usePageMotion";
import ContactForm from "./ContactForm";
import svc from "@/components/services/Services.module.css";
import s from "./Contact.module.css";

/* one graphite room from the hero to the footer */
const GRAPHITE = "#151619";

/**
 * KONTAKT / CONTACT: the end point of the visitor journey, a conversion page.
 * A premium company inviting a conversation, in one graphite room: the hero,
 * the direct e-mail, the inquiry drawn straight into the dark, one quiet
 * signature, and the footer in the same graphite. Only typography, hairlines
 * and the small red + carry the identity.
 */
export default function ContactPage() {
  const { dict, locale, href } = useI18n();
  const t = dict.contactPage;
  const root = useRef<HTMLElement>(null);
  usePageMotion(root);
  // the footer continues the room on this page only (it stays paper elsewhere)
  useEffect(() => {
    const html = document.documentElement;
    html.dataset.footer = "dark";
    return () => {
      delete html.dataset.footer;
    };
  }, []);
  const ground = { ["--bg" as string]: GRAPHITE, ["--from" as string]: GRAPHITE };

  return (
    <article ref={root} className={`${svc.page} ${s.page}`}>
      {/* ------------------------------------------------------------ HERO */}
      <section className={`${svc.section} ${s.room} ${s.hero}`} style={ground} data-tone="dark" aria-labelledby="ct-title">
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
      </section>

      {/* --------------------------------------------------------- CONTACT */}
      <section className={`${svc.section} ${s.room} ${s.contact}`} style={ground} data-tone="dark" aria-labelledby="ct-direct">
        <div className="frame">
          {/* the one transition signal: a red + and a line drawing out of it */}
          <div className={s.signal} data-reveal aria-hidden="true">
            <span className={s.signalPlus} />
            <span className={s.signalLine} />
          </div>

          <div className={s.direct} data-reveal>
            <h2 id="ct-direct" className={s.directHead}>
              <span className={`t-label ${s.directTag}`}>{t.direct.tag}</span>
              <span className={s.directTitle}>{t.direct.title}</span>
            </h2>
            <a href={`mailto:${CONTACT_EMAIL}`} className={s.mail} dir="ltr" data-cursor="link">
              <span className={s.mailText}>{CONTACT_EMAIL}</span>
              <span className={s.mailArrow} aria-hidden="true">
                →
              </span>
            </a>
          </div>

          <div className={s.formArea}>
            <ContactForm copy={t} locale={locale} privacyHref={href("/datenschutz")} />
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------- CLOSING */}
      <section className={`${svc.section} ${s.room} ${s.closing}`} style={ground} data-tone="dark" aria-label={COMPANY.legalName}>
        <div className={`frame ${s.closeRow}`} data-reveal>
          <span className={s.closeLine} aria-hidden="true" />
          <span className={s.closePlus} aria-hidden="true" />
          <p className={s.closeName}>{COMPANY.legalName}</p>
          <p className={s.closeMeta}>{t.closing.line}</p>
          <a href={`mailto:${CONTACT_EMAIL}`} className={s.closeMail} dir="ltr">
            {CONTACT_EMAIL}
          </a>
        </div>
      </section>
    </article>
  );
}
