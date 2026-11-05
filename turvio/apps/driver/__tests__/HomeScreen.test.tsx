import { fireEvent, render, screen } from "@testing-library/react-native";
import HomeScreen from "../src/app/(tabs)/index";
import { useTourStore } from "../src/store/tourStore";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({ router: { push: (...a: unknown[]) => mockPush(...a), back: jest.fn() } }));

describe("HomeScreen", () => {
  beforeEach(() => {
    mockPush.mockReset();
    useTourStore.getState().resetData();
    useTourStore.getState().setLocale("en");
  });

  it("puts Scan and Optimize first and shows tour progress with labelled estimates", async () => {
    await render(<HomeScreen />);
    expect(screen.getByText("Scan parcels")).toBeTruthy();
    expect(screen.getByText("Optimize route")).toBeTruthy();
    expect(screen.getByText("Erfurt Zentrum A")).toBeTruthy();
    expect(screen.getByTestId("progress-text").props.children.join("")).toContain("0 of 8 stops done");
    expect(screen.getByText("Development mode – synthetic test data")).toBeTruthy();
    expect(screen.getAllByText("straight-line estimate").length).toBeGreaterThan(0);
    await fireEvent.press(screen.getByTestId("hero-scan"));
    expect(mockPush).toHaveBeenCalledWith("/scan");
  });

  it("starts, continues and pauses the tour", async () => {
    await render(<HomeScreen />);
    await fireEvent.press(screen.getByTestId("start-tour"));
    expect(useTourStore.getState().tours.find((t) => t.id === "tour_ef_a")!.status).toBe("in_progress");
    await fireEvent.press(screen.getByTestId("continue-tour"));
    expect(mockPush.mock.calls.at(-1)![0]).toMatch(/^\/stop\//);
    await fireEvent.press(screen.getByTestId("pause-tour"));
    expect(useTourStore.getState().tours.find((t) => t.id === "tour_ef_a")!.status).toBe("paused");
  });

  it("renders in German", async () => {
    useTourStore.getState().setLocale("de");
    await render(<HomeScreen />);
    expect(screen.getByText("Tour starten")).toBeTruthy();
    expect(screen.getByText("Pakete scannen")).toBeTruthy();
  });
});
