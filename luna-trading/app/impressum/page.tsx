import type { Metadata } from "next";
import PageShell from "@/components/ui/PageShell";
import { COMPANY } from "@/content/site";

export const metadata: Metadata = { title: "Impressum", robots: { index: false } };

const TBD = "— wird ergänzt —";

/** Legal notice structure (§ 5 DDG). Values come only from content/site.ts. */
export default function Page() {
  return (
    <PageShell index="§" eyebrow="Legal" title="Impressum">
      <div lang="de">
        <h2>Angaben gemäß § 5 DDG</h2>
        <p>
          {COMPANY.legalName}
          <br />
          {COMPANY.street ?? TBD}
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
