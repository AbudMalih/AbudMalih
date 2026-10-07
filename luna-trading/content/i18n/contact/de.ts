import type { ContactCopy } from "./types";

const de: ContactCopy = {
  meta: {
    title: "Kontakt",
    description:
      "Kontakt zur Luna Trading GmbH in Köln: per E-Mail an info@luna-trading.de oder über eine kurze Anfrage zu Handel, Beschaffung, Produktentwicklung, Marken, E-Commerce und Distribution.",
  },
  hero: {
    eyebrow: "Kontakt",
    h1a: "Geschäft beginnt",
    h1b: "mit einem Gespräch.",
    lead: "Ob Produkt, Beschaffung, Marke, E-Commerce oder Handel: Sprechen wir darüber, was als Nächstes kommt.",
  },
  direct: {
    tag: "Direkt",
    title: "Schreiben Sie uns.",
  },
  inquiry: {
    title: "Gespräch beginnen",
    typeLegend: "Thema Ihrer Anfrage",
    types: {
      business: "Geschäft & Beschaffung",
      brand: "Marke & Produkt",
      supplier: "Lieferant / Hersteller",
      general: "Allgemeine Anfrage",
    },
  },
  fields: {
    name: "Name",
    company: "Unternehmen",
    email: "E-Mail",
    message: "Nachricht",
    optional: "optional",
    required: "Pflichtfeld",
  },
  errors: {
    summary: "Bitte prüfen Sie die markierten Angaben.",
    required: "Bitte füllen Sie dieses Feld aus.",
    nameRequired: "Bitte geben Sie Ihren Namen an.",
    emailRequired: "Bitte geben Sie Ihre E-Mail-Adresse an.",
    messageRequired: "Bitte schreiben Sie uns kurz, worum es geht.",
    email: "Bitte prüfen Sie die E-Mail-Adresse.",
    long: "Dieser Text ist zu lang.",
    short: "Bitte schreiben Sie ein paar Worte mehr.",
  },
  privacy: {
    text: "Ihre Angaben verwenden wir ausschließlich, um Ihre Anfrage zu bearbeiten.",
    link: "Datenschutz",
  },
  submit: { idle: "Anfrage senden", sending: "Wird gesendet" },
  failure: {
    title: "Ihre Nachricht konnte nicht gesendet werden.",
    text: "Bitte schreiben Sie uns direkt per E-Mail. Ihre Angaben bleiben im Formular erhalten.",
    retry: "Erneut versuchen",
    rate: "Zu viele Anfragen in kurzer Zeit. Bitte versuchen Sie es in einigen Minuten erneut.",
  },
  success: {
    tag: "Anfrage gesendet",
    h1: "Vielen Dank.",
    h2: "Ihre Nachricht ist bei uns angekommen.",
    text: "Wir melden uns so bald wie möglich.",
    again: "Weitere Anfrage",
  },
  closing: { line: "Köln · Deutschland" },
};

export default de;
