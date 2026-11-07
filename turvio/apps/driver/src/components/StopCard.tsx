import { isOpen, type Stop } from "@turvio/shared";
import { Pressable, Text, View } from "react-native";
import { addressLine, statusTone, windowText } from "../lib/format";
import { useT } from "../lib/i18n";
import { radii, space, type as ty, useTheme } from "../theme";
import { Ionicons, Pill, toneColors } from "./ui";

/** Compact stop row: number, recipient, address, parcels and state at a glance. */
function Meta({ icon, color, text }: { icon: React.ComponentProps<typeof Ionicons>["name"]; color: string; text: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      <Ionicons name={icon} size={13} color={color} />
      <Text style={[ty.small, { color }]} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

export function StopCard({ stop, index, current, onPress, right, testID }: { stop: Stop; index: number; current?: boolean; onPress?: () => void; right?: React.ReactNode; testID?: string }) {
  const { c } = useTheme();
  const t = useT();
  const open = isOpen(stop.status);
  const [bg, fg] = open ? (stop.type === "pickup" ? [c.warningSoft, c.warningInk] : current ? [c.primary, "#FFFFFF"] : [c.primarySoft, c.primary]) : toneColors(c, statusTone(stop.status));
  const parcels = stop.parcels.length;
  const loaded = stop.parcels.filter((p) => p.loadedAt).length;
  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`${index + 1}. ${stop.recipientName ?? ""} ${addressLine(stop)}`}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: space.md,
        backgroundColor: c.card,
        borderRadius: radii.lg,
        borderWidth: current ? 2 : 1,
        borderColor: current ? c.primary : c.border,
        paddingHorizontal: space.md,
        paddingVertical: 10,
        opacity: pressed ? 0.85 : open ? 1 : 0.72,
      })}
    >
      <View style={{ width: 32, height: 32, borderRadius: radii.md, backgroundColor: bg, alignItems: "center", justifyContent: "center" }}>
        {open ? (
          <Text style={{ color: fg, fontWeight: "700", fontSize: 14, fontVariant: ["tabular-nums"] }}>{index + 1}</Text>
        ) : (
          <Ionicons name={statusTone(stop.status) === "success" ? "checkmark" : "close"} size={18} color={fg} />
        )}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          {stop.priority && <Ionicons name="flash" size={14} color={c.warning} />}
          {stop.type === "pickup" && <Ionicons name="arrow-up-circle" size={15} color={c.warningInk} />}
          <Text style={[ty.bodyStrong, { color: c.text, flexShrink: 1 }]} numberOfLines={1}>
            {stop.recipientName ?? addressLine(stop)}
          </Text>
          {stop.locked && <Ionicons name="lock-closed" size={13} color={c.textMuted} accessibilityLabel={t("stops.locked")} />}
        </View>
        <Text style={[ty.small, { color: c.textMuted }]} numberOfLines={1}>
          {addressLine(stop)}
        </Text>
        {(parcels > 0 || windowText(stop)) && (
          <View style={{ flexDirection: "row", gap: space.md, alignItems: "center" }}>
            {parcels > 0 && (
              <Meta icon="cube-outline" color={loaded === parcels ? c.successInk : c.textMuted} text={`${loaded ? `${loaded}/` : ""}${parcels === 1 ? t("stops.oneParcel") : t("stops.parcelsCount", { n: parcels })}`} />
            )}
            {windowText(stop) && <Meta icon="time-outline" color={c.textMuted} text={windowText(stop)!} />}
          </View>
        )}
        {(!open || stop.status === "in_progress" || (!stop.location && open)) && (
          <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap", marginTop: 2 }}>
            {!open && <Pill label={t(`stopStatus.${stop.status}` as never)} tone={statusTone(stop.status)} />}
            {stop.status === "in_progress" && <Pill label={t("stopStatus.in_progress")} tone="primary" />}
            {!stop.location && open && <Pill icon="location-outline" label={t("stops.needsLocation")} tone="warning" />}
          </View>
        )}
      </View>
      {right}
    </Pressable>
  );
}
