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
