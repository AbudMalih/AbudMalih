import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { CompanyTable } from "../components/CompanyTable";
import { platformTenants, toRow } from "../lib/platform";

const now = new Date("2026-10-30T12:00:00Z");
const rows = platformTenants(now).map((r) => toRow(r, now));

function setup() {
  const user = userEvent.setup();
  render(<CompanyTable rows={rows} now={now.getTime()} />);
  const table = () => screen.getByRole("table");
  const bodyRows = () => within(table()).getAllByRole("row").slice(1);
  return { user, table, bodyRows };
}

describe("CompanyTable", () => {
  it("shows the first page with pagination info", () => {
    const { bodyRows } = setup();
    expect(bodyRows()).toHaveLength(8);
    expect(screen.getByText(`1–8 of ${rows.length}`)).toBeTruthy();
  });

  it("filters by search and shows an empty state with reset", async () => {
    const { user, bodyRows } = setup();
    await user.type(screen.getByRole("searchbox", { name: "Search companies" }), "hanse");
    expect(bodyRows()).toHaveLength(1);
    expect(screen.getByText("Hansefracht GmbH")).toBeTruthy();
    await user.type(screen.getByRole("searchbox", { name: "Search companies" }), "zzz");
    expect(screen.getByText("No companies match your filters")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Clear all filters" }));
    expect(bodyRows()).toHaveLength(8);
  });

  it("sorts by company name and toggles direction", async () => {
    const { user, bodyRows } = setup();
    const header = screen.getByRole("columnheader", { name: /Company/ });
    await user.click(within(header).getByRole("button"));
    expect(header.getAttribute("aria-sort")).toBe("ascending");
    const first = within(bodyRows()[0]!).getAllByRole("button")[0]!.textContent;
    expect(first).toContain("Alpen Last-Mile GmbH");
    await user.click(within(header).getByRole("button"));
    expect(header.getAttribute("aria-sort")).toBe("descending");
  });

  it("paginates", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: "Next page" }));
    expect(screen.getByText(`9–${rows.length} of ${rows.length}`)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Next page" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("selects rows and shows the bulk action bar", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("checkbox", { name: "Select all companies on this page" }));
    expect(screen.getByText("8 selected")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Clear selection" }));
    expect(screen.queryByText("8 selected")).toBeNull();
  });

  it("opens the company detail sheet", async () => {
    const { user } = setup();
    await user.type(screen.getByRole("searchbox", { name: "Search companies" }), "elbe");
    await user.click(screen.getByRole("button", { name: /^Elbe Express Logistik GmbH/ }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Subscription")).toBeTruthy();
    expect(within(dialog).getByText("Annual")).toBeTruthy();
  });
});
