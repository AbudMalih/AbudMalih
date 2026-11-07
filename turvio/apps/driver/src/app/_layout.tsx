import { Redirect, router, useSegments } from "expo-router";
import { ShareIntentProvider, useShareIntentContext } from "expo-share-intent";
import { Stack } from "expo-router/stack";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { applyLayoutDirection, useLocale, useT } from "../lib/i18n";
import { loadServerUrlOverride, serverUrlLoaded } from "../lib/serverUrl";
import { setPendingShare } from "../lib/share";
import { isServerMode, useTourStore } from "../store/tourStore";
import { useTheme } from "../theme";

export default function RootLayout() {
  const locale = useLocale();
  const t = useT();
  const { c, dark } = useTheme();
  const user = useTourStore((s) => s.user);
  const segments = useSegments();
  // Test builds may point at another server (login screen); read it before the first API call.
  const [serverReady, setServerReady] = useState(serverUrlLoaded());
  const needsLogin = isServerMode() && !user && segments[0] !== "login";

  useEffect(() => {
    applyLayoutDirection(locale);
  }, [locale]);
  useEffect(() => {
    if (!serverReady) void loadServerUrlOverride().finally(() => setServerReady(true));
  }, [serverReady]);

  if (!serverReady) return null;
  if (needsLogin)
    return (
      <ShareIntentProvider options={{ resetOnBackground: false }}>
        <ShareBridge signedIn={false} />
        <Redirect href="/login" />
      </ShareIntentProvider>
    );

  const modal = { presentation: "modal" as const };
  return (
    <ShareIntentProvider options={{ resetOnBackground: false }}>
      <ShareBridge signedIn />
      <StatusBar style={dark ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: c.card },
          headerTintColor: c.text,
          headerShadowVisible: false,
          headerTitleStyle: { fontWeight: "700", fontSize: 17 },
          contentStyle: { backgroundColor: c.bg },
          animation: "slide_from_right",
          animationDuration: 220,
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="stop/[id]" options={{ title: "" }} />
        <Stack.Screen name="scan" options={{ headerShown: false, animation: "fade_from_bottom" }} />
        <Stack.Screen name="label" options={{ title: t("label.title"), ...modal }} />
        <Stack.Screen name="edit-stop/[id]" options={{ title: t("stop.editAddress"), ...modal }} />
        <Stack.Screen name="add-stop" options={{ title: t("addStop.title"), ...modal }} />
        <Stack.Screen name="photo-import/index" options={{ title: t("photoImport.title"), ...modal }} />
        <Stack.Screen name="photo-import/[key]" options={{ title: t("photoImport.edit"), ...modal }} />
        <Stack.Screen name="import" options={{ title: t("import.title"), ...modal }} />
        <Stack.Screen name="new-route" options={{ title: t("route.newTitle"), ...modal }} />
        <Stack.Screen name="optimize" options={{ title: t("optimize.title"), ...modal }} />
        <Stack.Screen name="pod/[id]" options={{ title: t("pod.title"), ...modal }} />
        <Stack.Screen name="outcome/[id]" options={{ title: t("outcome.title"), ...modal }} />
        <Stack.Screen name="pick-location/[id]" options={{ title: t("map.pickTitle") }} />
      </Stack>
    </ShareIntentProvider>
  );
}

/**
 * Shares from other apps (WhatsApp …): keep the items in memory, clear them in the native
 * module, and open the photo import once the driver is signed in.
 */
function ShareBridge({ signedIn }: { signedIn: boolean }) {
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntentContext();
  const [waiting, setWaiting] = useState(false);
  useEffect(() => {
    if (!hasShareIntent) return;
    if (setPendingShare(shareIntent) > 0) setWaiting(true);
    resetShareIntent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasShareIntent]);
  useEffect(() => {
    if (!waiting || !signedIn) return;
    setWaiting(false);
    router.push({ pathname: "/photo-import", params: { shared: String(Date.now()) } });
  }, [waiting, signedIn]);
  return null;
}
