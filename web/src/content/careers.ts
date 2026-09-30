import type { ProcessStep } from "./types";

/** Careers page content. Edit here – components contain no copy of their own. */

export const careerHero = {
  eyebrow: "Karriere bei JARBOU",
  lines: ["Deine Leistung", "bewegt uns."],
  lead: "Über 160 Kolleginnen und Kollegen sorgen jeden Tag dafür, dass Logistik funktioniert. Finde deine Stelle – und bewirb dich in rund zwei Minuten, ohne Konto.",
};

export const careerNav = [
  { id: "jobs", label: "Jobs" },
  { id: "bei-jarbou", label: "Bei JARBOU" },
  { id: "bewerbungsprozess", label: "Bewerbungsprozess" },
  { id: "entwicklung", label: "Entwicklung" },
  { id: "standorte", label: "Standorte" },
  { id: "faq", label: "FAQ" },
] as const;

export const whyJarbou = [
  { id: "onboarding", title: "Strukturierte Einarbeitung", text: "Klare Abläufe und feste Ansprechpartner – vom ersten Tag an." },
  { id: "fleet", title: "Moderner Fuhrpark", text: "Mehr als 180 Transporter und 25 LKW im Einsatz." },
  { id: "teams", title: "Starke Teams", text: "Über 160 Kolleginnen und Kollegen, die sich aufeinander verlassen." },
  { id: "development", title: "Entwicklung", text: "Wenn du Verantwortung übernehmen willst, bekommst du die Chance, dich weiterzuentwickeln." },
  { id: "perspective", title: "Langfristige Perspektive", text: "Wir suchen Menschen, mit denen wir dauerhaft zusammenarbeiten – vielleicht dich." },
  { id: "locations", title: "Mehrere Standorte", text: "JARBOU ist in mehreren Regionen Deutschlands im Einsatz." },
];

export const applicationSteps: ProcessStep[] = [
  { id: "bewerbung", index: "01", title: "Bewerbung", text: "Kurzbewerbung in rund zwei Minuten oder vollständige Bewerbung mit Unterlagen – ohne Konto." },
  { id: "erstes-gespraech", index: "02", title: "Erstes Gespräch", text: "Wir melden uns telefonisch bei dir und klären erste Fragen zu Stelle, Standort und Starttermin." },
  { id: "persoenlich", index: "03", title: "Persönliches Gespräch", text: "Du lernst uns kennen – und wir dich. Hier ist Raum für alle deine Fragen zum Arbeitsalltag." },
  { id: "pruefung", index: "04", title: "Prüfung / Abstimmung", text: "Wir stimmen die Details mit dir ab und prüfen die für die Stelle erforderlichen Unterlagen." },
  { id: "angebot", index: "05", title: "Angebot", text: "Passt es für beide Seiten, bekommst du ein Angebot." },
  { id: "onboarding", index: "06", title: "Onboarding", text: "Strukturierte Einarbeitung mit festen Ansprechpartnern an deinem Standort." },
];

export const dayAtJarbou: ProcessStep[] = [
  { id: "fahrzeugcheck", index: "01", title: "Fahrzeugcheck", text: "Vor Tourbeginn wird das Fahrzeug geprüft – Licht, Reifen, Schäden, Ausstattung." },
  { id: "vorbereitung", index: "02", title: "Vorbereitung", text: "Tour, Gebiet und Besonderheiten des Tages werden mit der Disposition abgestimmt." },
  { id: "beladung", index: "03", title: "Beladung", text: "Sendungen werden in Tourreihenfolge geladen – sauber, sicher und nachvollziehbar." },
  { id: "scanning", index: "04", title: "Scanning", text: "Jede Sendung wird erfasst, bevor das Fahrzeug den Hof verlässt." },
  { id: "abfahrt", index: "05", title: "Abfahrt", text: "Die Tour startet. Bei Fragen ist die Disposition jederzeit erreichbar." },
  { id: "zustellung", index: "06", title: "Zustellung / Abholung", text: "Zustellen, abholen, dokumentieren – freundlich und professionell beim Empfänger." },
  { id: "qualitaet", index: "07", title: "Qualitätskontrolle", text: "Abweichungen werden gemeldet und geklärt, damit die Qualität stimmt." },
  { id: "tagesabschluss", index: "08", title: "Tagesabschluss", text: "Rückmeldung an die Disposition, Tour im System abschließen, Fahrzeug übergeben – der Tag ist geschafft." },
];

export const developmentPath = [
  { id: "fahrer", title: "Fahrer" },
  { id: "senior-fahrer", title: "Senior Fahrer" },
  { id: "disponent", title: "Disponent" },
  { id: "teamleiter", title: "Teamleiter" },
  { id: "standortleitung", title: "Standortleitung" },
];

export const developmentDisclaimer =
  "Entwicklungsmöglichkeiten hängen von Leistung, Erfahrung, Verantwortung und dem betrieblichen Bedarf ab.";

/** Driving-licence classes offered in the full application. */
export const licenceClasses = ["BE", "C1", "C1E", "C", "CE", "D1", "D"] as const;
