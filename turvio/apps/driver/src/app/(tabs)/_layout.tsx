import { router } from "expo-router";
import { Tabs, type BottomTabBarProps } from "expo-router/js-tabs";
import { useEffect } from "react";
import { AppState, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TrackingNoticeHost } from "../../components/Tracking";
import { GRADIENTS, GradientFill, Ionicons, type IconName } from "../../components/ui";
import { useTourTracking } from "../../lib/useTourTracking";
import { useT } from "../../lib/i18n";
import { isServerMode, useTourStore } from "../../store/tourStore";
import { fw, useTheme } from "../../theme";

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

const TAB_ICONS: Record<string, [IconName, IconName]> = {
  index: ["home-outline", "home"],
  map: ["map-outline", "map"],
  stops: ["list-outline", "list"],
  settings: ["ellipsis-horizontal", "ellipsis-horizontal"],
};

/**
 * TURVIO NEXT tab bar (prototype .tabbar): floating rounded bar, violet active pill, raised
 * gradient scan button between Stops and More. Same routes and test IDs as before.
 */
function NextTabBar({ state, descriptors, emitter, navigateToTab }: BottomTabBarProps) {
  const { c, dark } = useTheme();
  const t = useT();
  const insets = useSafeAreaInsets();
  const item = (route: (typeof state.routes)[number], index: number) => {
    const { options } = descriptors[route.key]!;
    const focused = state.index === index;
    const [icon, active] = TAB_ICONS[route.name] ?? ["ellipse-outline", "ellipse"];
    const label = typeof options.title === "string" ? options.title : route.name;
    return (
      <Pressable
        key={route.key}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={label}
        testID={options.tabBarButtonTestID}
        onPress={() => {
          const e = emitter.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
          if (!focused && !e.defaultPrevented) navigateToTab(route.key);
        }}
        style={({ pressed }) => [styles.tab, focused && { backgroundColor: c.primarySoft, borderColor: dark ? "rgba(117,91,255,0.3)" : "rgba(91,68,232,0.2)" }, { transform: [{ scale: pressed ? 0.94 : 1 }] }]}
      >
        <Ionicons name={focused ? active : icon} size={21} color={focused ? c.primaryText : c.textMuted} />
        <Text style={[styles.label, { color: focused ? c.text : c.textMuted }]} numberOfLines={1}>
          {label}
        </Text>
      </Pressable>
    );
  };
  const items = state.routes.map(item);
  const scan = (
    <Pressable
      key="scan"
      accessibilityRole="button"
      accessibilityLabel={t("tabs.scan")}
      testID="tab-scan"
      onPress={() => router.push("/scan")}
      style={({ pressed }) => [styles.tab, { transform: [{ scale: pressed ? 0.92 : 1 }] }]}
    >
      <View style={styles.scan}>
        <GradientFill colors={GRADIENTS.scan} radius={17} />
        <Ionicons name="scan" size={24} color="#FFFFFF" />
      </View>
    </Pressable>
  );
  items.splice(Math.max(0, items.length - 1), 0, scan);
  return (
    <View style={{ backgroundColor: c.bg, paddingHorizontal: 12, paddingTop: 6, paddingBottom: Math.max(insets.bottom, 8) + 4 }}>
      <View style={[styles.bar, { backgroundColor: c.tabBar, borderColor: c.borderStrong }]} accessibilityRole="tablist">
        {items}
      </View>
    </View>
  );
}

export default function TabLayout() {
  const t = useT();
  const { c } = useTheme();
  useBackgroundSync();
  useTourTracking();
  return (
    <>
    <TrackingNoticeHost />
    <Tabs
      tabBar={(props) => <NextTabBar {...props} />}
      screenOptions={{
        headerStyle: { backgroundColor: c.bg },
        headerShadowVisible: false,
        headerTitleStyle: { ...fw("800"), color: c.text, fontSize: 18 },
        sceneStyle: { backgroundColor: c.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t("tabs.today"), headerShown: false, tabBarButtonTestID: "tab-today" }} />
      <Tabs.Screen name="map" options={{ title: t("tabs.map"), headerShown: false, tabBarButtonTestID: "tab-map" }} />
      <Tabs.Screen name="stops" options={{ title: t("tabs.stops"), tabBarButtonTestID: "tab-stops" }} />
      <Tabs.Screen name="settings" options={{ title: t("tabs.more"), tabBarButtonTestID: "tab-settings" }} />
    </Tabs>
    </>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 26,
    borderWidth: 1,
    padding: 6,
    gap: 2,
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  tab: { flex: 1, height: 56, borderRadius: 18, borderWidth: 1, borderColor: "transparent", alignItems: "center", justifyContent: "center", gap: 3 },
  label: { fontSize: 11, lineHeight: 13, ...fw("700") },
  scan: { width: 50, height: 50, borderRadius: 17, alignItems: "center", justifyContent: "center", overflow: "hidden", marginTop: -6, shadowColor: "#6F55FF", shadowOpacity: 0.7, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
});
