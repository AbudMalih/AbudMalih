import type { MessageKey } from "../i18n";
import type { LocationIssue } from "./checks";

/**
 * Translated text of a location issue (P0-3.6): from its code and details, in the app's language –
 * never the API's English message, which is only the fallback for unknown codes.
 */
export function locationIssueText(issue: Pick<LocationIssue, "code" | "message" | "details">, t: (key: MessageKey, params?: Record<string, string | number>) => string): string {
  const d = issue.details ?? {};
  const road = (v: unknown) => (typeof v === "string" && v.trim() ? v : t("location.unnamedRoad"));
  const num = (v: unknown) => (typeof v === "number" ? Math.round(v) : 0);
  switch (issue.code) {
    case "coordinates_invalid":
      return t(d.reason === "zero" ? "location.issue.coordinatesZero" : "location.issue.coordinatesInvalid");
    case "outside_country":
      return t(d.swapped ? "location.issue.outsideCountrySwapped" : "location.issue.outsideCountry");
    case "out_of_coverage":
      return t("location.issue.outOfCoverage", { km: (num(d.snapMeters) / 1000).toFixed(1) });
    case "unreachable":
      return t("location.issue.unreachable");
    case "far_from_road":
      return t("location.issue.farFromRoad", { road: road(d.roadName), meters: num(d.snapMeters) });
    case "motorway":
      return d.alternativeMeters != null
        ? t("location.issue.motorwayAlt", { road: road(d.roadRef), alt: road(d.alternativeRoad), meters: num(d.alternativeMeters) })
        : t("location.issue.motorway", { road: road(d.roadRef) });
    case "address_mismatch":
      return t("location.issue.addressMismatch", { meters: num(d.distanceMeters) });
    case "approximate_location":
      return t("location.issue.approximate");
    case "duplicate_coordinates":
      return t("location.issue.duplicate", { n: num(d.count) });
    case "different_access_road":
      return t("location.issue.differentAccess", { road: road(d.roadName), meters: num(d.snapMeters) });
    case "restricted_access":
      return t("location.issue.restricted", { road: road(d.roadName) });
    case "address_not_in_map_data":
      return t("location.issue.notInMapData");
    default:
      return issue.message;
  }
}
