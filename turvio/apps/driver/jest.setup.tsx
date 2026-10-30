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
