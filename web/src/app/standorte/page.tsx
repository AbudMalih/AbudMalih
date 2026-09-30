import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/seo/JsonLd";
import { pageMeta } from "@/lib/seo";
import { OperationsMap } from "@/components/data/OperationsMap";
import { PageHero } from "@/components/layout/PageHero";
import { ButtonLink } from "@/components/ui/Button";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { getPublishedJobs } from "@/content/jobs";
import { labelFor, publishedLocations } from "@/content/locations";
import { InView } from "@/motion/InView";

export const metadata: Metadata = pageMeta({
  title: "Standorte",
  description: "JARBOU ist in mehreren Regionen Deutschlands im Einsatz – u. a. in Bremen, Hannover, Köln, Magdeburg, Kassel, Haiger, Erfurt, Suhl und Zwickau.",
  path: "/standorte",
});

export default function LocationsPage() {
  const jobsByLocation: Record<string, { slug: string; title: string }[]> = {};
  for (const j of getPublishedJobs()) (jobsByLocation[j.locationId] ??= []).push({ slug: j.slug, title: j.title });

  // Group by Bundesland for the index below the map.
  const byState = publishedLocations.reduce<Record<string, typeof publishedLocations>>((acc, l) => {
    (acc[l.state] ??= []).push(l);
    return acc;
  }, {});

  return (
    <>
      <PageHero
        eyebrow="Standorte"
        lines={["Deutschlandweit im Einsatz.", "Regional stark."]}
        lead="Unsere Teams arbeiten in mehreren Regionen Deutschlands. Wählen Sie einen Standort, um Details und offene Stellen zu sehen."
      />

      <section aria-label="Interaktive Standortkarte" className="bg-ink pb-24 lg:pb-32">
        <div className="shell">
          <InView threshold={0.15}>
            <OperationsMap locations={publishedLocations} explorer jobsByLocation={jobsByLocation} />
          </InView>
        </div>
      </section>

      <section aria-labelledby="regions-title" className="defer-render bg-paper py-24 text-ink lg:py-32">
        <div className="shell">
          <SectionLabel index="01" tone="dark">
            Regionen
          </SectionLabel>
          <h2 id="regions-title" className="h-section mt-6">
            Nach Bundesland.
          </h2>
          <dl className="mt-14 grid border-t border-ink sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(byState)
              .sort(([a], [b]) => a.localeCompare(b, "de"))
              .map(([state, list]) => (
                <div key={state} className="border-b border-ink/15 py-6 sm:pr-8">
                  <dt className="eyebrow text-steel-600">{state}</dt>
                  {list.map((l) => (
                    <dd key={l.id} className="mt-2 flex flex-wrap items-baseline gap-x-3">
                      <span className="text-2xl font-extrabold uppercase tracking-[-0.02em]">{l.name}</span>
                      {labelFor(l) && <span className="font-mono text-[0.68rem] uppercase tracking-[0.12em] text-red-ink">{labelFor(l)}</span>}
                    </dd>
                  ))}
                </div>
              ))}
          </dl>
        </div>
      </section>

      <section className="bg-graphite-900 py-20">
        <div className="shell flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <p className="h-section max-w-2xl">Arbeiten in Ihrer Region?</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/karriere#jobs">Offene Stellen</ButtonLink>
            <ButtonLink href="/karriere/initiativbewerbung" variant="outline">
              Initiativ bewerben
            </ButtonLink>
          </div>
        </div>
      </section>
      <Breadcrumbs trail={[{ name: "Standorte", path: "/standorte" }]} />
    </>
  );
}
