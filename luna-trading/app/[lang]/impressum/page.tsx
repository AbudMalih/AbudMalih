import type { Metadata } from "next";
import PageShell from "@/components/ui/PageShell";
import { COMPANY } from "@/content/site";
import { getDictionary, type Locale } from "@/content/i18n";

export const metadata: Metadata = { title: "Impressum", robots: { index: false } };

const TBD = "wird ergänzt";

/** Legal notice (§ 5 DDG): German in every locale. Values come only from content/site.ts. */
export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const locale = (await params).lang as Locale;
  const d = getDictionary(locale);
  return (
    <PageShell locale={locale} index="§" eyebrow={d.pages.legalEyebrow} title="Impressum" lead={d.pages.legalNote || undefined}>
      <div lang="de" dir="ltr" style={{ textAlign: "start" }}>
        <h2>Angaben gemäß § 5 DDG</h2>
        <p>
          {COMPANY.legalName}
          <br />
          {COMPANY.street ?? `Anschrift: ${TBD}`}
          <br />
          {COMPANY.postalCode ?? ""} {COMPANY.city}, Deutschland
        </p>
        <h2>Vertreten durch</h2>
        <p>{COMPANY.managingDirectors ?? TBD}</p>
        <h2>Kontakt</h2>
        <p>
          Telefon: {COMPANY.phone ?? TBD}
          <br />
          E-Mail: {COMPANY.email ?? TBD}
        </p>
        <h2>Registereintrag</h2>
        <p>{COMPANY.register ?? TBD}</p>
        <h2>Umsatzsteuer-ID</h2>
        <p>{COMPANY.vatId ?? TBD}</p>
      </div>
    </PageShell>
  );
}
