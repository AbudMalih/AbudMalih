import type { ProcessStep, Service } from "./types";

/** Detail content for /leistungen, keyed by service id. */
export const serviceDetails: Record<string, { intro: string; tasks: string[]; result: string }> = {
  disposition: {
    intro: "Die Disposition ist das Zentrum jedes Einsatztags. Sie bringt Fahrerinnen und Fahrer, Fahrzeuge und Touren zusammen und bleibt während des ganzen Tages Ansprechpartner.",
    tasks: ["Tägliche Einsatz- und Personalplanung", "Zuordnung von Fahrern, Fahrzeugen und Touren", "Steuerung bei Ausfällen und Abweichungen", "Feste Ansprechpartner je Standort"],
    result: "Jeder Einsatztag beginnt mit einem klaren Plan – und bleibt steuerbar, wenn sich etwas ändert.",
  },
  routes: {
    intro: "Touren werden nach Gebiet, Volumen und Zeitfenstern strukturiert. Die Planung wird laufend mit dem tatsächlichen Tourverlauf abgeglichen.",
    tasks: ["Tourenplanung nach Zustellgebiet", "Berücksichtigung von Zeitfenstern", "Anpassung bei Volumenschwankungen", "Auswertung des Tourverlaufs"],
    result: "Touren, die zum Gebiet, zum Volumen und zum Team passen.",
  },
  delivery: {
    intro: "Unsere Teams übernehmen Transport-, Express- und Last-Mile-Zustellungen sowie Abholungen im Tourverlauf – eingearbeitet in die Abläufe des jeweiligen Projekts.",
    tasks: ["Last-Mile-Zustellung", "Express- und KEP-Projekte", "Abholungen im Tourverlauf", "Dokumentation der Zustellung"],
    result: "Zuverlässige Ausführung an der Stelle, an der Logistik sichtbar wird: beim Empfänger.",
  },
  quality: {
    intro: "Qualität wird bei JARBOU gesteuert, nicht angenommen. Abweichungen werden erfasst, geprüft und in Maßnahmen übersetzt.",
    tasks: ["Steuerung über Kennzahlen", "Erfassung und Auswertung von Abweichungen", "Regelmäßige Qualitätskontrollen", "Reporting und Maßnahmenverfolgung"],
    result: "Transparenz über die operative Leistung – als Grundlage für jede Verbesserung.",
  },
  fleet: {
    intro: "Mehr als 180 Transporter und 25 LKW sind im Einsatz. Fahrzeuge werden disponiert, geprüft und so geplant, dass Ausfälle den Betrieb nicht aufhalten.",
    tasks: ["Fahrzeugdisposition", "Tägliche Fahrzeugchecks vor Tourbeginn", "Planung von Wartung und Ersatzfahrzeugen", "Zuordnung nach Tour und Einsatzart"],
    result: "Einsatzbereite Fahrzeuge für jede geplante Tour.",
  },
  operations: {
    intro: "Vom Projektstart bis zum laufenden Betrieb stellen wir Teams, Fahrzeuge und operative Führung vor Ort.",
    tasks: ["Aufbau operativer Teams", "Einarbeitung neuer Fahrerinnen und Fahrer", "Operative Führung am Standort", "Abstimmung mit dem Auftraggeber"],
    result: "Ein Partner, der Verantwortung für den gesamten Ablauf übernimmt.",
  },
};

export const services: Service[] = [
  {
    id: "disposition",
    index: "01",
    title: "Disposition & Steuerung",
    lead: "Wir planen Fahrer, Fahrzeuge und Touren jeden Tag neu – mit klaren Zuständigkeiten und kurzen Wegen.",
    points: ["Tägliche Einsatzplanung", "Fahrer- und Fahrzeugzuordnung", "Direkte Ansprechpartner im Betrieb"],
    media: "service-disposition",
  },
  {
    id: "routes",
    index: "02",
    title: "Routen- & Tourenmanagement",
    lead: "Touren werden nach Zustellgebiet, Volumen und Zeitfenstern strukturiert und laufend nachgesteuert.",
    points: ["Tourenplanung nach Gebiet", "Abstimmung von Zeitfenstern", "Anpassung bei Abweichungen"],
    media: "service-routes",
  },
  {
    id: "delivery",
    index: "03",
    title: "Zustellung & Abholung",
    lead: "Transport-, Express- und Last-Mile-Zustellung – zuverlässig ausgeführt von eingearbeiteten Teams.",
    points: ["Last-Mile-Zustellung", "Express- und KEP-Projekte", "Abholungen im Tourverlauf"],
    media: "service-delivery",
  },
  {
    id: "quality",
    index: "04",
    title: "Qualitätsmanagement",
    lead: "Wir steuern Leistung über Kennzahlen, prüfen Abweichungen und leiten konkrete Maßnahmen ab.",
    points: ["Kennzahlenbasierte Steuerung", "Auswertung von Prozessabweichungen", "Regelmäßige Qualitätskontrollen"],
    media: "service-quality",
  },
  {
    id: "fleet",
    index: "05",
    title: "Fuhrparkmanagement",
    lead: "Mehr als 180 Transporter und 25 LKW – gewartet, zugeordnet und einsatzbereit.",
    points: ["Fahrzeugdisposition", "Tägliche Fahrzeugchecks", "Planung von Wartung und Ausfällen"],
    media: "service-fleet",
  },
  {
    id: "operations",
    index: "06",
    title: "Operative Umsetzung",
    lead: "Vom Projektstart bis zum laufenden Betrieb: Wir stellen Teams, Fahrzeuge und Führung vor Ort.",
    points: ["Aufbau operativer Teams", "Einarbeitung von Fahrerinnen und Fahrern", "Laufende Betriebsführung"],
    media: "service-operations",
  },
];

export const processSteps: ProcessStep[] = [
  {
    id: "planung",
    index: "01",
    title: "Planung",
    text: "Volumen, Gebiete und Zeitfenster werden vorab bewertet. Daraus entstehen Touren, Personal- und Fahrzeugbedarf.",
  },
  {
    id: "disposition",
    index: "02",
    title: "Disposition",
    text: "Die Disposition ordnet jeden Tag Fahrer, Fahrzeuge und Touren zu – mit einer klar verantwortlichen Person pro Standort.",
  },
  {
    id: "abfahrt",
    index: "03",
    title: "Abfahrt",
    text: "Fahrzeugcheck, Beladung und Scanning sind abgeschlossen, bevor ein Fahrzeug den Hof verlässt.",
  },
  {
    id: "zustellung",
    index: "04",
    title: "Zustellung",
    text: "Unsere Teams stellen zu und holen ab. Abweichungen im Tourverlauf werden direkt an die Disposition gemeldet.",
  },
  {
    id: "qualitaet",
    index: "05",
    title: "Qualität",
    text: "Nach Tagesabschluss werden Kennzahlen ausgewertet und Maßnahmen für den nächsten Einsatztag abgeleitet.",
  },
];
