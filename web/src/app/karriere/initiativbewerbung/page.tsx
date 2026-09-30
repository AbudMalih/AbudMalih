import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/seo/JsonLd";
import { pageMeta } from "@/lib/seo";
import { ApplicationForm } from "@/components/forms/ApplicationForm";
import { PageHero } from "@/components/layout/PageHero";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { applicationOptions } from "@/lib/forms/options";

export const metadata: Metadata = pageMeta({
  title: "Initiativbewerbung",
  description: "Keine passende Stelle gefunden? Bewirb dich initiativ bei JARBOU Logistik – für deine Wunschtätigkeit und deinen Wunschstandort.",
  path: "/karriere/initiativbewerbung",
});

export default function InitiativePage() {
  const opts = applicationOptions();
  return (
    <>
      <PageHero
        eyebrow="Initiativbewerbung"
        lines={["Deine Stelle ist", "noch nicht dabei?"]}
        lead="Erzähl uns, was du suchst und wo du arbeiten möchtest. Wir melden uns, wenn es passt."
      />
      <section aria-label="Initiativbewerbung" className="bg-paper py-16 text-ink lg:py-24">
        <div className="shell grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <SectionLabel tone="dark">In fünf Schritten</SectionLabel>
            <p className="mt-6 max-w-sm leading-relaxed text-graphite-600">
              Kontakt, Wunschtätigkeit, Erfahrung, Unterlagen, Absenden. Alle Angaben außer den Pflichtfeldern sind freiwillig.
            </p>
          </div>
          <div className="lg:col-span-7 lg:col-start-6">
            <ApplicationForm mode="initiative" positions={opts.positions} locations={opts.locations} careersEmail={opts.careersEmail} />
          </div>
        </div>
      </section>
      <Breadcrumbs trail={[{ name: "Karriere", path: "/karriere" }, { name: "Initiativbewerbung", path: "/karriere/initiativbewerbung" }]} />
    </>
  );
}
