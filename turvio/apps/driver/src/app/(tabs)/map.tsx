import { isOpen } from "@turvio/shared";
import { router } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NavigateButton } from "../../components/NavigateButton";
import { StopCard } from "../../components/StopCard";
import { TourMap } from "../../components/TourMap";
import { Banner, EmptyState, IconButton } from "../../components/ui";
import { useT } from "../../lib/i18n";
import { currentPosition } from "../../lib/location";
import { useMyTour } from "../../store/useMyTour";
import { radii, space, type as ty, useTheme } from "../../theme";

export default function MapScreen() {
  const t = useT();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { tour, depot, stops } = useMyTour();
  const [showMe, setShowMe] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const next = stops.find((s) => isOpen(s.status));
  const focus = stops.find((s) => s.id === selected) ?? next;

  if (!tour) return <EmptyState icon="map-outline" title={t("home.noRoutes")} text={t("home.noRoutesText")} />;

  const toggleMe = async () => {
    if (showMe) return setShowMe(false);
    const r = await currentPosition(true);
    if (r.ok) {
      setShowMe(true);
      setNotice(t("map.locationExplain"));
    } else setNotice(t("optimize.locationDenied"));
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <TourMap depot={depot} stops={stops} currentStopId={focus?.id} showUserLocation={showMe} onStopPress={(s) => setSelected(s.id)} />
      <View style={{ position: "absolute", top: insets.top + space.sm, right: space.lg, gap: space.sm }}>
        <IconButton icon={showMe ? "locate" : "locate-outline"} label={t("map.myLocation")} active={showMe} onPress={() => void toggleMe()} testID="map-locate" />
      </View>
      <View style={{ position: "absolute", left: space.md, right: space.md, bottom: space.md, gap: space.sm }}>
        {notice && <Banner text={notice} tone="neutral" icon="location-outline" />}
        {focus && (
          <View style={{ backgroundColor: c.card, borderRadius: radii.xl, padding: space.md, gap: space.sm, borderWidth: 1, borderColor: c.border, shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 12, elevation: 6 }}>
            <Text style={[ty.caption, { color: c.textMuted }]}>{focus.id === next?.id ? t("map.next").toUpperCase() : `#${stops.indexOf(focus) + 1}`}</Text>
            <StopCard stop={focus} index={stops.indexOf(focus)} current={focus.id === next?.id} onPress={() => router.push(`/stop/${focus.id}`)} />
            <View style={{ flexDirection: "row", gap: space.sm }}>
              <NavigateButton stop={focus} />
            </View>
            <Text style={[ty.small, { color: c.textSubtle, fontSize: 12 }]}>{t("map.orderLine")}</Text>
          </View>
        )}
      </View>
    </View>
  );
}
