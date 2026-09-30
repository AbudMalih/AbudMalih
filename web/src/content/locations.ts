import type { Location, LocationType } from "./types";

/**
 * Operational geography.
 *
 * Confirmed list of JARBOU locations. The exact classification of most sites
 * (logistics site, project site, operational area, office) has not been
 * confirmed yet, so `type` stays `null` and the UI shows the neutral label
 * "Standort". Edit `type` once JARBOU confirms it.
 *
 * Coordinates are city centres for map placement only – they are not
 * addresses and must not be presented as such.
 */
export const locations: Location[] = [
  { id: "bremen", name: "Bremen", state: "Bremen", lat: 53.0793, lng: 8.8017, type: null, projectNote: null, published: true },
  { id: "hannover", name: "Hannover", state: "Niedersachsen", lat: 52.3759, lng: 9.732, type: "project", projectNote: "DHL Express", published: true },
  { id: "magdeburg", name: "Magdeburg", state: "Sachsen-Anhalt", lat: 52.1205, lng: 11.6276, type: null, projectNote: null, published: true },
  { id: "kassel", name: "Kassel", state: "Hessen", lat: 51.3127, lng: 9.4797, type: "project", projectNote: "DHL Express", published: true },
  { id: "haiger", name: "Haiger", state: "Hessen", lat: 50.7426, lng: 8.2066, type: null, projectNote: null, published: true },
  { id: "erfurt", name: "Erfurt", state: "Thüringen", lat: 50.9848, lng: 11.0299, type: null, projectNote: null, published: true },
  { id: "suhl", name: "Suhl", state: "Thüringen", lat: 50.6098, lng: 10.6928, type: null, projectNote: null, published: true },
  { id: "zwickau", name: "Zwickau", state: "Sachsen", lat: 50.7189, lng: 12.4964, type: null, projectNote: null, published: true },
];

export const locationTypeLabel: Record<LocationType, string> = {
  office: "Büro",
  warehouse: "Lager",
  logistics_site: "Logistikstandort",
  project: "Projektstandort",
  operational_area: "Einsatzgebiet",
  recruiting_location: "Recruiting-Standort",
};

export function labelFor(location: Location): string {
  return location.type ? locationTypeLabel[location.type] : "Standort";
}

export const publishedLocations = locations.filter((l) => l.published);
