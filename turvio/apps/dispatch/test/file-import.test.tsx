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
const existing = base.stops.flatMap((s) => s.parcels.map((p) => p.trackingNumber))[0];

let calls: { method: string; url: string; body: any }[] = [];
let geocodeResults: unknown[] = [];

beforeEach(() => {
  calls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ method, url, body });
      if (url.includes("/dispatch?")) return new Response(JSON.stringify(base), { status: 200 });
      if (url.endsWith("/v1/geocode/batch")) return new Response(JSON.stringify({ provider: "postgres", results: geocodeResults.slice(0, body.addresses.length) }), { status: 200 });
      if (url.includes("/v1/geocode/search"))
        return new Response(JSON.stringify({ results: [{ label: "Unbekannte Gasse 3, 30159 Hannover", location: { lat: 52.371, lng: 9.735 }, precision: "house" }] }), { status: 200 });
      if (method === "POST" && url.endsWith("/stops")) return new Response(JSON.stringify({ ids: body.stops.map((_: unknown, i: number) => `s${i}`) }), { status: 201 });
      return new Response("{}", { status: 200 });
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

const CSV = [
  "Sdg-Nr;Empf.;Anschrift;PLZ;Zielort",
  "TVO1000001;Kiosk am Platz;Lister Meile 44a;30161;Hannover",
  "TVO1000002;Kiosk am Platz;Lister Meile 44a;30161;Hannover",
  "TVO1000003;Praxis Dr. Ay;Podbielskistr. 7;30163;Hannover",
  `${existing};Büro;Unbekannte Gasse 3;30159;Hannover`,
].join("\n");

const open = async (user: ReturnType<typeof userEvent.setup>, csv = CSV) => {
  render(
    <TooltipProvider>
      <DispatchProvider base={base} session={session}>
        <AddStopsDialog open onOpenChange={() => {}} target={{ tourId: tour.id }} targetLabel={tour.name} />
      </DispatchProvider>
    </TooltipProvider>,
  );
  const dialog = await screen.findByRole("dialog");
  await user.click(within(dialog).getByRole("tab", { name: "CSV / Excel file" }));
  await user.upload(within(dialog).getByLabelText("Choose a CSV or Excel file"), new File([csv], "manifest.csv", { type: "text/csv" }));
  await within(dialog).findByRole("region", { name: "Column mapping" });
  return dialog;
};
const map = async (user: ReturnType<typeof userEvent.setup>, dialog: HTMLElement, fields: string[]) => {
  for (const [i, f] of fields.entries()) await user.selectOptions(within(dialog).getByRole("combobox", { name: new RegExp(`^Column ${i + 1} `) }), f);
};

describe("Dispatch file import", () => {
  it("known headers are pre-mapped, the rest is mapped by hand; rows at the same address become one stop", async () => {
    const user = userEvent.setup();
    const dialog = await open(user);
    // "Anschrift" and "PLZ" are recognised; "Zielort" (city) is not – every row lacks a city until mapped.
    expect((within(dialog).getByRole("combobox", { name: /^Column 3 / }) as HTMLSelectElement).value).toBe("address");
    expect((within(dialog).getByRole("combobox", { name: /^Column 4 / }) as HTMLSelectElement).value).toBe("postalCode");
    expect(await within(dialog).findByText(/4 rows cannot be imported/)).toBeTruthy();
    expect((within(dialog).getByRole("button", { name: /Import/ }) as HTMLButtonElement).disabled).toBe(true);
    await user.selectOptions(within(dialog).getByRole("combobox", { name: /^Column 3 / }), "");
    await user.selectOptions(within(dialog).getByRole("combobox", { name: /^Column 4 / }), "");
    expect(within(dialog).getByText(/Map either a full-address column/)).toBeTruthy();
    await map(user, dialog, ["tracking", "recipientName", "street", "postalCode", "city"]);
    expect(within(dialog).getByText("4 rows")).toBeTruthy();
    expect(within(dialog).getByText(/3 stops · 4 parcels/)).toBeTruthy();
    expect(within(dialog).getByText(/1 rows merged into stops/)).toBeTruthy();
    expect(within(dialog).getByText(/already on a stop for this day/)).toBeTruthy();
  });

  it("finds locations on the server, lets a missing one be picked, and imports grouped stops", async () => {
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
    // One geocoding call for the 3 distinct addresses (not 4 rows).
    const batch = calls.filter((c) => c.url.endsWith("/v1/geocode/batch"));
    expect(batch).toHaveLength(1);
    expect(batch[0]!.body.addresses).toEqual([
      { street: "Lister Meile", houseNumber: "44a", postalCode: "30161", city: "Hannover" },
      { street: "Podbielskistr.", houseNumber: "7", postalCode: "30163", city: "Hannover" },
      { street: "Unbekannte Gasse", houseNumber: "3", postalCode: "30159", city: "Hannover" },
    ]);
    expect(within(dialog).getByText(/1 street level only/)).toBeTruthy();
    expect(within(dialog).getByText("not found")).toBeTruthy();

    await user.click(within(dialog).getByRole("button", { name: /Set location for Unbekannte Gasse 3/ }));
    await user.type(within(dialog).getByRole("textbox", { name: "Search address" }), "Unbekannte Gasse 3");
    await user.click(await within(dialog).findByRole("option", { name: /Unbekannte Gasse 3/ }));
    expect(within(dialog).getByText(/1 picked by hand/)).toBeTruthy();

    await user.click(within(dialog).getByRole("button", { name: "Import 3 stops (4 parcels)" }));
    await waitFor(() => expect(calls.find((c) => c.method === "POST" && c.url.endsWith("/stops"))).toBeTruthy());
    const post = calls.find((c) => c.method === "POST" && c.url.endsWith("/stops"))!;
    expect(post.body.tourId).toBe(tour.id);
    expect(post.body.stops).toHaveLength(3);
    expect(post.body.stops[0]).toMatchObject({ recipientName: "Kiosk am Platz", trackingNumbers: ["TVO1000001", "TVO1000002"], location: { lat: 52.3801, lng: 9.7439 }, locationSource: "geocoder" });
    expect(post.body.stops[2]).toMatchObject({ location: { lat: 52.371, lng: 9.735 }, locationSource: "dispatch" });
  });

  it("stops without location are only imported when that box stays ticked", async () => {
    const user = userEvent.setup();
    geocodeResults = [null, null, null];
    const dialog = await open(user);
    await map(user, dialog, ["tracking", "recipientName", "street", "postalCode", "city"]);
    await user.click(within(dialog).getByRole("checkbox", { name: /Also import stops without location/ }));
    expect((within(dialog).getByRole("button", { name: "Import" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("invalid rows block the import and are listed by row number", async () => {
    const user = userEvent.setup();
    const dialog = await open(user, "Straße;PLZ;Ort\nLister Meile 44a;30161;Hannover\nPodbielskistr. 7;3016;\n");
    expect(within(dialog).getByText(/1 row cannot be imported/)).toBeTruthy();
    expect(within(dialog).getByText(/Row 3: city missing/)).toBeTruthy();
    expect((within(dialog).getByRole("button", { name: /Import/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("reads Excel-style Windows-1252 CSV as well as UTF-8", () => {
    expect(decodeText(new TextEncoder().encode("Straße;Ort"))).toBe("Straße;Ort");
    expect(decodeText(new Uint8Array([0x53, 0x74, 0x72, 0x61, 0xdf, 0x65]))).toBe("Straße"); // "Straße" in Windows-1252
  });
});
