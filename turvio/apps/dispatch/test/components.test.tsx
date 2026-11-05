import { createDispatchDataset, scopeDispatchDataset } from "@turvio/shared";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { ListView } from "../components/ListView";
import { PickupsView } from "../components/PickupsView";
import { PlanningView } from "../components/PlanningView";
import { TourList } from "../components/TourList";
import { DispatchProvider } from "../lib/store";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(""),
  usePathname: () => "/list",
  useRouter: () => ({ push: vi.fn() }),
}));

const base = createDispatchDataset(new Date("2026-11-05T10:00:00Z"));
const session = { userName: "Test", email: "t@example.test", role: "admin", organizationName: "JARBOU (synthetic)", companyWide: true };

function wrap(ui: ReactNode, data = base) {
  return render(
    <DispatchProvider base={data} session={session}>
      {ui}
    </DispatchProvider>,
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
    expect(list().getByText("HAN-02")).toBeTruthy();
    await user.click(screen.getByRole("tab", { name: /^All/ }));
    await user.type(screen.getByRole("searchbox", { name: "Search tours and drivers" }), "kassel");
    expect(list().getAllByRole("listitem").every((li) => li.textContent?.includes("Kassel"))).toBe(true);
  });

  it("selects a tour", async () => {
    const user = userEvent.setup();
    wrap(<TourList />);
    const btn = screen.getByRole("button", { name: /BRE-01/ });
    await user.click(btn);
    expect(btn.getAttribute("aria-pressed")).toBe("true");
  });

  it("shows only permitted depots for a scoped dispatcher", () => {
    const scoped = scopeDispatchDataset(base, { organizationId: "org_jarbou", userId: "u", role: "dispatcher", active: true, depotIds: ["dep_haiger"] });
    wrap(<TourList />, scoped);
    const items = within(screen.getByRole("list", { name: "Tours" })).getAllByRole("listitem");
    expect(items.every((li) => li.textContent?.includes("Haiger"))).toBe(true);
  });
});

describe("ListView", () => {
  it("sorts, filters and opens the tour drawer", async () => {
    const user = userEvent.setup();
    wrap(<ListView />);
    const rows = () => within(screen.getByRole("table")).getAllByRole("row").slice(1);
    expect(rows()).toHaveLength(8); // first page
    const left = screen.getByRole("columnheader", { name: /Left/ });
    await user.click(within(left).getByRole("button"));
    expect(left.getAttribute("aria-sort")).toBe("ascending");
    expect(within(rows()[0]!).getAllByRole("cell")[6]!.textContent).toBe("0");
    await user.type(screen.getByRole("searchbox", { name: "Search tours" }), "HAN-02");
    expect(rows()).toHaveLength(1);
    await user.click(within(rows()[0]!).getByRole("button", { name: /HAN-02/ }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Tour HAN-02")).toBeTruthy();
    expect(within(dialog).getByText(/time windows? will be missed/)).toBeTruthy();
  });
});

describe("PlanningView", () => {
  it("assigns unassigned stops to a tour in the draft", async () => {
    const user = userEvent.setup();
    wrap(<PlanningView />);
    const total = base.unassigned.length;
    expect(screen.getByText(`Unassigned stops · ${total}`)).toBeTruthy();
    const kassel = base.unassigned.filter((u) => u.depotId === "dep_kassel");
    for (const u of kassel) await user.click(screen.getByRole("checkbox", { name: `Select ${u.recipientName}, ${u.address.street} ${u.address.houseNumber ?? ""}`.trim() }));
    await user.click(screen.getByRole("button", { name: /Assign$/ }));
    await user.click(await screen.findByRole("menuitem", { name: /KAS-01/ }));
    expect(screen.getByText(`Unassigned stops · ${total - kassel.length}`)).toBeTruthy();
    expect(screen.getByText(new RegExp(`Local planning draft · ${kassel.length} change`))).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /Discard draft/ }));
    expect(screen.getByText(`Unassigned stops · ${total}`)).toBeTruthy();
  });

  it("creates a new tour through the dialog", async () => {
    const user = userEvent.setup();
    wrap(<PlanningView />);
    await user.click(screen.getByRole("button", { name: /New tour/ }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Create tour" }));
    expect(await screen.findByText("HAN-04")).toBeTruthy();
  });
});

describe("PickupsView", () => {
  it("shows pickups needing attention by default and all on request", async () => {
    const user = userEvent.setup();
    wrap(<PickupsView />);
    const rows = () => within(screen.getByRole("table")).getAllByRole("row").slice(1);
    const attention = rows().length;
    expect(attention).toBeGreaterThan(0);
    await user.click(screen.getByRole("tab", { name: /^All/ }));
    expect(rows().length).toBeGreaterThan(attention);
    await user.click(screen.getByRole("tab", { name: /Unassigned/ }));
    expect(rows().every((r) => r.textContent?.includes("Not on a tour"))).toBe(true);
  });
});
