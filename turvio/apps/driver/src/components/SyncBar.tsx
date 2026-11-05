import { colors, spacing } from "@turvio/shared";
import { Pressable, Text, View } from "react-native";
import { useT } from "../lib/i18n";
import { isServerMode, useTourStore } from "../store/tourStore";

/** Server mode: shows offline state, queued changes and the last refresh. */
export function SyncBar() {
  const t = useT();
  const state = useTourStore((s) => s.syncState);
  const outbox = useTourStore((s) => s.outbox.length);
  const last = useTourStore((s) => s.lastSyncAt);
  const message = useTourStore((s) => s.syncMessage);
  const sync = useTourStore((s) => s.sync);
  if (!isServerMode()) return null;
  const offline = state === "offline";
  const text = offline
    ? t("sync.offline", { n: outbox })
    : outbox > 0
      ? t("sync.pending", { n: outbox })
      : last
        ? t("sync.lastSync", { time: new Date(last).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) })
        : "…";
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        padding: spacing.md,
        borderRadius: 12,
        backgroundColor: offline || state === "error" ? colors.warningSoft : colors.white,
        borderWidth: 1,
        borderColor: offline || state === "error" ? colors.warning : colors.border,
      }}
      accessibilityRole="summary"
      testID="sync-bar"
    >
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: offline ? colors.warning : state === "syncing" ? colors.primary : colors.success }} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontSize: 13, fontWeight: "600" }}>{text}</Text>
        {state === "error" && message ? <Text style={{ color: colors.warningInk, fontSize: 12 }}>{message}</Text> : null}
      </View>
      <Pressable onPress={() => void sync()} accessibilityRole="button" hitSlop={12} style={{ paddingHorizontal: spacing.sm, paddingVertical: 6 }}>
        <Text style={{ color: colors.primary, fontWeight: "700" }}>{t("sync.refresh")}</Text>
      </Pressable>
    </View>
  );
}
