import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import Link from "next/link";
import { PageHero } from "@/components/layout/PageHero";
import { ButtonLink } from "@/components/ui/Button";
import { SectionLabel } from "@/components/ui/SectionLabel";
import {
  applicationSteps,
  careerHero,
  careerNav,
  dayAtJarbou,
  developmentDisclaimer,
  developmentPath,
  whyJarbou,
} from "@/content/careers";
import { faqs } from "@/content/faqs";
import { formatStartDate, getPublishedJobs, jobFacets } from "@/content/jobs";
import { publishedLocations } from "@/content/locations";
import { visibleStories } from "@/content/stories";
import { faqJsonLd, jsonLdScript } from "@/lib/structured-data";
import { ApplicationProcess, DevelopmentPath, EmployeeStories, FaqList } from "@/sections/careers/CareerSections";
import { CareerSubnav } from "@/sections/careers/CareerSubnav";
import { DayAtJarbou } from "@/sections/careers/DayAtJarbou";
import { JobBoard } from "@/sections/careers/JobBoard";
import { StickyApply } from "@/sections/careers/StickyApply";

export const metadata: Metadata = pageMeta({
  title: "Karriere",
  description: "Jobs bei JARBOU Logistik: Fahrer, Disposition und mehr. Strukturierte Einarbeitung, moderner Fuhrpark, starke Teams. Bewerbung in rund zwei Minuten – ohne Konto.",
  path: "/karriere",
});

const APPLY = "/karriere/bewerben";

