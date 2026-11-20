import { useState } from "react";
import { create } from "zustand";
import { Alert, Linking, Platform, Pressable, Text, View } from "react-native";
import { ApiError } from "../lib/auth";
import { errorText } from "../lib/errorText";
import { useT } from "../lib/i18n";
import { acknowledgeNotice, hasNoticeDetails, startTracking, useTrackingStatus, withdrawAcknowledgement, type NoticeDetails } from "../lib/tracking";
import { forgetDismissed, openTrackingSetup, signatureOf, suppressAutoPrompt, useTrackingSetup } from "../lib/trackingOnboarding";
import { useTourStore } from "../store/tourStore";
import { useMyTour } from "../store/useMyTour";
import { radii, space, type as ty, useTheme } from "../theme";
import { Banner, Button, Ionicons, Sheet } from "./ui";

/** Open/close state of the notice sheet (opened from the header pill or from settings). */
export const useNoticeSheet = create<{ open: boolean }>(() => ({ open: false }));
export const openTrackingNotice = () => useNoticeSheet.setState({ open: true });

/**
 * Mounted once (tab layout): the notice for re-reading it from Settings. Opening it automatically
 * when something is missing is the job of the live-location set-up (TrackingSetupHost).
 */
export function TrackingNoticeHost() {
  const open = useNoticeSheet((s) => s.open);
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

/**
 * The company's own part of the notice (controller, data-protection contact, legal basis, further
 * text) below the standard text. Only filled-in fields are shown; nothing at all when none is set.
 * Labels and values are stacked (no left/right placement), so the block reads the same in RTL.
 */
export function NoticeDetailsBlock({ notice }: { notice: NoticeDetails | null | undefined }) {
  const t = useT();
  const { c } = useTheme();
  if (!hasNoticeDetails(notice)) return null;
  const rows = (
    [
      ["tracking.noticeController", notice.controller, "notice-controller"],
      ["tracking.noticeContact", notice.contact, "notice-contact"],
      ["tracking.noticeLegalBasis", notice.legalBasis, "notice-legal-basis"],
      ["tracking.noticeText", notice.text, "notice-text"],
    ] as const
  ).filter(([, v]) => typeof v === "string" && v.trim().length > 0);
  return (
    <View style={{ gap: space.sm, borderTopWidth: 1, borderTopColor: c.border, paddingTop: space.sm }} testID="tracking-notice-company">
      <Text style={[ty.bodyStrong, { color: c.text }]}>{t("tracking.noticeCompany")}</Text>
      {rows.map(([label, value, id]) => (
        <View key={id} style={{ gap: space.xxs }} testID={id}>
          <Text style={[ty.caption, { color: c.textMuted }]}>{t(label)}</Text>
          <Text style={[ty.body, { color: c.text }]} selectable>
            {value!.trim()}
          </Text>
        </View>
      ))}
    </View>
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
      setError(errorText(e, t));
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
      <NoticeDetailsBlock notice={status.notice} />
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
  const setup = useTrackingSetup((x) => x.status);
  const user = useTourStore((x) => x.user);
  const knownOrg = useTourStore((x) => x.organizationId);
  const { tours } = useMyTour();
  const [withdrawing, setWithdrawing] = useState(false);
  const [outcome, setOutcome] = useState<{ tone: "success" | "primary" | "danger"; text: string } | null>(null);
  if (!user) return null;
  const orgId = setup?.orgId ?? tours.find((x) => x.status === "in_progress")?.organizationId ?? (knownOrg || null);
  const acknowledged = s.state === "active" || (!!setup?.tracked && setup.acknowledgedVersion != null && setup.acknowledgedVersion === setup.noticeVersion && s.acknowledgedVersion !== null);
  const canWithdraw = !!orgId && acknowledged && !s.withdrawalPending;

  const withdraw = async () => {
    if (!orgId) return;
    setWithdrawing(true);
    setOutcome(null);
    try {
      const r = await withdrawAcknowledgement(orgId);
      // The notice is missing again: shown again later (next start / sign-in), not right now.
      suppressAutoPrompt();
      await forgetDismissed();
      const cur = useTrackingSetup.getState().status;
      if (cur && cur.orgId === orgId) {
        const missing = cur.missing.includes("notice") ? cur.missing : [...cur.missing, "notice" as const];
        useTrackingSetup.setState({ status: { ...cur, acknowledgedVersion: null, missing, signature: signatureOf(orgId, cur, missing) } });
      }
      if (r.sent) setOutcome({ tone: "success", text: t("tracking.withdrawDone") });
      else if (r.error instanceof ApiError && r.error.status === 0) setOutcome({ tone: "primary", text: t("tracking.withdrawPending") });
      else setOutcome({ tone: "danger", text: `${errorText(r.error, t)} ${t("tracking.withdrawPending")}` });
    } catch (e) {
      setOutcome({ tone: "danger", text: errorText(e, t) });
    } finally {
      setWithdrawing(false);
    }
  };
  const confirmWithdraw = () => {
    if (Platform.OS === "web") {
      if (globalThis.confirm?.(`${t("tracking.withdrawTitle")}\n\n${t("tracking.withdrawBody")}`)) void withdraw();
      return;
    }
    Alert.alert(t("tracking.withdrawTitle"), t("tracking.withdrawBody"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("tracking.withdrawConfirm"), style: "destructive", onPress: () => void withdraw() },
    ]);
  };
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
      {setup && setup.missing.length > 0 && (
        <>
          <Text style={[ty.small, { color: c.warningInk }]}>{t("setup.incomplete")}</Text>
          <Button label={t("setup.finish")} variant="secondary" icon="location-outline" onPress={() => openTrackingSetup(setup)} testID="tracking-setup-open" />
        </>
      )}
      {s.state === "permission_denied" && !setup?.missing.length && <Button label={t("tracking.openSettings")} variant="secondary" icon="settings-outline" onPress={() => void Linking.openSettings()} />}
      {(s.state === "notice_required" || s.state === "active") && <Button label={t("tracking.noticeTitle")} variant="ghost" onPress={onReadNotice} />}
      {s.withdrawalPending && !outcome && <Text style={[ty.small, { color: c.textMuted }]}>{t("tracking.withdrawPending")}</Text>}
      {outcome && <Banner text={outcome.text} tone={outcome.tone} />}
      {canWithdraw && <Button label={t("tracking.withdraw")} variant="secondary" icon="stop-circle-outline" loading={withdrawing} onPress={confirmWithdraw} testID="tracking-withdraw" />}
    </View>
  );
}
