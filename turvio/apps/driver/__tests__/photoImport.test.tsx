import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";
import PhotoImport from "../src/app/photo-import";
import { ApiError } from "../src/lib/auth";
import { registerOcrEngine } from "../src/lib/ocr";
import { draftsFromExtraction, geocodeDrafts, positionOf, readiness, readText, toStopInput, type ImportDraft } from "../src/lib/photoImport";
import { useImportStore } from "../src/store/importStore";
import { useTourStore } from "../src/store/tourStore";

// Synthetic test images: the "OCR" returns these texts for the picked URIs.
const IMAGES: Record<string, string> = {
  "file:///cache/ImagePicker/whatsapp.png": "14:32\nDisposition\nBitte noch heute:\n1) Anna Krüger\nSteinweg 20\n98527 Suhl\n2) Klaus Richter\nAuenstraße 36\n98529 Suhl\n14:33 ✓✓",
  "file:///cache/ImagePicker/dhl-label.jpg": "DHL PAKET\nVon: Shop AG, Lagerweg 3, 04109 Leipzig\nAn:\nJonas Becker\nFriedrich-König-Str. 7\n98527 Suhl",
};
const mockReplace = jest.fn();
const mockBack = jest.fn();
const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  router: { push: (...a: unknown[]) => mockPush(...a), back: () => mockBack(), replace: (...a: unknown[]) => mockReplace(...a) },
  useLocalSearchParams: () => ({}),
  Stack: { Screen: () => null },
}));
jest.mock("expo-constants", () => ({ expoConfig: { version: "test" } }));
jest.mock("expo-image-picker", () => ({
  requestCameraPermissionsAsync: jest.fn(async () => ({ granted: true })),
  launchCameraAsync: jest.fn(async () => ({ canceled: true, assets: [] })),
  launchImageLibraryAsync: jest.fn(async () => ({ canceled: false, assets: [{ uri: "file:///cache/ImagePicker/whatsapp.png" }, { uri: "file:///cache/ImagePicker/dhl-label.jpg" }] })),
}));
jest.mock("expo-camera", () => ({
  scanFromURLAsync: jest.fn(async (uri: string) => (uri.includes("dhl") ? [{ data: "JJD000390007912345678", type: "code128" }] : [])),
}));
const mockDeleted: string[] = [];
jest.mock("../src/lib/files", () => ({ deleteTemporary: async (uri: string) => void mockDeleted.push(uri), deleteFile: async () => undefined }));

const draft = (text: string): ImportDraft => draftsFromExtraction(readText(text), 1)[0]!;

describe("photo import – logic", () => {
  it("geocoding: exact house → position; street-level → confirmation needed; miss → pin; never invented", async () => {
    const ds = [draft("Steinweg 20, 98527 Suhl"), draft("Auenstraße 36, 98529 Suhl"), draft("Gibtsnicht 1, 98527 Suhl"), draft("An: Max\n12345678\nPackstation 123\n98527 Suhl")];
    const calls: unknown[] = [];
    const client = {
      request: async (_m: string, _p: string, body: unknown) => {
        calls.push(body);
        return { results: [{ precision: "house", location: { lat: 50.61, lng: 10.69 } }, { precision: "street", location: { lat: 50.62, lng: 10.72 } }, null] };
      },
    };
    const out = await geocodeDrafts(client as never, ds);
    expect(out.map((d) => d.geo.status)).toEqual(["found", "confirm", "not_found", "not_found"]);
    expect((calls[0] as { addresses: unknown[] }).addresses).toHaveLength(3); // Packstation is not sent
    expect(positionOf(out[0]!)).toEqual({ lat: 50.61, lng: 10.69 });
    expect(positionOf(out[1]!)).toBeNull(); // the street-level suggestion is NOT used until confirmed
    expect(readiness(out[1]!)).toEqual({ ready: false, reason: "needs_position_decision" });
    expect(readiness({ ...out[1]!, geo: { status: "confirmed", location: { lat: 50.62, lng: 10.72 } } }).ready).toBe(true);
    expect(readiness({ ...out[2]!, withoutPosition: true }).ready).toBe(true);
  });

  it("geocoder not configured (503) → 'unavailable'; network error → 'offline'", async () => {
    const d = [draft("Steinweg 20, 98527 Suhl")];
    expect((await geocodeDrafts({ request: async () => { throw new ApiError(503, "geocoder_unavailable", "x"); } } as never, d))[0]!.geo.status).toBe("unavailable");
    expect((await geocodeDrafts({ request: async () => { throw new ApiError(0, "network", "x"); } } as never, d))[0]!.geo.status).toBe("offline");
    expect((await geocodeDrafts(null, d))[0]!.geo.status).toBe("unavailable");
  });

  it("saved stop: position only from exact/confirmed geocoder or pin; Packstation keeps the Postnummer", () => {
    const found = { ...draft("Steinweg 20, 98527 Suhl"), geo: { status: "found" as const, location: { lat: 1, lng: 2 } } };
    expect(toStopInput(found)).toMatchObject({ location: { lat: 1, lng: 2 }, locationSource: "geocoder" });
    const pinned = { ...found, geo: { status: "pinned" as const, location: { lat: 3, lng: 4 } } };
    expect(toStopInput(pinned)).toMatchObject({ locationSource: "manual_pin" });
    const later = { ...draft("Steinweg 20, 98527 Suhl"), geo: { status: "confirm" as const, suggestion: { lat: 9, lng: 9 } }, withoutPosition: true };
    expect(toStopInput(later)).toMatchObject({ location: null, locationSource: null });
    const ps = draft("An: Max Mustermann\n12345678\nPackstation 123\n98527 Suhl");
    expect(ps.kind).toBe("packstation");
    expect(ps.values.notes).toContain("Postnummer: 12345678");
  });

  it("a missing city stays empty (not taken from the depot)", () => {
    expect(draft("Max Muster\nSteinweg 20\n98527 Suhl").values.city).toBe("Suhl");
    expect(draftsFromExtraction(readText("Steinweg 20"), 1)).toEqual([]);
  });
});

