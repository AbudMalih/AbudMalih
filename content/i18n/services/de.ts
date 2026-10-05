import type { ServicesCopy } from "./types";

/** Leistungen. Deutsch ist die Primärsprache: kurz, konkret, belastbar. */
const de: ServicesCopy = {
  meta: {
    title: "Leistungen",
    description:
      "Beschaffung, Import und Export, Produktentwicklung, Markenentwicklung, E-Commerce und Distribution: wie Luna Trading den Weg von der Quelle bis zum Markt verbindet.",
  },
  hero: {
    eyebrow: "Was wir tun",
    h1a: "Von der Quelle",
    h1b: "bis zum Markt.",
    lead: "Luna Trading verbindet internationale Beschaffung, Handel, Produktentwicklung, Markenaufbau, E-Commerce und Distribution zu einer durchgehenden Struktur: von der ersten Spezifikation bis zum Produkt beim Kunden.",
    scroll: "Das Modell",
  },
  route: ["Quelle", "Import", "Entwicklung", "Marke", "E-Commerce", "Distribution", "Markt"],
  model: {
    tag: "Das Betriebsmodell",
    title: "Sechs Disziplinen. Eine Kette.",
    intro: "Jede Stufe bereitet die nächste vor. Unser Wert liegt nicht in einer einzelnen Leistung, sondern in der Verbindung.",
    lines: {
      sourcing: "Passende Hersteller und Materialien finden, bewerten und koordinieren.",
      trade: "Internationale Warenströme kaufmännisch steuern und nach Europa führen.",
      development: "Aus einer Idee ein marktfähiges Produkt machen.",
      brand: "Positionierung und Auftritt, die einem Produkt Identität geben.",
      ecommerce: "Produkte über eigene Shops und Marktplätze zum Kunden bringen.",
      distribution: "Bestellungen zuverlässig an ihr Ziel bringen.",
    },
    jump: "Zur Leistung",
  },
  chapters: {
    sourcing: {
      stop: "Quelle",
      title: "Globale Beschaffung",
      statement: "Am Anfang steht die richtige Quelle.",
      body: "Wir identifizieren Hersteller, die zu Produkt, Qualität und Menge passen, bewerten Angebote kaufmännisch und koordinieren die Abstimmung von den ersten Anforderungen bis zum Muster.",
      focus: ["Herstelleridentifikation", "Anforderungsprofil und Spezifikation", "Kaufmännische Bewertung", "Muster- und Entwicklungskoordination"],
    },
    trade: {
      stop: "Import",
      title: "Import & Export",
      statement: "Der Handel zwischen den Märkten.",
      body: "Wir sind die kaufmännische Ebene zwischen Herstellung und Markt: Wir steuern Einkauf und Import, verantworten die Handelsdokumentation und koordinieren den Transport mit spezialisierten Logistikpartnern bis in den europäischen Markt.",
      focus: ["Internationaler Einkauf", "Importkoordination", "Export", "Handelsdokumentation", "Markteintritt in Europa"],
    },
    development: {
      stop: "Entwicklung",
      title: "Produkt\u00ADentwicklung",
      statement: "Vom Gedanken zum marktfähigen Produkt.",
      body: "Wir übersetzen eine Produktidee in klare Vorgaben, begleiten Muster und Anpassungen und entwickeln Verpackung und Kennzeichnung, bis das Produkt bereit für seinen Markt ist.",
      focus: ["Material und Maß", "Muster und Iteration", "Verpackung und Kennzeichnung", "Konformität im Blick"],
    },
    brand: {
      stop: "Marke",
      title: "Marken\u00ADentwicklung",
      statement: "Wir bauen Marken um Produkte.",
      body: "Ein gutes Produkt braucht eine Haltung. Wir entwickeln Positionierung und Auftritt, koordinieren Gestaltung und Verpackung und bereiten die Marke kaufmännisch auf ihren Markt vor.",
      focus: ["Markenpositionierung", "Koordination der visuellen Identität", "Verpackungsgestaltung", "Marktauftritt", "Kaufmännische Vorbereitung"],
    },
    ecommerce: {
      stop: "E-Commerce",
      title: "E-Commerce",
      statement: "Vom Produkt zum Kunden. Digital.",
      body: "Wir bringen Produkte und Marken in den digitalen Handel: in eigene Onlineshops, auf Marktplätze und in den europäischen Markt.",
      focus: ["Eigene Onlineshops", "Marktplatzpräsenz", "Produktdaten und Präsentation", "Europäischer Onlinehandel"],
    },
    distribution: {
      stop: "Distribution",
      title: "Distribution",
      statement: "Aus der Bestellung wird Bewegung.",
      body: "Am Ende wird aus der digitalen Bestellung wieder eine physische Lieferung. Wir koordinieren Fulfilment und Vertriebsstrukturen mit spezialisierten Logistikpartnern, damit Ware zuverlässig zu Handel, Geschäftskunden und Endkunden gelangt.",
      focus: ["Fulfilment-Lösungen", "Vertriebsstrukturen", "Handel und B2B", "Endkundenversand"],
    },
  },
  sourcing: {
    spec: "Spezifikation",
    rows: [
      ["Material", "definiert"],
      ["Maß", "definiert"],
      ["Menge", "abgestimmt"],
      ["Muster", "in Prüfung"],
    ],
    origin: "Ursprung",
  },
  trade: {
    container: "Ware in Bewegung",
    document: "Handelsdokument",
    docRows: ["Einkauf", "Import", "Zollabwicklung", "Lieferung"],
    market: "Europäischer Markt",
  },
  development: { process: ["Idee", "Spezifikation", "Muster", "Verpackung", "Marktreif"] },
  brand: {
    positioning: "Positionierung",
    axes: ["Funktional", "Emotional", "Zugänglich", "Exklusiv"],
    type: "Typografie",
    palette: "Farbe",
    pack: "Verpackung",
  },
  ecommerce: {
    flow: ["Produkt", "Marke", "Digitaler Kanal", "Kunde"],
    channels: ["Eigener Shop", "Marktplatz", "Europäischer Markt"],
    platforms: "Plattformen & Vertriebskanäle",
    groups: { store: "Store-Technologie", marketplace: "Marktplätze" },
  },
  distribution: {
    flow: ["Bestellung", "Fulfilment", "Distribution", "Ziel"],
    destinations: ["Handel", "Geschäftskunden", "Endkunden"],
  },
  payoff: {
    tag: "Die vollständige Route",
    title: "Der Wert liegt in der Verbindung.",
    body: "Luna Trading verbindet jede Stufe mit der nächsten. So wird aus einer Quelle ein Markt.",
  },
  luviscent: {
    tag: "Eigenmarke",
    title1: "Eine Marke.",
    title2: "Ein System.",
    body: "LUVISCENT® ist eine Eigenmarke, entwickelt innerhalb des Luna-Trading-Ökosystems: von der Beschaffung über Produkt und Marke bis in den digitalen Handel.",
    cta: "LUVISCENT entdecken",
    brands: "Alle Marken",
  },
  cta: {
    tag: "Kontakt",
    h1: "Sprechen wir",
    h2: "über Ihr nächstes Projekt.",
    lead: "Beschaffung, Produkt, Marke oder Vertrieb: Erzählen Sie uns, woran Sie arbeiten.",
    button: "Kontakt aufnehmen",
    company: "Das Unternehmen",
  },
};

export default de;
