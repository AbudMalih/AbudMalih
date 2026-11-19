import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Toaster } from "@turvio/web-ui/ds";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PlatformAdmins } from "../components/PlatformAdmins";
import { mockFetch, path, type Call } from "./fetch";

const ME = "44444444-4444-4444-8444-444444444444";
const OTHER = "55555555-5555-4555-8555-555555555555";
let admins: { userId: string; email: string | null; since: string; you: boolean }[];
let calls: Call[];
beforeEach(() => {
  admins = [
    { userId: ME, email: "me@turvio.example", since: "2026-01-01T00:00:00Z", you: true },
    { userId: OTHER, email: "ops@turvio.example", since: "2026-02-01T00:00:00Z", you: false },
  ];
  calls = mockFetch((c) => {
    const p = path(c);
    if (p === "/v1/platform/admins" && c.method === "GET") return { body: { admins } };
    if (p === "/v1/platform/admins" && c.method === "POST") {
      const email = (c.body as { email: string }).email;
      if (email === "nobody@example.com") return { status: 404, body: { error: { code: "not_found", message: "no TURVIO account uses this e-mail address" } } };
      admins = [...admins, { userId: "66666666-6666-4666-8666-666666666666", email, since: "2026-11-19T00:00:00Z", you: false }];
      return { status: 201, body: { userId: "x", email } };
    }
    if (p === `/v1/platform/admins/${OTHER}` && c.method === "DELETE") {
      admins = admins.filter((a) => a.userId !== OTHER);
      return { status: 204 };
    }
    return undefined;
  });
});
afterEach(() => vi.unstubAllGlobals());

function setup() {
  const user = userEvent.setup();
  render(
    <>
      <PlatformAdmins />
      <Toaster />
    </>,
  );
  return user;
}

describe("Platform admins", () => {
  it("lists admins, marks you and offers no way to remove yourself", async () => {
    setup();
    const me = (await screen.findByText("me@turvio.example")).closest("tr")!;
    expect(within(me).getByText("You")).toBeTruthy();
    expect(within(me).queryByRole("button")).toBeNull();
    expect(screen.getByRole("button", { name: "Remove ops@turvio.example" })).toBeTruthy();
  });

  it("adds an admin by e-mail", async () => {
    const user = setup();
    await screen.findByText("me@turvio.example");
    await user.type(screen.getByLabelText("Email"), "new@turvio.example");
    await user.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => expect(calls.some((c) => c.method === "POST" && path(c) === "/v1/platform/admins")).toBe(true));
    expect(calls.find((c) => c.method === "POST")!.body).toEqual({ email: "new@turvio.example" });
    expect(await screen.findByText("new@turvio.example is now a platform admin")).toBeTruthy();
    expect(await screen.findByText("new@turvio.example")).toBeTruthy();
  });

  it("explains when no account uses the e-mail address", async () => {
    const user = setup();
    await screen.findByText("me@turvio.example");
    await user.type(screen.getByLabelText("Email"), "nobody@example.com");
    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(await screen.findByText(/No TURVIO account uses nobody@example.com/)).toBeTruthy();
  });

  it("removes another admin only after confirmation", async () => {
    const user = setup();
    await user.click(await screen.findByRole("button", { name: "Remove ops@turvio.example" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/loses access to TURVIO Admin immediately/)).toBeTruthy();
    expect(calls.some((c) => c.method === "DELETE")).toBe(false);
    await user.click(within(dialog).getByRole("button", { name: "Remove access" }));
    await waitFor(() => expect(calls.some((c) => c.method === "DELETE" && path(c) === `/v1/platform/admins/${OTHER}`)).toBe(true));
    await waitFor(() => expect(screen.queryByText("ops@turvio.example")).toBeNull());
  });
});
