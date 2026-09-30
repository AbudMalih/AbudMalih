import { company } from "@/content/company";
import { site } from "@/content/site";

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: company.legalName,
    url: site.url,
    logo: `${site.url}/brand/jarbou-logo.svg`,
    foundingDate: String(company.founded),
    numberOfEmployees: { "@type": "QuantitativeValue", minValue: company.employees },
    email: company.email.careers,
    slogan: company.claim,
  };
}

/** Serialise JSON-LD safely for inline <script>. */
export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

const EMPLOYMENT: Record<import("@/content/types").EmploymentType, string> = {
  Vollzeit: "FULL_TIME",
  Teilzeit: "PART_TIME",
  Minijob: "PART_TIME",
  Aushilfe: "TEMPORARY",
};

const list = (title: string, items: string[]) => (items.length ? `<p><strong>${title}</strong></p><ul>${items.map((i) => `<li>${i}</li>`).join("")}</ul>` : "");

/** Google JobPosting. Salary is omitted unless approved (job.salary). */
export function jobPostingJsonLd(job: import("@/content/types").Job) {
  return {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    description: [
      `<p>${job.description}</p>`,
      list("Aufgaben", job.responsibilities),
      list("Anforderungen", job.requirements),
      list("Von Vorteil", job.niceToHave),
      list("Das bieten wir", job.benefits),
    ].join(""),
    identifier: { "@type": "PropertyValue", name: company.legalName, value: job.slug },
    datePosted: job.datePosted,
    ...(job.validThrough ? { validThrough: `${job.validThrough}T23:59:59+01:00` } : {}),
    employmentType: EMPLOYMENT[job.employmentType],
    hiringOrganization: { "@type": "Organization", name: company.legalName, sameAs: site.url, logo: `${site.url}/brand/jarbou-logo.svg` },
    jobLocation: {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressLocality: job.address.locality,
        addressRegion: job.address.region,
        addressCountry: "DE",
        ...(job.address.postalCode ? { postalCode: job.address.postalCode } : {}),
        ...(job.address.street ? { streetAddress: job.address.street } : {}),
      },
    },
    directApply: true,
    ...(job.salary ? { baseSalary: job.salary } : {}),
  };
}

export function faqJsonLd(faqs: import("@/content/types").Faq[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.answer } })),
  };
}
