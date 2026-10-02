/**
 * Site-wide content. Only verified facts live here.
 * Anything not yet supplied by Luna Trading is `null` and is NOT rendered —
 * never replace a null with invented data.
 */
export const COMPANY = {
  legalName: "Luna Trading GmbH",
  city: "Köln",
  cityEn: "Cologne",
  country: "Germany",
  countryCode: "DE",
  /** Geographic coordinates of Cologne (city centre) — used as the route terminus. */
  coordinates: { lat: 50.9375, lon: 6.9603 },
  // To be supplied by the client — intentionally empty:
  email: null as string | null,
  phone: null as string | null,
  street: null as string | null,
  postalCode: null as string | null,
  register: null as string | null,
  vatId: null as string | null,
  managingDirectors: null as string | null,
};

export const NAV = [
  { href: "/", label: "Home" },
  { href: "/what-we-do", label: "What we do" },
  { href: "/brands", label: "Brands" },
  { href: "/company", label: "Company" },
  { href: "/contact", label: "Contact" },
] as const;

export const LEGAL_NAV = [
  { href: "/impressum", label: "Impressum" },
  { href: "/datenschutz", label: "Datenschutz" },
] as const;

export const BRANDS = {
  luviscent: {
    name: "LUVISCENT",
    mark: "®",
    claim: "Eleganz liegt in der Luft.",
    category: "Home fragrance",
    /** External brand site — set when live. Falls back to the internal brand page. */
    url: null as string | null,
    internal: "/brands#luviscent",
  },
};
