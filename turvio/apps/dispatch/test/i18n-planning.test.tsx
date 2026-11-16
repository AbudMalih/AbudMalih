import { createDispatchDataset } from "@turvio/shared";
import { TooltipProvider } from "@turvio/web-ui/ds";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PlanningView } from "../components/PlanningView";
import { TourList } from "../components/TourList";
import { tourEndsSummary } from "../components/TourEndsDialog";
import { createT, type Locale } from "../lib/i18n";
import { I18nProvider } from "../lib/i18n/client";
import { DispatchProvider, type SessionInfo } from "../lib/store";

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(""), usePathname: () => "/planning", useRouter: () => ({ push: vi.fn() }) }));

const base = createDispatchDataset(new Date("2026-11-05T10:00:00Z"));
const session: SessionInfo = { userName: "T", email: "t@example.test", role: "admin", organizationId: "org_jarbou", organizationName: "JARBOU (synthetic)", companyWide: true, workspaces: [{ id: "org_jarbou", name: "JARBOU", role: "admin" }], environment: null };

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url.includes("/dispatch?")) return new Response(JSON.stringify(base), { status: 200 });
      if (url.endsWith("/events")) return new Response("[]", { status: 200 });
      return new Response("{}", { status: 200 });
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

const wrap = (locale: Locale, ui: ReactNode) =>
  render(
    <I18nProvider initial={locale}>
      <TooltipProvider>
        <DispatchProvider base={base} session={session}>
          {ui}
        </DispatchProvider>
      </TooltipProvider>
    </I18nProvider>,
  );

describe("planning group in German and Arabic", () => {
  it("PlanningView in German", () => {
    wrap("de", <PlanningView />);
    expect(screen.getByRole("heading", { name: "Planung" })).toBeTruthy();
    expect(screen.getAllByText("Neue Tour").length).toBeGreaterThan(0);
    expect(screen.getByText("Standortplan optimieren")).toBeTruthy();
    expect(screen.queryByText("Planning")).toBeNull();
    expect(screen.queryByText("Optimize depot plan")).toBeNull();
  });

  it("PlanningView and tour detail in Arabic", async () => {
    const user = userEvent.setup();
    wrap("ar", <PlanningView />);
    expect(screen.getByRole("heading", { name: "التخطيط" })).toBeTruthy();
    expect(screen.getByText("تحسين خطة الموقع")).toBeTruthy();
    expect(screen.queryByText("Add stops")).toBeNull();
    const tour = base.tours.find((t) => t.status === "planned")!;
    const card = screen.getByRole("group", { name: `الجولة ${tour.name}` });
    await user.click(within(card).getByRole("button", { name: tour.name }));
    const sheet = await screen.findByRole("dialog");
    expect(within(sheet).getAllByText("المحطات بالترتيب").length).toBeGreaterThan(0);
    expect(within(sheet).queryByText("Stops in order")).toBeNull();
    expect(within(sheet).getByTestId("tour-progress").textContent).toMatch(/^أُنجزت \d+ من \d+ محطة$/);
  });

  it("TourList filters in German and Arabic", () => {
    const { unmount } = wrap("de", <TourList />);
    expect(screen.getByRole("tab", { name: /Unterwegs/ })).toBeTruthy();
    expect(screen.queryByRole("tab", { name: /On route/ })).toBeNull();
    unmount();
    wrap("ar", <TourList />);
    expect(screen.getByRole("tab", { name: /في الطريق/ })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /منجزة/ })).toBeTruthy();
  });

  it("tour start/end summary is translated (English stays default)", () => {
    const tour = { ...base.tours[0]!, endMode: "last_stop" as const };
    const depot = base.depots.find((d) => d.id === tour.depotId)!;
    expect(tourEndsSummary(tour, depot)).toBe(`${depot.name} → last stop`);
    expect(tourEndsSummary(tour, depot, createT("de"))).toBe(`${depot.name} → letzter Stopp`);
    expect(tourEndsSummary(tour, depot, createT("ar"))).toBe(`${depot.name} ← آخر محطة`);
  });
});
