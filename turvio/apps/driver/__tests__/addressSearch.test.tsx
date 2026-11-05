import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { AddressSearch } from "../src/components/AddressSearch";
import { useTourStore } from "../src/store/tourStore";

const mockSearch = jest.fn(async () => ({ status: "unavailable" as const, message: "not configured" }));
jest.mock("../src/lib/geocode", () => ({ searchAddress: (...a: unknown[]) => mockSearch(...(a as [])) }));

describe("AddressSearch", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockSearch.mockClear();
    useTourStore.getState().setLocale("en");
  });
  afterEach(() => jest.useRealTimers());

  it("searches once per typed query (debounced) and explains when no provider is configured", async () => {
    await render(<AddressSearch onPick={() => undefined} />);
    await fireEvent.changeText(screen.getByTestId("address-search"), "Lister Meile 42");
    await act(async () => {
      jest.advanceTimersByTime(2000);
    });
    await act(async () => {
      jest.advanceTimersByTime(2000);
    });
    expect(mockSearch).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Address search is not configured/)).toBeTruthy();
  });
});
