import { fireEvent, render, screen } from "@testing-library/react-native";
import ImportScreen from "../src/app/import";
import { createStopPayload, useTourStore } from "../src/store/tourStore";

const mockBack = jest.fn();
jest.mock("expo-router", () => ({
  router: { push: jest.fn(), back: () => mockBack(), replace: jest.fn() },
  useLocalSearchParams: () => ({}),
  Stack: { Screen: () => null },
}));
jest.mock("expo-constants", () => ({ expoConfig: { version: "test" } }));
jest.mock("expo-document-picker", () => ({ getDocumentAsync: jest.fn() }));
jest.mock("expo-file-system", () => ({ File: jest.fn() }));

const header = "Sendungsnummer;Empfänger;Firma;Straße;Hausnummer;PLZ;Ort;lat;lng";
const line = (tn: string, who: string, company: string, street: string, no = "1") => `${tn};${who};${company};${street};${no};30165;Hannover;52.39;9.73`;

describe("driver import screen (demo mode, no server)", () => {
  beforeEach(() => {
    useTourStore.getState().resetData();
    useTourStore.getState().setLocale("en");
    mockBack.mockReset();
  });

  it("120 parcels at one address (spelled differently) become ONE stop with 120 parcels, each with its own recipient", async () => {
    const rows = Array.from({ length: 120 }, (_, i) => line(`TVO${300000 + i}DE`, `Person ${i}`, "Leinetal GmbH", i % 2 ? "Elfriede-Doeler-Weg" : "Elfriede-Döler-Weg", i % 3 ? "12a" : "12 a"));
    await render(<ImportScreen />);
    await fireEvent.changeText(screen.getByTestId("import-text"), [header, ...rows].join("\n"));
    await fireEvent.press(screen.getByTestId("import-preview"));
    expect(screen.getAllByText(/1 stop/).length).toBeGreaterThan(0);
    expect(screen.getByTestId("import-summary")).toBeTruthy();
    const before = useTourStore.getState().stops.length;
    await fireEvent.press(screen.getByTestId("import-run"));
    const stops = useTourStore.getState().stops;
    expect(stops.length).toBe(before + 1);
    const stop = stops.find((s) => s.parcels.some((p) => p.trackingNumber === "TVO300000DE"))!;
    expect(stop.parcels).toHaveLength(120);
    expect(stop.parcels[7]).toMatchObject({ trackingNumber: "TVO300007DE", recipientName: "Person 7", company: "Leinetal GmbH" });
    // The server request (offline queue) carries each parcel's own recipient and company.
    const payload = createStopPayload(stop);
    expect(payload.parcels).toHaveLength(120);
    expect(payload.parcels![7]).toEqual({ trackingNumber: "TVO300007DE", recipientName: "Person 7", company: "Leinetal GmbH" });
    expect(payload.trackingNumbers).toHaveLength(120); // still sent for older servers
  });

  it("a tracking number at two addresses blocks the import until the driver picks the address", async () => {
    const rows = [line("TVO400001DE", "A", "", "Göbelstraße"), line("TVO400001DE", "B", "", "Nordring"), line("TVO400002DE", "C", "", "Nordring")];
    await render(<ImportScreen />);
    await fireEvent.changeText(screen.getByTestId("import-text"), [header, ...rows].join("\n"));
    await fireEvent.press(screen.getByTestId("import-preview"));
    expect(screen.getByTestId("import-conflicts")).toBeTruthy();
    expect(screen.getByTestId("import-run").props.accessibilityState?.disabled).toBe(true);
    const before = useTourStore.getState().stops.length;
    await fireEvent.press(screen.getByTestId("import-run"));
    expect(useTourStore.getState().stops.length).toBe(before); // nothing imported while unresolved
    await fireEvent.press(screen.getByTestId("conflict-TVO400001DE-2"));
    await fireEvent.press(screen.getByTestId("import-run"));
    const stops = useTourStore.getState().stops;
    expect(stops.find((s) => s.parcels.some((p) => p.trackingNumber === "TVO400001DE"))!.address.street).toBe("Göbelstraße");
  });

  it("an invalid postcode is shown as an error on the row, never padded silently", async () => {
    await render(<ImportScreen />);
    await fireEvent.changeText(screen.getByTestId("import-text"), [header, "TVO500001DE;X;;Hauptstraße;1;3016;Hannover;52.39;9.73"].join("\n"));
    await fireEvent.press(screen.getByTestId("import-preview"));
    expect(screen.getByText(/postal code has only 4 digits/)).toBeTruthy();
  });
});
