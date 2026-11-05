import { createDispatchDataset, scopeDispatchDataset, type DispatchDataset } from "@turvio/shared";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ListView } from "../components/ListView";
import { PickupsView } from "../components/PickupsView";
import { PlanningView } from "../components/PlanningView";
import { TourList } from "../components/TourList";
import { TooltipProvider } from "@turvio/web-ui/ds";
import { DispatchProvider, type SessionInfo } from "../lib/store";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(""),
  usePathname: () => "/list",
  useRouter: () => ({ push: vi.fn() }),
}));

const base = createDispatchDataset(new Date("2026-11-05T10:00:00Z"));
const session: SessionInfo = {
  userName: "Test Dispatcher",
  email: "t@example.test",
  role: "admin",
  organizationId: "org_jarbou",
  organizationName: "JARBOU (synthetic)",
  companyWide: true,
  workspaces: [{ id: "org_jarbou", name: "JARBOU", role: "admin" }],
  environment: null,
};

let calls: { method: string; url: string; body: unknown }[] = [];
let current: DispatchDataset = base;

beforeEach(() => {
  calls = [];
  current = base;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      calls.push({ method, url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
      if (url.includes("/dispatch?")) return new Response(JSON.stringify(current), { status: 200 });
      if (url.endsWith("/events")) return new Response("[]", { status: 200 });
      if (method === "POST" && url.endsWith("/tours")) return new Response(JSON.stringify({ ...base.tours[0], id: "new-tour", name: "HAN-04", version: 1 }), { status: 201 });
      if (method === "POST" && url.endsWith("/stops/assign")) return new Response(null, { status: 204 });
      return new Response("{}", { status: 200 });
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

function wrap(ui: ReactNode, data = base) {
  return render(
    <TooltipProvider>
      <DispatchProvider base={data} session={session}>
        {ui}
      </DispatchProvider>
    </TooltipProvider>,
  );
}

describe("TourList", () => {
  it("filters by status and search", async () => {
    const user = userEvent.setup();
    wrap(<TourList />);
    const list = () => within(screen.getByRole("list", { name: "Tours" }));
    expect(list().getAllByRole("listitem")).toHaveLength(base.tours.length);
    await user.click(screen.getByRole("tab", { name: /Delayed/ }));
    expect(list().getAllByRole("listitem")).toHaveLength(1);
    await user.click(screen.getByRole("tab", { name: /^All/ }));
    await user.type(screen.getByRole("searchbox", { name: "Search tours and drivers" }), "kassel");
    expect(list().getAllByRole("listitem").every((li) => li.textContent?.includes("Kassel"))).toBe(true);
  });

  it("shows only permitted depots for a scoped dispatcher", () => {
    const scoped = scopeDispatchDataset(base, { organizationId: "org_jarbou", userId: "u", role: "dispatcher", active: true, depotIds: ["dep_haiger"] });
    wrap(<TourList />, scoped);
    const items = within(screen.getByRole("list", { name: "Tours" })).getAllByRole("listitem");
    expect(items.every((li) => li.textContent?.includes("Haiger"))).toBe(true);
  });
});

describe("ListView", () => {
  it("sorts, searches and opens the tour drawer with publish state and activity", async () => {
    const user = userEvent.setup();
    wrap(<ListView />);
    const rows = () => within(screen.getByRole("table")).getAllByRole("row").slice(1);
    const left = screen.getByRole("columnheader", { name: /Left/ });
    await user.click(within(left).getByRole("button"));
    expect(left.getAttribute("aria-sort")).toBe("ascending");
    await user.type(screen.getByRole("searchbox", { name: "Search tours" }), "HAN-02");
    expect(rows()).toHaveLength(1);
    await user.click(within(rows()[0]!).getByRole("button", { name: /HAN-02/ }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Not published")).toBeTruthy();
    await waitFor(() => expect(calls.some((c) => c.url.includes("/tours/tour_han_02/events"))).toBe(true));
  });
});

describe("PlanningView", () => {
  it("assigns unassigned stops through the API and reloads", async () => {
    const user = userEvent.setup();
    wrap(<PlanningView />);
    const kassel = base.unassigned.filter((u) => u.depotId === "dep_kassel");
    for (const u of kassel) await user.click(screen.getByRole("checkbox", { name: `Select ${u.recipientName}, ${u.address.street} ${u.address.houseNumber ?? ""}`.trim() }));
    await user.click(screen.getByRole("button", { name: /Assign$/ }));
    await user.click(await screen.findByRole("menuitem", { name: /KAS-01/ }));
    await waitFor(() => expect(calls.find((c) => c.method === "POST" && c.url.endsWith("/stops/assign"))).toBeTruthy());
    const call = calls.find((c) => c.url.endsWith("/stops/assign"))!;
    expect(call.url).toBe("/api/turvio/v1/orgs/org_jarbou/stops/assign");
    expect(call.body).toEqual({ stopIds: kassel.map((u) => u.id), tourId: "tour_kas_01" });
    await waitFor(() => expect(calls.some((c) => c.url.includes("/dispatch?date="))).toBe(true));
  });

  it("creates a tour through the dialog", async () => {
    const user = userEvent.setup();
    wrap(<PlanningView />);
    await user.click(screen.getByRole("button", { name: /New tour/ }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Create tour" }));
    await waitFor(() => expect(calls.find((c) => c.method === "POST" && c.url.endsWith("/tours"))).toBeTruthy());
    expect(calls.find((c) => c.url.endsWith("/tours"))!.body).toMatchObject({ depotId: "dep_hannover", plannedStartMinute: 450, date: base.date });
  });

  it("shows an empty state with a call to action for days without tours", () => {
    wrap(<PlanningView />, { ...base, tours: [], stops: [], unassigned: [] });
    expect(screen.getByText(`No tours planned for ${base.date}`)).toBeTruthy();
  });
});

describe("PickupsView", () => {
  it("shows pickups needing attention by default and all on request", async () => {
    const user = userEvent.setup();
    wrap(<PickupsView />);
    const rows = () => within(screen.getByRole("table")).getAllByRole("row").slice(1);
    const attention = rows().length;
    await user.click(screen.getByRole("tab", { name: /^All/ }));
    expect(rows().length).toBeGreaterThan(attention);
  });
});
