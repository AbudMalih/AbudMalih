import type { EmploymentType, Job, PositionCategory } from "./types";

/**
 * Job postings.
 *
 * Only real, confirmed vacancies are entered here. Possible recruiting
 * locations (Bremen, Köln, Kassel, Haiger, Erfurt, Suhl, Zwickau, Magdeburg)
 * are NOT vacancies – add a posting only when a position is actually open.
 *
 * A job is public when `status === "published"` and `validThrough` (if set)
 * has not passed. Empty lists are hidden on the job page – never fill them
 * with assumptions.
 */
export const jobs: Job[] = [
  {
    slug: "fahrer-dhl-express-hannover",
    title: "Fahrer (m/w/d) – DHL Express",
    locationId: "hannover",
    location: "Hannover",
    address: { locality: "Hannover", region: "Niedersachsen", postalCode: null, street: null },
    category: "Fahrer",
    department: "Zustellung",
    employmentType: "Vollzeit",
    startDate: "2026-11-01",
    summary: "Zustellung im DHL-Express-Projekt in Hannover.",
    description:
      "Für unser DHL-Express-Projekt in Hannover suchen wir zuverlässige Fahrerinnen und Fahrer, die Sendungen pünktlich und sorgfältig zustellen.",
    responsibilities: ["Zustellung von Sendungen im DHL-Express-Projekt am Standort Hannover"],
    requirements: [
      "Führerschein Klasse B",
      "Zuverlässigkeit",
      "Pünktlichkeit",
      "Freundliches und gepflegtes Auftreten",
      "Einwandfreies Führungszeugnis",
    ],
    niceToHave: ["Erfahrung in KEP, Express oder Zustellung"],
    benefits: [
      "Modernes Firmenfahrzeug",
      "Diensthandy und Navigation",
      "Arbeitskleidung",
      "Strukturierte Einarbeitung",
      "Pünktliche Gehaltszahlung",
      "Langfristige Perspektive",
      "Firmenfahrzeug kann nach betrieblicher Absprache für den Arbeitsweg mit nach Hause genommen werden",
    ],
    salary: null,
    status: "published",
    datePosted: "2026-09-30",
    validThrough: null,
    featured: true,
    applicationQuestions: ["Führerschein Klasse B vorhanden?", "Erfahrung in KEP / Express / Zustellung?"],
  },
  {
    slug: "disponent-operations-coordinator-hannover",
    title: "Disponent / Operations Coordinator (m/w/d)",
    locationId: "hannover",
    location: "Hannover",
    address: { locality: "Hannover", region: "Niedersachsen", postalCode: null, street: null },
    category: "Disposition",
    department: "Disposition",
    employmentType: "Vollzeit",
    startDate: null,
    summary: "Koordination von Fahrern, Touren und Fahrzeugen im täglichen Betrieb.",
    description:
      "Sie organisieren den täglichen operativen Betrieb in Hannover und sorgen dafür, dass Fahrer, Touren und Fahrzeuge zuverlässig zusammenspielen.",
    responsibilities: [
      "Fahrerkoordination",
      "Tourenkoordination",
      "Fahrzeugkoordination",
      "Organisation des täglichen Betriebs",
      "Unterstützung beim Teamaufbau",
      "Überwachung operativer Abläufe",
      "Kommunikation mit dem Management",
    ],
    requirements: [],
    niceToHave: ["Erfahrung in KEP", "Erfahrung im Express-Bereich", "Erfahrung auf der Last Mile"],
    benefits: [],
    salary: null,
    status: "published",
    datePosted: "2026-09-30",
    validThrough: null,
    featured: true,
    applicationQuestions: [],
  },
];

export function getPublishedJobs(now: Date = new Date()): Job[] {
  return jobs.filter((j) => j.status === "published" && (!j.validThrough || new Date(j.validThrough) >= now));
}

export function getJob(slug: string): Job | undefined {
  return getPublishedJobs().find((j) => j.slug === slug);
}

export function formatStartDate(iso: string | null): string {
  if (!iso) return "Nach Vereinbarung";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

/** Filter facets derived from the published jobs – never hardcoded. */
export function jobFacets(list: Job[]) {
  const uniq = <T,>(xs: T[]) => Array.from(new Set(xs));
  return {
    locations: uniq(list.map((j) => j.location)).sort(),
    categories: uniq(list.map((j) => j.category)) as PositionCategory[],
    employmentTypes: uniq(list.map((j) => j.employmentType)) as EmploymentType[],
  };
}
