import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/seo/JsonLd";
import { pageMeta } from "@/lib/seo";
import { PageHero } from "@/components/layout/PageHero";
import { ButtonLink } from "@/components/ui/Button";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { MediaSlot } from "@/components/ui/MediaSlot";
import { StatRow } from "@/components/ui/StatRow";
import { company, companyPage, timeline } from "@/content/company";
import { InView } from "@/motion/InView";

export const metadata: Metadata = pageMeta({
  title: "Unternehmen",
  description: "JARBOU Logistik GmbH – gegründet 2019, heute über 160 Mitarbeitende, mehr als 180 Transporter und 25 LKW in mehreren Regionen Deutschlands.",
  path: "/unternehmen",
});

export default function CompanyPage() {
  const entries = timeline.filter((t) => t.published);
  return (
    <>
      <PageHero eyebrow="Unternehmen" lines={companyPage.headline} lead={companyPage.lead} />

      {/* Figures */}
      <section aria-label="JARBOU in Zahlen" className="bg-ink pb-24 lg:pb-32">
        <div className="shell">
          <StatRow />
        </div>
      </section>

      {/* Timeline 2019 → heute */}
      <section aria-labelledby="timeline-title" className="defer-render bg-paper py-24 text-ink lg:py-32">
        <div className="shell">
          <SectionLabel index="01" tone="dark">
            {`Seit ${company.founded}`}
          </SectionLabel>
          <h2 id="timeline-title" className="h-section mt-6 max-w-3xl">
            Von der Gründung bis heute.
          </h2>
          <InView as="ol" className="relative mt-16 grid gap-12 md:grid-cols-2 lg:mt-20" threshold={0.3}>
            <span aria-hidden="true" className="reveal-line absolute left-0 right-0 top-[9px] hidden h-0.5 bg-ink md:block" />
            <span aria-hidden="true" className="reveal-y absolute bottom-0 left-[8px] top-0 w-0.5 bg-ink md:hidden" />
            {entries.map((e, i) => (
              <li key={e.id} className="reveal relative pl-10 md:pl-0" style={{ "--d": `${300 + i * 300}ms` } as React.CSSProperties}>
                <span
                  aria-hidden="true"
                  className={`absolute left-0 top-0 block size-[18px] border-2 border-ink [transform:skewX(-28deg)] ${i === entries.length - 1 ? "bg-red" : "bg-paper"}`}
                />
                <p className="display mt-0 text-[clamp(3rem,7vw,6rem)] md:mt-10">{e.year ?? "Heute"}</p>
                <h3 className="mt-3 text-xl font-bold uppercase tracking-[-0.01em]">{e.title}</h3>
                <p className="mt-3 max-w-md leading-relaxed text-graphite-600">{e.text}</p>
              </li>
            ))}
          </InView>
        </div>
      </section>

      {/* Chapters */}
      <section aria-label="Wofür JARBOU steht" className="defer-render bg-ink py-24 lg:py-32">
        <div className="shell">
          {companyPage.chapters.map((c, i) => (
            <InView key={c.id} className="grid gap-6 border-t border-white/10 py-14 first:border-t-0 first:pt-0 lg:grid-cols-12 lg:gap-12 lg:py-20">
              <p className="reveal eyebrow text-steel-400 lg:col-span-3">
                <span className="text-red-glow">0{i + 1}</span> <span className="ml-2">{c.eyebrow}</span>
              </p>
              <h2 className="reveal h-section lg:col-span-5" style={{ "--d": "100ms" } as React.CSSProperties}>
                {c.title}
              </h2>
              <p className="reveal max-w-md text-lg leading-relaxed text-steel-300 lg:col-span-4" style={{ "--d": "200ms" } as React.CSSProperties}>
                {c.text}
              </p>
              <MediaSlot id={c.media} className="aspect-[3/2] lg:col-span-9 lg:col-start-4" sizes="(min-width: 1024px) 70vw, 100vw" />
            </InView>
          ))}
        </div>
      </section>

      {/* Principles */}
      <section aria-labelledby="principles-title" className="defer-render bg-paper py-24 text-ink lg:py-32">
        <div className="shell">
          <SectionLabel index="02" tone="dark">
            Grundsätze
          </SectionLabel>
          <h2 id="principles-title" className="h-section mt-6">
            So arbeiten wir.
          </h2>
          <dl className="mt-14 grid border-t border-ink sm:grid-cols-2 lg:grid-cols-4">
            {companyPage.principles.map((p) => (
              <div key={p.id} className="border-b border-ink/15 py-8 sm:pr-8 lg:border-b-0 lg:border-r lg:px-8 lg:first:pl-0 lg:last:border-r-0">
                <dt className="text-2xl font-extrabold uppercase tracking-[-0.02em]">{p.title}</dt>
                <dd className="mt-3 leading-relaxed text-graphite-600">{p.text}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Next */}
      <section className="bg-graphite-900 py-20">
        <div className="shell flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <p className="h-section max-w-2xl">Werden Sie Teil von JARBOU – oder starten Sie ein Projekt mit uns.</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/karriere">Karriere bei JARBOU</ButtonLink>
            <ButtonLink href="/business" variant="outline">
              Logistik anfragen
            </ButtonLink>
          </div>
        </div>
      </section>
      <Breadcrumbs trail={[{ name: "Unternehmen", path: "/unternehmen" }]} />
    </>
  );
}
