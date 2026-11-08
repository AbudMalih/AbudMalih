import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createDispatchDataset } from "@turvio/shared";
import { TooltipProvider } from "@turvio/web-ui/ds";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AddStopsDialog } from "../components/AddStopsDialog";
import { decodeText } from "../components/FileImport";
import { DispatchProvider, type SessionInfo } from "../lib/store";

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(""), usePathname: () => "/planning", useRouter: () => ({ push: vi.fn() }) }));

const base = createDispatchDataset(new Date("2026-11-05T10:00:00Z"));
const session: SessionInfo = { userName: "T", email: "t@example.test", role: "admin", organizationId: "org_jarbou", organizationName: "JARBOU (synthetic)", companyWide: true, workspaces: [{ id: "org_jarbou", name: "JARBOU", role: "admin" }], environment: null };
const tour = base.tours.find((t) => t.status === "planned")!;
/** Synthetic 1,000-parcel manifest (apps/api/test/fixtures/bulk-import, generate.py). */
const BULK = join(import.meta.dirname, "../../api/test/fixtures/bulk-import");

let calls: { method: string; url: string; body: any }[] = [];
let geocodeResults: unknown[] = [];
/** What the server's tracking lookup answers. */
let lookupFound: { trackingNumber: string; stopStatus: string; blocking: boolean; tourName: string | null; tourDate: string | null }[] = [];
/** Postcode check answers by "postcode|city". */
let postcodeAnswers: Record<string, { status: string; knownCities?: string[] }> = {};
let saveAnswer: (body: any) => Response = (body) => new Response(JSON.stringify({ ids: body.stops.map((_: unknown, i: number) => `s${i}`) }), { status: 201 });

beforeEach(() => {
  calls = [];
  geocodeResults = [];
  lookupFound = [];
  postcodeAnswers = {};
  saveAnswer = (body) => new Response(JSON.stringify({ ids: body.stops.map((_: unknown, i: number) => `s${i}`) }), { status: 201 });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ method, url, body });
      if (url.includes("/dispatch?")) return new Response(JSON.stringify(base), { status: 200 });
      if (url.endsWith("/v1/geocode/batch")) return new Response(JSON.stringify({ provider: "postgres", results: geocodeResults.slice(0, body.addresses.length) }), { status: 200 });
      if (url.endsWith("/v1/geocode/postcodes"))
        return new Response(JSON.stringify({ available: true, results: body.pairs.map((p: { postalCode: string; city: string }) => ({ ...p, ...(postcodeAnswers[`${p.postalCode}|${p.city}`] ?? { status: "ok" }) })) }), { status: 200 });
      if (url.endsWith("/parcels/lookup")) {
        const found = lookupFound.filter((f) => body.trackingNumbers.includes(f.trackingNumber));
        return new Response(JSON.stringify({ found, blocking: found.filter((f) => f.blocking).length }), { status: 200 });
      }
      if (url.includes("/v1/geocode/search"))
        return new Response(JSON.stringify({ results: [{ label: "Unbekannte Gasse 3, 30159 Hannover", location: { lat: 52.371, lng: 9.735 }, precision: "house" }] }), { status: 200 });
      if (method === "POST" && url.endsWith("/stops")) return saveAnswer(body);
      return new Response("{}", { status: 200 });
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

const CSV = [
  "Sdg-Nr;Empf.;Anschrift;PLZ;Zielort",
  "TVO1000001;Kiosk am Platz;Lister Meile 44a;30161;Hannover",
  "TVO1000002;Anna Ay;Lister Meile 44a;30161;Hannover",
  "TVO1000003;Praxis Dr. Ay;Podbielskistr. 7;30163;Hannover",
  "TVO1000004;Büro;Unbekannte Gasse 3;30159;Hannover",
].join("\n");

