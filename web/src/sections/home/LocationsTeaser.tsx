import { OperationsMap } from "@/components/data/OperationsMap";
import { ButtonLink } from "@/components/ui/Button";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { publishedLocations } from "@/content/locations";
import { InView } from "@/motion/InView";

export function LocationsTeaser() {
  return (
    <section aria-labelledby="locations-title" className="border-t border-white/10 bg-ink py-24 lg:py-36 defer-render">
      <div className="shell">
        <SectionLabel index="04">Standorte</SectionLabel>
        <div className="mt-6 grid gap-8 lg:grid-cols-12">
          <h2 id="locations-title" className="display text-[clamp(2.2rem,6vw,5.75rem)] lg:col-span-8">
            Deutschlandweit im Einsatz. Regional stark.
          </h2>
          <p className="max-w-md self-end text-lg leading-relaxed text-steel-300 lg:col-span-4">
            Unsere Teams arbeiten in mehreren Regionen Deutschlands – von Bremen bis Zwickau.
          </p>
        </div>
        <InView className="mt-16 lg:mt-20" threshold={0.2}>
          <OperationsMap locations={publishedLocations} />
        </InView>
        <div className="mt-14">
          <ButtonLink href="/standorte" variant="outline">
            Zur Standortübersicht
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
