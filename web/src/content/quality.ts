/** Quality control loop – a process description, no performance figures. */
export const qualityLoop = [
  {
    id: "tour",
    title: "Tour läuft",
    text: "Touren werden nach Plan gefahren. Der Tourverlauf wird laufend mit der Planung abgeglichen.",
  },
  {
    id: "abweichung",
    title: "Abweichung erkannt",
    text: "Verzögerungen, Zustellprobleme oder Fahrzeugthemen werden sofort an die Disposition gemeldet.",
  },
  {
    id: "pruefung",
    title: "Prüfung",
    text: "Die Disposition bewertet Ursache und Auswirkung – noch am selben Einsatztag.",
  },
  {
    id: "massnahme",
    title: "Maßnahme",
    text: "Touren, Einsatzplanung oder Abläufe werden angepasst und die Maßnahme wird dokumentiert.",
  },
  {
    id: "reporting",
    title: "Reporting",
    text: "Kennzahlen und Maßnahmen fließen in das Reporting und in die Planung des nächsten Tages ein.",
  },
] as const;

export const measuredMetrics = [
  { id: "zustellqualitaet", title: "Zustellqualität", text: "Erfolgreich abgeschlossene Zustellungen und Abholungen je Tour." },
  { id: "tourenperformance", title: "Tourenperformance", text: "Tourverlauf im Abgleich mit Planung und Zeitfenstern." },
  { id: "abweichungen", title: "Prozessabweichungen", text: "Erfassung, Ursache und Behebung von Abweichungen im Ablauf." },
  { id: "qualitaetskontrolle", title: "Qualitätskontrolle", text: "Regelmäßige Prüfungen und daraus abgeleitete Maßnahmen." },
] as const;
