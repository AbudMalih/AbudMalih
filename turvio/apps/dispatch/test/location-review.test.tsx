import { summarizeTours, type DispatchDataset, type Stop, type Tour } from "@turvio/shared";
import { TooltipProvider } from "@turvio/web-ui/ds";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StopEditActions } from "../components/StopEditActions";
import { TourDetail } from "../components/TourDetail";
import { stopTooltipHtml } from "../lib/eta";
import { checkStatusLabel, locationBadge, needsReview, type LocationReport } from "../lib/locations";
import { optimizeNotes, optimizeProblems } from "../lib/optimize";
import { DispatchProvider, type SessionInfo } from "../lib/store";

/**
 * P0-3.4 Dispatch location review: badges, banner, review panel. Nothing is changed without an
 * explicit click; a pending check is never shown as checked; after publication edits need a reason.
 */
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(""), usePathname: () => "/map", useRouter: () => ({ push: vi.fn() }) }));

const stop = (i: number, extra: Partial<Stop> = {}): Stop =>
  ({
    id: `s${i}`,
    tourId: "T",
    type: "delivery",
    sequence: i,
    status: "pending",
    recipientName: `Kunde ${i}`,
    address: { street: "Teststraße", houseNumber: String(i + 1), postalCode: "30161", city: "Hannover", countryCode: "DE" },
    location: { lat: 52.38 + i * 0.002, lng: 9.74 },
    serviceSeconds: 120,
    priority: false,
    parcels: [],
    addressVersion: 1,
    locationVersion: 1,
    locationPrecision: "house",
    ...extra,
  }) as Stop;
const tour = { id: "T", organizationId: "o", name: "LOC-T", date: "2026-11-10", depotId: "d", driverId: "drv", vehicleId: null, status: "planned", plannedStartMinute: 480, version: 3, publishedAt: "2026-11-10T06:00:00.000Z" } as Tour;
const data = {
  organizationId: "o",
  date: "2026-11-10",
  asOfMinute: 420,
  isToday: true,
  timeZone: "UTC",
  depots: [{ id: "d", organizationId: "o", name: "Depot", address: { street: "x", houseNumber: "1", postalCode: "30161", city: "Hannover", countryCode: "DE" }, location: { lat: 52.37, lng: 9.73 } }],
  drivers: [{ id: "drv", organizationId: "o", displayName: "D", depotId: "d", maxShiftMinutes: 480, active: true }],
  vehicles: [],
  tours: [tour],
  stops: [stop(0), stop(1), stop(2), stop(3, { approach: { lat: 52.3862, lng: 9.7405, roadName: "Klusriede" } })],
  unassigned: [],
} as DispatchDataset;

const base: Omit<LocationReport, "stopId"> = { status: "checked", unavailable: [], confirmation: null, approach: null, acknowledged: false, issues: [], severity: null };
const reports: LocationReport[] = [
  { ...base, stopId: "s0" },
  {
    ...base,
    stopId: "s1",
    severity: "warning",
    issues: [{ code: "motorway", severity: "warning", message: "The location is on a motorway (A 2).", suggestion: { kind: "approach", location: { lat: 52.3825, lng: 9.7405 }, roadName: "Klusriede", distanceMeters: 49 } }],
  },
  { ...base, stopId: "s2", status: "pending", severity: null },
  { ...base, stopId: "s3", severity: "error", issues: [{ code: "out_of_coverage", severity: "error", message: "No road in the routing data within 1.0 km." }] },
];

