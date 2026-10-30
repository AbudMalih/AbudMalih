import { colors, formatAddress, formatMinuteOfDay, spacing, type Stop } from "@turvio/shared";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useT } from "../lib/i18n";
import { Pill, styles as ui } from "./ui";

export function statusTone(status: Stop["status"]) {
  switch (status) {
    case "delivered":
    case "picked_up":
      return "success" as const;
    case "failed":
      return "danger" as const;
    case "skipped":
      return "warning" as const;
    default:
      return "neutral" as const;
  }
}

export function StopRow(props: {
  stop: Stop;
  position: number;
  onPress: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  const t = useT();
  const { stop } = props;
  const done = stop.status !== "pending";
  return (
    <Pressable
      onPress={props.onPress}
      accessibilityRole="button"
      testID={`stop-row-${stop.id}`}
      style={({ pressed }) => [s.row, pressed && { backgroundColor: colors.surface }]}
    >
      <View style={[s.badge, done && s.badgeDone, stop.priority && !done && s.badgePriority]}>
        <Text style={[s.badgeText, done && { color: colors.textMuted }]}>{props.position}</Text>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[ui.body, { fontWeight: "600" }, done && { color: colors.textMuted }]} numberOfLines={1}>
          {stop.recipientName ?? formatAddress(stop)}
        </Text>
        <Text style={ui.muted} numberOfLines={1}>
          {formatAddress(stop)}
        </Text>
        <View style={[ui.row, { flexWrap: "wrap", marginTop: 4 }]}>
          <Pill label={t(`stopStatus.${stop.status}`)} tone={statusTone(stop.status)} />
          {stop.type === "pickup" && <Pill label={t("stopType.pickup")} tone="primary" />}
          {stop.priority && <Pill label={t("stops.priority")} tone="warning" />}
          {stop.timeWindow && (
            <Pill
              label={t("stops.window", {
                from: formatMinuteOfDay(stop.timeWindow.start),
                to: formatMinuteOfDay(stop.timeWindow.end),
              })}
            />
          )}
          {stop.parcels.length > 0 && <Pill label={t("home.parcels", { n: stop.parcels.length })} />}
          {!stop.location && <Pill label={t("stops.noLocation")} tone="danger" />}
        </View>
      </View>
      {(props.onMoveUp || props.onMoveDown) && (
        <View style={{ gap: spacing.xs }}>
          <Pressable
            accessibilityLabel={t("stops.moveUp")}
            disabled={!props.onMoveUp}
            onPress={props.onMoveUp}
            style={[s.move, !props.onMoveUp && { opacity: 0.3 }]}
          >
            <Text style={s.moveText}>▲</Text>
          </Pressable>
          <Pressable
            accessibilityLabel={t("stops.moveDown")}
            disabled={!props.onMoveDown}
            onPress={props.onMoveDown}
            style={[s.move, !props.onMoveDown && { opacity: 0.3 }]}
          >
            <Text style={s.moveText}>▼</Text>
          </Pressable>
        </View>
      )}
    </Pressable>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  badge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeDone: { backgroundColor: colors.border },
  badgePriority: { backgroundColor: colors.warning },
  badgeText: { color: colors.white, fontWeight: "700" },
  move: {
    width: 44,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  moveText: { color: colors.text, fontSize: 14 },
});
