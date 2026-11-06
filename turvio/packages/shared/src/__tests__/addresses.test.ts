import { describe, expect, it } from "vitest";
import { classifyTracking, extractAddresses, findDuplicates, looseAddressKey, prepareLines } from "../capture/addresses";
import type { Stop } from "../schemas";

// All names, addresses and numbers are synthetic.
const v = (f: { value: string | null }) => f.value;
const addr = (x: ReturnType<typeof extractAddresses>, i = 0) => {
  const a = x.addresses[i]!;
  return { name: v(a.recipientName), street: v(a.street), no: v(a.houseNumber), plz: v(a.postalCode), city: v(a.city), kind: a.kind, tracking: a.trackingNumbers.map((t) => `${t.carrier}:${t.code}`) };
};

describe("screenshots and plain text", () => {
  it("WhatsApp chat with one address: chat noise and phone number ignored", () => {
    const x = extractAddresses("14:32\nChef Disposition\nHallo Samir, bitte noch heute zustellen:\nMax Mustermann\nBahnhofstraße 12\n98527 Suhl\nTel. 0170 1234567\n14:33 ✓✓");
    expect(x.mode).toBe("text");
    expect(x.addresses).toHaveLength(1);
    expect(addr(x)).toMatchObject({ name: "Max Mustermann", street: "Bahnhofstraße", no: "12", plz: "98527", city: "Suhl", tracking: [] });
  });

  it("WhatsApp chat with several numbered addresses", () => {
    const x = extractAddresses("Tour-Nachtrag:\n1) Anna Krüger\nSteinweg 20\n98527 Suhl\n2) Klaus Richter\nAuenstraße 36\n98529 Suhl\n3. Erika Muster\nHoher Rain 5\n98527 Suhl");
    expect(x.addresses.map((_, i) => addr(x, i))).toEqual([
      expect.objectContaining({ name: "Anna Krüger", street: "Steinweg", no: "20", plz: "98527" }),
      expect.objectContaining({ name: "Klaus Richter", street: "Auenstraße", no: "36", plz: "98529" }),
      expect.objectContaining({ name: "Erika Muster", street: "Hoher Rain", no: "5", plz: "98527" }),
    ]);
    expect(x.warnings).toContain("multiple_addresses");
  });

  it("one-line addresses (maps share, chat) with and without name / country", () => {
    expect(addr(extractAddresses("Würzburger Str. 21, 98529 Suhl, Deutschland"))).toMatchObject({ street: "Würzburger Str.", no: "21", plz: "98529", city: "Suhl", name: null });
    expect(addr(extractAddresses("Jonas Becker, Lister Meile 42a, 30161 Hannover"))).toMatchObject({ name: "Jonas Becker", street: "Lister Meile", no: "42a", plz: "30161" });
    expect(addr(extractAddresses("Bitte an Am Rimbach 4 98529 Suhl"))).toMatchObject({ no: "4", plz: "98529", city: "Suhl" });
  });

  it("several one-line addresses in one message", () => {
    const x = extractAddresses("Steinweg 20, 98527 Suhl\nAuenstraße 36, 98529 Suhl");
    expect(x.addresses.map((a) => `${v(a.street)} ${v(a.houseNumber)}`)).toEqual(["Steinweg 20", "Auenstraße 36"]);
  });

  it("finds nothing rather than inventing", () => {
    const x = extractAddresses("Hallo, wann kommst du?\n14:02");
    expect(x.addresses).toEqual([]);
    expect(x.warnings).toContain("address_not_found");
  });

  it("prepareLines drops timestamps, emoji-only lines and links", () => {
    expect(prepareLines("09:15\n👍\nhttps://maps.example/abc\nSteinweg 20").map((l) => l.text)).toEqual(["Steinweg 20"]);
  });
});

