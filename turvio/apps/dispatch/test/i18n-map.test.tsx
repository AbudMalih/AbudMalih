import { createDispatchDataset } from "@turvio/shared";
import { TooltipProvider } from "@turvio/web-ui/ds";
import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ListView } from "../components/ListView";
import { OpsSummary } from "../components/OpsSummary";
import { createT, type Locale } from "../lib/i18n";
import { I18nProvider } from "../lib/i18n/client";
import { actionLabel, checkStatusLabel, locationBadge, precisionLabel, type LocationReport } from "../lib/locations";
import { DispatchProvider, type SessionInfo } from "../lib/store";

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(""), usePathname: () => "/list", useRouter: () => ({ push: vi.fn() }) }));

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

const wrap = (ui: ReactNode, locale: Locale) =>
  render(
    <I18nProvider initial={locale}>
      <TooltipProvider>
        <DispatchProvider base={base} session={session}>
          {ui}
        </DispatchProvider>
      </TooltipProvider>
    </I18nProvider>,
  );

describe("map group in German and Arabic", () => {
  it("ListView: headings, search and columns in German", () => {
    wrap(<ListView />, "de");
    expect(screen.getByRole("heading", { name: "Touren" })).toBeTruthy();
    expect(screen.getByRole("searchbox", { name: "Touren suchen" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: /Fahrer/ })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: /Ende/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Nächste Seite" })).toBeTruthy();
    expect(screen.queryByRole("searchbox", { name: "Search tours" })).toBeNull();
    expect(screen.queryByText("Tours")).toBeNull();
    expect(document.body.textContent).not.toContain("completion from road times");
  });

  it("ListView: Arabic labels and flipped page arrows", () => {
    wrap(<ListView />, "ar");
    expect(screen.getByRole("heading", { name: "الجولات" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: /السائق/ })).toBeTruthy();
    const next = screen.getByRole("button", { name: "الصفحة التالية" });
    expect(next.querySelector("svg")?.getAttribute("class")).toContain("rtl:-scale-x-100");
    expect(screen.queryByText("Previous page")).toBeNull();
  });

  it("OpsSummary: KPI labels translated", () => {
    const { unmount } = wrap(<OpsSummary />, "de");
    const de = within(screen.getByRole("region", { name: "Betriebsübersicht" }));
    expect(de.getByText("Aktive Touren")).toBeTruthy();
    expect(de.getByText("Verspätete Touren")).toBeTruthy();
    expect(de.queryByText("Active tours")).toBeNull();
    unmount();
    wrap(<OpsSummary />, "ar");
    const ar = within(screen.getByRole("region", { name: "ملخص العمليات" }));
    expect(ar.getByText("الجولات النشطة")).toBeTruthy();
    expect(ar.queryByText("Pickups")).toBeNull();
  });

  it("location check wording follows the language; English stays the default", () => {
    const r: LocationReport = { stopId: "s", status: "checked", severity: "warning", issues: [], unavailable: [], confirmation: null, approach: null, acknowledged: false };
    expect(locationBadge(r)).toEqual({ label: "Check location", tone: "warning" });
    expect(locationBadge(r, createT("de"))).toEqual({ label: "Standort prüfen", tone: "warning" });
    expect(locationBadge({ ...r, status: "pending", severity: null }, createT("ar"))!.label).toBe("جارٍ التحقق من الموقع…");
    expect(checkStatusLabel({ ...r, status: "partial" }, createT("de"))).toBe("Teilweise geprüft (einige Prüfungen nicht verfügbar)");
    expect(precisionLabel("manual_pin", createT("de"))).toBe("von Hand gesetzt");
    expect(precisionLabel("custom_code", createT("de"))).toBe("custom_code");
    expect(actionLabel("location_changed")).toBe("Pin moved");
    expect(actionLabel("location_changed", createT("ar"))).toBe("تم نقل الدبوس");
  });
});
