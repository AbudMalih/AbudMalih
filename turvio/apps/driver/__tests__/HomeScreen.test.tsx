import { fireEvent, render, screen } from "@testing-library/react-native";
import HomeScreen from "../src/app/(tabs)/index";
import { useTourStore } from "../src/store/tourStore";

jest.mock("expo-router", () => ({ router: { push: jest.fn(), back: jest.fn() } }));

describe("HomeScreen", () => {
  beforeEach(() => {
    useTourStore.getState().resetData();
    useTourStore.getState().setLocale("en");
  });

  it("shows the driver's synthetic tour and progress", async () => {
    await render(<HomeScreen />);
    expect(screen.getByText("Erfurt Zentrum A")).toBeTruthy();
    expect(screen.getByTestId("progress-text").props.children.join("")).toContain("0 of 8 stops done");
    expect(screen.getByText("Development mode – synthetic test data")).toBeTruthy();
  });

  it("starts and pauses the tour", async () => {
    await render(<HomeScreen />);
    await fireEvent.press(screen.getByTestId("start-tour"));
    expect(useTourStore.getState().tours.find((t) => t.id === "tour_ef_a")!.status).toBe("in_progress");
    await fireEvent.press(screen.getByText("Pause tour"));
    expect(useTourStore.getState().tours.find((t) => t.id === "tour_ef_a")!.status).toBe("paused");
  });

  it("renders in German", async () => {
    useTourStore.getState().setLocale("de");
    await render(<HomeScreen />);
    expect(screen.getByText("Tour starten")).toBeTruthy();
  });
});
