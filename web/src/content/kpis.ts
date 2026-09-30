import type { KpiSeries } from "./types";

/**
 * KPI data source.
 *
 * All series below are DEMO data for interface illustration only
 * (`source: "demo"`). They are always rendered with a visible
 * "Beispieldarstellung – keine Echtdaten" label.
 *
 * To connect real data, replace `getKpiSeries` with a server-side fetch
 * against the reporting system and return `source: "live"` series.
 */
const demoSeries: KpiSeries[] = [
  {
    id: "tour-performance",
    title: "Tourenperformance",
    description: "Abgeschlossene Stopps je Tour im Verhältnis zur Planung.",
    source: "demo",
    target: 0.9,
    data: [
      { label: "Mo", value: 0.86 },
      { label: "Di", value: 0.91 },
      { label: "Mi", value: 0.93 },
      { label: "Do", value: 0.89 },
      { label: "Fr", value: 0.94 },
      { label: "Sa", value: 0.92 },
    ],
  },
];

export async function getKpiSeries(): Promise<KpiSeries[]> {
  return demoSeries;
}

export const measuredMetrics = [
  { id: "zustellqualitaet", title: "Zustellqualität", text: "Erfolgreich abgeschlossene Zustellungen und Abholungen je Tour." },
  { id: "tourenperformance", title: "Tourenperformance", text: "Tourverlauf im Abgleich mit Planung und Zeitfenstern." },
  { id: "abweichungen", title: "Prozessabweichungen", text: "Erfassung, Ursache und Behebung von Abweichungen im Ablauf." },
  { id: "qualitaetskontrolle", title: "Qualitätskontrolle", text: "Regelmäßige Prüfungen und daraus abgeleitete Maßnahmen." },
] as const;
