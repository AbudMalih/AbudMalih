import { useEffect, useState } from "react";
import { create } from "zustand";
import { Linking, Pressable, Text, View } from "react-native";
import { useT } from "../lib/i18n";
import { acknowledgeNotice, startTracking, useTrackingStatus } from "../lib/tracking";
import { useTourStore } from "../store/tourStore";
import { useMyTour } from "../store/useMyTour";
import { radii, space, type as ty, useTheme } from "../theme";
import { Banner, Button, Ionicons, Sheet } from "./ui";

/** Open/close state of the notice sheet (opened from the header pill or from settings). */
export const useNoticeSheet = create<{ open: boolean }>(() => ({ open: false }));
export const openTrackingNotice = () => useNoticeSheet.setState({ open: true });

/** Mounted once (tab layout): shows the notice when tracking waits for it, once per occurrence. */
export function TrackingNoticeHost() {
  const open = useNoticeSheet((s) => s.open);
  const state = useTrackingStatus((s) => s.state);
  useEffect(() => {
    if (state === "notice_required") openTrackingNotice();
  }, [state]);
  return <TrackingNoticeSheet visible={open} onClose={() => useNoticeSheet.setState({ open: false })} />;
}

/** Header indicator: visible whenever live tracking runs or needs the driver's attention. */
export function TrackingPill({ onPress = openTrackingNotice }: { onPress?: () => void }) {
  const t = useT();
  const { c } = useTheme();
  const state = useTrackingStatus((s) => s.state);
  if (state !== "active" && state !== "permission_denied" && state !== "notice_required") return null;
  const tone = state === "active" ? { bg: c.successSoft, fg: c.successInk, icon: "radio-outline" as const, label: t("tracking.active") } : { bg: c.warningSoft, fg: c.warningInk, icon: "location-outline" as const, label: state === "permission_denied" ? t("tracking.denied") : t("tracking.noticeNeeded") };
  return (
    <Pressable
      onPress={state === "permission_denied" ? () => void Linking.openSettings() : onPress}
      accessibilityRole="button"
      accessibilityLabel={tone.label}
      testID="tracking-pill"
      hitSlop={8}
      style={{ flexDirection: "row", alignItems: "center", gap: space.xs, backgroundColor: tone.bg, borderRadius: radii.pill, paddingHorizontal: space.sm, paddingVertical: space.xxs + 1 }}
    >
      {state === "active" ? <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: c.successInk }} /> : <Ionicons name={tone.icon} size={13} color={tone.fg} />}
      <Text style={[ty.caption, { color: tone.fg, letterSpacing: 0 }]}>{tone.label}</Text>
    </Pressable>
  );
}

/** The tracking notice. Tracking never starts before the driver confirmed it. */
export function TrackingNoticeSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useT();
  const { c } = useTheme();
  const status = useTrackingStatus();
  const { tours } = useMyTour();
  const onRoad = tours.find((x) => x.status === "in_progress");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const accept = async () => {
    if (!onRoad) return onClose();
    setBusy(true);
    setError(null);
    try {
      await acknowledgeNotice(onRoad.organizationId);
      await startTracking(
        { orgId: onRoad.organizationId, tourId: onRoad.id, tourName: onRoad.name, notificationTitle: t("tracking.notificationTitle"), notificationBody: t("tracking.notificationBody", { tour: onRoad.name }) },
        { requestPermissions: true },
      );
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet visible={visible} onClose={onClose} title={t("tracking.noticeTitle")} testID="tracking-notice">
      {[
        t("tracking.noticeBody1", { seconds: status.intervalSeconds ?? 10 }),
        t("tracking.noticeBody2"),
        t("tracking.noticeBody3", { days: status.retentionDays ?? 30 }),
        t("tracking.noticeBody4"),
      ].map((p) => (
        <Text key={p} style={[ty.body, { color: c.text }]}>
          {p}
        </Text>
      ))}
      <Text style={[ty.small, { color: c.textMuted }]}>{t("tracking.backgroundHint")}</Text>
      {error && <Banner text={error} tone="danger" />}
      <Button label={t("tracking.noticeAccept")} size="lg" icon="checkmark" loading={busy} onPress={() => void accept()} testID="tracking-notice-accept" />
      <Button label={t("tracking.noticeLater")} variant="ghost" onPress={onClose} />
    </Sheet>
  );
}

/** Settings: what tracking does right now, in plain words. */
export function TrackingSettingsSection({ onReadNotice = openTrackingNotice }: { onReadNotice?: () => void }) {
  const t = useT();
  const { c } = useTheme();
  const s = useTrackingStatus();
  const user = useTourStore((x) => x.user);
  if (!user) return null;
  const text =
    s.state === "active"
      ? t("tracking.stateActive", { n: s.buffered })
      : s.state === "disabled"
        ? t("tracking.stateDisabled")
        : s.state === "permission_denied"
          ? t("tracking.stateDenied")
          : s.state === "notice_required"
            ? t("tracking.stateNotice")
            : s.state === "error"
              ? t("tracking.stateError", { message: s.message ?? "" })
              : t("tracking.stateOff");
  return (
    <View style={{ gap: space.sm }} testID="tracking-settings">
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
        <Ionicons name={s.state === "active" ? "radio" : "radio-outline"} size={18} color={s.state === "active" ? c.successInk : c.textMuted} />
        <Text style={[ty.body, { color: c.text, flex: 1 }]}>{text}</Text>
      </View>
      {s.state === "permission_denied" && <Button label={t("tracking.openSettings")} variant="secondary" icon="settings-outline" onPress={() => void Linking.openSettings()} />}
      {(s.state === "notice_required" || s.state === "active") && <Button label={t("tracking.noticeTitle")} variant="ghost" onPress={onReadNotice} />}
    </View>
  );
}
