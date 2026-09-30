import type { Stat } from "./types";

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
