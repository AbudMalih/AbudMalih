import { createDispatchDataset } from "@turvio/shared";
import { TooltipProvider } from "@turvio/web-ui/ds";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseLatLng } from "../components/AddressSearch";
import { PlanningView } from "../components/PlanningView";
import { tourEndsSummary } from "../components/TourEndsDialog";
import { DispatchProvider, type SessionInfo } from "../lib/store";

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(""), usePathname: () => "/planning", useRouter: () => ({ push: vi.fn() }) }));

const base = createDispatchDataset(new Date("2026-11-05T10:00:00Z"));
const session: SessionInfo = { userName: "T", email: "t@example.test", role: "admin", organizationId: "org_jarbou", organizationName: "JARBOU (synthetic)", companyWide: true, workspaces: [{ id: "org_jarbou", name: "JARBOU", role: "admin" }], environment: null };
let calls: { method: string; url: string; body: unknown }[] = [];

beforeEach(() => {
  calls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      calls.push({ method, url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
      if (url.includes("/dispatch?")) return new Response(JSON.stringify(base), { status: 200 });
      if (url.includes("/v1/geocode/search"))
        return new Response(JSON.stringify({ provider: "postgres", results: [{ label: "Ernst-August-Platz 1, 30159 Hannover", location: { lat: 52.3759, lng: 9.732 }, precision: "house" }] }), { status: 200 });
      if (method === "PATCH") return new Response(JSON.stringify({ ...base.tours[0] }), { status: 200 });
      return new Response("{}", { status: 200 });
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

const wrap = () =>
  render(
    <TooltipProvider>
      <DispatchProvider base={base} session={session}>
        <PlanningView />
      </DispatchProvider>
    </TooltipProvider>,
  );

const tour = base.tours.find((t) => t.status === "planned")!;
const openDialog = async (user: ReturnType<typeof userEvent.setup>) => {
  const card = screen.getByRole("group", { name: `Tour ${tour.name}` });
  await user.click(within(card).getByRole("button", { name: /→/ }));
  return screen.findByRole("dialog");
};

describe("tour start and end", () => {
  it("summarizes start and end on the card", () => {
    const depot = base.depots.find((d) => d.id === tour.depotId)!;
    expect(tourEndsSummary(tour, depot)).toBe(`${depot.name} → ${depot.name}`);
    expect(tourEndsSummary({ ...tour, endMode: "last_stop" }, depot)).toBe(`${depot.name} → last stop`);
    expect(tourEndsSummary({ ...tour, startLocation: { lat: 1, lng: 2 }, startLabel: "Hub", endMode: "address", endLocation: { lat: 1, lng: 2 }, endLabel: "Home" }, depot)).toBe("Hub → Home");
  });

  it("'at the last stop' is saved as end mode last_stop", async () => {
    const user = userEvent.setup();
    wrap();
    const dialog = await openDialog(user);
    await user.click(within(dialog).getByRole("radio", { name: /At the last stop/ }));
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(calls.find((c) => c.method === "PATCH")).toBeTruthy());
    expect(calls.find((c) => c.method === "PATCH")!.body).toMatchObject({ start: null, end: { mode: "last_stop" } });
  });

  it("an own start address is picked from the address search", async () => {
    const user = userEvent.setup();
    wrap();
    const dialog = await openDialog(user);
    const start = within(dialog).getByRole("radiogroup", { name: "Start" });
    await user.click(within(start).getByRole("radio", { name: /Other address/ }));
    expect((within(dialog).getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(true); // no address yet
    await user.type(within(dialog).getByRole("textbox", { name: "Search address" }), "Ernst-August");
    await user.click(await within(dialog).findByRole("option", { name: /Ernst-August-Platz 1/ }));
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(calls.find((c) => c.method === "PATCH")).toBeTruthy());
    expect(calls.find((c) => c.method === "PATCH")!.body).toMatchObject({ start: { lat: 52.3759, lng: 9.732, label: "Ernst-August-Platz 1, 30159 Hannover" }, end: { mode: "depot" } });
    expect(calls.find((c) => c.url.includes("/v1/geocode/search"))!.url).toContain("country=de");
  });

  it("coordinates can be typed when no address search is available", () => {
    expect(parseLatLng("52.3759, 9.7320")).toEqual({ lat: 52.3759, lng: 9.732 });
    expect(parseLatLng("52,3759; 9,7320")).toEqual({ lat: 52.3759, lng: 9.732 });
    expect(parseLatLng("95, 9")).toBeNull();
    expect(parseLatLng("Hauptstraße 1")).toBeNull();
  });
});
