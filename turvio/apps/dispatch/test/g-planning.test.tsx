import { createDispatchDataset } from "@turvio/shared";
import { TooltipProvider } from "@turvio/web-ui/ds";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AddStopsDialog } from "../components/AddStopsDialog";
import { PlanningView } from "../components/PlanningView";
import { I18nProvider } from "../lib/i18n/client";
import { DispatchProvider, type SessionInfo } from "../lib/store";
import { UiRoot } from "../lib/ui";

/** Phase G Planning: tour rows in one bordered list instead of cards – same data and actions as the classic cards. */
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(""), usePathname: () => "/planning", useRouter: () => ({ push: vi.fn() }) }));

const base = createDispatchDataset(new Date("2026-11-05T10:00:00Z"));
const session: SessionInfo = { userName: "T", email: "t@example.test", role: "admin", organizationId: "org_jarbou", organizationName: "JARBOU", companyWide: true, workspaces: [{ id: "org_jarbou", name: "JARBOU", role: "admin" }], environment: null };
let calls: { method: string; url: string; body: unknown }[] = [];

beforeEach(() => {
  calls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ method: init?.method ?? "GET", url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
      return new Response(url.includes("/dispatch?") ? JSON.stringify(base) : url.endsWith("/events") ? "[]" : "{}", { status: 200 });
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

function wrap(ui: ReactNode, v: "g" | "classic", locale: "en" | "de" | "ar" = "en") {
  return render(
    <UiRoot ui={v}>
      <I18nProvider initial={locale}>
        <TooltipProvider>
          <DispatchProvider base={base} session={session}>
            {ui}
          </DispatchProvider>
        </TooltipProvider>
      </I18nProvider>
    </UiRoot>,
  );
}

/** Per tour: its name, publish state, figures and the names of its controls (order-independent). */
function tourGroups(container: HTMLElement) {
  return within(container)
    .getAllByRole("group", { name: /^Tour / })
    .map((el) => ({
      name: el.getAttribute("aria-label"),
      controls: within(el)
        .getAllByRole("button")
        .map((b) => b.getAttribute("aria-label") ?? b.textContent?.trim())
        .sort(),
      published: /Not published/.test(el.textContent ?? ""),
      figures: el.textContent?.match(/\d+ stops?|\d+ open|\d+ pickups?/g),
    }));
}

describe("Phase G planning", () => {
  it("tour rows carry the same tours, status, figures and actions as the classic cards", () => {
    const classic = wrap(<PlanningView />, "classic");
    const a = tourGroups(classic.container);
    const sideTexts = within(classic.container).getAllByRole("checkbox").length;
    classic.unmount();
    const g = wrap(<PlanningView />, "g");
    const b = tourGroups(g.container);
    expect(b.map((x) => x.name)).toEqual(a.map((x) => x.name));
    expect(b.map((x) => x.published)).toEqual(a.map((x) => x.published));
    expect(b.map((x) => x.figures)).toEqual(a.map((x) => x.figures));
    // Optimize is an icon button with the same accessible name; every other control is identical.
    expect(b.map((x) => x.controls)).toEqual(a.map((x) => x.controls));
    expect(within(g.container).getAllByRole("checkbox")).toHaveLength(sideTexts);
    for (const name of ["Optimize depot plan", "Add stops", "New tour"]) expect(within(g.container).getAllByRole("button", { name: new RegExp(name) }).length).toBeGreaterThan(0);
  });

  it("assigns selected unassigned stops in G", async () => {
    const user = userEvent.setup();
    wrap(<PlanningView />, "g");
    const kassel = base.unassigned.filter((u) => u.depotId === "dep_kassel");
    for (const u of kassel) await user.click(screen.getByRole("checkbox", { name: `Select ${u.recipientName}, ${u.address.street} ${u.address.houseNumber ?? ""}`.trim() }));
    await user.click(screen.getByRole("button", { name: /Assign$/ }));
    await user.click(await screen.findByRole("menuitem", { name: /KAS-01/ }));
    await waitFor(() => expect(calls.find((c) => c.method === "POST" && c.url.endsWith("/stops/assign"))).toBeTruthy());
    expect(calls.find((c) => c.url.endsWith("/stops/assign"))!.body).toEqual({ stopIds: kassel.map((u) => u.id), tourId: "tour_kas_01" });
  });

  it("keeps German and Arabic in G", () => {
    const { unmount } = wrap(<PlanningView />, "g", "de");
    expect(screen.getByRole("heading", { name: "Planung" })).toBeTruthy();
    expect(screen.getByText("Standortplan optimieren")).toBeTruthy();
    unmount();
    wrap(<PlanningView />, "g", "ar");
    expect(screen.getByRole("heading", { name: "التخطيط" })).toBeTruthy();
    expect(screen.queryByText("Optimize")).toBeNull();
  });

  it("import keeps its steps and mapping in G", async () => {
    const user = userEvent.setup();
    const tour = base.tours.find((t) => t.status === "planned")!;
    wrap(<AddStopsDialog open onOpenChange={() => {}} target={{ tourId: tour.id }} targetLabel={tour.name} />, "g");
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getAllByRole("tab")).toHaveLength(3);
    await user.click(within(dialog).getByRole("tab", { name: "CSV / Excel file" }));
    const csv = ["Sdg-Nr;Empf.;Anschrift;PLZ;Zielort", "TVO1;Kiosk;Lister Meile 44a;30161;Hannover"].join("\n");
    await user.upload(within(dialog).getByLabelText("Choose a CSV or Excel file"), new File([csv], "m.csv", { type: "text/csv" }));
    const mapping = await within(dialog).findByRole("region", { name: "Column mapping" });
    expect(within(mapping).getAllByRole("combobox")).toHaveLength(5);
  });
});
