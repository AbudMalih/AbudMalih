import { describe, expect, it } from "vitest";
import { ApiCallError, errorMessage } from "../lib/api";

describe("error messages for users", () => {
  it("server faults carry the support reference, no status or error code", () => {
    expect(errorMessage(new ApiCallError(500, "internal", "Something went wrong on our side", "req-4z"))).toBe("Something went wrong on our side · Support reference: req-4z");
  });
  it("problems with the request show only their message", () => {
    expect(errorMessage(new ApiCallError(403, "mfa_required", "Two-step verification required", "req-4z"))).toBe("Two-step verification required");
    expect(errorMessage(new ApiCallError(0, "network", "No connection to TURVIO."))).toBe("No connection to TURVIO.");
    expect(errorMessage(new Error("boom"))).toBe("boom");
  });
});
