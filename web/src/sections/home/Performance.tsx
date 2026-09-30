import { SectionLabel } from "@/components/ui/SectionLabel";
import { measuredMetrics, qualityLoop } from "@/content/quality";
import { InView } from "@/motion/InView";

/**
 * Quality as a control loop – how deviations are handled, without
 * presenting any performance figures.
 */
export function Performance() {
  return (
    <section id="qualitaet" aria-labelledby="quality-title" className="defer-render bg-ink py-24 lg:py-32">
      <div className="shell">
        <SectionLabel index="03">Qualität</SectionLabel>
        <div className="mt-6 grid gap-8 lg:grid-cols-12">
          <h2 id="quality-title" className="h-section lg:col-span-7">
            Transparenz ist bei uns Standard.
          </h2>
          <p className="max-w-md text-base leading-relaxed text-steel-300 lg:col-span-4 lg:col-start-9">
            Gute Logistik entsteht nicht durch Zufall. Wir steuern unsere operative Leistung anhand klarer Kennzahlen – von Zustellqualität und Tourenperformance bis zu Prozessabweichungen und Qualitätskontrolle.
          </p>
        </div>

        <InView className="mt-16 lg:mt-24" threshold={0.3}>
          <h3 className="eyebrow text-steel-400">Regelkreis im Einsatz</h3>
          <ol className="relative mt-10 grid gap-0 md:grid-cols-5">
            {/* Loop track: forward line on desktop, vertical on mobile */}
            <span aria-hidden="true" className="reveal-line absolute left-0 right-0 top-[7px] hidden h-px bg-white/40 md:block" />
            <span aria-hidden="true" className="reveal-y absolute bottom-0 left-[7px] top-0 w-px bg-white/25 md:hidden" />
            {qualityLoop.map((step, i) => {
              const alert = step.id === "abweichung";
              return (
                <li
                  key={step.id}
                  className="reveal relative pb-10 pl-10 md:pb-0 md:pl-0 md:pr-8"
                  style={{ "--d": `${250 + i * 180}ms` } as React.CSSProperties}
                >
                  <span
                    aria-hidden="true"
                    className={`absolute left-0 top-0 block size-[15px] border [transform:skewX(-28deg)] ${
                      alert ? "border-red bg-red" : "border-white/60 bg-ink"
                    }`}
                  />
                  <p className="font-mono text-[0.7rem] text-steel-500 md:mt-9">0{i + 1}</p>
                  <h4 className="mt-2 text-lg font-semibold uppercase tracking-[-0.01em] text-white">{step.title}</h4>
                  <p className="mt-3 max-w-[15rem] text-sm leading-relaxed text-steel-400">{step.text}</p>
                </li>
              );
            })}
          </ol>
          {/* Return path: Reporting feeds the next day's planning */}
          <div
            aria-hidden="true"
            className="reveal mt-12 hidden items-center gap-4 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-steel-500 md:flex"
            style={{ "--d": "1300ms" } as React.CSSProperties}
          >
            <svg viewBox="0 0 24 12" className="h-3 w-6 text-red">
              <path d="M22 1 V6 H3 M7 2 L3 6 L7 10" fill="none" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            <span className="h-px flex-1 bg-white/15" />
            <span>Rückfluss in die Planung des nächsten Einsatztags</span>
          </div>
          <p className="sr-only">Die Ergebnisse aus dem Reporting fließen in die Planung des nächsten Einsatztags zurück.</p>
        </InView>

        <div className="mt-20 border-t border-white/10 pt-10 lg:mt-24">
          <h3 className="eyebrow text-steel-400">Was wir messen</h3>
          <dl className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {measuredMetrics.map((m) => (
              <div key={m.id}>
                <dt className="font-semibold text-white">{m.title}</dt>
                <dd className="mt-2 text-sm leading-relaxed text-steel-400">{m.text}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
