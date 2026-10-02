import type { Metadata } from "next";
import PageShell, { InPreparation } from "@/components/ui/PageShell";
import { COMPANY } from "@/content/site";

export const metadata: Metadata = { title: "Company" };

export default function Page() {
  return (
    <PageShell
      index="03"
      eyebrow="Company"
      title={<>One company. <span className="tone-graphite">Multiple markets.</span></>}
      lead={`${COMPANY.legalName} is based in ${COMPANY.cityEn}, ${COMPANY.country}.`}
    >
      <InPreparation items={["Company profile", "Leadership", "Locations"]} />
    </PageShell>
  );
}
