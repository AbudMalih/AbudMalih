import type { GeoPoint } from "@turvio/shared";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AddressSearch } from "../../components/AddressSearch";
import { TourMap } from "../../components/TourMap";
import { Button } from "../../components/ui";
import { feedback } from "../../lib/haptics";
import { useT } from "../../lib/i18n";
import { useTourStore } from "../../store/tourStore";
import { useMyTour, useStop } from "../../store/useMyTour";
import { radii, space, useTheme } from "../../theme";

/** Set or correct a stop's map position: address search or tap/drag on the map. */
export default function PickLocation() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useT();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { stop } = useStop(id);
  const { depot, stops } = useMyTour();
  const setStopLocation = useTourStore((s) => s.setStopLocation);
  const [pin, setPin] = useState<GeoPoint | null>(stop?.location ?? null);
  const [source, setSource] = useState<"geocoder" | "manual_pin">("manual_pin");
  if (!stop) return null;
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ padding: space.md }}>
        <AddressSearch
          near={depot?.location}
          onPick={(r) => {
            setPin(r.location);
            setSource("geocoder");
          }}
        />
      </View>
      <View style={{ flex: 1, margin: space.md, marginTop: 0, borderRadius: radii.lg, overflow: "hidden" }}>
        <TourMap
          depot={depot}
          stops={stops.filter((s) => s.id !== stop.id)}
          pendingPin={pin}
          onMapPress={(p) => {
            setPin(p);
            setSource("manual_pin");
          }}
        />
      </View>
      <View style={{ padding: space.md, paddingBottom: insets.bottom + space.md }}>
        <Button
          label={t("map.pickConfirm")}
          icon="checkmark"
          size="lg"
          disabled={!pin}
          onPress={() => {
            setStopLocation(stop.id, pin!, source);
            feedback.success();
            router.back();
          }}
          testID="pick-confirm"
        />
      </View>
    </View>
  );
}
