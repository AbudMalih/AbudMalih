import { fireEvent, render, screen } from "@testing-library/react-native";
import OutcomeScreen from "../src/app/outcome/[id]";
import StopDetail from "../src/app/stop/[id]";
import { useTourStore } from "../src/store/tourStore";

let mockParams: Record<string, string> = {};
const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock("expo-router", () => ({
  router: { push: (...a: unknown[]) => mockPush(...a), back: () => mockBack(), replace: jest.fn() },
  useLocalSearchParams: () => mockParams,
  Stack: { Screen: () => null },
}));
jest.mock("expo-constants", () => ({ expoConfig: { version: "test" } }));

describe("delivery workflow screens", () => {
  let stopId = "";
  beforeEach(() => {
    useTourStore.getState().resetData();
    useTourStore.getState().setLocale("en");
    stopId = useTourStore.getState().stops.find((s) => s.type === "delivery" && s.tourId === "tour_ef_a")!.id;
    mockParams = { id: stopId };
    mockPush.mockReset();
    mockBack.mockReset();
  });

  it("stop detail: arrival, delivery goes to proof of delivery, not-delivered opens the outcome screen", async () => {
    await render(<StopDetail />);
    await fireEvent.press(screen.getByTestId("arrived"));
    expect(useTourStore.getState().stops.find((s) => s.id === stopId)!.status).toBe("in_progress");
    await fireEvent.press(screen.getByTestId("mark-delivered"));
    expect(mockPush).toHaveBeenCalledWith(`/pod/${stopId}`);
    await fireEvent.press(screen.getByTestId("mark-not-delivered"));
    expect(mockPush).toHaveBeenCalledWith(`/outcome/${stopId}`);
  });

  it("stop detail: saves a driver note", async () => {
    await render(<StopDetail />);
    await fireEvent.press(screen.getByTestId("add-note"));
    await fireEvent.changeText(screen.getByTestId("note-input"), "Gate code 4711");
    await fireEvent.press(screen.getByTestId("save-note"));
    expect(useTourStore.getState().stops.find((s) => s.id === stopId)!.driverNotes).toBe("Gate code 4711");
  });

  it("outcome: requires a reason (and a note for 'other'), then records the status", async () => {
    await render(<OutcomeScreen />);
    await fireEvent.press(screen.getByTestId("outcome-save"));
    expect(screen.getByText("Choose a reason.")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("outcome-rescheduled"));
    await fireEvent.press(screen.getByTestId("reason-other"));
    await fireEvent.press(screen.getByTestId("outcome-save"));
    expect(screen.getByText("Please add a note for this reason.")).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId("outcome-note"), "Customer asked for Friday");
    await fireEvent.press(screen.getByTestId("outcome-save"));
    expect(useTourStore.getState().stops.find((s) => s.id === stopId)).toMatchObject({ status: "rescheduled", failureReason: "other", driverNotes: "Customer asked for Friday" });
    expect(mockBack).toHaveBeenCalled();
  });
});
