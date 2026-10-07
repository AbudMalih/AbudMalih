import type { ChapterId } from "../chapters";
import type { ServicesCopy } from "./services/types";
import type { BrandsCopy } from "./brands/types";
import type { CompanyCopy } from "./company/types";
import type { ContactCopy } from "./contact/types";

export type CapabilityId = "sourcing" | "trade" | "product" | "brand" | "ecommerce" | "distribution";
export type StepId = "sourcing" | "import" | "development" | "brand" | "ecommerce" | "distribution";

export type Dictionary = {
  meta: { title: string; description: string; ogDescription: string; titleTemplate: string };
  a11y: {
    skip: string;
    home: string;
    menu: string;
    close: string;
    siteMenu: string;
    primaryNav: string;
    footerNav: string;
    chapters: string;
    goTo: string;
    language: string;
    scroll: string;
  };
  nav: { home: string; whatWeDo: string; brands: string; company: string; contact: string; cta: string };
  legal: { impressum: string; datenschutz: string };
  company: { place: string; city: string };
  chapters: Record<ChapterId, string>;
  hero: { lines: [string, string, string]; route: string; routeSpan: string; index: string[] };
  source: { tag: string; l1: string; l2: string; supporting: string[] };
  transport: { tag: string; l1: string; l2: string; leadStrong: string; lead: string };
  warehouse: { tag: string; l1: string; l2: string; labels: { germany: string; eu: string; ecommerce: string; b2b: string } };
  brands: { a1: string; a2: string; b1: string; b2: string };
  chain: {
    tag: string;
    h1: string;
    h2: string;
    steps: Record<StepId, { label: string; line: string }>;
  };
  commerce: {
    tag: string;
    h1: string;
    h2: string;
    secondary: string;
    body: string;
    origin: string;
    platform: string;
    /** neutral caption for the platform layer: never partner/endorsement wording */
    channels: string;
    groups: { store: string; marketplace: string };
    /** final endpoints: customers / markets */
    destinations: [string, string];
    owned: string;
  };
  luviscent: { owner: string; category: string; body: string; cta: string; allBrands: string };
  ecosystem: {
    tag: string;
    h1: string;
    h2: string;
    capabilities: Record<CapabilityId, string>;
    caption: string;
    ownedBrands: string;
    center: string;
    legend: { origin: string; capability: string; brand: string };
    title: string;
    desc: string;
  };
  closing: { lines: [string, string, string, string]; cta: string; sign: string };
  footer: { statement: string; company: string; navigate: string; owned: string; legal: string };
  pages: {
    back: string;
    prep: string;
    whatWeDo: { eyebrow: string; t1: string; t2: string; lead: string };
    brands: { eyebrow: string; t1: string; t2: string; lead: string };
    company: { eyebrow: string; t1: string; t2: string; lead: string; items: string[] };
    contact: { eyebrow: string; t1: string; t2: string; pending: string };
    notFound: { eyebrow: string; lead: string; home: string; t1: string; t2: string };
    error: { title: string; lead: string; retry: string };
    legalEyebrow: string;
    legalNote: { impressum: string; datenschutz: string };
  };
  services: ServicesCopy;
  brandsPage: BrandsCopy;
  companyPage: CompanyCopy;
  contactPage: ContactCopy;
};
