import { Slashes } from "@/components/brand/Slashes";
import { ButtonLink } from "@/components/ui/Button";
import { SectionLabel } from "@/components/ui/SectionLabel";

const AUDIENCES = [
  "Logistiknetzwerke",
  "Logistikunternehmen mit Kapazitätsbedarf",
  "Unternehmen mit operativem Zustellbedarf",
  "Auftraggeber für regionale Last-Mile-Projekte",
];

export function BusinessTeaser() {
  return (
    <section aria-labelledby="business-title" className="relative overflow-hidden bg-graphite-900 py-24 lg:py-36 defer-render">
      <Slashes className="pointer-events-none absolute -bottom-[10%] -right-[6%] h-[70%] w-auto text-white/[0.035]" />
      <div className="shell relative">
        <SectionLabel index="06">Für Unternehmen</SectionLabel>
        <div className="mt-6 grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <h2 id="business-title" className="display text-[clamp(2.2rem,6vw,5.75rem)]">
              Operative Logistik. Zuverlässig skaliert.
            </h2>
            <p className="mt-8 max-w-xl text-lg leading-relaxed text-steel-300">
              Wir stellen Teams, Fahrzeuge und operative Führung für Transport-, Express- und Last-Mile-Projekte – planbar, messbar und mit klaren Ansprechpartnern.
            </p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href="/business">Logistik anfragen</ButtonLink>
              <ButtonLink href="/leistungen" variant="outline">
                Leistungen ansehen
              </ButtonLink>
            </div>
          </div>
          <div className="self-end lg:col-span-4 lg:col-start-9">
            <h3 className="eyebrow text-steel-400">Wir arbeiten für</h3>
            <ul className="mt-5 border-t border-white/10">
              {AUDIENCES.map((a) => (
                <li key={a} className="border-b border-white/10 py-4 text-white">
                  {a}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
