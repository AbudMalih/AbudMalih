import { isOpen } from "@turvio/shared";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NavigateButton } from "../../components/NavigateButton";
import { StopCard } from "../../components/StopCard";
import { TourMap } from "../../components/TourMap";
import { Banner, EmptyState, IconButton } from "../../components/ui";
import { useT } from "../../lib/i18n";
import { locationPermission } from "../../lib/location";
import { useMyLocation } from "../../lib/useMyLocation";
import { useMyTour } from "../../store/useMyTour";
import { lift, radii, space, type as ty, useTheme } from "../../theme";

export default function MapScreen() {
  const t = useT();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { tour, depot, stops, road } = useMyTour();
  const { showMe, setShowMe, locating, focus: focusMe, notice, locate, onUserGesture } = useMyLocation();
  const [selected, setSelected] = useState<string | null>(null);
  const next = stops.find((s) => isOpen(s.status));
  const focus = stops.find((s) => s.id === selected) ?? next;
  // Already allowed (e.g. for optimizing from here): show the position dot right away, never prompt here.
  useEffect(() => {
    void locationPermission().then((p) => p === "granted" && setShowMe(true));
  }, []);

  if (!tour) return <EmptyState icon="map-outline" title={t("home.noRoutes")} text={t("home.noRoutesText")} />;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <TourMap
        depot={depot}
        tour={tour}
        stops={stops}
        roadGeometry={road?.geometry ?? null}
        currentStopId={focus?.id}
        showUserLocation={showMe}
        onStopPress={(s) => setSelected(s.id)}
        focus={focusMe}
        onUserGesture={onUserGesture}
      />
      <View style={{ position: "absolute", top: insets.top + space.sm, right: space.lg, gap: space.sm }}>
        <IconButton icon={showMe ? "locate" : "locate-outline"} label={t("map.myLocation")} active={showMe} loading={locating} onPress={() => void locate()} testID="map-locate" />
      </View>
      <View style={{ position: "absolute", left: space.md, right: space.md, bottom: space.md, gap: space.sm }}>
        {notice && <Banner text={notice.text} tone={notice.tone} icon="location-outline" action={notice.action} />}
        {locating && !notice && <Banner text={t("map.locating")} tone="neutral" icon="locate-outline" />}
        {focus && (
          <View style={{ backgroundColor: c.card, borderRadius: radii.xl, padding: space.md, gap: space.sm, borderWidth: 1, borderColor: c.border, ...lift(2, { opaque: true }) }}>
            <Text style={[ty.caption, { color: c.textMuted }]}>{focus.id === next?.id ? t("map.next").toUpperCase() : `#${stops.indexOf(focus) + 1}`}</Text>
            <StopCard stop={focus} index={stops.indexOf(focus)} current={focus.id === next?.id} onPress={() => router.push(`/stop/${focus.id}`)} />
            <View style={{ flexDirection: "row", gap: space.sm }}>
              <NavigateButton stop={focus} />
            </View>
            <Text style={[ty.small, { color: c.textSubtle, fontSize: 12 }]}>{road ? t("map.roadLine") : t("map.orderLine")}</Text>
          </View>
        )}
      </View>
    </View>
  );
}