const open = async (user: ReturnType<typeof userEvent.setup>, csv: string | Uint8Array = CSV, name = "manifest.csv") => {
  render(
    <TooltipProvider>
      <DispatchProvider base={base} session={session}>
        <AddStopsDialog open onOpenChange={() => {}} target={{ tourId: tour.id }} targetLabel={tour.name} />
      </DispatchProvider>
    </TooltipProvider>,
  );
  const dialog = await screen.findByRole("dialog");
  await user.click(within(dialog).getByRole("tab", { name: "CSV / Excel file" }));
  await user.upload(within(dialog).getByLabelText("Choose a CSV or Excel file"), new File([csv as BlobPart], name, { type: "text/csv" }));
  await within(dialog).findByRole("region", { name: "Column mapping" });
  return dialog;
};
const map = async (user: ReturnType<typeof userEvent.setup>, dialog: HTMLElement, fields: string[]) => {
  for (const [i, f] of fields.entries()) await user.selectOptions(within(dialog).getByRole("combobox", { name: new RegExp(`^Column ${i + 1} `) }), f);
};
const importButton = (dialog: HTMLElement) => within(dialog).getByRole("button", { name: /^Import/ }) as HTMLButtonElement;

describe("Dispatch file import", () => {
  it("known headers are pre-mapped, the rest is mapped by hand; rows at the same address become one stop", async () => {
    const user = userEvent.setup();
    const dialog = await open(user);
    expect((within(dialog).getByRole("combobox", { name: /^Column 3 / }) as HTMLSelectElement).value).toBe("address");
    expect((within(dialog).getByRole("combobox", { name: /^Column 4 / }) as HTMLSelectElement).value).toBe("postalCode");
    expect(await within(dialog).findByText(/4 rows cannot be imported/)).toBeTruthy();
    expect(importButton(dialog).disabled).toBe(true);
    await user.selectOptions(within(dialog).getByRole("combobox", { name: /^Column 3 / }), "");
    await user.selectOptions(within(dialog).getByRole("combobox", { name: /^Column 4 / }), "");
    expect(within(dialog).getByText(/Map either a full-address column/)).toBeTruthy();
    await map(user, dialog, ["tracking", "recipientName", "street", "postalCode", "city"]);
    expect(within(dialog).getByText("4 rows")).toBeTruthy();
    expect(within(dialog).getByText(/3 stops · 4 parcels/)).toBeTruthy();
  });

  it("finds locations on the server, lets a missing one be picked, and imports every parcel with its own recipient", async () => {
    const user = userEvent.setup();
    geocodeResults = [
      { label: "Lister Meile 44a, 30161 Hannover", location: { lat: 52.3801, lng: 9.7439 }, precision: "house" },
      { label: "Podbielskistraße, 30163 Hannover", location: { lat: 52.3912, lng: 9.7605 }, precision: "street" },
      null,
    ];
    const dialog = await open(user);
    await map(user, dialog, ["tracking", "recipientName", "street", "postalCode", "city"]);
    await user.click(within(dialog).getByRole("button", { name: /Find locations \(3\)/ }));
    await waitFor(() => expect(within(dialog).getByText(/1 found \(house number\)/)).toBeTruthy());
    await user.click(within(dialog).getByRole("button", { name: /Set location for Unbekannte Gasse 3/ }));
    await user.type(within(dialog).getByRole("textbox", { name: "Search address" }), "Unbekannte Gasse 3");
    await user.click(await within(dialog).findByRole("option", { name: /Unbekannte Gasse 3/ }));
    await waitFor(() => expect(importButton(dialog).disabled).toBe(false));
    await user.click(within(dialog).getByRole("button", { name: "Import 3 stops (4 parcels)" }));
    await waitFor(() => expect(calls.find((c) => c.method === "POST" && c.url.endsWith("/stops"))).toBeTruthy());
    const post = calls.find((c) => c.method === "POST" && c.url.endsWith("/stops"))!;
    expect(post.body).toMatchObject({ tourId: tour.id, rejectPlannedTracking: true });
    expect(post.body.stops[0]).toMatchObject({
      recipientName: "Kiosk am Platz",
      parcels: [
        { trackingNumber: "TVO1000001", recipientName: "Kiosk am Platz" },
        { trackingNumber: "TVO1000002", recipientName: "Anna Ay" },
      ],
      location: { lat: 52.3801, lng: 9.7439 },
      locationSource: "geocoder",
    });
    expect(post.body.stops[2]).toMatchObject({ location: { lat: 52.371, lng: 9.735 }, locationSource: "dispatch" });
  });

  it("the 1,000-parcel manifest (one customer with 120 parcels) does not crash: 100 stops, 1,000 parcels, recipient and company per parcel", async () => {
    const user = userEvent.setup();
    const dialog = await open(user, readFileSync(join(BULK, "parcels.csv")), "parcels.csv");
    expect(await within(dialog).findByText(/100 stops · 1000 parcels/)).toBeTruthy();
    expect(within(dialog).getByText(/900 rows merged into stops/)).toBeTruthy();
    // Coordinates are not in the file: import only after locations are found or accepted without.
    geocodeResults = Array.from({ length: 100 }, (_, i) => ({ label: `x${i}`, location: { lat: 52.38 + i / 10000, lng: 9.74 }, precision: "house" }));
    await user.click(within(dialog).getByRole("button", { name: /Find locations \(100\)/ }));
    await waitFor(() => expect(importButton(dialog).disabled).toBe(false));
    expect(importButton(dialog).textContent).toContain("Import 100 stops (1000 parcels)");
    await user.click(importButton(dialog));
    await waitFor(() => expect(calls.find((c) => c.method === "POST" && c.url.endsWith("/stops"))).toBeTruthy());
    const body = calls.find((c) => c.method === "POST" && c.url.endsWith("/stops"))!.body;
    const parcels = body.stops.flatMap((s: { parcels: unknown[] }) => s.parcels);
    expect(body.stops).toHaveLength(100);
    expect(parcels).toHaveLength(1000);
    expect(Math.max(...body.stops.map((s: { parcels: unknown[] }) => s.parcels.length))).toBe(120);
    expect(parcels.filter((p: { company?: string }) => p.company === "Großhandel Leinetal GmbH (Wareneingang)")).toHaveLength(120);
    // One company-wide tracking check for all 1,000 parcels before saving.
    expect(calls.find((c) => c.url.endsWith("/parcels/lookup"))!.body.trackingNumbers).toHaveLength(1000);
  });

  it("a tracking number at two different addresses blocks the import until someone decides; nothing is dropped silently", async () => {
    const user = userEvent.setup();
    const dialog = await open(user, readFileSync(join(BULK, "duplicates.csv")), "duplicates.csv");
    const conflicts = await within(dialog).findByRole("region", { name: "Address conflicts" });
    expect(within(conflicts).getByText(/2 tracking number\(s\) appear at different addresses/)).toBeTruthy();
    expect(within(dialog).getByText(/3 tracking number\(s\) are listed twice at the same address/)).toBeTruthy();
    expect(within(dialog).getByRole("status").textContent).toMatch(/Decide where 2 conflicting parcel/);
    // Decide: first option (the true address) for one, leave the other out.
    const sets = within(conflicts).getAllByRole("group");
    await user.click(within(sets[0]!).getAllByRole("radio")[0]!);
    await user.click(within(sets[1]!).getByRole("radio", { name: /Leave this parcel out/ }));
    await waitFor(() => expect(within(dialog).queryByText(/Decide where/)).toBeNull());
    expect(within(dialog).getByText(/100 stops · 999 parcels/)).toBeTruthy();
  });

  it("parcels already planned in TURVIO are listed with their tour and must be left out explicitly", async () => {
    const user = userEvent.setup();
    lookupFound = [
      { trackingNumber: "TVO1000001", stopStatus: "pending", blocking: true, tourName: "HAN-02", tourDate: "2026-11-05" },
      { trackingNumber: "TVO1000004", stopStatus: "failed", blocking: false, tourName: "HAN-01", tourDate: "2026-11-04" },
    ];
    const dialog = await open(user);
    await map(user, dialog, ["tracking", "recipientName", "street", "postalCode", "city"]);
    const region = await within(dialog).findByRole("region", { name: "Already in TURVIO" });
    expect(within(region).getByText(/TVO1000001 · HAN-02 \(2026-11-05\) · pending/)).toBeTruthy();
    expect(within(dialog).getByText(/1 parcel\(s\) had an earlier attempt that ended/)).toBeTruthy();
    await user.click(within(dialog).getByRole("checkbox", { name: /Also import stops without location/ })); // no geocoding in this test
    await user.click(within(dialog).getByRole("checkbox", { name: /Also import stops without location/ }));
    expect(importButton(dialog).disabled).toBe(true);
    expect(within(dialog).getByRole("status").textContent).toMatch(/1 parcel\(s\) are already in TURVIO/);
    await user.click(within(region).getByRole("checkbox", { name: /Leave these 1 parcel\(s\) out/ }));
    await waitFor(() => expect(importButton(dialog).disabled).toBe(false));
    expect(importButton(dialog).textContent).toContain("3 parcels");
  });

  it("a save refused by the server (someone imported meanwhile) keeps the dialog open and re-checks", async () => {
    const user = userEvent.setup();
    saveAnswer = () => new Response(JSON.stringify({ error: { code: "tracking_already_planned", message: "1 parcel(s) are already planned or delivered – nothing was saved" } }), { status: 409 });
    const dialog = await open(user);
    await map(user, dialog, ["tracking", "recipientName", "street", "postalCode", "city"]);
    await waitFor(() => expect(importButton(dialog).disabled).toBe(false));
    const lookups = () => calls.filter((c) => c.url.endsWith("/parcels/lookup")).length;
    const before = lookups();
    lookupFound = [{ trackingNumber: "TVO1000003", stopStatus: "pending", blocking: true, tourName: "HAN-03", tourDate: null }];
    await user.click(importButton(dialog));
    await waitFor(() => expect(lookups()).toBeGreaterThan(before));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(await within(dialog).findByRole("region", { name: "Already in TURVIO" })).toBeTruthy();
  });

  it("4-digit postcodes are never padded silently; a correction verified for the city is applied on request", async () => {
    const user = userEvent.setup();
    postcodeAnswers = { "03016|Hannover": { status: "unknown" }, "01067|Dresden": { status: "ok" }, "30163|Bremen": { status: "mismatch", knownCities: ["Hannover"] } };
    const csv = ["Sendungsnummer;Straße;PLZ;Ort", "TVO2000001;Schloßstraße 1;1067;Dresden", "TVO2000002;Hauptstr. 1;3016;Hannover", "TVO2000003;Podbielskistr. 7;30163;Bremen"].join("\n");
    const dialog = await open(user, csv);
    expect(await within(dialog).findByText(/3 rows cannot be imported/)).toBeTruthy();
    expect(within(dialog).getByText(/Row 4: postcode does not belong to this city \(30163 is Hannover, not Bremen\)/)).toBeTruthy();
    await user.click(await within(dialog).findByRole("button", { name: "Use the corrected postcodes" }));
    // Only Dresden (verified) is corrected; "3016 Hannover" stays an error.
    expect(await within(dialog).findByText(/2 rows cannot be imported/)).toBeTruthy();
    expect(within(dialog).getByText(/Row 3: postcode has only 4 digits \(3016\)/)).toBeTruthy();
  });

  it("reads Excel-style Windows-1252 CSV as well as UTF-8", () => {
    expect(decodeText(new TextEncoder().encode("Straße;Ort"))).toBe("Straße;Ort");
    expect(decodeText(new Uint8Array([0x53, 0x74, 0x72, 0x61, 0xdf, 0x65]))).toBe("Straße");
  });
});