describe("carrier labels", () => {
  it("DHL: sender skipped, JJD barcode", () => {
    const x = extractAddresses("DHL PAKET\nVon: Online-Shop AG, Lagerweg 3, 04109 Leipzig\nAn:\nJonas Becker\nFriedrich-König-Str. 7\n98527 Suhl", [{ data: "JJD000390007912345678", type: "code128" }]);
    expect(x.mode).toBe("label");
    expect(x.carrier).toBe("dhl");
    expect(addr(x)).toMatchObject({ name: "Jonas Becker", street: "Friedrich-König-Str.", no: "7", plz: "98527", tracking: ["dhl:JJD000390007912345678"] });
  });

  it("Hermes: H + 19 digits, also printed with spaces", () => {
    const x = extractAddresses("Hermes\nAbsender:\nVersand GmbH\nHauptstr. 1\n33100 Paderborn\nEmpfänger:\nErika Musterfrau\nAm Rimbach 4a\n98529 Suhl\nH100 3450 0123 4567 8901");
    expect(addr(x)).toMatchObject({ name: "Erika Musterfrau", plz: "98529", tracking: ["hermes:H1003450012345678901"] });
  });

  it("DPD: 14 digits with DPD named on the label", () => {
    const x = extractAddresses("DPD Classic\nEmpfänger:\nPaula Schmidt\nSteinweg 20\n98527 Suhl\nPaketnr. 0123 4567 8901 23");
    expect(addr(x).tracking).toEqual(["dpd:01234567890123"]);
  });

  it("GLS: 11/12-digit numbers only count when GLS is named", () => {
    expect(addr(extractAddresses("GLS\nEmpfänger:\nKlaus Richter\nAuenstraße 36\n98529 Suhl\nTrack-ID 41234567890")).tracking).toEqual(["gls:41234567890"]);
    expect(addr(extractAddresses("Klaus Richter\nAuenstraße 36\n98529 Suhl\nRef 41234567890")).tracking).toEqual([]);
  });

  it("UPS 1Z", () => {
    expect(addr(extractAddresses("UPS\nAn: Max Muster\nSteinweg 20\n98527 Suhl\n1Z 999 AA1 01 2345 6784")).tracking).toEqual(["ups:1Z999AA10123456784"]);
  });

  it("label without sender marker: the recipient (last block) is used and flagged", () => {
    const x = extractAddresses("Shop GmbH\nLagerweg 3\n04109 Leipzig\nAnna Krüger\nSteinweg 20\n98527 Suhl", [{ data: "JJD000390007912345678", type: "code128" }]);
    expect(x.addresses).toHaveLength(1);
    expect(addr(x)).toMatchObject({ plz: "98527", name: "Anna Krüger" });
    expect(x.addresses[0]!.warnings).toContain("multiple_addresses");
  });

  it("postcodes and phone numbers are never tracking numbers", () => {
    expect(addr(extractAddresses("DHL\nAn: Max Muster\nSteinweg 20\n98527 Suhl\nTel. 03681 123456789")).tracking).toEqual([]);
  });
});

describe("Packstation and parcel shops", () => {
  it("Packstation with Postnummer", () => {
    const x = extractAddresses("DHL Paket\nAn:\nMax Mustermann\n12345678\nPackstation 123\n98527 Suhl");
    expect(addr(x)).toMatchObject({ kind: "packstation", street: "Packstation", no: "123", plz: "98527", name: "Max Mustermann" });
    expect(x.addresses[0]!.postNumber).toBe("12345678");
  });

  it("Packstation without Postnummer is flagged", () => {
    const x = extractAddresses("An:\nMax Mustermann\nPackstation 123\n98527 Suhl");
    expect(x.addresses[0]!.warnings).toContain("post_number_missing");
  });

  it("Postfiliale with 'Postnummer:' label", () => {
    const x = extractAddresses("An: Erika Muster\nPostnummer: 87654321\nPostfiliale 512\n98527 Suhl");
    expect(x.addresses[0]).toMatchObject({ kind: "packstation", postNumber: "87654321" });
  });

  it("Hermes PaketShop", () => {
    const x = extractAddresses("Hermes PaketShop\nKiosk am Markt\nMarkt 3\n98527 Suhl");
    expect(addr(x)).toMatchObject({ kind: "parcel_shop", street: "Markt", no: "3" });
    expect(x.addresses[0]!.shopName).toBe("Hermes PaketShop");
    expect(x.addresses[0]!.warnings).toContain("parcel_shop");
  });
});

