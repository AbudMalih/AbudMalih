import AsyncStorage from "@react-native-async-storage/async-storage";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import LoginScreen from "../src/app/login";
import { createAuthClient, type TokenStore } from "../src/lib/auth";
import { apiBaseUrl } from "../src/lib/optimizer";
import { __resetServerUrlForTests, appVariant, loadServerUrlOverride, setServerUrlOverride, validateServerUrl } from "../src/lib/serverUrl";
import { setAuthClient, useTourStore } from "../src/store/tourStore";

const mockConfig: { extra: { variant?: string } } = { extra: {} };
jest.mock("expo-constants", () => ({ get expoConfig() { return { version: "test", extra: mockConfig.extra }; } }));
jest.mock("expo-router", () => ({ router: { replace: jest.fn(), push: jest.fn() }, Redirect: () => null }));

const BUILD = "https://api.staging.turvio.test";

beforeEach(async () => {
  __resetServerUrlForTests();
  await AsyncStorage.clear();
  process.env.EXPO_PUBLIC_API_URL = BUILD;
  mockConfig.extra = { variant: "preview" };
});
afterAll(() => {
  delete process.env.EXPO_PUBLIC_API_URL;
});

describe("server address rules", () => {
  it.each([
    ["https://api.example.com", "https://api.example.com"],
    ["  https://API.Example.com/ ", "https://api.example.com"],
    ["https://example.com/turvio/", "https://example.com/turvio"],
    ["https://api.example.com:8443", "https://api.example.com:8443"],
    ["http://localhost:4000", "http://localhost:4000"],
    ["http://127.0.0.1:4000", "http://127.0.0.1:4000"],
    ["http://10.0.2.2:4000", "http://10.0.2.2:4000"],
    ["http://192.168.178.20:4000/", "http://192.168.178.20:4000"],
  ])("accepts %s", (input, url) => {
    expect(validateServerUrl(input)).toEqual({ ok: true, url });
  });

  it.each([
    ["http://api.example.com", "insecure"],
    ["http://172.16.0.5:4000", "insecure"],
    ["http://192.169.1.1", "insecure"],
    ["http://10.0.0.300", "invalid"],
    ["http://localhost.evil.com", "insecure"],
    ["api.example.com", "invalid"],
    ["ftp://api.example.com", "invalid"],
    ["https://user:pw@api.example.com", "invalid"],
    ["https://api.example.com/?x=1", "invalid"],
    ["https://", "invalid"],
    ["", "invalid"],
  ])("rejects %s (%s)", (input, reason) => {
    expect(validateServerUrl(input)).toEqual({ ok: false, reason });
  });
});

describe("runtime server override", () => {
  it("preview builds use and persist the chosen server; reset returns to the built-in one", async () => {
    expect(appVariant()).toBe("preview");
    expect(apiBaseUrl()).toBe(BUILD);
    expect(await setServerUrlOverride("https://api.other.test/")).toEqual({ ok: true, url: "https://api.other.test" });
    expect(apiBaseUrl()).toBe("https://api.other.test");
    expect(await AsyncStorage.getItem("turvio.serverUrl")).toBe("https://api.other.test");

    // Next app start: restored from storage.
    __resetServerUrlForTests();
    expect(apiBaseUrl()).toBe(BUILD);
    expect(await loadServerUrlOverride()).toBe("https://api.other.test");
    expect(apiBaseUrl()).toBe("https://api.other.test");

    expect(await setServerUrlOverride("http://api.other.test")).toEqual({ ok: false, reason: "insecure" });
    expect(apiBaseUrl()).toBe("https://api.other.test");
    await setServerUrlOverride(null);
    expect(apiBaseUrl()).toBe(BUILD);
    expect(await AsyncStorage.getItem("turvio.serverUrl")).toBeNull();
  });

  it("development builds may use a LAN server over http", async () => {
    mockConfig.extra = { variant: "development" };
    expect((await setServerUrlOverride("http://192.168.1.50:4000")).ok).toBe(true);
    expect(apiBaseUrl()).toBe("http://192.168.1.50:4000");
  });

  it("production builds ignore stored overrides and refuse new ones", async () => {
    await AsyncStorage.setItem("turvio.serverUrl", "https://api.other.test");
    mockConfig.extra = { variant: "production" };
    expect(await loadServerUrlOverride()).toBeNull();
    expect(apiBaseUrl()).toBe(BUILD);
    expect((await setServerUrlOverride("https://api.other.test")).ok).toBe(false);
    expect(apiBaseUrl()).toBe(BUILD);
    mockConfig.extra = {};
    expect(appVariant()).toBe("production");
  });

  it("a stored invalid address is ignored", async () => {
    await AsyncStorage.setItem("turvio.serverUrl", "http://evil.example.com");
    expect(await loadServerUrlOverride()).toBeNull();
    expect(apiBaseUrl()).toBe(BUILD);
  });

  it("never turns a demo build (no built-in server) into a server build", async () => {
    await setServerUrlOverride("https://api.other.test");
    delete process.env.EXPO_PUBLIC_API_URL;
    expect(apiBaseUrl()).toBeNull();
  });
});

describe("login screen", () => {
  const calls: string[] = [];
  const memory = (): TokenStore => {
    const m = new Map<string, string>();
    return { get: async (k) => m.get(k) ?? null, set: async (k, v) => void m.set(k, v), remove: async (k) => void m.delete(k) };
  };
  beforeEach(() => {
    calls.length = 0;
    useTourStore.setState({ user: null });
    useTourStore.getState().setLocale("en");
    setAuthClient(
      createAuthClient({
        store: memory(),
        fetchImpl: (async (url: string) => {
          calls.push(url);
          return { ok: false, status: 401, json: async () => ({ error: { code: "invalid_credentials", message: "Email or password is incorrect" } }) } as Response;
        }) as typeof fetch,
      }),
    );
  });
  afterAll(() => setAuthClient(null));

  it("preview: lets the tester pick a server (https only) and signs in against it", async () => {
    await render(<LoginScreen />);
    expect(screen.getByTestId("login-server-active").props.children).toBe(BUILD);
    await fireEvent.press(screen.getByTestId("login-server-toggle"));
    await fireEvent.changeText(screen.getByTestId("login-server-url"), "http://api.other.test");
    await fireEvent.press(screen.getByTestId("login-server-save"));
    expect(await screen.findByText(/Use https:\/\//)).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId("login-server-url"), "https://api.other.test");
    await fireEvent.press(screen.getByTestId("login-server-save"));
    await waitFor(() => expect(apiBaseUrl()).toBe("https://api.other.test"));

    await fireEvent.changeText(screen.getByTestId("login-email"), "felix@jarbou.test");
    await fireEvent.changeText(screen.getByTestId("login-password"), "pw");
    await fireEvent.press(screen.getByTestId("login-submit"));
    await waitFor(() => expect(calls).toContain("https://api.other.test/v1/auth/login"));
  });

  it("production: no server field", async () => {
    mockConfig.extra = { variant: "production" };
    await render(<LoginScreen />);
    expect(screen.queryByTestId("login-server")).toBeNull();
  });
});
