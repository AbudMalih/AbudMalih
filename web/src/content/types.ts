/**
 * Typed content model.
 *
 * Every piece of editorial content lives in /src/content and is described by
 * these types. The shapes are deliberately CMS-agnostic so a headless CMS
 * (e.g. Sanity, Storyblok, Payload) can later replace the static modules
 * without touching the components.
 *
 * Rule: nothing is published as fact unless `verified: true` (where present).
 * Unknown values are `null` and are hidden by the UI – never invented.
 */

export type Stat = {
  id: string;
  /** Numeric value used for the count-up animation. */
  value: number;
  /** Suffix rendered after the number, e.g. "+". */
  suffix?: string;
  label: string;
  /** Disable count-up for values like years, where counting is meaningless. */
  animate: boolean;
};

export type LocationType =
  | "office"
  | "warehouse"
  | "logistics_site"
  | "project"
  | "operational_area"
  | "recruiting_location";

export type Location = {
  id: string;
  name: string;
  /** Bundesland, for grouping. */
  state: string;
  /** WGS84 coordinates of the city centre (not an address). */
  lat: number;
  lng: number;
  /**
   * Classification. `null` = not yet confirmed by JARBOU – the UI then shows
   * the neutral label "Standort" and never claims office/warehouse status.
   */
  type: LocationType | null;
  /** Optional, only when confirmed (e.g. "DHL Express"). */
  projectNote: string | null;
  /** Controls public visibility. */
  published: boolean;
};

export type Service = {
  id: string;
  index: string;
  title: string;
  lead: string;
  points: string[];
  /** Key into the media registry. */
  media: MediaKey;
};

export type ProcessStep = {
  id: string;
  index: string;
  title: string;
  text: string;
};

export type MediaKey =
  | "service-disposition"
  | "service-routes"
  | "service-delivery"
  | "service-quality"
  | "service-fleet"
  | "service-operations";

export type MediaItem = {
  /** Path in /public or remote URL. `null` = no approved photograph yet. */
  src: string | null;
  alt: string;
  width?: number;
  height?: number;
  /**
   * `true` while the slot shows the built-in schematic illustration instead
   * of an approved JARBOU photograph. Replace by setting `src`.
   */
  placeholder: boolean;
};

export type Partner = {
  id: string;
  name: string;
  logo: string | null;
  /** Only render when JARBOU has written permission to show the logo. */
  publicUseApproved: boolean;
  /** Short, factual description of the relationship – no endorsement claims. */
  relationship: string | null;
};

export type EmploymentType = "Vollzeit" | "Teilzeit" | "Minijob" | "Aushilfe";

export type Job = {
  slug: string;
  title: string;
  location: string;
  department: string;
  employmentType: EmploymentType;
  /** ISO date or null when "ab sofort" / not specified. */
  startDate: string | null;
  summary: string;
  description: string;
  responsibilities: string[];
  requirements: string[];
  niceToHave: string[];
  benefits: string[];
  /** Only publish when approved. */
  salary: string | null;
  status: "draft" | "published" | "archived";
  /** ISO date when published. */
  datePosted: string | null;
  /** ISO date after which the posting is hidden. */
  validThrough: string | null;
  featured: boolean;
  applicationQuestions: string[];
};
