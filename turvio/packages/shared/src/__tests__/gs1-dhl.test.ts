import { describe, expect, it } from "vitest";
import { classifyTracking, normalizeTrackingNumber, parseGs1 } from "../capture";

const GS = "\u001d";

describe("GS1 element strings", () => {
  it("parses the human-readable and the raw form", () => {
    expect([...parseGs1("(00)340434161234567890(421)27630161")!]).toEqual([["00", "340434161234567890"], ["421", "27630161"]]);
    expect([...parseGs1(`00340434161234567890421${"27630161"}`)!]).toEqual([["00", "340434161234567890"], ["421", "27630161"]]);
    expect([...parseGs1(`4211234${GS}00340434161234567890`)!]).toEqual([["421", "1234"], ["00", "340434161234567890"]]);
    expect(parseGs1("HELLO")).toBeNull();
  });
});

describe("parcel numbers from labels (DHL and GS1)", () => {
  it("GS1-128 with routing code: the SSCC, never the glued string", () => {
    expect(normalizeTrackingNumber(`]C100340434161234567890${GS}42127630161`)).toBe("340434161234567890");
    expect(normalizeTrackingNumber("(00)340434161234567890(421)27630161")).toBe("340434161234567890");
    expect(normalizeTrackingNumber(`00340434161234567890${GS}42127630161`)).toBe("340434161234567890");
  });
  it("GS1 DataMatrix with a consignment number (401)", () => {
    expect(normalizeTrackingNumber(`]d24016045678${GS}42127630161`)).toBe("6045678");
    expect(normalizeTrackingNumber(`]d2401JJD000390007788123456${GS}421276`)).toBe("JJD000390007788123456");
  });
  it("structured 2D content (DHL DataMatrix style): the embedded parcel number", () => {
    expect(normalizeTrackingNumber("DEUPA|1|JJD000390007788123456|30161|HANNOVER|V01")).toBe("JJD000390007788123456");
    expect(normalizeTrackingNumber("ROUTE 30161 00340434161234567890 X")).toBe("340434161234567890");
    expect(normalizeTrackingNumber("PRIO;RR123456785DE;30161")).toBe("RR123456785DE");
    // Several fields without any known parcel number: not a parcel identifier.
    expect(normalizeTrackingNumber("ABC|30161|HANNOVER")).toBeNull();
  });
  it("plain codes are unchanged", () => {
    expect(normalizeTrackingNumber("JJD000390007788123456")).toBe("JJD000390007788123456");
    expect(normalizeTrackingNumber("00340434161234567890")).toBe("340434161234567890");
    expect(normalizeTrackingNumber(" tvo 1234 5678 90 ")).toBe("TVO1234567890");
    expect(normalizeTrackingNumber("JJD 0003 9000 7788 1234 56")).toBe("JJD000390007788123456");
  });
  it("a DHL Paket SSCC is classified as DHL (as normalised, without the 00 identifier)", () => {
    expect(classifyTracking(normalizeTrackingNumber("00340434161234567890")!)).toEqual({ carrier: "dhl", confidence: "high" });
  });
});
