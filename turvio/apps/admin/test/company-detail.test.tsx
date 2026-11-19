import { render, screen, waitFor, within } from "@testing-library/react";
import { Toaster } from "@turvio/web-ui/ds";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CompanyDetail, reactivationStatus } from "../components/CompanyDetail";
import type { OrgDetail } from "../lib/remote";
import { mockFetch, path, type Call } from "./fetch";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }), usePathname: () => "/companies/x" }));

const ID = "11111111-1111-4111-8111-111111111111";
const INV = "22222222-2222-4222-8222-222222222222";

function detail(o: Partial<OrgDetail> = {}): OrgDetail {
  return {
    id: ID,
    name: "Elbe Express GmbH",
    slug: "elbe",
    countryCode: "DE",
    defaultLocale: "de",
    status: "active",
    createdAt: "2026-09-01T08:00:00Z",
    subscription: { planCode: "team", planName: "Team", status: "active", interval: "month", seats: 5, trialEndsAt: null, currentPeriodEnd: "2026-12-01T00:00:00Z", cancelAtPeriodEnd: false, limitOverrides: { max_depots: 4 } },
    usage: { members: 3, activeDrivers: 4, vehicles: 3, depots: 2, toursLast30d: 40 },
    members: [
      { membershipId: "m1", userId: "u1", email: "owner@elbe.example", role: "owner", active: true, since: "2026-09-01T08:00:00Z" },
      { membershipId: "m2", userId: "u2", email: null, role: "dispatcher", active: false, since: "2026-09-02T08:00:00Z" },
    ],
    invitations: [{ id: INV, email: "new@elbe.example", role: "driver", createdAt: "2026-11-01T08:00:00Z", expiresAt: "2026-11-08T08:00:00Z" }],
    ...o,
  };
}

let current: OrgDetail;
let calls: Call[];
let patchStatus = 204;
beforeEach(() => {
  current = detail();
  patchStatus = 204;
  calls = mockFetch((c) => {
    const p = path(c);
    if (p === `/v1/platform/organizations/${ID}` && c.method === "GET") return { body: current };
    if (p === `/v1/platform/organizations/${ID}` && c.method === "PATCH") {
      if (patchStatus !== 204) return { status: patchStatus, body: { error: { code: "validation_failed", message: "Some fields are invalid" } } };
      const b = c.body as Record<string, unknown>;
      if (b.status) current = { ...current, status: b.status as OrgDetail["status"] };
      return { status: 204 };
    }
    if (p === `/v1/platform/organizations/${ID}/invitations/${INV}/resend` && c.method === "POST") return { body: { id: INV, email: "new@elbe.example", role: "driver", expiresAt: "2026-11-30T00:00:00Z", emailSent: true } };
    return undefined;
  });
});
afterEach(() => vi.unstubAllGlobals());

const patches = () => calls.filter((c) => c.method === "PATCH");

async function setup() {
  const user = userEvent.setup();
  render(
    <>
      <CompanyDetail id={ID} />
      <Toaster />
    </>,
  );
  await screen.findByRole("heading", { level: 1, name: "Elbe Express GmbH" });
  return user;
}

