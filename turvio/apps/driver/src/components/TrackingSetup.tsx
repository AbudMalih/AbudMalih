import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Linking, Platform, Text, View } from "react-native";
import { useT } from "../lib/i18n";
import { startTracking, useTrackingStatus } from "../lib/tracking";
import {
  STEP_ORDER,
  checkSetup,
  closeTrackingSetup,
  openTrackingSetup,
  performStep,
  rememberDismissed,
  useTrackingSetup,
  wasDismissed,
  type SetupStatus,
  type SetupStep,
} from "../lib/trackingOnboarding";
import { auth, isServerMode, useTourStore } from "../store/tourStore";
import { useMyTour } from "../store/useMyTour";
import { space, type as ty, useTheme } from "../theme";
import { Banner, Button, Ionicons, Sheet } from "./ui";

/** The driver's company (first driver membership); cached per sign-in. */
let orgCache: { userId: string; orgId: string | null } | null = null;
async function driverOrgId(userId: string): Promise<string | null> {
  if (orgCache?.userId === userId) return orgCache.orgId;
  const known = useTourStore.getState().organizationId;
  let orgId: string | null = known || null;
  if (!orgId) {
    const me = await auth().request<{ memberships: { organizationId: string; role: string }[] }>("GET", "/v1/me");
    orgId = me.memberships.find((m) => m.role === "driver")?.organizationId ?? null;
  }
  orgCache = { userId, orgId };
  return orgId;
}

/**
 * Mounted once (tab layout). After sign-in, on app start and when the app returns to the
 * foreground: if the company tracks this driver and the set-up is incomplete, the set-up opens –
 * unless the driver postponed exactly this situation before (no repeated prompts). A revoked
 * permission, a new notice version or tracking newly switched on is a new situation.
 */
export function TrackingSetupHost() {
  const user = useTourStore((s) => s.user);
  const trackingState = useTrackingStatus((s) => s.state);
  const { open, status } = useTrackingSetup();
  const running = useRef(false);

  const evaluate = useCallback(
    async (opts: { auto: boolean }) => {
      if (!user || !isServerMode() || Platform.OS === "web" || running.current) return;
      running.current = true;
      try {
        const orgId = await driverOrgId(user.id);
        if (!orgId) return;
        const s = await checkSetup(orgId);
        useTrackingSetup.setState({ status: s });
        if (!opts.auto || !s.missing.length || useTrackingSetup.getState().open) return;
        if (!(await wasDismissed(s.signature))) openTrackingSetup(s);
      } catch {
        // Offline / server unavailable: try again on the next foreground.
      } finally {
        running.current = false;
      }
    },
    [user],
  );

  useEffect(() => {
    if (!user) {
      orgCache = null;
      useTrackingSetup.setState({ open: false, status: null });
      return;
    }
    void evaluate({ auto: true });
    const sub = AppState.addEventListener("change", (a) => a === "active" && void evaluate({ auto: true }));
    return () => sub.remove();
  }, [user, evaluate]);

  // Tour start found something missing (notice / permission): same rule – once per situation.
  useEffect(() => {
    if (trackingState === "notice_required" || trackingState === "permission_denied") void evaluate({ auto: true });
  }, [trackingState, evaluate]);

  return <TrackingSetupSheet visible={open} status={status} onRecheck={() => evaluate({ auto: false })} />;
}

const STEP_ICON: Record<SetupStep, "location-outline" | "locate-outline" | "time-outline" | "notifications-outline" | "document-text-outline"> = {
  location: "location-outline",
  precise: "locate-outline",
  background: "time-outline",
  notifications: "notifications-outline",
  notice: "document-text-outline",
};

