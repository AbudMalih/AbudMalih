import { geocodeImportRows } from "../src/lib/geocode";
import { parseLabelText } from "@turvio/shared";
import { formFromExtraction } from "../src/lib/labelForm";
import { navigationUrls, openNavigation } from "../src/lib/navigation";
import { drainOutbox, backoffMs, type OutboxItem } from "../src/lib/outbox";
import { ApiError } from "../src/lib/auth";
import { emptyStopForm, parseStopForm } from "../src/lib/stopForm";
import { strokesToSvg } from "../src/components/SignaturePad";

describe("label review", () => {
  it("prefills the form from OCR text and keeps the scanned code as tracking number", () => {
    const x = parseLabelText("Erika Beispiel\nLister Meile 42a\n30161 Hannover", []);
    const { value, confidence } = formFromExtraction(x, emptyStopForm("Hannover"), "TVO5555555555");
    expect(value).toMatchObject({ recipientName: "Erika Beispiel", street: "Lister Meile", houseNumber: "42a", postalCode: "30161", city: "Hannover", trackingNumbers: "TVO5555555555" });
    expect(confidence).toMatchObject({ postalCode: "high", recipientName: "medium", trackingNumbers: "high" });
    const parsed = parseStopForm(value);
    expect(parsed.ok && parsed.value.location).toBeNull(); // no coordinates invented
  });
});

describe("navigation hand-off", () => {
  const target = { location: { lat: 52.38, lng: 9.74 }, addressText: "Lister Meile 42, 30161 Hannover" };
  it("builds app links with https fallbacks", () => {
    expect(navigationUrls("waze", target, "android")).toEqual({ native: "waze://?ll=52.38,9.74&navigate=yes", web: "https://waze.com/ul?ll=52.38,9.74&navigate=yes" });
    expect(navigationUrls("apple", target, "ios").native).toBe("maps://?daddr=52.38,9.74&dirflg=d");
    expect(navigationUrls("apple", target, "android").native).toBeNull();
    expect(navigationUrls("google", { location: null, addressText: "A B" }, "android").native).toBe("google.navigation:q=A%20B&mode=d");
  });
  it("falls back to the web link when the app is missing", async () => {
    const opened: string[] = [];
    const used = await openNavigation("waze", target, {
      openURL: async (u: string) => {
        opened.push(u);
        if (u.startsWith("waze://")) throw new Error("No app");
      },
    });
    expect(used).toBe("web");
    expect(opened).toEqual(["waze://?ll=52.38,9.74&navigate=yes", "https://waze.com/ul?ll=52.38,9.74&navigate=yes"]);
  });
});

describe("outbox drain", () => {
  const item = (id: string, kind: OutboxItem["kind"] = "stop_note"): OutboxItem => ({ id, kind: "stop_note", orgId: "o", at: "2026-11-05T10:00:00.000Z", stopId: "s", note: "n" } as OutboxItem & { kind: typeof kind });
  it("stops at a transient error with backoff and moves permanent errors aside", async () => {
    let queue = [item("a"), item("b"), item("c")];
    let fail: Record<string, unknown> = { b: new ApiError(422, "invalid", "no"), c: new ApiError(0, "network", "offline") };
    const client = { request: async (_m: string, _p: string, body?: unknown) => {
      const id = (body as { clientEventId: string }).clientEventId;
      if (fail[id]) throw fail[id];
      return {} as never;
    } };
    const r = await drainOutbox(() => queue[0], (id) => (queue = queue.filter((x) => x.id !== id)), (it) => (queue = queue.map((x) => (x.id === it.id ? it : x))), { client, readFileBase64: async () => "", deleteFile: async () => undefined }, () => 1000);
    expect(r.sent).toEqual(["a"]);
    expect(r.failed.map((f) => f.item.id)).toEqual(["b"]);
    expect(r.offline).toBe(true);
    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({ id: "c", attempts: 1, nextAttemptAt: 1000 + backoffMs(1) });
    fail = {};
    const again = await drainOutbox(() => queue[0], (id) => (queue = queue.filter((x) => x.id !== id)), () => undefined, { client, readFileBase64: async () => "", deleteFile: async () => undefined }, () => 1000);
    expect(again.offline).toBe(true); // still backing off
    const later = await drainOutbox(() => queue[0], (id) => (queue = queue.filter((x) => x.id !== id)), () => undefined, { client, readFileBase64: async () => "", deleteFile: async () => undefined }, () => 1_000_000);
    expect(later.sent).toEqual(["c"]);
  });
});

describe("signature", () => {
  it("serialises strokes to path-only SVG", () => {
    const svg = strokesToSvg(["M1 1 L5 5"], 300.4, 120);
    expect(svg).toBe('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 120" width="300" height="120"><path d="M1 1 L5 5" fill="none" stroke="#0F172A" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>');
  });
});

describe("bulk geocoding for imports", () => {
  it("applies exact house matches only and counts street-level results", async () => {

    const rows = [
      { street: "Lister Meile", houseNumber: "42", postalCode: "30161", city: "Hannover", location: null },
      { street: "Lister Meile", houseNumber: "999", postalCode: "30161", city: "Hannover", location: null },
      { street: "Weg", houseNumber: "1", postalCode: "30159", city: "Hannover", location: { lat: 52, lng: 9 } },
    ];
    const client = {
      request: async () =>
        ({ results: [{ precision: "house", location: { lat: 52.38, lng: 9.74 } }, { precision: "street", location: { lat: 52.3, lng: 9.7 } }] }) as never,
    };
    const r = await geocodeImportRows(client, rows);
    expect(r).toMatchObject({ applied: 1, streetOnly: 1, status: "ok" });
    expect(r.rows[0]!.location).toEqual({ lat: 52.38, lng: 9.74 });
    expect(r.rows[1]!.location).toBeNull(); // street-level: not used as a house position
    expect(r.rows[2]!.location).toEqual({ lat: 52, lng: 9 });
  });
});