describe("Company detail", () => {
  it("shows status, usage vs limits, members and pending invitations", async () => {
    await setup();
    expect(screen.getAllByText("Active").length).toBeGreaterThan(0);
    expect(screen.getByText("owner@elbe.example")).toBeTruthy();
    expect(screen.getByText("Unknown account")).toBeTruthy();
    expect(screen.getByText("Deactivated")).toBeTruthy();
    expect(screen.getByText("new@elbe.example")).toBeTruthy();
    // Depots: override 4 marked as custom; drivers limited by the 5 seats.
    const depots = screen.getByRole("rowheader", { name: /Depots/ }).closest("tr")!;
    expect(within(depots).getByText("Custom")).toBeTruthy();
    expect(within(depots).getByText("4")).toBeTruthy();
    const drivers = screen.getByRole("rowheader", { name: /^Drivers/ }).closest("tr")!;
    expect(within(drivers).getByText("5")).toBeTruthy();
  });

  it("suspends only after a confirmation that explains the immediate effect", async () => {
    const user = await setup();
    await user.click(screen.getByRole("button", { name: "Suspend" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/takes effect immediately/)).toBeTruthy();
    expect(patches()).toHaveLength(0);
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(patches()).toHaveLength(0);

    await user.click(screen.getByRole("button", { name: "Suspend" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Suspend company" }));
    await waitFor(() => expect(patches()).toHaveLength(1));
    expect(patches()[0]!.body).toEqual({ status: "suspended" });
    expect(await screen.findByText("Elbe Express GmbH suspended")).toBeTruthy();
    // Reloaded: now offers reactivation.
    expect(await screen.findByRole("button", { name: "Reactivate" })).toBeTruthy();
  });

  it("reactivates to the subscription's state", async () => {
    current = detail({ status: "suspended", subscription: { ...detail().subscription!, status: "trialing", trialEndsAt: "2026-12-01T00:00:00Z" } });
    expect(reactivationStatus(current)).toBe("trialing");
    const user = await setup();
    await user.click(screen.getByRole("button", { name: "Reactivate" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Reactivate" }));
    await waitFor(() => expect(patches()[0]?.body).toEqual({ status: "trialing" }));
  });

  it("changes plan and seats with one PATCH", async () => {
    const user = await setup();
    await user.click(screen.getByRole("button", { name: "Change plan" }));
    const dialog = await screen.findByRole("dialog");
    await user.selectOptions(within(dialog).getByLabelText("Plan"), "business");
    const seats = within(dialog).getByLabelText("Driver seats");
    await user.clear(seats);
    await user.type(seats, "12");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(patches()).toHaveLength(1));
    expect(patches()[0]!.body).toEqual({ planCode: "business", seats: 12 });
    expect(await screen.findByText("Plan saved")).toBeTruthy();
  });

  it("limit overrides: empty fields go back to the plan default (null)", async () => {
    const user = await setup();
    await user.click(screen.getByRole("button", { name: "Limits" }));
    const dialog = await screen.findByRole("dialog");
    const depots = within(dialog).getByLabelText("Depots") as HTMLInputElement;
    expect(depots.value).toBe("4");
    await user.clear(depots);
    await user.type(within(dialog).getByLabelText("Vehicles"), "7");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(patches()).toHaveLength(1));
    expect(patches()[0]!.body).toEqual({ limitOverrides: { max_drivers: null, max_dispatchers: null, max_depots: null, max_vehicles: 7, max_stops_per_month: null } });
  });

  it("sets the trial end as the end of the chosen day", async () => {
    const user = await setup();
    await user.click(screen.getByRole("button", { name: "Trial end" }));
    const dialog = await screen.findByRole("dialog");
    const input = within(dialog).getByLabelText("Trial ends");
    await user.clear(input);
    await user.type(input, "2026-12-24");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(patches()).toHaveLength(1));
    expect(patches()[0]!.body).toEqual({ trialEndsAt: new Date("2026-12-24T23:59:59").toISOString() });
  });

  it("resends a pending invitation", async () => {
    const user = await setup();
    await user.click(screen.getByRole("button", { name: "Resend invitation to new@elbe.example" }));
    await waitFor(() => expect(calls.some((c) => c.method === "POST" && path(c) === `/v1/platform/organizations/${ID}/invitations/${INV}/resend`)).toBe(true));
    expect(await screen.findByText("Invitation sent again to new@elbe.example")).toBeTruthy();
  });

  it("shows a friendly error toast when a change fails", async () => {
    patchStatus = 400;
    const user = await setup();
    await user.click(screen.getByRole("button", { name: "Change plan" }));
    const dialog = await screen.findByRole("dialog");
    await user.selectOptions(within(dialog).getByLabelText("Plan"), "business");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Change not saved")).toBeTruthy();
    expect(screen.getByText(/Some values are not valid/)).toBeTruthy();
    expect(screen.queryByText(/HTTP|400|Some fields are invalid/)).toBeNull();
  });

  it("redirects to two-step verification when the API asks for it", async () => {
    vi.unstubAllGlobals();
    mockFetch(() => ({ status: 403, body: { error: { code: "mfa_required", message: "x" } } }));
    const assign = vi.fn();
    const loc = window.location;
    Object.defineProperty(window, "location", { configurable: true, value: { ...loc, pathname: `/companies/${ID}`, search: "", assign } });
    try {
      render(<CompanyDetail id={ID} />);
      await waitFor(() => expect(assign).toHaveBeenCalledWith(`/security?required=1&next=${encodeURIComponent(`/companies/${ID}`)}`));
    } finally {
      Object.defineProperty(window, "location", { configurable: true, value: loc });
    }
  });
});