export default function CareersPage() {
  const jobs = getPublishedJobs();
  const facets = jobFacets(jobs);
  const rows = jobs.map((j) => ({
    slug: j.slug,
    title: j.title,
    location: j.location,
    category: j.category,
    employmentType: j.employmentType,
    start: formatStartDate(j.startDate),
    summary: j.summary,
  }));
  const jobCount = (id: string) => jobs.filter((j) => j.locationId === id).length;

  return (
    <>
      <PageHero eyebrow={careerHero.eyebrow} lines={careerHero.lines} lead={careerHero.lead} size="big" accent="bewegt">
        <div className="flex flex-col gap-3 sm:flex-row">
          <ButtonLink href="#jobs">Offene Stellen</ButtonLink>
          <ButtonLink href={APPLY} variant="outline">
            Jetzt bewerben
          </ButtonLink>
        </div>
      </PageHero>

      <CareerSubnav items={careerNav} applyHref={APPLY} />

      {/* Jobs */}
      <section id="jobs" aria-labelledby="jobs-title" className="scroll-mt-16 bg-paper py-20 text-ink lg:py-28">
        <div className="shell">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <SectionLabel index="01" tone="dark">
                Jobs
              </SectionLabel>
              <h2 id="jobs-title" className="h-section mt-6">
                Aktuelle Stellen.
              </h2>
            </div>
            <p className="max-w-sm text-graphite-600">
              Nichts Passendes dabei?{" "}
              <Link href="/karriere/initiativbewerbung" className="font-semibold text-ink underline underline-offset-4">
                Initiativ bewerben
              </Link>
            </p>
          </div>
          <div className="mt-12">
            <JobBoard jobs={rows} facets={facets} />
          </div>
        </div>
      </section>

      {/* Bei JARBOU */}
      <section id="bei-jarbou" aria-labelledby="why-title" className="scroll-mt-16 bg-ink py-20 lg:py-28">
        <div className="shell">
          <SectionLabel index="02">Bei JARBOU</SectionLabel>
          <h2 id="why-title" className="h-section mt-6">
            Warum JARBOU?
          </h2>
          <dl className="mt-14 grid gap-x-10 border-t border-white/15 sm:grid-cols-2 lg:grid-cols-3">
            {whyJarbou.map((w, i) => (
              <div key={w.id} className="border-b border-white/10 py-8">
                <dt className="flex items-baseline gap-4 text-xl font-bold text-white">
                  <span className="font-mono text-xs font-normal text-red-glow">0{i + 1}</span>
                  {w.title}
                </dt>
                <dd className="mt-3 pl-8 leading-relaxed text-steel-300">{w.text}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Ein Tag bei JARBOU */}
      <section aria-labelledby="day-title" className="border-t border-white/10 bg-ink py-20 lg:py-28">
        <div className="shell">
          <SectionLabel>Arbeitsalltag</SectionLabel>
          <h2 id="day-title" className="h-section mt-6">
            Ein Tag bei JARBOU.
          </h2>
          <p className="mt-6 max-w-xl text-steel-300">So läuft ein typischer Einsatztag in der Zustellung – von der ersten Prüfung bis zum Feierabend.</p>
          <div className="mt-12 lg:mt-4">
            <DayAtJarbou steps={dayAtJarbou} />
          </div>
        </div>
      </section>

      {/* Bewerbungsprozess */}
      <section id="bewerbungsprozess" aria-labelledby="process-title" className="scroll-mt-16 bg-paper py-20 text-ink lg:py-28">
        <div className="shell">
          <SectionLabel index="03" tone="dark">
            Bewerbungsprozess
          </SectionLabel>
          <h2 id="process-title" className="h-section mt-6">
            Von der Bewerbung bis zum ersten Tag.
          </h2>
          <div className="mt-14 lg:mt-20">
            <ApplicationProcess steps={applicationSteps} />
          </div>
          <div className="mt-14 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href={APPLY}>Jetzt bewerben</ButtonLink>
          </div>
        </div>
      </section>

      {/* Entwicklung */}
      <section id="entwicklung" aria-labelledby="dev-title" className="scroll-mt-16 bg-ink py-20 lg:py-28">
        <div className="shell">
          <SectionLabel index="04">Entwicklung</SectionLabel>
          <h2 id="dev-title" className="h-section mt-6 max-w-3xl">
            Wer Verantwortung will, kann wachsen.
          </h2>
          <div className="mt-14">
            <DevelopmentPath path={developmentPath} disclaimer={developmentDisclaimer} />
          </div>
        </div>
      </section>

      <EmployeeStories stories={visibleStories} />

      {/* Standorte */}
      <section id="standorte" aria-labelledby="loc-title" className="scroll-mt-16 border-t border-white/10 bg-graphite-900 py-20 lg:py-28">
        <div className="shell grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <SectionLabel index="05">Standorte</SectionLabel>
            <h2 id="loc-title" className="h-section mt-6">
              Arbeiten in Ihrer Region.
            </h2>
            <p className="mt-6 max-w-md text-steel-300">JARBOU ist in mehreren Regionen Deutschlands im Einsatz. Offene Stellen sind direkt am Standort verlinkt.</p>
            <div className="mt-8">
              <ButtonLink href="/standorte" variant="outline">
                Zur Standortkarte
              </ButtonLink>
            </div>
          </div>
          <ul className="grid grid-cols-2 border-t border-white/15 sm:grid-cols-3 lg:col-span-7">
            {publishedLocations.map((l) => {
              const n = jobCount(l.id);
              return (
                <li key={l.id} className="border-b border-white/10 py-5 pr-4">
                  <p className="text-xl font-extrabold uppercase tracking-[-0.02em] text-white">{l.name}</p>
                  <p className="mt-1 font-mono text-[0.68rem] uppercase tracking-[0.12em] text-steel-400">
                    {n ? (
                      <Link href="#jobs" className="text-red-glow hover:underline">
                        {n} {n === 1 ? "offene Stelle" : "offene Stellen"}
                      </Link>
                    ) : (
                      l.state
                    )}
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" aria-labelledby="faq-title" className="scroll-mt-16 bg-paper py-20 text-ink lg:py-28">
        <div className="shell grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <SectionLabel index="06" tone="dark">
              FAQ
            </SectionLabel>
            <h2 id="faq-title" className="h-section mt-6">
              Häufige Fragen.
            </h2>
          </div>
          <div className="lg:col-span-8">
            <FaqList faqs={faqs} />
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-ink py-24 lg:py-32">
        <div className="shell">
          <p className="display text-[clamp(2.6rem,7vw,7rem)] text-white">
            <span className="block">Bereit für</span>
            <span className="block">
              den nächsten <span className="text-red">Schritt?</span>
            </span>
          </p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href={APPLY}>Jetzt bewerben</ButtonLink>
            <ButtonLink href="/karriere/initiativbewerbung" variant="outline">
              Initiativbewerbung
            </ButtonLink>
          </div>
        </div>
      </section>

      <StickyApply href={APPLY} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(faqJsonLd(faqs)) }} />
    </>
  );
}
