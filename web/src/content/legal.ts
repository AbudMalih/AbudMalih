/**
 * LEGAL CONTENT – Impressum & Datenschutzerklärung.
 *
 * ⚠ To be supplied by JARBOU Logistik GmbH and reviewed by a lawyer.
 * Nothing here may be invented. Empty (`null` / `[]`) fields are simply not
 * rendered; while `approved` is false the pages show a neutral notice and
 * stay `noindex`.
 *
 * MISSING (Impressum): address, managing director(s), register court +
 * number, VAT ID, phone/e-mail, person responsible for content.
 * MISSING (Datenschutz): complete approved text for every section below,
 * including the applicant-data section and the final retention period
 * (must match APPLICANT_RETENTION_DAYS).
 */

export type LegalSection = { id: string; title: string; body: string[] | null };

export const imprint = {
  approved: false,
  company: "JARBOU Logistik GmbH",
  address: null as { street: string; zip: string; city: string } | null,
  managingDirectors: [] as string[],
  phone: null as string | null,
  email: null as string | null,
  register: null as { court: string; number: string } | null,
  vatId: null as string | null,
  contentResponsible: null as { name: string; address: string } | null,
  /** Further approved sections (e.g. consumer dispute resolution). */
  sections: [] as LegalSection[],
};

export const privacyPolicy = {
  approved: false,
  /** ISO date of the approved version. */
  updated: null as string | null,
  sections: [
    { id: "verantwortlicher", title: "Verantwortlicher", body: null },
    { id: "hosting", title: "Hosting und Server-Logfiles", body: null },
    { id: "einwilligung", title: "Cookies und Einwilligungen", body: null },
    { id: "formulare", title: "Kontakt- und Projektanfragen", body: null },
    { id: "bewerbungen", title: "Bewerbungen", body: null },
    { id: "speicherdauer", title: "Speicherdauer und Löschung", body: null },
    { id: "empfaenger", title: "Empfänger und Auftragsverarbeiter", body: null },
    { id: "rechte", title: "Ihre Rechte", body: null },
  ] as LegalSection[],
};
