import type { Metadata } from "next";
import Link from "next/link";
import PageShell from "@/components/ui/PageShell";
import { LEGAL_ENTITY as L } from "@/content/legal";
import { getDictionary, isLocale, localePath, type Locale } from "@/content/i18n";
import { pageMetadata } from "@/lib/seo";
import s from "@/components/legal/Legal.module.css";

type P = { params: Promise<{ lang: string }> };

const DESCRIPTION: Record<Locale, string> = {
  de: "Impressum der Luna Trading GmbH, Köln: Anbieterkennzeichnung gemäß § 5 DDG.",
  en: "Legal notice (Impressum) of Luna Trading GmbH, Cologne.",
  ar: "البيانات القانونية لشركة Luna Trading GmbH في كولونيا.",
};

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  return pageMetadata({ locale: lang, path: "/impressum", title: getDictionary(lang).legal.impressum, description: DESCRIPTION[lang], index: false });
}

/**
 * Impressum (§ 5 DDG). German in every locale; the German text is the
 * authoritative one. Verified data only (content/legal.ts). No telephone,
 * no fax, no EU ODR link (platform discontinued). No consumer-dispute
 * statement: § 36 (3) VSBG exempts businesses with no more than ten
 * employees on 31 December of the previous year (0 on 31 Dec 2025, owner
 * confirmation, 7 Nov 2026) and the company has not committed to
 * participate in dispute resolution. Re-check every January.
 */
export default async function Page({ params }: P) {
  const locale = (await params).lang as Locale;
  const d = getDictionary(locale);
  return (
    <PageShell locale={locale} index="§" eyebrow={d.pages.legalEyebrow} title={d.legal.impressum} lead={d.pages.legalNote.impressum || undefined}>
      <div className={s.doc} lang="de" dir="ltr">
        <h2>Angaben gemäß § 5 DDG</h2>
        <address>
          <span className={s.entity}>{L.name}</span>
          <br />
          {L.street}
          <br />
          {L.postalCode} {L.city}
          <br />
          {L.country}
        </address>
        <p>Vertreten durch den Geschäftsführer: {L.managingDirector}</p>

        <h2>Kontakt</h2>
        <p>
          E-Mail: <a href={`mailto:${L.email}`}>{L.email}</a>
          <br />
          Kontaktformular: <Link href={localePath("de", "/contact")}>luna-trading.de{localePath("de", "/contact")}</Link>
        </p>

        <h2>Registereintrag</h2>
        <p>
          Eintragung im Handelsregister
          <br />
          Registergericht: {L.registerCourt}
          <br />
          Registernummer: {L.registerNumber}
        </p>

        <h2>Umsatzsteuer-Identifikationsnummer</h2>
        <p>
          Umsatzsteuer-Identifikationsnummer gemäß § 27a Umsatzsteuergesetz:
          <br />
          {L.vatId}
        </p>
      </div>
    </PageShell>
  );
}
