import { describe, expect, it } from "vitest";
import { memberScopeLabel } from "../lib/helpers";

const name = (id: string) => ({ h: "Hannover", b: "Bremen" })[id] ?? "–";

describe("Team list shows fail-closed location access", () => {
  it("a dispatcher without locations is shown as having no access – never 'All depots'", () => {
    expect(memberScopeLabel({ role: "dispatcher", depotIds: null }, name)).toBe("No locations – no access");
    expect(memberScopeLabel({ role: "dispatcher", depotIds: [] }, name)).toBe("No locations – no access");
  });
  it("assigned locations, the explicit all-locations grant, admins and drivers", () => {
    expect(memberScopeLabel({ role: "dispatcher", depotIds: ["h", "b"] }, name)).toBe("Hannover, Bremen");
    expect(memberScopeLabel({ role: "dispatcher", depotIds: null, allLocations: true }, name)).toBe("All locations");
    expect(memberScopeLabel({ role: "admin", depotIds: null }, name)).toBe("All locations");
    expect(memberScopeLabel({ role: "owner", depotIds: null }, name)).toBe("All locations");
    expect(memberScopeLabel({ role: "driver", depotIds: null }, name)).toBe("TURVIO Driver");
  });
});
