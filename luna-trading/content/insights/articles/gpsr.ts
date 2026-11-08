import type { Article } from "../types";

/**
 * DRAFT for template review (Phase 3A). Facts: Regulation (EU) 2023/988
 * (General Product Safety Regulation, GPSR), applicable since 13 December
 * 2024. Legal content: to be reviewed before publishing (Phase 3B).
 */
export const gpsr: Article = {
  id: "gpsr",
  category: "compliance",
  status: "draft",
  published: "2026-11-08",
  updated: "2026-11-08",
  reviewed: "2026-11-08",
  cover: { src: "/story/check", illustrative: true },
  related: ["incoterms"],
  text: {
    de: {
      slug: "gpsr-pflichten-importeure",
      title:
        "GPSR: Was die Produktsicherheitsverordnung für Importeure bedeutet",
      seoTitle: "GPSR-Pflichten für Importeure im Überblick",
      description:
        "Seit dem 13. Dezember 2024 gilt die EU-Produktsicherheitsverordnung (GPSR). Welche Angaben Produkte brauchen und was beim Import aus Drittländern wichtig ist.",
      lead: "Die Allgemeine Produktsicherheitsverordnung (EU) 2023/988 hat die bisherige Produktsicherheitsrichtlinie abgelöst. Für Waren aus Drittländern wie China stellt sie klare Anforderungen an Kennzeichnung und Verantwortung in der EU.",
      keyPoints: [
        "Die GPSR gilt seit dem 13. Dezember 2024 unmittelbar in allen EU-Staaten.",
        "Für Verbraucherprodukte muss ein verantwortlicher Wirtschaftsakteur in der EU benannt sein.",
        "Name und Kontaktangaben von Hersteller bzw. Importeur gehören auf Produkt, Verpackung oder Begleitdokument.",
        "Online-Angebote müssen die wesentlichen Sicherheits- und Kontaktangaben ebenfalls zeigen.",
      ],
      coverAlt:
        "Hände mit Klemmbrett prüfen einen verschlossenen Karton in einem Lager.",
      body: [
        { t: "h2", id: "worum-geht-es", text: "Worum es bei der GPSR geht" },
        {
          t: "p",
          text: "Die Verordnung (EU) 2023/988 regelt die allgemeine Sicherheit von Verbraucherprodukten, soweit keine spezielleren EU-Vorschriften gelten. Als Verordnung gilt sie seit dem 13. Dezember 2024 unmittelbar in allen Mitgliedstaaten und ersetzt die frühere Richtlinie 2001/95/EG.",
        },
        {
          t: "h2",
          id: "verantwortliche-person",
          text: "Ein Verantwortlicher in der EU",
        },
        {
          t: "p",
          text: "Ein Verbraucherprodukt darf nur in Verkehr gebracht werden, wenn ein in der EU niedergelassener Wirtschaftsakteur dafür verantwortlich ist, zum Beispiel der Hersteller selbst, der Importeur oder ein Bevollmächtigter. Bei Waren direkt aus China übernimmt diese Rolle häufig der Importeur.",
        },
        {
          t: "h2",
          id: "kennzeichnung",
          text: "Angaben auf Produkt und Verpackung",
        },
        {
          t: "ul",
          items: [
            "Name, Handelsname oder Marke sowie Post- und E-Mail-Adresse des Herstellers.",
            "Bei Herstellern außerhalb der EU zusätzlich die Angaben des verantwortlichen Wirtschaftsakteurs in der EU.",
            "Typen-, Chargen- oder Seriennummer zur Identifikation.",
            "Warnhinweise und Sicherheitsinformationen in der Sprache des Ziellandes.",
          ],
        },
        { t: "h2", id: "online-handel", text: "Pflichten im Online-Handel" },
        {
          t: "p",
          text: "Wer Produkte online anbietet, muss diese Angaben auch im Angebot sichtbar machen, etwa auf Marktplätzen. Wie wir Produkte für den Online-Verkauf vorbereiten, beschreiben wir unter [E-Commerce](/what-we-do#ecommerce).",
        },
        {
          t: "note",
          title: "Vor der Produktion klären",
          text: "Kennzeichnung und Verpackung lassen sich am einfachsten vor der Produktion festlegen. Nachträgliche Etikettierung im Lager kostet Zeit und Geld.",
        },
      ],
    },
  },
};
