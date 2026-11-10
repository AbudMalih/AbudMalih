import { describe, expect, it } from "vitest";
import {
  DEFAULT_LOCATION_THRESHOLDS as T,
  coordinateIssues,
  duplicateCoordinates,
  evaluateStopLocation,
  sameStreet,
  type Evidence,
  type RoadSnapEvidence,
  type StopLocationInput,
} from "../location/checks";

const HAN = { lat: 52.3745, lng: 9.7384 };
const done = <V>(value: V): Evidence<V> => ({ state: "done", value });
const road = (extra: Partial<RoadSnapEvidence> = {}): Evidence<RoadSnapEvidence> => done({ distanceMeters: 16, roadName: "Lister Meile", roadRef: "", classes: [], snapped: HAN, ...extra });
const input = (extra: Partial<StopLocationInput> = {}): StopLocationInput => ({
  stopId: "s1",
  location: HAN,
  street: "Lister Meile",
  countryCode: "DE",
  road: road(),
  reach: done({ fromOrigin: true, toOrigin: true }),
  address: done({ precision: "house", location: HAN }),
  ...extra,
});
const codes = (c: ReturnType<typeof evaluateStopLocation>) => c.issues.map((i) => `${i.severity}:${i.code}`);

describe("thresholds (as approved)", () => {
  it("150 m warning, 250 m address mismatch, 1,000 m coverage", () => {
    expect(T).toMatchObject({ farFromRoadMeters: 150, addressMismatchMeters: 250, coverageMeters: 1000 });
  });
  it("are configurable", () => {
    const c = evaluateStopLocation(input({ road: road({ distanceMeters: 120 }) }), { ...T, farFromRoadMeters: 100 });
    expect(codes(c)).toContain("warning:far_from_road");
  });
});

describe("a normal house address", () => {
  it("has no issues and is checked", () => {
    const c = evaluateStopLocation(input());
    expect(c).toMatchObject({ status: "checked", severity: null, issues: [] });
  });
});

describe("road distance", () => {
  it("149 m: nothing, 151 m: warning, 999 m: warning, 1,001 m: error out of coverage", () => {
    const at = (d: number) => codes(evaluateStopLocation(input({ road: road({ distanceMeters: d, roadName: "Lister Meile" }) })));
    expect(at(149)).toEqual([]);
    expect(at(151)).toEqual(["warning:far_from_road"]);
    expect(at(999)).toEqual(["warning:far_from_road"]);
    expect(at(1001)).toEqual(["error:out_of_coverage"]);
  });
});

describe("legitimate deliveries are never errors", () => {
  it("pedestrian zone: nearest car road has another name 115 m away → information only", () => {
    const c = evaluateStopLocation(input({ street: "Bahnhofstraße", road: road({ distanceMeters: 115, roadName: "Ständehausstraße" }) }));
    expect(codes(c)).toEqual(["info:different_access_road"]);
    expect(c.severity).toBe("info");
  });
  it("road-name mismatch alone (close to the road) is not even information", () => {
    expect(codes(evaluateStopLocation(input({ street: "Edenstraße", road: road({ distanceMeters: 20, roadName: "Drostestraße" }) })))).toEqual([]);
  });
  it("restricted access (residents / delivery only) → information only", () => {
    expect(codes(evaluateStopLocation(input({ road: road({ classes: ["restricted"] }) })))).toEqual(["info:restricted_access"]);
  });
  it("motorway with a normal road nearby → warning with a suggestion, coordinate unchanged", () => {
    const alt = { location: { lat: 52.427723, lng: 9.74229 }, roadName: "Klusriede", distanceMeters: 49 };
    const loc = { lat: 52.427361, lng: 9.741878 };
    const c = evaluateStopLocation(input({ location: loc, street: "Klusriede", road: road({ distanceMeters: 0, roadName: "", roadRef: "A 2", classes: ["motorway"], nonMotorway: alt }), address: done(null) }));
    const mw = c.issues.find((i) => i.code === "motorway")!;
    expect(mw.severity).toBe("warning");
    expect(mw.suggestion).toEqual({ kind: "approach", location: alt.location, roadName: "Klusriede", distanceMeters: 49 });
    expect(mw.message).toMatch(/service-area delivery/);
    expect(c.severity).toBe("warning");
    expect(c.issues.some((i) => i.severity === "error")).toBe(false);
  });
  it("motorway service area without a normal road within 250 m → still only a warning, no suggestion", () => {
    const c = evaluateStopLocation(input({ road: road({ classes: ["motorway"], roadRef: "A 7", nonMotorway: { location: HAN, roadName: "x", distanceMeters: 400 } }) }));
    const mw = c.issues.find((i) => i.code === "motorway")!;
    expect(mw.severity).toBe("warning");
    expect(mw.suggestion).toBeUndefined();
  });
});

