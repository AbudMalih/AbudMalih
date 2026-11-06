import { render, screen, waitFor } from "@testing-library/react-native";
import PhotoImport from "../src/app/photo-import";
import { registerOcrEngine } from "../src/lib/ocr";
import { consumeSharedItems, hasPendingShare, setPendingShare } from "../src/lib/share";
import { useImportStore } from "../src/store/importStore";
import { useTourStore } from "../src/store/tourStore";

const mockDeleted: string[] = [];
jest.mock("../src/lib/files", () => ({ deleteTemporary: async (uri: string) => void mockDeleted.push(uri), deleteFile: async () => undefined }));
jest.mock("expo-router", () => ({ router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() }, useLocalSearchParams: () => ({ shared: "1" }), Stack: { Screen: () => null } }));
jest.mock("expo-constants", () => ({ expoConfig: { version: "test" } }));
jest.mock("expo-camera", () => ({ scanFromURLAsync: jest.fn(async () => []) }));
jest.mock("expo-image-picker", () => ({}));

describe("share into TURVIO", () => {
  beforeEach(() => {
    mockDeleted.length = 0;
    void consumeSharedItems();
  });

  it("keeps images (max 10) and text; other files are discarded and their copies deleted", async () => {
    const files = [
      { path: "file:///cache/a.jpg", mimeType: "image/jpeg", size: 1000 },
      { path: "file:///cache/doc.pdf", mimeType: "application/pdf", size: 1000 },
      { path: "file:///cache/huge.png", mimeType: "image/png", size: 80 * 1024 * 1024 },
      ...Array.from({ length: 12 }, (_, i) => ({ path: `file:///cache/s${i}.png`, mimeType: "image/png", size: 10 })),
    ];
    expect(setPendingShare({ files, text: "Steinweg 20, 98527 Suhl" })).toBe(11);
    expect(hasPendingShare()).toBe(true);
    const items = await consumeSharedItems();
    expect(items.filter((i) => i.kind === "image")).toHaveLength(10);
    expect(items.at(-1)).toEqual({ kind: "text", text: "Steinweg 20, 98527 Suhl" });
    expect(mockDeleted).toEqual(expect.arrayContaining(["file:///cache/doc.pdf", "file:///cache/huge.png", "file:///cache/s10.png", "file:///cache/s11.png"]));
    expect(hasPendingShare()).toBe(false);
  });

  it("a shared WhatsApp text and screenshot open as cards in the photo import", async () => {
    useTourStore.getState().resetData();
    useTourStore.getState().setLocale("en");
    useImportStore.getState().reset();
    registerOcrEngine({ name: "test", recognize: async () => [{ text: "Klaus Richter" }, { text: "Auenstraße 36" }, { text: "98529 Suhl" }] });
    setPendingShare({ text: "Anna Krüger, Steinweg 20, 98527 Suhl", files: [{ path: "file:///cache/shot.png", mimeType: "image/png", size: 100 }] });
    await render(<PhotoImport />);
    await waitFor(() => expect(useImportStore.getState().drafts).toHaveLength(2));
    expect(screen.getByText("Anna Krüger")).toBeTruthy();
    expect(screen.getByText("Klaus Richter")).toBeTruthy();
    expect(mockDeleted).toContain("file:///cache/shot.png");
  });
});
