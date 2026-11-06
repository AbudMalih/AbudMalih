import { Redirect, useSegments } from "expo-router";
import { Stack } from "expo-router/stack";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { applyLayoutDirection, useLocale, useT } from "../lib/i18n";
import { isServerMode, useTourStore } from "../store/tourStore";
import { useTheme } from "../theme";

export default function RootLayout() {
  const locale = useLocale();
  const t = useT();
  const { c, dark } = useTheme();
  const user = useTourStore((s) => s.user);
  const segments = useSegments();
  const needsLogin = isServerMode() && !user && segments[0] !== "login";

  useEffect(() => {
    applyLayoutDirection(locale);
  }, [locale]);

  if (needsLogin) return <Redirect href="/login" />;

  const modal = { presentation: "modal" as const };
  return (
    <>
      <StatusBar style={dark ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: c.card },
          headerTintColor: c.text,
          headerShadowVisible: false,
          headerTitleStyle: { fontWeight: "700" },
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
        <Stack.Screen name="import" options={{ title: t("import.title"), ...modal }} />
        <Stack.Screen name="new-route" options={{ title: t("route.newTitle"), ...modal }} />
        <Stack.Screen name="optimize" options={{ title: t("optimize.title"), ...modal }} />
        <Stack.Screen name="pod/[id]" options={{ title: t("pod.title"), ...modal }} />
        <Stack.Screen name="outcome/[id]" options={{ title: t("outcome.title"), ...modal }} />
        <Stack.Screen name="pick-location/[id]" options={{ title: t("map.pickTitle") }} />
      </Stack>
    </>
  );
}
