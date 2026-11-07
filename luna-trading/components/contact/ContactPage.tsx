"use client";

import { useRef } from "react";
import { useI18n } from "@/content/i18n/I18nProvider";
import { CONTACT_EMAIL, COMPANY } from "@/content/site";
import { usePageMotion } from "@/components/services/usePageMotion";
import { FlagDE } from "@/components/import/Flags";
import { Gyro } from "@/components/kit/Ambient";
import {
  PageHero,
  RedButton,
  GhostButton,
  kit as k,
} from "@/components/kit/Kit";
import ContactForm from "./ContactForm";
import { QUOTE_COPY } from "@/content/quotePage";
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
            <GhostButton href={`mailto:${CONTACT_EMAIL}`}>
              {CONTACT_EMAIL}
            </GhostButton>
          </>
        }
        aside={
          <div style={{ display: "grid", justifyItems: "center", gap: 14 }}>
            <Gyro />
            <span className={k.flagChip}>
              <FlagDE className={k.flag} />
              <span>
                <small>{COMPANY.legalName}</small>
                {dict.company.place}
              </span>
            </span>
          </div>
        }
      />

      <section
        id="anfrage"
        className={k.light}
        data-tone="light"
        aria-label={t.inquiry.title}
      >
        <div className="frame">
          <div
            className={k.card}
            style={{ background: "#fbfaf8" }}
            data-reveal
            aria-label={t.inquiry.title}
            role="region"
          >
            <div className={s.formArea}>
              <ContactForm
                copy={t}
                locale={locale}
                privacyHref={href("/datenschutz")}
              />
            </div>
          </div>
          {/* freight enquiries have their own, structured form */}
          <div
            className={k.cardDark}
            style={{
              marginTop: 16,
              background: "#141518",
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 20,
            }}
            data-reveal
          >
            <div>
              <p className={`t-label ${k.tagDark}`} style={{ margin: 0 }}>
                {QUOTE_COPY[locale].hero.eyebrow}
              </p>
              <p className={k.textDark} style={{ maxWidth: "40em" }}>
                {QUOTE_COPY[locale].hero.lead}
              </p>
            </div>
            <RedButton href={href("/quote")}>
              {QUOTE_COPY[locale].nav}
            </RedButton>
          </div>
          <p className={k.note} data-reveal>
            {COMPANY.legalName} · {t.closing.line}
          </p>
        </div>
      </section>
    </article>
  );
}
