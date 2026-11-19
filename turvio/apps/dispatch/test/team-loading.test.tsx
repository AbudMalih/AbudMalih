import { createDispatchDataset } from "@turvio/shared";
import { TooltipProvider } from "@turvio/web-ui/ds";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FleetView } from "../components/FleetView";
import { I18nProvider } from "../lib/i18n/client";
import { DispatchProvider, type SessionInfo } from "../lib/store";

/**
 * Fleet & team → Team (staging defect "Team does not load"): the list is fetched only on the Team tab,
 * a failure shows an error with a retry instead of an endless spinner, and a two-step-verification
 * requirement is explained in place instead of throwing the user out of the Drivers tab.
 */
let search = "";
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(search),
  usePathname: () => "/fleet",
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
const team = {
  members: [
    { membershipId: "m0", email: "t@example.test", role: "admin", active: true, depotIds: null, allLocations: true, driverId: null },
    { membershipId: "m1", email: "dispo@example.test", role: "dispatcher", active: true, depotIds: [], allLocations: true, driverId: null },
  ],
  invitations: [{ id: "i1", email: "new@example.test", role: "dispatcher", expiresAt: "2026-11-12T10:00:00Z" }],
};
const writes: Array<{ method: string; url: string; body: unknown }> = [];

let membersReplies: Array<() => Response> = [];
const membersCalls = () => (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.filter(([u]) => String(u).endsWith("/members")).length;
const assign = vi.fn();

beforeEach(() => {
  search = "";
  membersReplies = [];
  writes.length = 0;
  assign.mockReset();
  vi.stubGlobal("location", { ...window.location, assign, pathname: "/fleet", search: "" });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status });
      if (init?.method && init.method !== "GET") {
        writes.push({ method: init.method, url, body: init.body ? JSON.parse(String(init.body)) : undefined });
        return init.method === "PATCH" ? new Response(null, { status: 204 }) : json({ id: "i1", email: "new@example.test" });
      }
      if (url.endsWith("/members")) return (membersReplies.shift() ?? (() => json(team)))();
      if (url.endsWith("/vehicles")) return json([]);
      if (url.includes("/dispatch?")) return json(base);
      if (url.endsWith("/events")) return json([]);
      return json({});
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

const wrap = () =>
  render(
    <I18nProvider initial="en">
      <TooltipProvider>
        <DispatchProvider base={base} session={session}>
          <FleetView />
        </DispatchProvider>
      </TooltipProvider>
    </I18nProvider>,
  );

describe("Fleet & team · Team loading", () => {
  it("does not request the team on the Drivers tab", async () => {
    wrap();
    await screen.findAllByText(/Drivers/);
    expect(membersCalls()).toBe(0);
  });

  it("loads the team on the Team tab", async () => {
    search = "tab=team";
    wrap();
    expect(await screen.findByText("dispo@example.test")).toBeTruthy();
    expect(membersCalls()).toBe(1);
  });

  it("shows an error with a retry instead of an endless spinner, and the retry recovers", async () => {
    search = "tab=team";
    membersReplies = [() => new Response(JSON.stringify({ error: { code: "internal", message: "Something went wrong on our side", requestId: "req-1" } }), { status: 500 })];
    wrap();
    expect(await screen.findByText("The team could not be loaded.")).toBeTruthy();
    expect(screen.queryByText("Loading team…")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("dispo@example.test")).toBeTruthy();
    expect(membersCalls()).toBe(2);
  });

  it("explains a two-step-verification requirement in place and links to the set-up page", async () => {
    search = "tab=team";
    membersReplies = [() => new Response(JSON.stringify({ error: { code: "mfa_required", message: "Two-step verification required" } }), { status: 403 })];
    wrap();
    expect(await screen.findByText("Two-step verification required")).toBeTruthy();
    const link = screen.getByRole("link", { name: "Set up two-step verification" });
    expect(link.getAttribute("href")).toBe(`/security?required=1&next=${encodeURIComponent("/fleet?tab=team")}`);
    expect(assign).not.toHaveBeenCalled();
  });

  it("manages members: your own row has no actions; edit role, remove access, resend an invitation", async () => {
    search = "tab=team";
    wrap();
    await screen.findByText("dispo@example.test");
    expect(screen.getByText("You")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Actions for t@example.test" })).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Actions for dispo@example.test" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Remove access" }));
    expect(writes.at(-1)).toMatchObject({ method: "PATCH", url: "/api/turvio/v1/orgs/org_jarbou/members/m1", body: { active: false } });

    await userEvent.click(screen.getByRole("button", { name: "Actions for dispo@example.test" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Edit" }));
    await userEvent.selectOptions(await screen.findByRole("combobox"), "admin");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(writes.at(-1)).toMatchObject({ method: "PATCH", url: "/api/turvio/v1/orgs/org_jarbou/members/m1", body: { role: "admin" } });

    await userEvent.click(screen.getByRole("button", { name: "Resend" }));
    expect(writes.at(-1)).toMatchObject({ method: "POST", url: "/api/turvio/v1/orgs/org_jarbou/invitations/i1/resend" });
  });
});
