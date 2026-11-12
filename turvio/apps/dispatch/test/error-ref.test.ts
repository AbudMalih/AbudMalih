import { describe, expect, it } from "vitest";
import { ApiCallError, errorMessage } from "../lib/api";

describe("error messages carry the server reference", () => {
  it("adds status, code and request id for API errors", () => {
    expect(errorMessage(new ApiCallError(403, "mfa_required", "Two-step verification required", "req-4z"))).toBe(
      "Two-step verification required (HTTP 403 · mfa_required · Ref req-4z)",
    );
  });
  it("leaves other errors unchanged", () => {
    expect(errorMessage(new ApiCallError(0, "network", "No connection to TURVIO."))).toBe("No connection to TURVIO.");
    expect(errorMessage(new Error("boom"))).toBe("boom");
  });
});
