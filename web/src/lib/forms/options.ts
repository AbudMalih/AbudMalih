import { company } from "@/content/company";
import { getPublishedJobs } from "@/content/jobs";
import { publishedLocations } from "@/content/locations";

/** Select options for application forms, derived from the content layer. */
export function applicationOptions() {
  return {
    positions: [
      ...getPublishedJobs().map((j) => ({ value: j.slug, label: `${j.title} · ${j.location}` })),
      { value: "Initiativbewerbung", label: "Keine passende Stelle – Initiativbewerbung" },
    ],
    locations: [...publishedLocations.map((l) => ({ value: l.name, label: l.name })), { value: "Flexibel", label: "Flexibel / mehrere Standorte" }],
    careersEmail: company.email.careers,
  };
}
