import { KpiBarChart } from "@/components/data/KpiBarChart";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { getKpiSeries, measuredMetrics } from "@/content/kpis";
import { InView } from "@/motion/InView";

export async function Performance() {
  const [series] = await getKpiSeries();
  return (
    <section id="qualitaet" aria-labelledby="quality-title" className="bg-ink py-24 lg:py-36 defer-render">
      <div className="shell">
        <SectionLabel index="03">Qualität</SectionLabel>
        <div className="mt-6 grid gap-10 lg:grid-cols-12">
          <h2 id="quality-title" className="display text-[clamp(2.2rem,6vw,5.75rem)] lg:col-span-8">
            Transparenz ist bei uns Standard.
          </h2>
          <p className="max-w-md self-end text-lg leading-relaxed text-steel-300 lg:col-span-4">
            Gute Logistik entsteht nicht durch Zufall. Wir steuern unsere operative Leistung anhand klarer Kennzahlen – von Zustellqualität und Tourenperformance bis zu Prozessabweichungen und Qualitätskontrolle.
          </p>
        </div>

        <InView className="mt-16 grid gap-12 lg:mt-24 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-5">
            <h3 className="eyebrow text-steel-400">Was wir messen</h3>
            <ol className="mt-6">
              {measuredMetrics.map((m, i) => (
                <li
                  key={m.id}
                  className="reveal grid grid-cols-[3rem_1fr] border-t border-white/10 py-6 last:border-b"
                  style={{ "--d": `${i * 120}ms` } as React.CSSProperties}
                >
                  <span className="font-mono text-xs text-red">0{i + 1}</span>
                  <span>
                    <span className="block text-lg font-semibold text-white">{m.title}</span>
                    <span className="mt-1 block text-sm leading-relaxed text-steel-400">{m.text}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
          <div className="reveal border border-white/10 bg-graphite-900 p-6 sm:p-8 lg:col-span-7" style={{ "--d": "200ms" } as React.CSSProperties}>
            {series && <KpiBarChart series={series} />}
            <p className="mt-6 border-t border-white/10 pt-4 text-xs leading-relaxed text-steel-500">
              Die Grafik zeigt, wie Kennzahlen im Reporting aufbereitet werden. Die Werte sind Beispiele und keine Leistungsdaten von JARBOU.
            </p>
          </div>
        </InView>
      </div>
    </section>
  );
}
