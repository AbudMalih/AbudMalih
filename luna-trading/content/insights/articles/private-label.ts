import type { Article } from "../types";

/** DRAFT for template review (Phase 3A). To be reviewed before publishing (Phase 3B). */
export const privateLabel: Article = {
  id: "private-label",
  category: "brands",
  status: "draft",
  published: "2026-11-08",
  updated: "2026-11-08",
  cover: { src: "/story/desk", illustrative: true },
  related: ["incoterms"],
  text: {
    de: {
      slug: "eigenmarke-private-label-aufbauen",
      title: "Eigenmarke aufbauen: Von der Spezifikation bis zum Marktstart",
      seoTitle: "Private Label: Eigenmarke Schritt für Schritt aufbauen",
      description:
        "Wie aus einem beschafften Produkt eine Eigenmarke wird: Spezifikation, Muster, Verpackung, Kennzeichnung und Vorbereitung für den Online-Handel.",
      lead: "Eine Eigenmarke entsteht nicht mit dem Logo, sondern mit einer klaren Spezifikation. Die wichtigsten Schritte vom ersten Muster bis zum Verkaufsstart.",
      keyPoints: [
        "Am Anfang steht eine schriftliche Spezifikation: Material, Maße, Qualität, Verpackung.",
        "Muster werden gegen diese Spezifikation geprüft, nicht gegen einen Eindruck.",
        "Kennzeichnung und Verpackung müssen die EU-Anforderungen erfüllen.",
        "Listing, Bilder und Texte entscheiden über den Erfolg im Online-Handel.",
      ],
      coverAlt:
        "Zwei Hände prüfen Produktmuster an einem Schreibtisch, daneben ein Laptop.",
      body: [
        { t: "h2", id: "spezifikation", text: "Die Spezifikation zuerst" },
        {
          t: "p",
          text: "Bevor Hersteller angefragt werden, sollte feststehen, was das Produkt leisten muss: Material, Maße, Toleranzen, Oberflächen, Verpackung und Mengen. Eine schriftliche Spezifikation macht Angebote vergleichbar.",
        },
        { t: "h2", id: "muster", text: "Muster prüfen und freigeben" },
        {
          t: "p",
          text: "Muster werden gegen die Spezifikation geprüft. Erst wenn ein Muster freigegeben ist, sollte die Serienproduktion beginnen. Wie wir Hersteller finden und Muster koordinieren, beschreiben wir unter [Globale Beschaffung](/what-we-do#sourcing).",
        },
        {
          t: "h2",
          id: "marke-verpackung",
          text: "Marke, Verpackung, Kennzeichnung",
        },
        {
          t: "p",
          text: "Positionierung, Name und Gestaltung bilden die Identität. Verpackung und Etiketten müssen zugleich die gesetzlichen Angaben tragen. Beispiele für eigene Marken zeigen wir unter [Marken](/brands).",
        },
        { t: "h2", id: "marktstart", text: "Vorbereitung für den Marktstart" },
        {
          t: "ul",
          items: [
            "Produktdaten, Bilder und Texte für Shop und Marktplätze vorbereiten.",
            "Lagerung und Versand in Deutschland planen.",
            "Erste Liefermenge an Nachfrage und Lagerkosten ausrichten.",
          ],
        },
      ],
    },
  },
};
