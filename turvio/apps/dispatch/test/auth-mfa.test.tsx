import { LoginForm, MfaSetupForm, groupKey } from "@turvio/web-ui/ds";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiCallError, api } from "../lib/api";

let calls: { url: string; body: unknown }[];
let assign: ReturnType<typeof vi.fn>;

function stubFetch(handler: (url: string, body: unknown) => [number, unknown]) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const body = init.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ url, body });
      const [status, data] = handler(url, body);
      return Response.json(data, { status });
    }),
  );
}

beforeEach(() => {
  calls = [];
  assign = vi.fn();
  vi.stubGlobal("location", { ...window.location, assign, pathname: "/settings", search: "" });
});
afterEach(() => vi.unstubAllGlobals());

describe("two-step sign-in", () => {
  it("asks for the authenticator code when the account has a second factor", async () => {
    stubFetch((url, body) => {
      if (url === "/api/auth/login") return [200, { mfaRequired: true, factorType: "totp" }];
      if (url === "/api/auth/mfa/verify") return (body as { code: string }).code === "123456" ? [200, { user: {} }] : [422, { error: { code: "invalid_code", message: "The code is not correct." } }];
      return [404, {}];
    });
    render(<LoginForm product="Dispatch" next="/planning" />);
    await userEvent.type(screen.getByLabelText("Email"), "owner@jarbou.test");
    await userEvent.type(screen.getByLabelText("Password"), "secret-password");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    const code = await screen.findByLabelText("Authentication code");
    expect(assign).not.toHaveBeenCalled();
    await userEvent.type(code, "000000");
    await userEvent.click(screen.getByRole("button", { name: "Verify" }));
    expect((await screen.findByRole("alert")).textContent).toContain("The code is not correct.");
    await userEvent.type(screen.getByLabelText("Authentication code"), "123 456");
    await userEvent.click(screen.getByRole("button", { name: "Verify" }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith("/planning"));
    expect(calls.at(-1)).toEqual({ url: "/api/auth/mfa/verify", body: { code: "123456" } });
  });

  it("goes back to the password when the sign-in step expired", async () => {
    stubFetch((url) => (url === "/api/auth/login" ? [200, { mfaRequired: true, factorType: "totp" }] : [401, { error: { code: "invalid_token", message: "This sign-in step expired. Please sign in again." } }]));
    render(<LoginForm product="Dispatch" />);
    await userEvent.type(screen.getByLabelText("Email"), "owner@jarbou.test");
    await userEvent.type(screen.getByLabelText("Password"), "pw");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await userEvent.type(await screen.findByLabelText("Authentication code"), "123456");
    await userEvent.click(screen.getByRole("button", { name: "Verify" }));
    expect((await screen.findByRole("alert")).textContent).toContain("expired");
    expect(screen.getByLabelText("Password")).toBeTruthy();
  });
});

describe("two-step set-up page", () => {
  it("enrols with key + otpauth link and turns it on with a code", async () => {
    stubFetch((url) => {
      if (url === "/api/turvio/v1/auth/mfa") return [200, { enabled: false, aal: "aal1" }];
      if (url === "/api/turvio/v1/auth/mfa/enroll") return [200, { factorId: "f", secret: "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP", otpauthUrl: "otpauth://totp/TURVIO:x?secret=JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP" }];
      if (url === "/api/auth/mfa/activate") return [200, { user: {}, aal: "aal2" }];
      return [404, {}];
    });
    render(<MfaSetupForm product="Dispatch" required next="/settings" />);
    expect(await screen.findByText(/This action needs two-step verification/)).toBeTruthy();
    await userEvent.click(await screen.findByRole("button", { name: "Set up two-step verification" }));
    expect((await screen.findByTestId("mfa-secret")).textContent).toBe("JBSW Y3DP EHPK 3PXP JBSW Y3DP EHPK 3PXP");
    expect(screen.getByRole("link", { name: "add TURVIO to your authenticator app" }).getAttribute("href")).toMatch(/^otpauth:\/\/totp\//);
    await userEvent.type(screen.getByLabelText("Authentication code"), "123456");
    await userEvent.click(screen.getByRole("button", { name: "Turn on" }));
    expect(await screen.findByText(/Two-step verification is now on/)).toBeTruthy();
    expect(calls.at(-1)).toEqual({ url: "/api/auth/mfa/activate", body: { code: "123456" } });
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(assign).toHaveBeenCalledWith("/settings");
  });

  it("groups keys for manual entry", () => {
    expect(groupKey("ABCDEFGH")).toBe("ABCD EFGH");
  });
});

describe("api() helper", () => {
  it("sends users to the set-up page on mfa_required", async () => {
    stubFetch(() => [403, { error: { code: "mfa_required", message: "needs 2fa" } }]);
    await expect(api("GET", "/v1/orgs/o/members")).rejects.toBeInstanceOf(ApiCallError);
    expect(assign).toHaveBeenCalledWith("/security?required=1&next=%2Fsettings");
  });
});
