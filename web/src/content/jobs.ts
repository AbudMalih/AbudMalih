import type { Job } from "./types";

/**
 * Job postings.
 *
 * Only real, confirmed vacancies are entered here. Possible recruiting
 * locations (Bremen, Kassel, Haiger, Erfurt, Suhl, Zwickau, Magdeburg) are
 * NOT vacancies – add a posting only when a position is actually open.
 *
 * A job is public when `status === "published"` and `validThrough` has not
 * passed.
 */
export const jobs: Job[] = [
  {
    slug: "fahrer-dhl-express-hannover",
    title: "Fahrer (m/w/d) – DHL Express",
    location: "Hannover",
    department: "Zustellung",
    employmentType: "Vollzeit",
    startDate: "2026-11-01",
    summary: "Zustellung im DHL-Express-Projekt am Standort Hannover.",
    description:
      "Für unser DHL-Express-Projekt in Hannover suchen wir zuverlässige Fahrerinnen und Fahrer, die Sendungen pünktlich und sorgfältig zustellen.",
    responsibilities: [
      "Zustellung und Abholung von Express-Sendungen im zugewiesenen Tourgebiet",
      "Fahrzeugcheck vor Tourbeginn",
      "Freundlicher, professioneller Kontakt mit Empfängern",
    ],
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
      "Firmenfahrzeug nach betrieblicher Absprache auch für den Arbeitsweg nutzbar",
    ],
    salary: null,
    status: "published",
    datePosted: "2026-09-30",
    validThrough: null,
    featured: true,
    applicationQuestions: ["Besitzen Sie einen Führerschein Klasse B?", "Haben Sie Erfahrung in KEP / Express / Zustellung?"],
  },
  {
    slug: "disponent-operations-coordinator-hannover",
    title: "Disponent / Operations Coordinator (m/w/d)",
    location: "Hannover",
    department: "Disposition",
    employmentType: "Vollzeit",
    startDate: null,
    summary: "Koordination von Fahrern, Touren und Fahrzeugen im täglichen Betrieb.",
    description:
      "Sie steuern den täglichen operativen Betrieb in Hannover und sorgen dafür, dass Fahrer, Touren und Fahrzeuge zuverlässig zusammenspielen.",
    responsibilities: [
      "Fahrerkoordination",
      "Tourenkoordination",
      "Fahrzeugkoordination",
      "Steuerung des täglichen operativen Betriebs",
      "Unterstützung beim Teamaufbau",
      "Überwachung operativer Abläufe",
      "Kommunikation mit dem Management",
    ],
    requirements: ["Organisationsstärke und Verantwortungsbewusstsein", "Klare Kommunikation"],
    niceToHave: ["Erfahrung in KEP, Express oder Last Mile"],
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
  return jobs.filter(
    (j) => j.status === "published" && (!j.validThrough || new Date(j.validThrough) >= now),
  );
}

export function formatStartDate(iso: string | null): string {
  if (!iso) return "Nach Vereinbarung";
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}
