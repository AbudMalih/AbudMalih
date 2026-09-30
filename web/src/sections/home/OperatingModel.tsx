import { SectionLabel } from "@/components/ui/SectionLabel";
import { processSteps } from "@/content/services";
import { InView } from "@/motion/InView";

const FOCUS: Record<string, string> = {
  planung: "Routenplanung",
  disposition: "Fahrer & Fahrzeuge",
  abfahrt: "Fahrzeugcheck & Beladung",
  zustellung: "Ausführung im Tourgebiet",
  qualitaet: "Qualitätsreporting",
};

const PRINCIPLES = [
  { title: "Klare Verantwortung", text: "Jeder Standort hat feste Ansprechpartner – intern wie für unsere Auftraggeber." },
  { title: "Tägliche Koordination", text: "Disposition und Teams stimmen sich jeden Einsatztag vor, während und nach der Tour ab." },
  { title: "Messbare Ergebnisse", text: "Qualität wird nicht angenommen, sondern ausgewertet und verbessert." },
];

/** Calm section: the five-step route draws once when it enters view. */
export function OperatingModel() {
  return (
    <section aria-labelledby="model-title" className="border-t border-ink/10 bg-paper pb-24 text-ink lg:pb-36 defer-render">
      <div className="shell pt-24 lg:pt-32">
        <SectionLabel index="02" tone="dark">
          Betriebsmodell
        </SectionLabel>
        <h2 id="model-title" className="h-section mt-6 max-w-4xl">
          So funktioniert JARBOU.
        </h2>

        <InView as="ol" className="relative mt-16 grid gap-0 md:grid-cols-5 lg:mt-24" threshold={0.3}>
          {/* Route line – horizontal on desktop, vertical on mobile */}
          <span aria-hidden="true" className="reveal-line absolute left-0 right-0 top-[7px] hidden h-0.5 bg-ink md:block" />
          <span aria-hidden="true" className="reveal-y absolute bottom-0 left-[7px] top-0 w-0.5 bg-ink md:hidden" />
          {processSteps.map((s, i) => (
            <li key={s.id} className="reveal relative pb-12 pl-10 md:pb-0 md:pl-0 md:pr-8" style={{ "--d": `${300 + i * 220}ms` } as React.CSSProperties}>
              <span
                aria-hidden="true"
                className={`absolute left-0 top-0 block size-4 border-2 border-ink ${i === processSteps.length - 1 ? "bg-red" : "bg-paper"} [transform:skewX(-28deg)]`}
              />
              <p className="font-mono text-xs text-steel-600 md:mt-10">{s.index}</p>
              <h3 className="mt-2 text-2xl font-bold uppercase tracking-[-0.02em]">{s.title}</h3>
              <p className="mt-1 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-red-ink">{FOCUS[s.id]}</p>
              <p className="mt-4 max-w-xs text-[0.95rem] leading-relaxed text-graphite-600">{s.text}</p>
            </li>
          ))}
        </InView>

        <div className="mt-20 grid gap-10 border-t border-ink/15 pt-12 md:grid-cols-3 lg:mt-28">
          {PRINCIPLES.map((p) => (
            <div key={p.title}>
              <h3 className="text-lg font-semibold">{p.title}</h3>
              <p className="mt-3 max-w-sm leading-relaxed text-graphite-600">{p.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
