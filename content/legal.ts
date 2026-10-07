import { CONTACT_EMAIL } from "./site";

/**
 * Verified legal entity data (supplied by Luna Trading GmbH).
 * Used ONLY by the Impressum and the Datenschutzerklärung (and, without the
 * managing director, by the Organization structured data). The footer and
 * marketing pages never render the street address or the director's name.
 */
export const LEGAL_ENTITY = {
  name: "Luna Trading GmbH",
  street: "Frankenstraße 4",
  postalCode: "51149",
  city: "Köln",
  country: "Deutschland",
  countryCode: "DE",
  /** Impressum only (§ 5 DDG). Never in marketing copy, metadata or structured data. */
  managingDirector: "Abdul-Arahman Al-Malih",
  registerCourt: "Amtsgericht Köln",
  registerNumber: "HRB 128497",
  vatId: "DE464401923",
  email: CONTACT_EMAIL,
} as const;

/** Review date of the privacy policy (real implementation / review month). */
export const PRIVACY_REVIEWED = "Oktober 2026";
