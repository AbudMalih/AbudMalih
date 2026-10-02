import type { Metadata } from "next";
import PageShell, { InPreparation } from "@/components/ui/PageShell";
import { COMPANY } from "@/content/site";

export const metadata: Metadata = { title: "Contact" };

export default function Page() {
  return (
    <PageShell index="04" eyebrow="Contact" title={<>Let&rsquo;s do <span className="tone-graphite">business</span><span className="tone-red">+</span></>}>
      <p>
        {COMPANY.legalName}
        <br />
        {COMPANY.city}, {COMPANY.country}
      </p>
      {COMPANY.email ? (
        <p>
          <a className="link-line" href={`mailto:${COMPANY.email}`}>
            {COMPANY.email}
          </a>
        </p>
      ) : (
        <InPreparation items={["Contact details and enquiry form follow in Phase 2"]} />
      )}
    </PageShell>
  );
}