const session: SessionInfo = { userName: "T", email: "t@example.test", role: "dispatcher", organizationId: "o", organizationName: "Test (synthetic)", companyWide: false, workspaces: [{ id: "o", name: "Test", role: "dispatcher" }], environment: null };
let calls: { method: string; url: string; body: unknown }[] = [];
beforeEach(() => {
  calls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      calls.push({ method, url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
      if (url.includes("/dispatch?")) return new Response(JSON.stringify(data), { status: 200 });
      if (url.includes("/location-checks")) return new Response(JSON.stringify({ pending: true, checks: reports }), { status: 200 });
      if (url.endsWith("/events")) return new Response("[]", { status: 200 });
      return new Response(null, { status: 204 });
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());
const wrap = (ui: ReactNode) =>
  render(
    <TooltipProvider>
      <DispatchProvider base={data} session={session}>
        {ui}
      </DispatchProvider>
    </TooltipProvider>,
  );
const summary = () => summarizeTours(data)[0]!;
const row = (name: string) => screen.getAllByRole("listitem").find((li) => within(li).queryAllByText(name).length > 0)!;

describe("wording", () => {
  it("pending is never 'checked' or 'confirmed'; errors and unconfirmed warnings need review", () => {
    expect(locationBadge(reports[2])).toEqual({ label: "Checking location…", tone: "neutral" });
    expect(checkStatusLabel(reports[2]!)).toMatch(/not yet checked/);
    expect(needsReview(reports[2])).toBe(false);
    expect(locationBadge(reports[0])).toBeNull(); // nothing to say – no "OK" badge either
    expect(locationBadge(reports[1])).toEqual({ label: "Check location", tone: "warning" });
    expect(locationBadge({ ...reports[1]!, acknowledged: true })).toEqual({ label: "Location confirmed", tone: "success" });
    expect(locationBadge(reports[3])).toEqual({ label: "Location error", tone: "danger" });
    expect(needsReview(reports[1])).toBe(true);
    expect(needsReview({ ...reports[1]!, acknowledged: true })).toBe(false);
    expect(checkStatusLabel({ ...reports[0]!, status: "partial", unavailable: ["no local address data configured"] })).toBe("Partly checked (no local address data configured)");
  });
  it("optimize notes name excluded stops and approach points", () => {
    const r = { engine: "or-tools", matrixSource: "osrm", unassignedStopIds: [], violations: [], locationErrors: [{ stopId: "s3", codes: ["out_of_coverage"] }], approachStopIds: ["s1"] };
    expect(optimizeProblems(r)).toContain("1 stop(s) with a wrong or unreachable location were not optimized – kept at the end, check their location");
    expect(optimizeNotes(r)).toContain("1 stop(s) routed to their accepted approach point");
  });
  it("map tooltip shows the location badge and an accepted approach", () => {
    const s = summary();
    expect(stopTooltipHtml(s, s.stops[1]!, 2, locationBadge(reports[1]))).toContain("Check location");
    expect(stopTooltipHtml(s, s.stops[3]!, 4, null)).toContain("Navigation approach: Klusriede");
  });
});

describe("TourDetail location review", () => {
  it("banner counts errors and unconfirmed warnings (not pending); stop badges agree", async () => {
    wrap(<TourDetail summary={summary()} />);
    const banner = await screen.findByTestId("location-review-banner");
    expect(banner.textContent).toMatch(/^2 stops need a location review – including location errors/);
    expect(within(row("Kunde 1")).getByTestId("stop-location-badge").textContent).toBe("Check location");
    expect(within(row("Kunde 2")).getByTestId("stop-location-badge").textContent).toBe("Checking location…");
    expect(within(row("Kunde 3")).getByTestId("stop-location-badge").textContent).toBe("Location error");
    expect(within(row("Kunde 0")).queryByTestId("stop-location-badge")).toBeNull();
  });

  it("a suggested approach is applied only after an explicit, confirmed click – with a reason on a published tour", async () => {
    const user = userEvent.setup();
    wrap(<TourDetail summary={summary()} />);
    await screen.findByTestId("location-review-banner");
    await user.click(within(row("Kunde 1")).getByRole("button", { name: /Kunde 1/ }));
    const panel = await screen.findByTestId("location-review");
    expect(calls.some((c) => c.url.includes("/approach"))).toBe(false);
    await user.click(within(panel).getByRole("button", { name: /Use as navigation approach/ }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog.textContent).toMatch(/address and the pin stay unchanged/);
    const go = within(dialog).getByRole("button", { name: /Use this approach/ }) as HTMLButtonElement;
    expect(go.disabled).toBe(true); // published tour: reason first
    expect(calls.some((c) => c.url.includes("/approach"))).toBe(false);
    await user.type(within(dialog).getByRole("textbox", { name: "Approach reason" }), "Motorway – use the side road");
    await user.click(go);
    await waitFor(() => expect(calls.find((c) => c.url.includes("/location/approach"))).toBeTruthy());
    expect(calls.find((c) => c.url.includes("/location/approach"))).toMatchObject({
      method: "POST",
      body: { lat: 52.3825, lng: 9.7405, expectedLat: stop(1).location!.lat, expectedLng: 9.74, expectedAddressVersion: 1, reason: "Motorway – use the side road" },
    });
  });

  it("confirming a warning sends the warning codes and the exact location seen", async () => {
    const user = userEvent.setup();
    wrap(<TourDetail summary={summary()} />);
    await screen.findByTestId("location-review-banner");
    await user.click(within(row("Kunde 1")).getByRole("button", { name: /Kunde 1/ }));
    await user.click(await screen.findByTestId("confirm-location"));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByRole("textbox", { name: "Note" }), "Service area delivery");
    await user.click(within(dialog).getByRole("button", { name: /Confirm/ }));
    await waitFor(() => expect(calls.find((c) => c.url.includes("/location/confirm"))).toBeTruthy());
    expect(calls.find((c) => c.url.includes("/location/confirm"))!.body).toEqual({ expectedLat: stop(1).location!.lat, expectedLng: 9.74, expectedAddressVersion: 1, issueCodes: ["motorway"], note: "Service area delivery" });
  });

  it("a pending check offers no confirmation", async () => {
    const user = userEvent.setup();
    wrap(<TourDetail summary={summary()} />);
    await screen.findByTestId("location-review-banner");
    await user.click(within(row("Kunde 2")).getByRole("button", { name: /Kunde 2/ }));
    const panel = await screen.findByTestId("location-review");
    expect(within(panel).getByTestId("location-status").textContent).toMatch(/not yet checked/);
    expect(within(panel).queryByTestId("confirm-location")).toBeNull();
  });
});

describe("address edit after publication", () => {
  it("needs a reason and sends the address version seen", async () => {
    const user = userEvent.setup();
    wrap(<StopEditActions summary={summary()} stop={summary().stops[0]!} />);
    await user.click(screen.getByRole("button", { name: /Edit address/ }));
    const dialog = await screen.findByRole("dialog");
    const street = within(dialog).getByRole("textbox", { name: "No." });
    await user.clear(street);
    await user.type(street, "1a");
    const save = within(dialog).getByRole("button", { name: /Save/ }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    await user.type(within(dialog).getByRole("textbox", { name: "Reason for the change" }), "Customer called");
    expect(save.disabled).toBe(false);
    await user.click(save);
    await waitFor(() => expect(calls.find((c) => c.method === "PATCH")).toBeTruthy());
    expect(calls.find((c) => c.method === "PATCH")!.body).toMatchObject({ address: { houseNumber: "1a" }, reason: "Customer called", expectedAddressVersion: 1 });
  });
});