describe("photo import – screen (demo mode, no server)", () => {
  beforeEach(() => {
    useTourStore.getState().resetData();
    useTourStore.getState().setLocale("en");
    useImportStore.getState().reset();
    mockDeleted.length = 0;
    mockReplace.mockReset();
    mockBack.mockReset();
    registerOcrEngine({ name: "test", recognize: async (uri) => (IMAGES[uri] ?? "").split("\n").map((text) => ({ text, confidence: 0.95 })) });
  });

  it("two screenshots → three addresses → review → add → offer re-optimization; images deleted", async () => {
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
    await render(<PhotoImport />);
    await fireEvent.press(screen.getByTestId("pi-gallery"));
    await waitFor(() => expect(useImportStore.getState().drafts).toHaveLength(3));
    expect(screen.getByText("3 address(es) found")).toBeTruthy();
    expect(screen.getByText("Anna Krüger")).toBeTruthy();
    expect(screen.getByText("Jonas Becker")).toBeTruthy();
    expect(screen.getByText("DHL JJD000390007912345678")).toBeTruthy();
    expect(mockDeleted.sort()).toEqual(Object.keys(IMAGES).sort());

    // No address search in demo mode: every stop needs a decision before it can be saved.
    const drafts = useImportStore.getState().drafts;
    expect(drafts.every((d) => d.geo.status === "unavailable")).toBe(true);
    expect(screen.getByTestId("pi-save").props.accessibilityState?.disabled ?? true).toBe(true);
    await fireEvent.press(screen.getByTestId(`pi-toggle-${drafts[1]!.key}`)); // skip Klaus Richter
    for (const d of [drafts[0]!, drafts[2]!]) await fireEvent.press(screen.getByTestId(`pi-nopos-${d.key}`));

    const tourId = useTourStore.getState().tours.find((t) => t.driverId === useTourStore.getState().driverId)!.id;
    const before = useTourStore.getState().stops.filter((s) => s.tourId === tourId).length;
    await fireEvent.press(screen.getByTestId("pi-save"));
    const after = useTourStore.getState().stops.filter((s) => s.tourId === tourId);
    expect(after.length).toBe(before + 2);
    const jonas = after.find((s) => s.parcels.some((p) => p.trackingNumber === "JJD000390007912345678"))!;
    expect(jonas).toMatchObject({ location: null, address: { street: "Friedrich-König-Str.", postalCode: "98527" } });
    expect(alert).toHaveBeenCalledWith("2 added, 0 merged", expect.any(String), expect.any(Array));
    const buttons = alert.mock.calls[0]![2] as { text: string; onPress: () => void }[];
    buttons.find((b) => b.text === "Re-optimize")!.onPress();
    expect(mockReplace).toHaveBeenCalledWith("/optimize");
    expect(useImportStore.getState().drafts).toEqual([]); // nothing kept after saving
  });

  it("flags an address that is already on the route and merges into it", async () => {
    const st = useTourStore.getState();
    const tour = st.tours.find((t) => t.driverId === st.driverId)!;
    const open = st.stops.find((s) => s.tourId === tour.id && s.status === "pending" && s.type === "delivery")!;
    const a = open.address;
    IMAGES["file:///cache/ImagePicker/dup.png"] = `${a.street} ${a.houseNumber ?? ""}, ${a.postalCode} ${a.city}`;
    const picker = jest.requireMock("expo-image-picker") as { launchImageLibraryAsync: jest.Mock };
    picker.launchImageLibraryAsync.mockResolvedValueOnce({ canceled: false, assets: [{ uri: "file:///cache/ImagePicker/dup.png" }] });
    await render(<PhotoImport />);
    await fireEvent.press(screen.getByTestId("pi-gallery"));
    await waitFor(() => expect(useImportStore.getState().drafts).toHaveLength(1));
    expect(useImportStore.getState().drafts[0]!.duplicates).toEqual([{ kind: "open_stop_same_address", stopId: open.id }]);
    expect(screen.getByText("Already on your route – parcels will be added to that stop")).toBeTruthy();
  });
});

describe("photo import – pasted text", () => {
  beforeEach(() => {
    useTourStore.getState().resetData();
    useTourStore.getState().setLocale("en");
    useImportStore.getState().reset();
  });

  it("paste a WhatsApp message with two addresses → two cards", async () => {
    await render(<PhotoImport />);
    await fireEvent.press(screen.getByTestId("pi-paste"));
    await fireEvent.changeText(screen.getByTestId("pi-paste-input"), "Hi! Noch zwei:\nAnna Krüger, Steinweg 20, 98527 Suhl\nKlaus Richter, Auenstraße 36, 98529 Suhl\nDanke 👍");
    await fireEvent.press(screen.getByTestId("pi-paste-read"));
    await waitFor(() => expect(useImportStore.getState().drafts).toHaveLength(2));
    expect(useImportStore.getState().drafts.map((d) => d.values.recipientName)).toEqual(["Anna Krüger", "Klaus Richter"]);
  });
});
