import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CompanyTable, PAGE_SIZE } from "../components/CompanyTable";
import type { OrgListItem } from "../lib/remote";
import { mockFetch, path, type Call } from "./fetch";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn(), prefetch: vi.fn() }), usePathname: () => "/companies" }));

const org = (i: number, o: Partial<OrgListItem> = {}): OrgListItem => ({
  id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
  name: `Company ${i}`,
  slug: `company-${i}`,
  countryCode: "DE",
  status: "active",
  createdAt: "2026-10-01T08:00:00Z",
  subscription: { planCode: "team", status: "active", seats: 5, trialEndsAt: null },
  members: 3,
  activeDrivers: 2,
  ...o,
});
const ALL = [org(1, { name: "Elbe Express", subscription: null }), org(2, { name: "Hansefracht", status: "suspended" }), ...Array.from({ length: 30 }, (_, i) => org(i + 3))];

let calls: Call[];
beforeEach(() => {
  calls = mockFetch((c) => {
    const u = new URL(path(c), "http://x");
    if (u.pathname !== "/v1/platform/organizations") return undefined;
    const q = u.searchParams.get("q")?.toLowerCase();
    const status = u.searchParams.get("status");
    const list = ALL.filter((o) => (!q || o.name.toLowerCase().includes(q)) && (!status || o.status === status));
    const offset = Number(u.searchParams.get("offset"));
    return { body: { total: list.length, organizations: list.slice(offset, offset + Number(u.searchParams.get("limit"))) } };
  });
});
afterEach(() => vi.unstubAllGlobals());

const bodyRows = () => within(screen.getByRole("table")).getAllByRole("row").slice(1);

describe("Companies list (GET /v1/platform/organizations)", () => {
  it("shows every company, also those without a subscription ('No plan')", async () => {
    render(<CompanyTable />);
    await waitFor(() => expect(bodyRows()).toHaveLength(PAGE_SIZE));
    expect(path(calls[0]!)).toBe(`/v1/platform/organizations?limit=${PAGE_SIZE}&offset=0`);
    const elbe = bodyRows()[0]!;
    expect(within(elbe).getByText("Elbe Express")).toBeTruthy();
    expect(within(elbe).getByText("No plan")).toBeTruthy();
    expect(within(bodyRows()[1]!).getByText("Suspended")).toBeTruthy();
    expect(screen.getByText(`1–${PAGE_SIZE} of ${ALL.length}`)).toBeTruthy();
    // No placeholder actions are left in the row menu.
    expect(screen.queryByText(/Change plan|Suspend company|Needs login|Billing/)).toBeNull();
  });

  it("searches on the server", async () => {
    const user = userEvent.setup();
    render(<CompanyTable />);
    await waitFor(() => expect(bodyRows().length).toBeGreaterThan(0));
    await user.type(screen.getByRole("searchbox", { name: "Search companies" }), "hanse");
    await waitFor(() => expect(bodyRows()).toHaveLength(1));
    expect(calls.some((c) => path(c).includes("q=hanse"))).toBe(true);
  });

  it("filters by status and pages with offset", async () => {
    const user = userEvent.setup();
    render(<CompanyTable />);
    await waitFor(() => expect(bodyRows()).toHaveLength(PAGE_SIZE));
    await user.click(screen.getByRole("button", { name: "Next page" }));
    await waitFor(() => expect(screen.getByText(`${PAGE_SIZE + 1}–${ALL.length} of ${ALL.length}`)).toBeTruthy());
    expect(calls.some((c) => path(c).includes(`offset=${PAGE_SIZE}`))).toBe(true);
    await user.click(screen.getByRole("button", { name: "All statuses" }));
    await user.click(await screen.findByRole("menuitem", { name: "Suspended" }));
    await waitFor(() => expect(bodyRows()).toHaveLength(1));
    expect(path(calls.at(-1)!)).toContain("status=suspended");
    expect(path(calls.at(-1)!)).toContain("offset=0");
  });

  it("shows a friendly error with retry", async () => {
    vi.unstubAllGlobals();
    mockFetch(() => ({ status: 500, body: { error: { code: "internal", message: "boom" } } }));
    render(<CompanyTable />);
    expect(await screen.findByText(/not reachable right now/)).toBeTruthy();
    expect(screen.queryByText(/500|boom/)).toBeNull();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  });
});
