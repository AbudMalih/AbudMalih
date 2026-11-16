import { createDispatchDataset, type Tour } from "@turvio/shared";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TourActionsMenu } from "../components/TourActions";
import { ToursManager } from "../components/ToursManager";
import { TooltipProvider } from "@turvio/web-ui/ds";
import type { Locale } from "../lib/i18n";
import { I18nProvider } from "../lib/i18n/client";
import { reasonText } from "../lib/lifecycle";
import { DispatchProvider, type SessionInfo } from "../lib/store";
import type { ListedTour } from "../lib/lifecycle";

/** Tours manager, tour actions and server reason codes in German and Arabic. */
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(""),
  usePathname: () => "/list",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const base = createDispatchDataset(new Date("2026-11-05T10:00:00Z"));
const session: SessionInfo = {
  userName: "Test",
  email: "t@example.test",
  role: "admin",
  organizationId: "org_jarbou",
  organizationName: "JARBOU (synthetic)",
  companyWide: true,
  workspaces: [{ id: "org_jarbou", name: "JARBOU", role: "admin" }],
  environment: null,
};
const tour = (over: Partial<Tour>): Tour => ({ ...base.tours[0]!, version: 3, publishedAt: null, archivedAt: null, closedAt: null, closedRemotely: false, closeReason: null, ...over });
const completed = tour({ id: "t_done", name: "HAN-01", status: "completed", closedAt: "2026-11-05T16:00:00Z" });
const running = tour({ id: "t_run", name: "HAN-02", status: "in_progress", publishedAt: "2026-11-05T06:00:00Z" });
const listed = (t: Tour): ListedTour => ({ tour: t, depotName: "Hannover", driverName: "Lena Hoffmann", vehicleLabel: null, stops: { total: 4, open: 1, delivered: 3, notDelivered: 0, cancelled: 0, skipped: 0 } });

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      const json = (b: unknown) => new Response(JSON.stringify(b), { status: 200 });
      if (url.includes("/dispatch?")) return json(base);
      if (url.endsWith("/events")) return json([]);
      if (url.includes("/location-checks")) return json({ checks: [], pending: false });
      if (url.includes("/tours/calendar")) return json({ month: "2026-11", days: [{ day: "2026-11-05", tours: 3, archived: 0, cancelled: 0, completed: 1, active: 1, empty: 1 }] });
      if (url.includes("/tours/bulk/preview"))
        return json({
          summary: { action: body.action, selected: 2, eligible: 1, protected: 1, unchanged: 0, affectedStops: 4, completedDeliveries: 3 },
          tours: [
            { id: "t_run", name: "HAN-02", date: "2026-11-05", status: "in_progress", published: true, archived: false, driverName: null, stops: 4, completedDeliveries: 3, openStops: 1, eligible: false, unchanged: false, reasons: ["active"], version: 3 },
          ],
        });
      if (url.includes("/delete-eligibility"))
        return json({
          tour: { id: "t_done", name: "HAN-01", date: completed.date, status: "completed", driverName: "Lena Hoffmann", version: 3 },
          eligible: false,
          reasons: ["status_completed", "proofs"],
          stops: 4, processedStops: 3, stopEvents: 6, proofs: 2, scannedParcels: 0, locationPoints: 0, completedDeliveries: 3,
        });
      if (url.includes("/tours?")) return json({ range: { from: "2026-11-05", to: "2026-11-05" }, total: 2, limit: 25, offset: 0, tours: [listed(completed), listed(running)] });
      return json({});
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

function wrap(ui: ReactNode, locale: Locale) {
  return render(
    <I18nProvider initial={locale}>
      <TooltipProvider>
        <DispatchProvider base={base} session={session}>
          {ui}
        </DispatchProvider>
      </TooltipProvider>
    </I18nProvider>,
  );
}

describe("tours in German", () => {
  it("manager, calendar (Intl month and weekdays) and bulk preview reasons are German", async () => {
    const user = userEvent.setup();
    wrap(<ToursManager archived="exclude" />, "de");
    await screen.findByText("HAN-01");
    expect(screen.getByRole("tab", { name: "Monat" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Tag aufräumen/ })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Fahrer" })).toBeTruthy();
    expect(screen.getAllByText("Abgeschlossen").length).toBeGreaterThan(0);
    expect(screen.queryByText("Only empty tours")).toBeNull();
    await user.click(screen.getByRole("button", { name: /Kalender/ }));
    expect(await screen.findByText("November 2026")).toBeTruthy();
    const monday = new Intl.DateTimeFormat("de-DE", { weekday: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2024, 0, 1)));
    expect(screen.getByText(monday)).toBeTruthy();
    expect(await screen.findByRole("button", { name: "2026-11-05: 3 Touren" })).toBeTruthy();
    await user.click(screen.getByRole("checkbox", { name: `HAN-01 ${completed.date} auswählen` }));
    expect(screen.getByTestId("selection-count").textContent).toBe("1 ausgewählt");
    await user.click(within(screen.getByRole("region", { name: "Sammelaktionen" })).getByRole("button", { name: /Archivieren/ }));
    const preview = await screen.findByTestId("bulk-preview");
    expect(within(preview).getByText("Wird geändert")).toBeTruthy();
    expect(within(preview).getByText(/HAN-02 \(2026-11-05\) – läuft gerade – beenden oder stornieren Sie sie zuerst/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "1 Tour archivieren" })).toBeTruthy();
  });

  it("delete dialog explains protection codes and records in German", async () => {
    const user = userEvent.setup();
    wrap(<TourActionsMenu item={{ tour: completed, stopCount: 4 }} />, "de");
    await user.click(screen.getByRole("button", { name: "Aktionen für HAN-01" }));
    await user.click(await screen.findByRole("menuitem", { name: "Endgültig löschen…" }));
    const preview = await screen.findByTestId("delete-preview");
    expect(within(preview).getByText("Diese Tour hat Zustellnachweise.")).toBeTruthy();
    expect(within(preview).getByText(/3 Stopps mit Ergebnis · 6 Einträge im Stoppverlauf · 2 Zustellnachweise/)).toBeTruthy();
    expect(within(preview).queryByText(/has proofs of delivery/)).toBeNull();
  });
});

describe("tours in Arabic", () => {
  it("manager and calendar are Arabic", async () => {
    const user = userEvent.setup();
    wrap(<ToursManager archived="exclude" />, "ar");
    await screen.findByText("HAN-01");
    expect(screen.getByRole("tab", { name: "شهر" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "السائق" })).toBeTruthy();
    expect(screen.queryByText("Calendar")).toBeNull();
    await user.click(screen.getByRole("button", { name: /التقويم/ }));
    expect(await screen.findByText("نوفمبر 2026")).toBeTruthy();
    expect(await screen.findByRole("button", { name: "2026-11-05: 3 جولات" })).toBeTruthy();
  });

  it("menu items and reason codes are Arabic", async () => {
    const user = userEvent.setup();
    wrap(<TourActionsMenu item={{ tour: running, stopCount: 4 }} />, "ar");
    await user.click(screen.getByRole("button", { name: "إجراءات HAN-02" }));
    const items = (await screen.findAllByRole("menuitem")).map((m) => m.textContent);
    expect(items).toEqual(expect.arrayContaining(["إنهاء عن بُعد…", "إلغاء الجولة…"]));
    expect(items).not.toContain("Finish remotely…");
  });
});

describe("reasonText", () => {
  it("is English by default and keeps unknown codes readable", () => {
    expect(reasonText("proofs")).toBe("has proofs of delivery");
    expect(reasonText("some_new_code")).toBe("some new code");
  });
});
