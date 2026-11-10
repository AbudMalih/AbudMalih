import { describe, expect, it } from "vitest";
import { translate } from "../i18n";
import type { Locale } from "../schemas";
import { coordinateIssues, evaluateStopLocation, type Evidence, type LocationIssue, type RoadSnapEvidence } from "../location/checks";
import { locationIssueText } from "../location/text";

/** P0-3.6: every location issue the rules can produce is worded in every Driver language – no English leftovers, no unfilled placeholders. */
const P = { lat: 52.3745, lng: 9.7384 };
const done = <V>(value: V): Evidence<V> => ({ state: "done", value });
const road = (x: Partial<RoadSnapEvidence>): Evidence<RoadSnapEvidence> => done({ distanceMeters: 16, roadName: "Lister Meile", roadRef: "", classes: [], snapped: P, ...x });
const base = { stopId: "s", location: P, street: "Lister Meile", countryCode: "DE", reach: done({ fromOrigin: true, toOrigin: true }), address: done({ precision: "house" as const, location: P }) };
const issues = (): LocationIssue[] => {
  const all: LocationIssue[] = [
    ...coordinateIssues({ lat: 0, lng: 0 }),
    ...coordinateIssues({ lat: 95, lng: 9 }),
    ...coordinateIssues({ lat: 9.7384, lng: 52.3745 }, "DE"),
    ...coordinateIssues({ lat: 48.85, lng: 2.35 }, "DE"),
  ];
  const ev = (x: Partial<Parameters<typeof evaluateStopLocation>[0]>) => evaluateStopLocation({ ...base, road: road({}), ...x }).issues;
  all.push(...ev({ road: road({ distanceMeters: 5000 }) }));
  all.push(...ev({ reach: done({ fromOrigin: false, toOrigin: true }) }));
  all.push(...ev({ road: road({ distanceMeters: 300, roadName: "" }) }));
  all.push(...ev({ road: road({ classes: ["motorway"], roadRef: "A 2", nonMotorway: { location: P, roadName: "Klusriede", distanceMeters: 49 } }) }));
  all.push(...ev({ road: road({ classes: ["motorway"], roadRef: "A 7", nonMotorway: null }) }));
  all.push(...ev({ address: done({ precision: "house", location: { lat: P.lat + 0.005, lng: P.lng } }) }));
  all.push(...ev({ address: done({ precision: "street", location: P }) }));
  all.push(...ev({ address: done(null) }));
  all.push(...ev({ duplicateOf: ["x", "y"] }));
  all.push(...ev({ road: road({ distanceMeters: 115, roadName: "Ständehausstraße", classes: ["restricted"] }) }));
  return all;
};

describe("location issue texts", () => {
  const codes = new Set(issues().map((i) => i.code));
  it("cover every issue code of the rules", () => {
    expect([...codes].sort()).toEqual(
      ["address_mismatch", "address_not_in_map_data", "approximate_location", "coordinates_invalid", "different_access_road", "duplicate_coordinates", "far_from_road", "motorway", "out_of_coverage", "outside_country", "restricted_access", "unreachable"].sort(),
    );
  });
  for (const locale of ["en", "de", "ro", "ar"] as Locale[]) {
    it(`${locale}: every issue has its own text with all values filled in`, () => {
      const t = (k: Parameters<typeof translate>[1], p?: Record<string, string | number>) => translate(locale, k, p);
      for (const i of issues()) {
        const text = locationIssueText(i, t);
        expect(text, `${locale} ${i.code}`).not.toMatch(/\{[a-z]+\}/);
        expect(text.length, `${locale} ${i.code}`).toBeGreaterThan(10);
        if (locale !== "en") expect(text, `${locale} ${i.code} is not English`).not.toBe(locationIssueText(i, (k, p) => translate("en", k, p)));
      }
    });
  }
  it("fills values: German motorway text names the road, the alternative and its distance", () => {
    const mw = issues().find((i) => i.code === "motorway" && i.details?.alternativeRoad)!;
    expect(locationIssueText(mw, (k, p) => translate("de", k, p))).toBe("Der Standort liegt auf einer Autobahn (A 2). Nächste normale Straße: Klusriede, 49 m – bitte prüfen (richtig bei Lieferung an eine Raststätte).");
    const far = issues().find((i) => i.code === "far_from_road")!;
    expect(locationIssueText(far, (k, p) => translate("ro", k, p))).toBe("Cel mai apropiat drum carosabil (un drum fără nume) este la 300 m – verificați locația.");
  });
});
