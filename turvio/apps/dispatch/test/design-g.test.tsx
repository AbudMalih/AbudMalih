import { createDispatchDataset } from "@turvio/shared";
import { render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@turvio/web-ui/ds";
import { OpsSummary } from "../components/OpsSummary";
import { TourList } from "../components/TourList";
import { I18nProvider } from "../lib/i18n/client";
import { DispatchProvider, type SessionInfo } from "../lib/store";
import { UiRoot } from "../lib/ui";
import { resolveUi } from "../lib/ui-flag";
import { PICK_COLORS } from "../components/LocationPickerMap";

/**
 * Phase G design: default in Dispatch, classic as fallback; same data and behaviour in both designs, translations kept.
 */
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(""), usePathname: () => "/map", useRouter: () => ({ push: vi.fn() }) }));
const base = createDispatchDataset(new Date("2026-11-05T10:00:00Z"));
const session: SessionInfo = { userName: "T", email: "t@example.test", role: "admin", organizationId: "org_jarbou", organizationName: "JARBOU", companyWide: true, workspaces: [], environment: null };
beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => new Response(url.includes("/dispatch?") ? JSON.stringify(base) : url.endsWith("/events") ? "[]" : "{}", { status: 200 })));
});

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

describe("Phase G design preview", () => {
  it("is the Dispatch default; the previous design only when explicitly chosen", () => {
    expect(resolveUi(undefined)).toBe("g");
    expect(resolveUi("1")).toBe("g");
    expect(resolveUi("classic")).toBe("classic");
  });

  it("KPI band shows the same figures and links in both designs", () => {
    const classic = wrap(<OpsSummary />, "classic");
    const figures = (el: HTMLElement) => within(el).getAllByText(/^\d+$/).map((n) => n.textContent);
    const a = figures(classic.container);
    const links = [...classic.container.querySelectorAll("a")].map((x) => x.getAttribute("href"));
    classic.unmount();
    const g = wrap(<OpsSummary />, "g");
    expect(figures(g.container)).toEqual(a);
    expect([...g.container.querySelectorAll("a")].map((x) => x.getAttribute("href"))).toEqual(links);
    // No coloured icon tiles in G.
    expect(g.container.querySelectorAll("svg")).toHaveLength(0);
  });

  it("G keeps translations (German and Arabic) and the tour list behaviour", () => {
    wrap(<OpsSummary />, "g", "de");
    expect(screen.getByText("Aktive Touren")).toBeTruthy();
    wrap(<TourList />, "g", "ar");
    expect(within(screen.getByRole("list", { name: "الجولات" })).getAllByRole("listitem")).toHaveLength(base.tours.length);
  });

  it("G styles are scoped to the data-ds attribute; Admin uses the same flag with the same fallback", () => {
    const tokens = readFileSync(join(__dirname, "../../../packages/web-ui/src/ds/tokens.css"), "utf8");
    const gBlocks = tokens.match(/:root\[data-ds="g"\][^{]*\{/g) ?? [];
    expect(gBlocks.length).toBeGreaterThanOrEqual(3);
    const admin = readFileSync(join(__dirname, "../../admin/app/layout.tsx"), "utf8");
    expect(admin).toMatch(/tv_ui/);
    expect(admin).toMatch(/=== "classic"/);
    expect(admin).toMatch(/defaultTheme="dark"/);
  });

  it("location picker: indigo in G, the classic violet unchanged", () => {
    expect(PICK_COLORS.classic.pick).toBe("#6F55FF");
    expect(PICK_COLORS.g.pick).toBe("#5E6AD2");
  });
});
