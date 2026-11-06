"use client";

import { useRef } from "react";
import { useI18n } from "@/content/i18n/I18nProvider";
import { CONTACT_EMAIL, COMPANY } from "@/content/site";
import { usePageMotion } from "@/components/services/usePageMotion";
import { FlagDE } from "@/components/import/Flags";
import { PageHero, RedButton, GhostButton, kit as k } from "@/components/kit/Kit";
import ContactForm from "./ContactForm";
import svc from "@/components/services/Services.module.css";
import s from "./Contact.module.css";

/**
 * KONTAKT / CONTACT on the site kit: port hero with the direct line, then the
 * inquiry form on a light card. The form itself (validation, SMTP delivery,
 * honest success / failure) is unchanged.
 */
export default function ContactPage() {
  const { dict, locale, href } = useI18n();
  const t = dict.contactPage;
  const root = useRef<HTMLElement>(null);
  usePageMotion(root);

  return (
    <article ref={root} className={`${svc.page} ${k.page} ${s.page}`}>
      <PageHero
        id="ct-title"
        short
        eyebrow={t.hero.eyebrow}
        a={t.hero.h1a}
        b={t.hero.h1b}
        lead={t.hero.lead}
        actions={
          <>
            <RedButton href="#anfrage">{t.inquiry.title}</RedButton>
            <GhostButton href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</GhostButton>
          </>
        }
        aside={
          <div className={k.glass}>
            <p className={`t-label ${k.tagDark}`}>{t.direct.tag}</p>
            <p className={k.h3} style={{ marginTop: 10 }}>
              {t.direct.title}
            </p>
            <a href={`mailto:${CONTACT_EMAIL}`} className={k.big} dir="ltr" style={{ display: "inline-block", marginTop: 18, borderBottom: "2px solid var(--luna-red)", paddingBottom: 6, wordBreak: "break-all" }}>
              {CONTACT_EMAIL}
            </a>
            <div className={k.flags}>
              <span className={k.flagChip}>
                <FlagDE className={k.flag} />
                <span>
                  <small>{COMPANY.legalName}</small>
                  {dict.company.place}
                </span>
              </span>
            </div>
          </div>
        }
      />

      <section id="anfrage" className={k.light} data-tone="light" aria-label={t.inquiry.title}>
        <div className="frame">
          <div className={k.card} style={{ background: "#fbfaf8" }} data-reveal aria-label={t.inquiry.title} role="region">
            <div className={s.formArea}>
              <ContactForm copy={t} locale={locale} privacyHref={href("/datenschutz")} />
            </div>
          </div>
          <p className={k.note} data-reveal>
            {COMPANY.legalName} · {t.closing.line}
          </p>
        </div>
      </section>
    </article>
  );
}
