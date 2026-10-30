import { colors } from "@turvio/shared";
import { Stack } from "expo-router/stack";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { applyLayoutDirection, useLocale, useT } from "../lib/i18n";

export default function RootLayout() {
  const locale = useLocale();
  const t = useT();

  useEffect(() => {
    applyLayoutDirection(locale);
  }, [locale]);

  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.white },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: "700" },
          contentStyle: { backgroundColor: colors.surface },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="add-stop" options={{ title: t("addStop.title"), presentation: "modal" }} />
        <Stack.Screen name="stop/[id]" options={{ title: "" }} />
      </Stack>
    </>
  );
}
