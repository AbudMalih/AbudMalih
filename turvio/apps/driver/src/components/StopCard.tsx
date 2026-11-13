import { isOpen, type Stop } from "@turvio/shared";
import { Pressable, Text, View } from "react-native";
import { addressLine, statusTone, windowText } from "../lib/format";
import { useT } from "../lib/i18n";
import { locationPill } from "../lib/locationCheck";
import { useTourStore } from "../store/tourStore";
import { fw, radii, space, type as ty, useTheme } from "../theme";
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
  const locPill = locationPill(stop, useTourStore((st) => st.locationChecks[stop.id]));
  const { c } = useTheme();
  const t = useT();
  const open = isOpen(stop.status);
  // NEXT: open stops get an outlined number tile (cyan; amber for pickups), the next stop a filled violet one.
  const [bg, fg] = open ? (stop.type === "pickup" ? [c.warningSoft, c.warningInk] : current ? [c.primary, "#FFFFFF"] : ["transparent", c.text]) : toneColors(c, statusTone(stop.status));
  const tileBorder = open && !current ? (stop.type === "pickup" ? c.warning : c.cyan) : "transparent";
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
        borderRadius: 18,
        borderWidth: current ? 1.5 : 1,
        borderColor: current ? c.primaryHi : c.border,
        paddingHorizontal: space.md,
        paddingVertical: 12,
        opacity: open ? 1 : 0.62,
        transform: [{ scale: pressed ? 0.985 : 1 }],
      })}
    >
      <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: bg, borderWidth: 1.5, borderColor: tileBorder, alignItems: "center", justifyContent: "center" }}>
        {open ? (
          <Text style={{ color: fg, ...fw("700"), fontSize: 14, fontVariant: ["tabular-nums"] }}>{index + 1}</Text>
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
        {(!open || stop.status === "in_progress" || (!stop.location && open) || (open && !!locPill)) && (
          <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap", marginTop: 2 }}>
            {!open && <Pill label={t(`stopStatus.${stop.status}` as never)} tone={statusTone(stop.status)} />}
            {stop.status === "in_progress" && <Pill label={t("stopStatus.in_progress")} tone="primary" />}
            {!stop.location && open && <Pill icon="location-outline" label={t("stops.needsLocation")} tone="warning" />}
            {open && locPill && <Pill icon="alert-circle-outline" label={t(locPill.key)} tone={locPill.tone} testID="stop-location-pill" />}
          </View>
        )}
      </View>
      {right}
    </Pressable>
  );
}
