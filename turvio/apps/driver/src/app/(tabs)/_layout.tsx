import { Tabs } from "expo-router/js-tabs";
import { useEffect } from "react";
import { AppState, View, type ColorValue } from "react-native";
import { Ionicons, type IconName } from "../../components/ui";
import { useT } from "../../lib/i18n";
import { isServerMode, useTourStore } from "../../store/tourStore";
import { useTheme } from "../../theme";

/** Keeps routes in sync: on open, every 30 s and when the app returns to the foreground. */
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

function useIcon(name: IconName, active: IconName) {
  const { c } = useTheme();
  return ({ color, focused }: { color: ColorValue; focused: boolean }) => (
    <View style={{ width: 52, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: focused ? c.primarySoft : "transparent" }}>
      <Ionicons name={focused ? active : name} color={typeof color === "string" ? color : undefined} size={22} />
    </View>
  );
}

export default function TabLayout() {
  const t = useT();
  const { c } = useTheme();
  useBackgroundSync();
  const today = useIcon("home-outline", "home");
  const stops = useIcon("list-outline", "list");
  const map = useIcon("map-outline", "map");
  const settings = useIcon("person-circle-outline", "person-circle");
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.textMuted,
        tabBarStyle: { backgroundColor: c.card, borderTopColor: c.border, height: 70, paddingBottom: 10, paddingTop: 6 },
        tabBarLabelStyle: { fontSize: 12, fontWeight: "700" },
        headerStyle: { backgroundColor: c.card },
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: "800", color: c.text, fontSize: 20 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t("tabs.today"), headerShown: false, tabBarIcon: today, tabBarButtonTestID: "tab-today" }} />
      <Tabs.Screen name="stops" options={{ title: t("tabs.stops"), tabBarIcon: stops, tabBarButtonTestID: "tab-stops" }} />
      <Tabs.Screen name="map" options={{ title: t("tabs.map"), headerShown: false, tabBarIcon: map, tabBarButtonTestID: "tab-map" }} />
      <Tabs.Screen name="settings" options={{ title: t("tabs.settings"), tabBarIcon: settings, tabBarButtonTestID: "tab-settings" }} />
    </Tabs>
  );
}
