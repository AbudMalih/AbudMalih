import type { Partner } from "./types";

/**
 * Partner / customer logos.
 *
 * A logo is only rendered when `publicUseApproved` is `true` AND a `logo`
 * file exists. Obtain written permission before enabling any entry.
 * The partner section is hidden entirely when no entry is approved.
 */
export const partners: Partner[] = [
  {
    id: "dhl-express",
    name: "DHL Express",
    logo: null,
    publicUseApproved: false,
    relationship: "Operative Zustellprojekte, u. a. in Hannover und Kassel",
  },
];

export const visiblePartners = partners.filter((p) => p.publicUseApproved && p.logo);
