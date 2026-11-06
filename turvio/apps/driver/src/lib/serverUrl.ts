import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

/**
 * Runtime TURVIO server address for development and preview (test) builds.
 *
 * Production builds always use the build-time EXPO_PUBLIC_API_URL; a stored
 * override is ignored there. The override only changes *which* server a
 * server-mode build talks to – it never turns a demo build into a server build.
 */
const KEY = "turvio.serverUrl";

export type AppVariant = "development" | "preview" | "production";

export function appVariant(): AppVariant {
  const v = (Constants.expoConfig?.extra as { variant?: string } | undefined)?.variant;
  return v === "development" || v === "preview" ? v : "production";
}

export const canOverrideServerUrl = () => appVariant() !== "production";

export type ServerUrlCheck = { ok: true; url: string } | { ok: false; reason: "invalid" | "insecure" };

/** Hosts that may use plain http:// in test builds: this machine and private LANs (10.x, 192.168.x). */
function isLocalHost(host: string): boolean {
  if (host === "localhost" || host === "127.0.0.1" || host === "[::1]") return true;
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m || m.slice(1).some((p) => Number(p) > 255)) return false;
  return m[1] === "10" || (m[1] === "192" && m[2] === "168");
}

/** https:// required, except localhost / 10.x / 192.168.x over http://. No credentials, query or fragment. */
export function validateServerUrl(input: string): ServerUrlCheck {
  const raw = input.trim();
  if (!/^https?:\/\//i.test(raw)) return { ok: false, reason: "invalid" };
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return { ok: false, reason: "invalid" };
  }
  if (!u.hostname || u.username || u.password || u.search || u.hash) return { ok: false, reason: "invalid" };
  const host = u.hostname.toLowerCase();
  if (u.protocol === "http:" && !isLocalHost(host)) return { ok: false, reason: "insecure" };
  if (u.protocol !== "http:" && u.protocol !== "https:") return { ok: false, reason: "invalid" };
  const path = u.pathname.replace(/\/+$/, "");
  return { ok: true, url: `${u.protocol}//${u.host.toLowerCase()}${path}` };
}

let override: string | null = null;
let loaded = false;

/** The build-time server (EXPO_PUBLIC_API_URL) or null in demo builds. */
export function buildServerUrl(): string | null {
  const url = process.env.EXPO_PUBLIC_API_URL?.trim();
  return url ? url.replace(/\/$/, "") : null;
}

/** The active override (null when none, or in production builds). */
export function serverUrlOverride(): string | null {
  return canOverrideServerUrl() ? override : null;
}

/** Reads the stored override once at start-up (before the first API call). */
export async function loadServerUrlOverride(): Promise<string | null> {
  if (!loaded) {
    if (canOverrideServerUrl()) {
      const stored = await AsyncStorage.getItem(KEY).catch(() => null);
      const check = stored ? validateServerUrl(stored) : null;
      override = check?.ok ? check.url : null;
    }
    loaded = true;
  }
  return serverUrlOverride();
}

/** Stores (or with null removes) the override. Refused in production builds and for invalid addresses. */
export async function setServerUrlOverride(input: string | null): Promise<ServerUrlCheck | { ok: true; url: null }> {
  if (!canOverrideServerUrl()) return { ok: false, reason: "invalid" };
  if (input === null || input.trim() === "") {
    override = null;
    await AsyncStorage.removeItem(KEY);
    return { ok: true, url: null };
  }
  const check = validateServerUrl(input);
  if (!check.ok) return check;
  override = check.url;
  await AsyncStorage.setItem(KEY, check.url);
  return check;
}

export const serverUrlLoaded = () => loaded;

/** Tests only. */
export function __resetServerUrlForTests() {
  override = null;
  loaded = false;
}
