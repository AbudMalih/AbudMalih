import { Tabs } from "expo-router/js-tabs";
import { useEffect } from "react";
import { AppState, StyleSheet, View, type ColorValue } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TrackingNoticeHost } from "../../components/Tracking";
import { Ionicons, type IconName } from "../../components/ui";
import { useTourTracking } from "../../lib/useTourTracking";
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
    <View style={{ width: 48, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: focused ? c.primarySoft : "transparent" }}>
      <Ionicons name={focused ? active : name} color={typeof color === "string" ? color : undefined} size={21} />
    </View>
  );
}

export default function TabLayout() {
  const t = useT();
  const { c } = useTheme();
  // Edge-to-edge (Android) / home indicator (iOS): the bar's own height plus the system's
  // bottom inset, so tabs never sit on the 3-button bar or the gesture handle.
  const insets = useSafeAreaInsets();
  const bottom = insets.bottom;
  useBackgroundSync();
  useTourTracking();
  const today = useIcon("home-outline", "home");
  const stops = useIcon("list-outline", "list");
  const map = useIcon("map-outline", "map");
  const settings = useIcon("person-circle-outline", "person-circle");
  return (
    <>
    <TrackingNoticeHost />
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.textMuted,
        tabBarStyle: { backgroundColor: c.card, borderTopColor: c.border, borderTopWidth: StyleSheet.hairlineWidth, height: 68 + bottom, paddingBottom: bottom + 6, paddingTop: 6 },
        tabBarItemStyle: { minHeight: 48 },
        tabBarLabelStyle: { fontSize: 11, lineHeight: 14, fontWeight: "600", marginTop: 2 },
        headerStyle: { backgroundColor: c.card },
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: "700", color: c.text, fontSize: 17 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t("tabs.today"), headerShown: false, tabBarIcon: today, tabBarButtonTestID: "tab-today" }} />
      <Tabs.Screen name="stops" options={{ title: t("tabs.stops"), tabBarIcon: stops, tabBarButtonTestID: "tab-stops" }} />
      <Tabs.Screen name="map" options={{ title: t("tabs.map"), headerShown: false, tabBarIcon: map, tabBarButtonTestID: "tab-map" }} />
      <Tabs.Screen name="settings" options={{ title: t("tabs.settings"), tabBarIcon: settings, tabBarButtonTestID: "tab-settings" }} />
    </Tabs>
    </>
  );
}