describe("tracking classification", () => {
  it("knows the carrier formats; bare numbers need context", () => {
    expect(classifyTracking("JJD000390007912345678")).toEqual({ carrier: "dhl", confidence: "high" });
    expect(classifyTracking("00340434161234567890")).toEqual({ carrier: "dhl", confidence: "high" });
    expect(classifyTracking("RR123456785DE")).toEqual({ carrier: "dhl", confidence: "high" });
    expect(classifyTracking("H1003450012345678901")).toEqual({ carrier: "hermes", confidence: "high" });
    expect(classifyTracking("12345678901")).toBeNull();
    expect(classifyTracking("12345678901", "gls")).toEqual({ carrier: "gls", confidence: "medium" });
  });
});

describe("duplicates", () => {
  const stop = (id: string, street: string, no: string, status: Stop["status"], codes: string[] = []): Stop =>
    ({
      id,
      organizationId: "o",
      tourId: "t",
      type: "delivery",
      status,
      sequence: 0,
      address: { street, houseNumber: no, postalCode: "98527", city: "Suhl", countryCode: "DE" },
      location: null,
      parcels: codes.map((c, i) => ({ id: `${id}-${i}`, trackingNumber: c })),
      priority: false,
      serviceSeconds: 120,
    }) as unknown as Stop;
  const stops = [stop("a", "Steinweg", "20", "pending"), stop("b", "Müllerstraße", "1", "delivered"), stop("c", "Hoher Rain", "5", "pending", ["JJD000390007912345678"])];

  it("same address as an open stop (merge), also with ASCII umlauts and 'Str.'", () => {
    expect(findDuplicates({ type: "delivery", address: { street: "Steinweg", houseNumber: "20", postalCode: "98527", city: "Suhl" }, trackingNumbers: [] }, stops)).toEqual([{ kind: "open_stop_same_address", stopId: "a" }]);
    expect(looseAddressKey({ street: "Muellerstr.", houseNumber: "1", postalCode: "98527", city: "Suhl" })).toBe(looseAddressKey({ street: "Müllerstraße", houseNumber: "1", postalCode: "98527", city: "Suhl" }));
  });

  it("address already delivered today", () => {
    expect(findDuplicates({ type: "delivery", address: { street: "Muellerstrasse", houseNumber: "1", postalCode: "98527", city: "Suhl" }, trackingNumbers: [] }, stops)).toEqual([{ kind: "completed_stop_same_address", stopId: "b" }]);
  });

  it("tracking number already on another stop", () => {
    expect(findDuplicates({ type: "delivery", address: { street: "Steinweg", houseNumber: "99", postalCode: "98527", city: "Suhl" }, trackingNumbers: ["jjd 0003 9000 7912 3456 78"] }, stops)).toEqual([{ kind: "tracking_on_other_stop", stopId: "c", trackingNumber: "JJD000390007912345678" }]);
  });

  it("twice in the same import", () => {
    const a = { street: "Auenstraße", houseNumber: "36", postalCode: "98529", city: "Suhl" };
    expect(findDuplicates({ type: "delivery", address: a, trackingNumbers: [] }, [], [{ address: a, trackingNumbers: [] }])).toEqual([{ kind: "same_in_this_import" }]);
  });
});

describe("tracking numbers with several addresses", () => {
  it("a number directly after an address belongs to it; others stay unassigned", () => {
    const x = extractAddresses("Anna Krüger\nSteinweg 20\n98527 Suhl\nSendungsnr. JJD000390007912345678\nKlaus Richter\nAuenstraße 36\n98529 Suhl\nKlingel defekt\nDHL JJD000390007900000001");
    expect(x.addresses.map((a) => a.trackingNumbers.map((t) => t.code))).toEqual([["JJD000390007912345678"], []]);
    expect(x.unassignedTrackingNumbers.map((t) => t.code)).toEqual(["JJD000390007900000001"]);
  });

  it("a trailing number after the last address is assigned to it only when directly below", () => {
    const x = extractAddresses("Steinweg 20, 98527 Suhl\nAuenstraße 36, 98529 Suhl\nDHL JJD000390007912345678");
    expect(x.addresses.map((a) => a.trackingNumbers.length)).toEqual([0, 1]);
  });
});