describe("address cross-check (own OSM address data)", () => {
  it("249 m from the house: nothing; 251 m: warning", () => {
    const off = (m: number) => ({ lat: HAN.lat + m / 111_320, lng: HAN.lng });
    expect(codes(evaluateStopLocation(input({ address: done({ precision: "house", location: off(249) }) })))).toEqual([]);
    expect(codes(evaluateStopLocation(input({ address: done({ precision: "house", location: off(251) }) })))).toEqual(["warning:address_mismatch"]);
  });
  it("placed at the street centre because the house number is unknown → approximate-location warning", () => {
    expect(codes(evaluateStopLocation(input({ address: done({ precision: "street", location: HAN }) })))).toEqual(["warning:approximate_location"]);
  });
  it("street-level lookup but the stop has its own coordinate → no warning (cannot judge)", () => {
    expect(codes(evaluateStopLocation(input({ address: done({ precision: "street", location: { lat: HAN.lat + 0.003, lng: HAN.lng } }) })))).toEqual([]);
  });
  it("address not in the map data → information, not a problem", () => {
    expect(codes(evaluateStopLocation(input({ address: done(null) })))).toEqual(["info:address_not_in_map_data"]);
  });
});

describe("hard errors", () => {
  it("0,0 and invalid coordinates", () => {
    expect(coordinateIssues({ lat: 0, lng: 0 })[0]!.code).toBe("coordinates_invalid");
    expect(coordinateIssues({ lat: 95, lng: 9 })[0]!.code).toBe("coordinates_invalid");
    expect(coordinateIssues({ lat: Number.NaN, lng: 9 })[0]!.code).toBe("coordinates_invalid");
  });
  it("German address outside Germany; swapped latitude/longitude named", () => {
    const swapped = coordinateIssues({ lat: 9.7384, lng: 52.3745 }, "DE")[0]!;
    expect(swapped).toMatchObject({ code: "outside_country", severity: "error", details: { swapped: true } });
    expect(coordinateIssues({ lat: 48.8566, lng: 2.3522 }, "DE")[0]!.details).toEqual({ swapped: false }); // Paris
    expect(coordinateIssues({ lat: 48.8566, lng: 2.3522 }, "FR")).toEqual([]);
    expect(coordinateIssues({ lat: 47.6, lng: 7.6 }, "DE")).toEqual([]); // Lörrach, border region
  });
  it("a coordinate error is final; no road/address result can hide it", () => {
    const c = evaluateStopLocation(input({ location: { lat: 0, lng: 0 }, road: { state: "pending" } }));
    expect(c).toMatchObject({ status: "checked", severity: "error" });
    expect(codes(c)).toEqual(["error:coordinates_invalid"]);
  });
  it("no road connection to or from the tour start", () => {
    expect(codes(evaluateStopLocation(input({ reach: done({ fromOrigin: false, toOrigin: true }) })))).toEqual(["error:unreachable"]);
    // Out of coverage already explains it: not reported twice.
    expect(codes(evaluateStopLocation(input({ road: road({ distanceMeters: 5000 }), reach: done({ fromOrigin: false, toOrigin: false }) })))).toEqual(["error:out_of_coverage"]);
  });
});

describe("pending and unavailable checks are never reported as validated", () => {
  it("pending road check: status pending, no verdict", () => {
    const c = evaluateStopLocation(input({ road: { state: "pending" } }));
    expect(c.status).toBe("pending");
    expect(c.severity).toBeNull();
    expect(c.checks.road).toBe("pending");
  });
  it("pending but an error is already known: the error is reported, status stays pending", () => {
    const c = evaluateStopLocation(input({ road: road({ distanceMeters: 5000 }), address: { state: "pending" } }));
    expect(c).toMatchObject({ status: "pending", severity: "error" });
  });
  it("no routing configured: partial with the reason, never 'checked'", () => {
    const c = evaluateStopLocation(input({ road: { state: "unavailable", reason: "no road routing configured" }, reach: { state: "unavailable", reason: "no road routing configured" } }));
    expect(c.status).toBe("partial");
    expect(c.unavailable).toContain("no road routing configured");
  });
  it("no coordinate: no_location", () => {
    expect(evaluateStopLocation(input({ location: null })).status).toBe("no_location");
  });
});

describe("duplicates and helpers", () => {
  it("same coordinate, different address → both flagged; same address → not", () => {
    const d = duplicateCoordinates([
      { id: "a", location: HAN, addressKey: "lister meile|1" },
      { id: "b", location: HAN, addressKey: "lister meile|3" },
      { id: "c", location: HAN, addressKey: "lister meile|1" },
      { id: "d", location: { lat: 52.38, lng: 9.74 }, addressKey: "x" },
    ]);
    expect(d.get("a")).toEqual(["b"]);
    expect(d.get("b")).toEqual(["a", "c"]);
    expect(d.has("d")).toBe(false);
    expect(codes(evaluateStopLocation(input({ duplicateOf: ["b"] })))).toEqual(["warning:duplicate_coordinates"]);
  });
  it("street names compare across spellings", () => {
    expect(sameStreet("Herrenhäuser Straße", "Herrenhäuser Str.")).toBe(true);
    expect(sameStreet("Göttinger Chaussee", "goettinger chaussee")).toBe(false); // ö vs oe: different words to OSM too
    expect(sameStreet("Georgstraße", "Georgstr")).toBe(true);
    expect(sameStreet("Lister Meile", "")).toBe(false);
  });
  it("issues are ordered by severity", () => {
    const c = evaluateStopLocation(input({ road: road({ distanceMeters: 300, roadName: "Andere Straße", classes: ["restricted"] }) }));
    expect(c.issues.map((i) => i.severity)).toEqual(["warning", "info", "info"]);
  });
});
