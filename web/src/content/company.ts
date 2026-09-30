import type { MediaKey, Stat, TimelineEntry } from "./types";

/**
 * Verified company facts (supplied by JARBOU Logistik GmbH).
 * Do not add figures here unless they have been confirmed by the company.
 */
export const company = {
  legalName: "JARBOU Logistik GmbH",
  shortName: "JARBOU",
  founded: 2019,
  employees: 160,
  vans: 180,
  trucks: 25,
  claim: "Logistik, die messbar funktioniert.",
  subclaim: "Zuverlässige Prozesse. Starke Teams. Klare Ergebnisse.",
  intro:
    "Seit 2019 steht JARBOU Logistik für leistungsstarke Transport-, Zustell- und Last-Mile-Lösungen. Mit über 160 Mitarbeitenden, mehr als 180 Transportern und 25 LKW sind wir in mehreren Regionen Deutschlands im Einsatz.",
  email: {
    careers: "karriere@jarbou-logistik.com",
    /** TODO(admin): confirm general and business inquiry addresses. */
    general: null as string | null,
    business: null as string | null,
  },
  /** TODO(admin): phone number and registered address for Impressum. */
  phone: null as string | null,
  address: null as { street: string; zip: string; city: string } | null,
} as const;

export const stats: Stat[] = [
  { id: "employees", value: company.employees, suffix: "+", label: "Mitarbeitende", animate: true },
  { id: "vans", value: company.vans, suffix: "+", label: "Transporter", animate: true },
  { id: "trucks", value: company.trucks, label: "LKW", animate: true },
  { id: "founded", value: company.founded, label: "Gegründet", animate: false },
];

/** /unternehmen – editorial copy. Only confirmed facts. */
export const companyPage = {
  headline: ["Logistik braucht Menschen,", "die Verantwortung übernehmen."],
  lead: "JARBOU Logistik GmbH wurde 2019 gegründet. Seitdem ist das Unternehmen deutlich gewachsen – heute arbeiten über 160 Menschen für JARBOU, mit mehr als 180 Transportern und 25 LKW in mehreren Regionen Deutschlands.",
  chapters: [
    {
      id: "wachstum",
      media: "photo-truck-40t" as MediaKey,
      eyebrow: "Wachstum",
      title: "Gewachsen durch Verlässlichkeit.",
      text: "Wachstum in der Logistik entsteht nicht durch Versprechen, sondern durch Einsatztage, die funktionieren. Jede neue Tour, jedes neue Fahrzeug und jedes neue Team muss in einen Ablauf passen, der jeden Tag trägt.",
    },
    {
      id: "menschen",
      media: "photo-team" as MediaKey,
      eyebrow: "Menschen",
      title: "Über 160 Menschen, ein Anspruch.",
      text: "Fahrerinnen und Fahrer, Disposition und Führung arbeiten Hand in Hand. Wir setzen auf klare Einarbeitung, feste Ansprechpartner und Teams, die sich aufeinander verlassen können.",
    },
    {
      id: "betrieb",
      media: "photo-vans" as MediaKey,
      eyebrow: "Operative Stärke",
      title: "Fahrzeuge, Teams und Führung aus einer Hand.",
      text: "Mit mehr als 180 Transportern und 25 LKW stellen wir die Kapazität, die Transport-, Express- und Last-Mile-Projekte brauchen – geplant, disponiert und geführt von eigenen Teams.",
    },
    {
      id: "verantwortung",
      media: "photo-dispatch" as MediaKey,
      eyebrow: "Verantwortung",
      title: "Klare Zuständigkeit. Messbare Qualität.",
      text: "Wir steuern unsere Leistung anhand klarer Kennzahlen, behandeln Abweichungen offen und leiten konkrete Maßnahmen ab. So entsteht Logistik, die messbar funktioniert.",
    },
  ],
  principles: [
    { id: "verlaesslich", title: "Verlässlich", text: "Zusagen gelten – im Betrieb wie gegenüber unseren Teams." },
    { id: "klar", title: "Klar", text: "Eindeutige Zuständigkeiten und kurze Wege." },
    { id: "messbar", title: "Messbar", text: "Qualität wird ausgewertet, nicht angenommen." },
    { id: "menschlich", title: "Menschlich", text: "Logistik wird von Menschen gemacht. Das vergessen wir nicht." },
  ],
};

/**
 * Company timeline. Only 2019 (founding) and today are confirmed. Add further
 * milestones as `published: false` drafts and publish them once verified.
 */
export const timeline: TimelineEntry[] = [
  { id: "gruendung", year: 2019, title: "Gründung", text: "Gründung der JARBOU Logistik GmbH.", published: true },
  {
    id: "heute",
    year: null,
    title: "Heute",
    text: "Über 160 Mitarbeitende, mehr als 180 Transporter und 25 LKW – im Einsatz in mehreren Regionen Deutschlands.",
    published: true,
  },
];
