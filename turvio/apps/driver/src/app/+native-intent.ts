import { getShareExtensionKey } from "expo-share-intent";

/**
 * iOS opens the app with "<scheme>://dataUrl=<key>…" after a share. That is not a screen:
 * send it to the home route; the ShareBridge in the root layout picks up the items and
 * opens the photo import (after sign-in when needed).
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    return path.includes(`dataUrl=${getShareExtensionKey()}`) ? "/" : path;
  } catch {
    return "/";
  }
}
