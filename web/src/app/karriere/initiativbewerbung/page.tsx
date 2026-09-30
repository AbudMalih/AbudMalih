import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { ApplicationForm } from "@/components/forms/ApplicationForm";
import { PageHero } from "@/components/layout/PageHero";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { applicationOptions } from "@/lib/forms/options";

export const metadata: Metadata = pageMeta({
  title: "Initiativbewerbung",
  description: "Keine passende Stelle gefunden? Bewerben Sie sich initiativ bei JARBOU Logistik – für Ihre Wunschtätigkeit und Ihren Wunschstandort.",
  path: "/karriere/initiativbewerbung",
});

export default function InitiativePage() {
  const opts = applicationOptions();
  return (
    <>
      <PageHero
        eyebrow="Initiativbewerbung"
        lines={["Ihre Stelle ist", "noch nicht dabei?"]}
        lead="Erzählen Sie uns, was Sie suchen und wo Sie arbeiten möchten. Wir melden uns, wenn es passt."
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
    </>
  );
}
