/**
 * Luna Trading ecosystem. The visualization is fully data-driven:
 * add a capability or an owned brand here and the instrument re-lays itself out.
 */
export type Capability = { id: string; label: string; short: string };
export type OwnedBrand = {
  id: string;
  name: string;
  /** Path to the official logo asset (unaltered). */
  logo: string;
  logoRatio: number;
  href: string;
};

export const CAPABILITIES: Capability[] = [
  { id: "sourcing", label: "Global sourcing", short: "SRC" },
  { id: "trade", label: "Import & export", short: "I/E" },
  { id: "product", label: "Product development", short: "PRD" },
  { id: "brand", label: "Brand development", short: "BRD" },
  { id: "ecommerce", label: "E-commerce", short: "ECM" },
  { id: "distribution", label: "Distribution", short: "DST" },
];

export const OWNED_BRANDS: OwnedBrand[] = [
  {
    id: "luviscent",
    name: "LUVISCENT®",
    logo: "/brand/luviscent-logo.png",
    logoRatio: 1537 / 173,
    href: "/brands#luviscent",
  },
];

/** The value chain told in chapter 05. */
export const CHAIN = [
  { id: "sourcing", label: "Sourcing", line: "Identifying the manufacturers and materials a product truly needs." },
  { id: "development", label: "Product development", line: "Refining specification, materials and packaging before production." },
  { id: "import", label: "Import", line: "Coordinating freight, customs and documentation into the European Union." },
  { id: "compliance", label: "Compliance", line: "Aligning every product with the requirements of the European market." },
  { id: "positioning", label: "Positioning", line: "Deciding where a product belongs — its audience, its price, its story." },
  { id: "ecommerce", label: "E-commerce", line: "Opening direct digital channels to the customer." },
  { id: "distribution", label: "Distribution", line: "Placing products into retail, B2B and consumer markets." },
];
