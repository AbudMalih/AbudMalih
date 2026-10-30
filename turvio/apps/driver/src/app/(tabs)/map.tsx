import { router } from "expo-router";
import { Text, View } from "react-native";
import { TourMap } from "../../components/TourMap";
import { styles as ui } from "../../components/ui";
import { useT } from "../../lib/i18n";
import { useMyTour } from "../../store/useMyTour";

export default function MapScreen() {
  const t = useT();
  const { depot, stops } = useMyTour();
  if (!depot) {
    return (
      <View style={[ui.screen, ui.content]}>
        <Text style={ui.body}>{t("home.noTour")}</Text>
      </View>
    );
  }
  return (
    <View style={ui.screen}>
      <TourMap
        depot={depot}
        stops={stops}
        onStopPress={(stop) => router.push({ pathname: "/stop/[id]", params: { id: stop.id } })}
      />
    </View>
  );
}
