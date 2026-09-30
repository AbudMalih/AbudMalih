import type { Faq } from "./types";

/**
 * Applicant FAQs (Du-Form). Rendered visibly on /karriere and therefore also
 * emitted as FAQPage structured data. Never promise salaries, response times
 * or working conditions that are not confirmed.
 */
export const faqs: Faq[] = [
  {
    id: "wie-bewerben",
    category: "Bewerbung",
    question: "Wie bewerbe ich mich bei JARBOU?",
    answer:
      "Am schnellsten über die Kurzbewerbung: Sie dauert rund zwei Minuten und funktioniert ohne Konto – auch auf dem Smartphone. Wenn du möchtest, kannst du alternativ die vollständige Bewerbung mit Unterlagen nutzen.",
  },
  {
    id: "lebenslauf",
    category: "Unterlagen",
    question: "Brauche ich einen Lebenslauf?",
    answer:
      "Für die Kurzbewerbung ist ein Lebenslauf optional. Wenn du einen hast, kannst du ihn direkt hochladen – als PDF, Word-Datei oder Foto.",
  },
  {
    id: "unterlagen",
    category: "Unterlagen",
    question: "Welche Unterlagen werden im Verlauf benötigt?",
    answer:
      "Welche Nachweise nötig sind, hängt von der Stelle ab und steht in der Stellenanzeige – bei Fahrerstellen zum Beispiel der Führerschein und ein einwandfreies Führungszeugnis. Wir sprechen das im Bewerbungsprozess mit dir ab.",
  },
  {
    id: "fuehrerschein",
    category: "Voraussetzungen",
    question: "Welchen Führerschein brauche ich?",
    answer:
      "Das steht in der jeweiligen Stellenanzeige. Für die ausgeschriebene Fahrerstelle im DHL-Express-Projekt in Hannover brauchst du den Führerschein Klasse B. Weitere Klassen kannst du in der vollständigen Bewerbung angeben.",
  },
  {
    id: "erfahrung",
    category: "Voraussetzungen",
    question: "Brauche ich Erfahrung in der Logistik?",
    answer:
      "Erfahrung in KEP, Express oder Zustellung ist von Vorteil, aber nicht für jede Stelle Voraussetzung. Neue Kolleginnen und Kollegen werden bei uns strukturiert eingearbeitet.",
  },
  {
    id: "standorte",
    category: "Standorte",
    question: "An welchen Standorten kann ich arbeiten?",
    answer:
      "JARBOU ist in mehreren Regionen Deutschlands im Einsatz. Aktuelle Stellen findest du in der Stellenübersicht. Wenn an deinem Wunschort keine Stelle ausgeschrieben ist, freuen wir uns über deine Initiativbewerbung.",
  },
  {
    id: "starttermin",
    category: "Start",
    question: "Wann kann ich anfangen?",
    answer:
      "Der Starttermin steht in der Stellenanzeige – zum Beispiel ab dem 01.11.2026 oder nach Vereinbarung. Gib in deiner Bewerbung einfach deinen frühesten möglichen Starttermin an.",
  },
  {
    id: "anstellungsart",
    category: "Anstellung",
    question: "Welche Anstellungsarten gibt es?",
    answer: "Die Anstellungsart steht in jeder Stellenanzeige. Die aktuell ausgeschriebenen Stellen sind Vollzeitstellen.",
  },
  {
    id: "mehrere-stellen",
    category: "Bewerbung",
    question: "Kann ich mich auf mehrere Stellen bewerben?",
    answer: "Ja. Wähle eine Stelle aus und nenne weitere Wünsche im Nachrichtenfeld der vollständigen Bewerbung.",
  },
  {
    id: "daten",
    category: "Datenschutz",
    question: "Was passiert mit meinen Daten?",
    answer: "Deine Angaben werden ausschließlich für das Bewerbungsverfahren verwendet. Einzelheiten findest du in unserer Datenschutzerklärung.",
  },
];
