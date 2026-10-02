/**
 * Luna Trading ecosystem: structure only. Labels live in content/i18n.
 * The instrument is data-driven: add a capability or an owned brand here
 * (plus its label in each dictionary) and it re-lays itself out.
 */
import type { CapabilityId, StepId } from "./i18n/types";

export type OwnedBrand = {
  id: string;
  name: string;
  /** Path to the official logo asset (unaltered). */
  logo: string;
  logoRatio: number;
  /** Locale-neutral path; prefixed per locale at render time. */
  href: string;
};

export const CAPABILITIES: CapabilityId[] = ["sourcing", "trade", "product", "brand", "ecommerce", "distribution"];

export const OWNED_BRANDS: OwnedBrand[] = [
  { id: "luviscent", name: "LUVISCENT®", logo: "/brand/luviscent-logo.png", logoRatio: 1537 / 173, href: "/brands#luviscent" },
];

/** The operating model told in chapter 05: SOURCE → IMPORT → DEVELOP → BRAND → E-COMMERCE → DISTRIBUTE */
export const CHAIN: StepId[] = ["sourcing", "import", "development", "brand", "ecommerce", "distribution"];
/** Index of the step that opens the digital-commerce moment. */
export const COMMERCE_STEP = CHAIN.indexOf("ecommerce");