export function TrackingSetupSheet({ visible, status, onRecheck }: { visible: boolean; status: SetupStatus | null; onRecheck: () => Promise<void> }) {
  const t = useT();
  const { c } = useTheme();
  const { tours } = useMyTour();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refused, setRefused] = useState<SetupStep | null>(null);
  // Steps of this run (for "Step n of total"); fixed when the sheet opens.
  const [plan, setPlan] = useState<SetupStep[]>([]);
  useEffect(() => {
    if (visible && status) setPlan(status.missing.length ? status.missing : []);
    if (!visible) {
      setRefused(null);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);
  // Returning from the Settings app: re-check what is still missing.
  useEffect(() => {
    if (!visible) return;
    const sub = AppState.addEventListener("change", (a) => a === "active" && void onRecheck());
    return () => sub.remove();
  }, [visible, onRecheck]);

  if (!status) return null;
  const step = STEP_ORDER.find((s) => status.missing.includes(s)) ?? null;
  const total = Math.max(plan.length, 1);
  const index = step ? Math.max(0, plan.indexOf(step)) + 1 : total;
  const onRoad = tours.find((x) => x.status === "in_progress");

  const run = async () => {
    if (!step) return;
    setBusy(true);
    setError(null);
    try {
      const r = await performStep(step, status);
      await onRecheck();
      const after = useTrackingSetup.getState().status;
      // Asked, and the system answered "no": next time it goes to the settings page instead.
      if (r === "asked" && after?.missing.includes(step)) setRefused(step);
      else setRefused(null);
      // Everything in place and a tour on the road: tracking can start now.
      if (after && after.missing.length === 0 && onRoad) {
        await startTracking(
          { orgId: onRoad.organizationId, tourId: onRoad.id, tourName: onRoad.name, notificationTitle: t("tracking.notificationTitle"), notificationBody: t("tracking.notificationBody", { tour: onRoad.name }) },
          { requestPermissions: false },
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const later = async () => {
    await rememberDismissed(status.signature);
    closeTrackingSetup();
  };

  const p = (text: string) => (
    <Text key={text} style={[ty.body, { color: c.text }]}>
      {text}
    </Text>
  );
  return (
    <Sheet visible={visible} onClose={() => void later()} title={step === "notice" ? t("tracking.noticeTitle") : t("setup.title")} testID="tracking-setup">
      {step ? (
        <>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
            <Ionicons name={STEP_ICON[step]} size={20} color={c.primaryText} />
            <Text style={[ty.caption, { color: c.textMuted, textTransform: "uppercase" }]} testID="tracking-setup-progress">
              {t("setup.progress", { n: index, total })}
            </Text>
          </View>
          {step !== "notice" && index === 1 && <Text style={[ty.small, { color: c.textSecondary }]}>{t("setup.intro")}</Text>}
          {step === "location" && (
            <>
              <Text style={[ty.h2, { color: c.text }]}>{t("setup.location.title")}</Text>
              {p(t("setup.location.body"))}
            </>
          )}
          {step === "precise" && (
            <>
              <Text style={[ty.h2, { color: c.text }]}>{t("setup.precise.title")}</Text>
              {p(t("setup.precise.body"))}
            </>
          )}
          {step === "background" && (
            <>
              <Text style={[ty.h2, { color: c.text }]}>{t("setup.background.title")}</Text>
              {p(Platform.OS === "ios" ? t("setup.background.bodyIos") : t("setup.background.body"))}
            </>
          )}
          {step === "notifications" && (
            <>
              <Text style={[ty.h2, { color: c.text }]}>{t("setup.notifications.title")}</Text>
              {p(t("setup.notifications.body"))}
            </>
          )}
          {step === "notice" && (
            <>
              {[
                t("tracking.noticeBody1", { seconds: status.intervalSeconds }),
                t("tracking.noticeBody2"),
                t("tracking.noticeBody3", { days: status.retentionDays }),
                t("tracking.noticeBody4"),
              ].map(p)}
              <Text style={[ty.small, { color: c.textMuted }]}>{t("setup.serviceNote")}</Text>
            </>
          )}
          {refused === step && <Banner text={t("setup.refused")} tone="warning" action={{ label: t("tracking.openSettings"), onPress: () => void Linking.openSettings() }} />}
          {error && <Banner text={error} tone="danger" />}
          <Button
            label={
              step === "notice"
                ? t("tracking.noticeAccept")
                : step === "location"
                  ? t("setup.location.button")
                  : step === "precise"
                    ? t("setup.precise.button")
                    : step === "notifications"
                      ? t("setup.notifications.button")
                      : t("setup.background.button")
            }
            size="lg"
            icon={step === "notice" ? "checkmark" : STEP_ICON[step]}
            loading={busy}
            onPress={() => void run()}
            testID={`tracking-setup-${step}`}
          />
          <Button label={t("setup.later")} variant="ghost" onPress={() => void later()} testID="tracking-setup-later" />
        </>
      ) : (
        <>
          <Ionicons name="checkmark-circle" size={36} color={c.successInk} />
          <Text style={[ty.h2, { color: c.text }]}>{t("setup.doneTitle")}</Text>
          {p(t("setup.doneBody"))}
          <Text style={[ty.small, { color: c.textMuted }]}>{t("setup.serviceNote")}</Text>
          <Button label={t("common.done")} size="lg" onPress={closeTrackingSetup} testID="tracking-setup-done" />
        </>
      )}
    </Sheet>
  );
}
