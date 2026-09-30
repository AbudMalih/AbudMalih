import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/seo/JsonLd";
import { pageMeta } from "@/lib/seo";
import Link from "next/link";
import { ContactForm } from "@/components/forms/ContactForm";
import { PageHero } from "@/components/layout/PageHero";
import { Arrow } from "@/components/ui/Button";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { company } from "@/content/company";

export const metadata: Metadata = pageMeta({
  title: "Kontakt",
  description: "Kontakt zu JARBOU Logistik: Geschäftsanfragen, Karriere und allgemeiner Kontakt – jeweils auf dem direkten Weg.",
  path: "/kontakt",
});

export default function ContactPage() {
  const paths = [
    {
      id: "geschaeft",
      index: "01",
      title: "Geschäftsanfragen",
      text: "Projekte in Transport, Express und Last Mile – mit Standort, Volumen und gewünschtem Start.",
      href: "/business#anfrage",
      cta: "Zur Projektanfrage",
      email: company.email.business,
    },
    {
      id: "karriere",
      index: "02",
      title: "Karriere",
      text: "Bewerbungen und Fragen zu offenen Stellen. Bitte keine Bewerbungen über das allgemeine Kontaktformular.",
      href: "/karriere",
      cta: "Zu den Stellen",
      email: company.email.careers,
    },
    {
      id: "allgemein",
      index: "03",
      title: "Allgemeiner Kontakt",
      text: "Alle anderen Anliegen – über das Formular unten.",
      href: "#allgemein",
      cta: "Zum Formular",
      email: company.email.general,
    },
  ];

  return (
    <>
      <PageHero eyebrow="Kontakt" lines={["Der direkte Weg", "zu JARBOU."]} lead="Wählen Sie Ihr Anliegen – so landet Ihre Nachricht direkt bei den richtigen Ansprechpartnern." />

      <section aria-label="Kontaktwege" className="bg-ink pb-24 lg:pb-32">
        <div className="shell grid border-t border-white/15 lg:grid-cols-3">
          {paths.map((p) => (
            <div key={p.id} className="flex flex-col border-b border-white/10 py-10 lg:border-b-0 lg:border-r lg:px-10 lg:first:pl-0 lg:last:border-r-0">
              <p className="font-mono text-xs text-red-glow">{p.index}</p>
              <h2 className="mt-3 text-3xl font-extrabold uppercase tracking-[-0.02em] text-white">{p.title}</h2>
              <p className="mt-4 max-w-sm flex-1 leading-relaxed text-steel-300">{p.text}</p>
              {p.email && (
                <a href={`mailto:${p.email}`} className="mt-6 break-all text-white underline underline-offset-4 hover:text-red">
                  {p.email}
                </a>
              )}
              <Link href={p.href} className="group mt-6 inline-flex min-h-11 items-center gap-3 text-sm font-semibold uppercase tracking-[0.12em] text-white">
                {p.cta}
                <Arrow className="size-4 text-red transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section id="allgemein" aria-labelledby="general-title" className="scroll-mt-20 bg-paper py-20 text-ink lg:py-28">
        <div className="shell grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <SectionLabel index="03" tone="dark">
              Allgemeiner Kontakt
            </SectionLabel>
            <h2 id="general-title" className="h-section mt-6">
              Schreiben Sie uns.
            </h2>
            <p className="mt-6 max-w-sm text-graphite-600">
              Für Bewerbungen nutzen Sie bitte die{" "}
              <Link href="/karriere/bewerben" className="font-semibold text-ink underline underline-offset-4">
                Online-Bewerbung
              </Link>
              , für Projekte die{" "}
              <Link href="/business#anfrage" className="font-semibold text-ink underline underline-offset-4">
                Projektanfrage
              </Link>
              .
            </p>
          </div>
          <div className="lg:col-span-7 lg:col-start-6">
            <ContactForm generalEmail={company.email.general} />
          </div>
        </div>
      </section>
      <Breadcrumbs trail={[{ name: "Kontakt", path: "/kontakt" }]} />
    </>
  );
}
