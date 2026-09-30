import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { BusinessInquiryForm } from "@/components/forms/BusinessInquiryForm";
import { PageHero } from "@/components/layout/PageHero";
import { ButtonLink } from "@/components/ui/Button";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { businessPage, serviceTypeOptions, vehicleNeedOptions } from "@/content/business";
import { company } from "@/content/company";
import { services } from "@/content/services";
import { InView } from "@/motion/InView";

export const metadata: Metadata = pageMeta({
  title: "Für Unternehmen",
  description: "Operative Logistik, zuverlässig skaliert: Teams, Fahrzeuge und operative Führung für Transport-, Express- und Last-Mile-Projekte. Jetzt Projekt anfragen.",
  path: "/business",
});

export default function BusinessPage() {
  return (
    <>
      <PageHero eyebrow={businessPage.eyebrow} lines={businessPage.lines} lead={businessPage.lead}>
        <ButtonLink href="#anfrage">Projekt anfragen</ButtonLink>
      </PageHero>

      {/* Capacity – verified figures only */}
      <section aria-labelledby="cap-title" className="bg-ink pb-24 lg:pb-32">
        <div className="shell">
          <h2 id="cap-title" className="sr-only">
            Kapazität
          </h2>
          <dl className="grid border-t border-white/15 md:grid-cols-3">
            {businessPage.capabilities.map((c) => (
              <div key={c.id} className="border-b border-white/10 py-8 md:border-b-0 md:border-r md:px-8 md:first:pl-0 md:last:border-r-0">
                <dt className="flex items-baseline gap-3">
                  <span className="text-[clamp(3rem,6vw,5.5rem)] font-bold leading-none tracking-[-0.045em] text-white">{c.figure}</span>
                  <span className="eyebrow text-steel-300">{c.label}</span>
                </dt>
                <dd className="mt-4 max-w-xs text-steel-400">{c.text}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Audiences */}
      <section aria-labelledby="aud-title" className="defer-render bg-paper py-24 text-ink lg:py-32">
        <div className="shell grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <SectionLabel index="01" tone="dark">
              Zielgruppen
            </SectionLabel>
            <h2 id="aud-title" className="h-section mt-6">
              Für wen wir arbeiten.
            </h2>
          </div>
          <ul className="border-t border-ink lg:col-span-8">
            {businessPage.audiences.map((a, i) => (
              <li key={a.id} className="grid gap-2 border-b border-ink/15 py-6 sm:grid-cols-[3rem_1fr_1.2fr] sm:gap-6">
                <span aria-hidden="true" className="font-mono text-xs text-red-ink">
                  0{i + 1}
                </span>
                <p className="text-xl font-bold">{a.title}</p>
                <p className="text-graphite-600">{a.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Scope */}
      <section aria-labelledby="scope-title" className="defer-render bg-ink py-24 lg:py-32">
        <div className="shell grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <SectionLabel index="02">Leistungsumfang</SectionLabel>
            <h2 id="scope-title" className="h-section mt-6">
              Der gesamte operative Ablauf.
            </h2>
            <div className="mt-8">
              <ButtonLink href="/leistungen" variant="outline">
                Leistungen im Detail
              </ButtonLink>
            </div>
          </div>
          <ul className="grid border-t border-white/15 sm:grid-cols-2 lg:col-span-8">
            {services.map((s) => (
              <li key={s.id} className="border-b border-white/10 py-6 sm:pr-8">
                <p className="font-mono text-xs text-red-glow">{s.index}</p>
                <p className="mt-2 text-lg font-semibold text-white">{s.title}</p>
                <p className="mt-2 text-sm leading-relaxed text-steel-400">{s.lead}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Project start */}
      <section aria-labelledby="start-title" className="defer-render bg-paper py-24 text-ink lg:py-32">
        <div className="shell">
          <SectionLabel index="03" tone="dark">
            Projektstart
          </SectionLabel>
          <h2 id="start-title" className="h-section mt-6">
            Von der Anfrage zum laufenden Betrieb.
          </h2>
          <InView as="ol" className="relative mt-16 grid md:grid-cols-5" threshold={0.3}>
            <span aria-hidden="true" className="reveal-line absolute left-0 right-0 top-[7px] hidden h-0.5 bg-ink md:block" />
            <span aria-hidden="true" className="reveal-y absolute bottom-0 left-[7px] top-0 w-0.5 bg-ink md:hidden" />
            {businessPage.projectSteps.map((s, i) => (
              <li key={s.id} className="reveal relative pb-10 pl-10 md:pb-0 md:pl-0 md:pr-6" style={{ "--d": `${200 + i * 180}ms` } as React.CSSProperties}>
                <span
                  aria-hidden="true"
                  className={`absolute left-0 top-0 block size-4 border-2 border-ink [transform:skewX(-28deg)] ${i === 4 ? "bg-red" : "bg-paper"}`}
                />
                <p className="font-mono text-xs text-steel-600 md:mt-10">{s.index}</p>
                <h3 className="mt-2 text-lg font-extrabold uppercase">{s.title}</h3>
                <p className="mt-2 max-w-xs text-sm leading-relaxed text-graphite-600">{s.text}</p>
              </li>
            ))}
          </InView>
        </div>
      </section>

      {/* Inquiry */}
      <section id="anfrage" aria-labelledby="inq-title" className="scroll-mt-20 border-t border-ink/10 bg-paper pb-24 text-ink lg:pb-32">
        <div className="shell grid gap-12 pt-20 lg:grid-cols-12 lg:pt-28">
          <div className="lg:col-span-4">
            <SectionLabel index="04" tone="dark">
              Projektanfrage
            </SectionLabel>
            <h2 id="inq-title" className="h-section mt-6">
              Erzählen Sie uns von Ihrem Projekt.
            </h2>
            <p className="mt-6 max-w-sm text-graphite-600">Je konkreter Standort, Volumen und Zeitplan, desto gezielter können wir das Gespräch vorbereiten.</p>
            {company.email.business && (
              <p className="mt-6 text-sm">
                E-Mail:{" "}
                <a href={`mailto:${company.email.business}`} className="font-semibold underline underline-offset-4">
                  {company.email.business}
                </a>
              </p>
            )}
          </div>
          <div className="lg:col-span-7 lg:col-start-6">
            <BusinessInquiryForm serviceTypes={serviceTypeOptions} vehicleNeeds={vehicleNeedOptions} businessEmail={company.email.business} />
          </div>
        </div>
      </section>
    </>
  );
}
