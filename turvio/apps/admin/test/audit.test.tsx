import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AUDIT_PAGE, AuditLog } from "../components/AuditLog";
import type { PlatformAuditEntry } from "../lib/remote";
import { mockFetch, path, type Call } from "./fetch";

const ORG = "33333333-3333-4333-8333-333333333333";
const entry = (id: number, o: Partial<PlatformAuditEntry> = {}): PlatformAuditEntry => ({
  id,
  action: "update",
  table: "subscriptions",
  recordId: null,
  changedColumns: ["seats"],
  at: "2026-11-10T09:00:00Z",
  actor: { userId: "u1", email: "ops@turvio.example" },
  organizationId: ORG,
  organizationName: "Elbe Express GmbH",
  ...o,
});

let calls: Call[];
beforeEach(() => {
  calls = mockFetch((c) => {
    const u = new URL(path(c), "http://x");
    if (u.pathname === "/v1/platform/organizations") return { body: { total: 1, organizations: [{ id: ORG, name: "Elbe Express GmbH" }] } };
    if (u.pathname !== "/v1/platform/audit") return undefined;
    const before = u.searchParams.get("before");
    if (!before) return { body: { entries: [entry(200, { action: "delete", table: "memberships", changedColumns: [] }), entry(199, { actor: null })], nextBefore: 199 } };
    return { body: { entries: [entry(150, { action: "insert", table: "organizations", changedColumns: [] })], nextBefore: null } };
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("Audit log (GET /v1/platform/audit)", () => {
  it("shows actor, deletions and pages with 'Load more' via nextBefore", async () => {
    const user = userEvent.setup();
    render(<AuditLog />);
    expect(await screen.findByText("Member removed")).toBeTruthy();
    expect(path(calls.find((c) => path(c).startsWith("/v1/platform/audit"))!)).toBe(`/v1/platform/audit?limit=${AUDIT_PAGE}`);
    expect(screen.getByText("Deleted")).toBeTruthy();
    expect(screen.getAllByText("ops@turvio.example").length).toBeGreaterThan(0);
    expect(screen.getByText("System")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Load more" }));
    expect(await screen.findByText("Company created")).toBeTruthy();
    expect(calls.some((c) => path(c) === `/v1/platform/audit?limit=${AUDIT_PAGE}&before=199`)).toBe(true);
    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(4);
    expect(screen.getByText("No older entries")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
  });

  it("filters by record type and company", async () => {
    const user = userEvent.setup();
    render(<AuditLog />);
    await screen.findByText("Member removed");
    await user.selectOptions(screen.getByLabelText("Record type"), "invitations");
    await waitFor(() => expect(calls.some((c) => path(c) === `/v1/platform/audit?limit=${AUDIT_PAGE}&table=invitations`)).toBe(true));
    await waitFor(() => expect(screen.getByRole("option", { name: "Elbe Express GmbH" })).toBeTruthy());
    await user.selectOptions(screen.getByLabelText("Company"), ORG);
    await waitFor(() => expect(calls.some((c) => path(c) === `/v1/platform/audit?limit=${AUDIT_PAGE}&table=invitations&organizationId=${ORG}`)).toBe(true));
  });

  it("starts filtered when opened from a company", async () => {
    render(<AuditLog initialOrganizationId={ORG} />);
    await screen.findByText("Member removed");
    expect(calls.some((c) => path(c) === `/v1/platform/audit?limit=${AUDIT_PAGE}&organizationId=${ORG}`)).toBe(true);
  });
});
