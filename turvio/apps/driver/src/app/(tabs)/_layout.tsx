import Ionicons from "@expo/vector-icons/Ionicons";
import { colors } from "@turvio/shared";
import { Tabs } from "expo-router/js-tabs";
import { useEffect, type ComponentProps } from "react";
import { AppState } from "react-native";
import type { ColorValue } from "react-native";
import { useT } from "../../lib/i18n";
import { isServerMode, useTourStore } from "../../store/tourStore";

/** Keeps the published tour in sync: on open, every 30 s and when the app returns to the foreground. */
function useBackgroundSync() {
  const sync = useTourStore((s) => s.sync);
  useEffect(() => {
    if (!isServerMode()) return;
    void sync();
    const timer = setInterval(() => void sync(), 30_000);
    const sub = AppState.addEventListener("change", (state) => state === "active" && void sync());
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [sync]);
}

type IconName = ComponentProps<typeof Ionicons>["name"];

function icon(name: IconName) {
  return ({ color, size }: { color: ColorValue; size: number }) => <Ionicons name={name} color={typeof color === "number" || color == null ? undefined : color} size={size} />;
}

export default function TabLayout() {
  const t = useT();
  useBackgroundSync();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.white, borderTopColor: colors.border, height: 64, paddingBottom: 8 },
        tabBarLabelStyle: { fontSize: 12, fontWeight: "600" },
        headerStyle: { backgroundColor: colors.white },
        headerTitleStyle: { fontWeight: "700", color: colors.text },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t("tabs.today"), tabBarIcon: icon("today-outline") }} />
      <Tabs.Screen name="stops" options={{ title: t("tabs.stops"), tabBarIcon: icon("list-outline") }} />
      <Tabs.Screen name="map" options={{ title: t("tabs.map"), tabBarIcon: icon("map-outline") }} />
      <Tabs.Screen name="settings" options={{ title: t("tabs.settings"), tabBarIcon: icon("settings-outline") }} />
    </Tabs>
  );
}
