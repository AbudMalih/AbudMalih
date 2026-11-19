import { fireEvent, render, screen } from "@testing-library/react-native";
import { Alert } from "react-native";

/**
 * Store readiness on the Settings screen: the privacy text describes live tracking, an account
 * deletion request can be sent from the app, store builds show no server address, and rejected
 * changes are explained in the driver's language (no raw server texts).
 */
jest.mock("expo-router", () => ({ router: { push: jest.fn(), replace: jest.fn() } }));
jest.mock("expo-constants", () => ({ expoConfig: { version: "0.3.0", extra: { variant: "production" } } }));
jest.mock("expo", () => ({ ...jest.requireActual("expo"), reloadAppAsync: jest.fn() }));
jest.mock("../src/components/Tracking", () => ({ TrackingSettingsSection: () => null }));
jest.mock("../src/lib/optimizer", () => ({ ...jest.requireActual("../src/lib/optimizer"), apiBaseUrl: () => "https://api.example.test" }));

import SettingsScreen from "../src/app/(tabs)/settings";
import { ApiError } from "../src/lib/auth";
import { errorText } from "../src/lib/errorText";
import { translate } from "@turvio/shared";
import { setAuthClient, useTourStore } from "../src/store/tourStore";

const request = jest.fn(async () => ({ requested: true }));
setAuthClient({ request } as never);
const t = (k: Parameters<typeof translate>[1], p?: Record<string, string | number>) => translate("en", k, p);

beforeEach(() => {
  request.mockClear();
  useTourStore.setState({
    user: { id: "u1", email: "lena@example.test", name: "Lena" },
    organizationName: "JARBOU",
    failed: [{ item: { id: "f1", kind: "scans", orgId: "o", at: "2026-11-19T08:00:00Z", tourId: "t1", scans: [] }, error: "Validation failed: code too short", code: "validation_failed" }],
  } as never);
});

describe("errorText", () => {
  it("translates known codes and never shows raw server text", () => {
    expect(errorText(new ApiError(0, "network", "No connection"), t)).toBe(t("errors.network"));
    expect(errorText(new ApiError(401, "invalid_credentials", "Invalid login"), t)).toBe(t("errors.invalidCredentials"));
    expect(errorText(new ApiError(500, "internal", "Something broke at db.ts:12"), t)).toBe(t("errors.server"));
    expect(errorText(new ApiError(422, "weird", "Raw English"), t)).toBe(t("errors.generic"));
    expect(errorText(new Error("x"), translate.bind(null, "de") as never)).toBe(translate("de", "errors.generic"));
  });
});

describe("Settings in a store build", () => {
  it("explains live tracking, hides the server address, translates rejected changes", async () => {
    await render(<SettingsScreen />);
    expect(screen.getByText(/Live tracking: only if your company switched it on/)).toBeTruthy();
    expect(screen.queryByText("https://api.example.test")).toBeNull();
    expect(screen.getByText("Not accepted: parcel scans")).toBeTruthy();
    expect(screen.queryByText(/Validation failed/)).toBeNull();
  });

  it("sends an account deletion request after confirmation", async () => {
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
    await render(<SettingsScreen />);
    fireEvent.press(screen.getByTestId("delete-account"));
    const buttons = alert.mock.calls[0]![2]!;
    await buttons.find((b) => b.style === "destructive")!.onPress!();
    expect(request).toHaveBeenCalledWith("POST", "/v1/me/account-deletion-request", {});
    alert.mockRestore();
  });
});
