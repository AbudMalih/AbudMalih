import { Text, View } from "react-native";
import { useT } from "../lib/i18n";
import type { TourChange } from "../lib/tourChanges";
import { useTourStore } from "../store/tourStore";
import { space, type as ty, useTheme } from "../theme";
import { Button, Ionicons, Sheet } from "./ui";

/**
 * Mounted once (tab layout): what dispatch changed in the driver's tours since the last sync
 * (withdrawn, cancelled, finished, stops added / removed, new order). The route on the phone is
 * already the current one – this makes sure the change is never silent.
 */
export function DispatchChangesHost() {
  const t = useT();
  const { c } = useTheme();
  const changes = useTourStore((s) => s.dispatchChanges);
  const clear = useTourStore((s) => s.clearDispatchChanges);
  const text = (x: TourChange) => {
    switch (x.kind) {
      case "removed":
        return t("changes.removed", { tour: x.tourName });
      case "finished":
        return x.reason ? t("changes.finishedReason", { tour: x.tourName, reason: x.reason }) : t("changes.finished", { tour: x.tourName });
      case "stops_added":
        return t("changes.stopsAdded", { tour: x.tourName, n: x.count });
      case "stops_removed":
        return t("changes.stopsRemoved", { tour: x.tourName, n: x.count });
      case "reordered":
        return t("changes.reordered", { tour: x.tourName });
    }
  };
  const icon = (x: TourChange) => (x.kind === "removed" ? "remove-circle-outline" : x.kind === "finished" ? "flag-outline" : x.kind === "reordered" ? "swap-vertical-outline" : "list-outline");
  return (
    <Sheet visible={changes.length > 0} onClose={clear} title={t("changes.title")} testID="dispatch-changes">
      {changes.map((x, i) => (
        <View key={`${x.kind}-${x.tourId}-${i}`} style={{ flexDirection: "row", gap: space.sm, alignItems: "flex-start" }}>
          <Ionicons name={icon(x)} size={18} color={c.primaryText} style={{ marginTop: 2 }} />
          <Text style={[ty.body, { color: c.text, flex: 1 }]}>{text(x)}</Text>
        </View>
      ))}
      {changes.some((x) => x.kind === "removed" || x.kind === "finished") && <Text style={[ty.small, { color: c.textMuted }]}>{t("changes.offlineKept")}</Text>}
      <Button label={t("changes.ok")} size="lg" icon="checkmark" onPress={clear} testID="dispatch-changes-ok" />
    </Sheet>
  );
}
