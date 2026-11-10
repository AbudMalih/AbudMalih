import type { Stop } from "@turvio/shared";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { addressLine } from "../lib/format";
import { useT } from "../lib/i18n";
import { availableNavApps, openNavigation, type NavApp } from "../lib/navigation";
import { navigationPoint } from "../lib/locationCheck";
import { useTourStore } from "../store/tourStore";
import { space, type as ty, useTheme } from "../theme";
import { Button, ListRow, Sheet } from "./ui";

/** Hands navigation off to Google Maps / Apple Maps / Waze; asks once unless a default is set. */
export function NavigateButton({ stop, variant = "primary", testID }: { stop: Stop; variant?: "primary" | "secondary"; testID?: string }) {
  const t = useT();
  const { c } = useTheme();
  const navApp = useTourStore((s) => s.prefs.navApp);
  const setPrefs = useTourStore((s) => s.setPrefs);
  const [open, setOpen] = useState(false);
  const [remember, setRemember] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  // An approach point accepted by dispatch (valid for this pin) is where the vehicle goes.
  const target = { location: navigationPoint(stop), addressText: addressLine(stop) };

  const go = async (app: NavApp) => {
    setOpen(false);
    if (remember) setPrefs({ navApp: app });
    const used = await openNavigation(app, target).catch(() => "web" as const);
    setNote(used === "web" ? t("nav.openedWeb") : null);
  };

  return (
    <View style={{ gap: 4, flex: 1 }}>
      <Button label={t("stop.navigate")} icon="navigate" variant={variant} onPress={() => (navApp ? void go(navApp) : setOpen(true))} testID={testID ?? "navigate"} />
      {note && <Text style={[ty.small, { color: c.textMuted }]}>{note}</Text>}
      {stop.approach && (
        <Text style={[ty.small, { color: c.textMuted }]} testID="navigate-approach">
          {t("location.navApproach", { road: stop.approach.roadName || t("location.unnamedRoad") })}
        </Text>
      )}
      <Sheet visible={open} onClose={() => setOpen(false)} title={t("nav.choose")}>
        {availableNavApps().map((app) => (
          <ListRow key={app} icon={app === "waze" ? "car-sport-outline" : "map-outline"} title={t(`nav.${app}`)} onPress={() => void go(app)} testID={`nav-${app}`} />
        ))}
        <Pressable onPress={() => setRemember(!remember)} accessibilityRole="checkbox" accessibilityState={{ checked: remember }} style={{ flexDirection: "row", alignItems: "center", gap: space.sm, paddingVertical: space.sm }}>
          <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: c.primary, backgroundColor: remember ? c.primary : "transparent" }} />
          <Text style={[ty.body, { color: c.text }]}>{t("nav.remember")}</Text>
        </Pressable>
      </Sheet>
    </View>
  );
}
