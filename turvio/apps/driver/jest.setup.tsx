// AsyncStorage ships an official in-memory Jest mock.
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

// react-native-maps is native-only; render plain views in tests.
jest.mock("react-native-maps", () => {
  const { View } = require("react-native");
  const Mock = (props: { children?: unknown; testID?: string }) => <View testID={props.testID}>{props.children as never}</View>;
  return { __esModule: true, default: Mock, Marker: Mock, Polyline: Mock };
});

// Native-only modules used by Phase 4 screens: light-weight mocks for unit tests.
jest.mock("expo-haptics", () => ({
  notificationAsync: jest.fn(async () => undefined),
  impactAsync: jest.fn(async () => undefined),
  NotificationFeedbackType: { Success: "success", Warning: "warning", Error: "error" },
  ImpactFeedbackStyle: { Light: "light" },
}));
jest.mock("expo-crypto", () => ({ randomUUID: () => require("node:crypto").randomUUID() }));
jest.mock("expo-location", () => ({
  getForegroundPermissionsAsync: jest.fn(async () => ({ status: "denied", canAskAgain: false })),
  requestForegroundPermissionsAsync: jest.fn(async () => ({ status: "denied" })),
  getCurrentPositionAsync: jest.fn(),
  Accuracy: { Balanced: 3 },
}));
jest.mock("expo-file-system", () => {
  const files = (globalThis as { __files?: Map<string, string> }).__files ?? new Map<string, string>();
  (globalThis as { __files?: Map<string, string> }).__files = files;
  class File {
    uri: string;
    constructor(...parts: (string | { uri: string })[]) {
      this.uri = parts.map((p) => (typeof p === "string" ? p : p.uri)).join("/");
    }
    get exists() {
      return files.has(this.uri);
    }
    async base64() {
      if (!files.has(this.uri)) throw new Error("missing");
      return files.get(this.uri)!;
    }
    delete() {
      files.delete(this.uri);
    }
  }
  class Directory extends File {
    create() {}
  }
  return { File, Directory, Paths: { document: { uri: "file:///doc" } } };
});
jest.mock("react-native-safe-area-context", () => require("react-native-safe-area-context/jest/mock").default);
// Icon fonts are assets; render icons as plain text nodes in tests.
jest.mock("@expo/vector-icons/Ionicons", () => {
  const { Text } = require("react-native");
  const Icon = ({ name }: { name: string }) => <Text>{`icon:${name}`}</Text>;
  return { __esModule: true, default: Icon };
});
