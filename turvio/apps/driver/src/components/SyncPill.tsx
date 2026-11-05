import { Pressable, Text, View } from "react-native";
import { timeOf } from "../lib/format";
import { useT } from "../lib/i18n";
import { isServerMode, useTourStore } from "../store/tourStore";
import { radii, type as ty, useTheme } from "../theme";
import { Ionicons, toneColors } from "./ui";

/** Compact, always-visible sync state; tap to sync now. */
export function SyncPill() {
  const t = useT();
  const { c } = useTheme();
  const state = useTourStore((s) => s.syncState);
  const outbox = useTourStore((s) => s.outbox.length);
  const failed = useTourStore((s) => s.failed.length);
  const last = useTourStore((s) => s.lastSyncAt);
  const sync = useTourStore((s) => s.sync);
  if (!isServerMode()) return null;
  const tone = failed ? "danger" : state === "offline" || state === "error" ? "warning" : outbox ? "primary" : "success";
  const [bg, fg] = toneColors(c, tone);
  const label = failed
    ? t("sync.failedItems", { n: failed })
    : state === "offline"
      ? t("sync.offline", { n: outbox })
      : state === "syncing"
        ? t("sync.syncing")
        : outbox
          ? t("sync.queued", { n: outbox })
          : last
            ? t("sync.lastSync", { time: timeOf(last) })
            : t("sync.synced");
  const icon = failed ? "alert-circle" : state === "offline" ? "cloud-offline" : state === "syncing" || outbox ? "sync" : "cloud-done";
  return (
    <Pressable onPress={() => void sync()} accessibilityRole="button" accessibilityLabel={label} testID="sync-pill" hitSlop={8}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: bg, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radii.pill, alignSelf: "flex-start" }}>
        <Ionicons name={icon} size={14} color={fg} />
        <Text style={[ty.caption, { color: fg, letterSpacing: 0 }]} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}
