/**
 * Site-wide facts. Only verified facts live here. Anything not yet supplied
 * by Luna Trading is `null` and is NOT rendered. Never replace a null with
 * invented data. Translatable copy lives in content/i18n.
 */
/**
 * Verified official contact address for the website (Kontakt page and the
 * server-side recipient of inquiries). Kept separate from COMPANY.email,
 * which the approved footer and Impressum render once it is set: switching
 * those on is a decision for the legal / launch phase.
 */
export const CONTACT_EMAIL = "info@luna-trading.de";

export const COMPANY = {
  legalName: "Luna Trading GmbH",
  city: "Köln",
  countryCode: "DE",
  /** Geographic coordinates of Cologne (city centre): the route terminus. */
  coordinates: { lat: 50.9375, lon: 6.9603 },
  // To be supplied by the client. Intentionally empty:
  email: null as string | null,
  phone: null as string | null,
  street: null as string | null,
  postalCode: null as string | null,
  register: null as string | null,
  vatId: null as string | null,
  managingDirectors: null as string | null,
};

/** Navigation structure (labels: dictionary `nav` / `legal`). */
export const NAV = [
  { href: "/", key: "home" },
  { href: "/what-we-do", key: "whatWeDo" },
  { href: "/brands", key: "brands" },
  { href: "/company", key: "company" },
  { href: "/contact", key: "contact" },
] as const;

export const LEGAL_NAV = [
  { href: "/impressum", key: "impressum" },
  { href: "/datenschutz", key: "datenschutz" },
] as const;

export const BRANDS = {
  luviscent: {
    name: "LUVISCENT",
    mark: "®",
    /** Brand claim: German in every language (it is part of the brand). */
    claim: "Eleganz liegt in der Luft.",
    /** External brand site: set when live. Falls back to the internal brand page. */
    url: null as string | null,
    internal: "/brands#luviscent",
  },
};
