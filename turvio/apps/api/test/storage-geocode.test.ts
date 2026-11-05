import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { NominatimGeocoder, PhotonGeocoder, RateLimiter } from "../src/geocode";
import { LocalProofStore, SupabaseProofStore, isSafeSignatureSvg, validateProofContent } from "../src/storage";

const P = "00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000002/00000000-0000-4000-8000-000000000003.svg";

describe("proof content validation", () => {
  it("accepts app-drawn signature SVG and rejects anything active", () => {
    expect(isSafeSignatureSvg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M1 1 L5 5" stroke="#000" fill="none"/></svg>')).toBe(true);
    for (const bad of [
      '<svg><script>alert(1)</script></svg>',
      '<svg onload="alert(1)"></svg>',
      '<svg><a href="javascript:alert(1)"><path d="M1 1"/></a></svg>',
      '<svg><image href="https://evil.example/x.png"/></svg>',
      '<svg><style>@import url(x)</style></svg>',
      '<?xml version="1.0"?><svg></svg>',
      '<svg><path d="M1 1" fill="url(#x)"/></svg>',
      "<svg>&xxe;</svg>",
    ]) {
      expect(isSafeSignatureSvg(bad), bad).toBe(false);
    }
  });
  it("checks magic numbers of photos", () => {
    expect(validateProofContent("image/jpeg", Buffer.from([0xff, 0xd8, 0xff, 0x00]))).toBeNull();
    expect(validateProofContent("image/jpeg", Buffer.from("GIF89a"))).toBe("not_a_jpeg");
    expect(validateProofContent("image/png", Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBeNull();
    expect(validateProofContent("text/html", Buffer.from("<html>"))).toBe("content_type_not_allowed");
  });
});

describe("proof stores", () => {
  it("local store keeps files private and refuses path traversal", async () => {
    const s = new LocalProofStore(mkdtempSync(join(tmpdir(), "pst-")));
    await s.put(P, Buffer.from("<svg></svg>"));
    expect((await s.get(P))!.contentType).toBe("image/svg+xml");
    await s.delete(P);
    expect(await s.get(P)).toBeNull();
    await expect(s.put("../../etc/passwd", Buffer.from("x"))).rejects.toThrow(/unsafe/);
  });
  it("supabase store uses the private bucket with the service key (mocked REST)", async () => {
    const calls: { url: string; method: string; headers: Record<string, string> }[] = [];
    const fake: typeof fetch = async (url, init) => {
      calls.push({ url: String(url), method: init?.method ?? "GET", headers: init?.headers as Record<string, string> });
      return new Response(init?.method === "GET" || !init?.method ? "data" : "{}", { status: 200, headers: { "content-type": "image/svg+xml" } });
    };
    const s = new SupabaseProofStore("https://proj.supabase.co", "service-key", "proofs", fake);
    await s.put(P, Buffer.from("x"), "image/svg+xml");
    await s.get(P);
    await s.delete(P);
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      `POST https://proj.supabase.co/storage/v1/object/proofs/${P}`,
      `GET https://proj.supabase.co/storage/v1/object/authenticated/proofs/${P}`,
      `DELETE https://proj.supabase.co/storage/v1/object/proofs`,
    ]);
    expect(calls[0]!.headers.authorization).toBe("Bearer service-key");
  });
});

describe("geocoders (mocked providers)", () => {
  it("maps Nominatim results with precision and sends a User-Agent", async () => {
    let ua = "";
    const fake: typeof fetch = async (_u, init) => {
      ua = (init?.headers as Record<string, string>)["user-agent"]!;
      return Response.json([{ lat: "52.38", lon: "9.74", addresstype: "building", address: { road: "Lister Meile", house_number: "42", postcode: "30161", city: "Hannover", country_code: "de" } }]);
    };
    const r = await new NominatimGeocoder("https://nominatim.internal", "TURVIO test", fake).search("Lister Meile 42", { countryCodes: ["DE"] });
    expect(ua).toBe("TURVIO test");
    expect(r[0]).toMatchObject({ label: "Lister Meile 42, 30161 Hannover", precision: "house", countryCode: "DE", location: { lat: 52.38, lng: 9.74 } });
  });
  it("maps Photon features", async () => {
    const fake: typeof fetch = async () => Response.json({ features: [{ geometry: { coordinates: [9.74, 52.38] }, properties: { type: "street", name: "Lister Meile", postcode: "30161", city: "Hannover", countrycode: "DE" } }] });
    const r = await new PhotonGeocoder("https://photon.internal", "x", fake).search("Lister", {});
    expect(r[0]).toMatchObject({ street: "Lister Meile", precision: "street", location: { lat: 52.38, lng: 9.74 } });
  });
  it("rate limits per user", () => {
    let t = 0;
    const l = new RateLimiter(1, 2, () => t);
    expect([l.take("a"), l.take("a"), l.take("a"), l.take("b")]).toEqual([true, true, false, true]);
    t = 1000;
    expect(l.take("a")).toBe(true);
  });
});
