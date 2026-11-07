import { isOpen, routeMetrics, tourProgress } from "@turvio/shared";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Image, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StopCard } from "../../components/StopCard";
import { SyncPill } from "../../components/SyncPill";
import { ActionTile, Banner, Button, Card, EmptyState, Ionicons, Pill, ProgressBar, SectionTitle, Stat, type IconName } from "../../components/ui";
import { duration, km } from "../../lib/format";
import { useLocale, useT } from "../../lib/i18n";
import { isServerMode, useTourStore } from "../../store/tourStore";
import { useMyTour } from "../../store/useMyTour";
import { radii, space, type as ty, useTheme } from "../../theme";

/**
 * Today: the route first (progress, road figures, next stop, one primary action), then the two
 * daily tools (scan, optimize), then compact quick actions. Figures are labelled as road values
 * or straight-line estimates – never presented as road data when routing is unavailable.
 */
export default function HomeScreen() {
  const t = useT();
  const locale = useLocale();
  const { c, dark } = useTheme();
  const insets = useSafeAreaInsets();
  const { tours, tour, depot, driver, stops, road } = useMyTour();
  const tourAction = useTourStore((s) => s.tourAction);
  const selectTour = useTourStore((s) => s.selectTour);
  const sync = useTourStore((s) => s.sync);
  const user = useTourStore((s) => s.user);
  const syncState = useTourStore((s) => s.syncState);
  const [refreshing, setRefreshing] = useState(false);

  const progress = useMemo(() => tourProgress(stops), [stops]);
  const metrics = useMemo(() => (depot ? routeMetrics(tour?.startLocation ?? depot.location, stops, tour?.endLocation ?? depot.location) : null), [depot, stops, tour]);
  const next = stops.find((s) => isOpen(s.status));
  const name = (user?.name ?? driver?.displayName ?? "").split(" ")[0] ?? "";
  const unlocated = stops.filter((s) => isOpen(s.status) && !s.location).length;
  const running = tour?.status === "in_progress" || tour?.status === "paused";
  const today = useMemo(() => {
    try {
      return new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long" }).format(new Date());
    } catch {
      return "";
    }
  }, [locale]);

  const refresh = async () => {
    setRefreshing(true);
    await sync();
    setRefreshing(false);
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={{ paddingTop: insets.top + space.sm, paddingHorizontal: space.lg, paddingBottom: space.xxl, gap: space.md }}
      refreshControl={isServerMode() ? <RefreshControl refreshing={refreshing || syncState === "syncing"} onRefresh={refresh} /> : undefined}
      testID="home"
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 32 }}>
        <Image source={dark ? require("../../../assets/brand/turvio-lockup-dark.png") : require("../../../assets/brand/turvio-lockup-light.png")} style={{ width: 92, height: 16 }} resizeMode="contain" accessibilityLabel="TURVIO" />
        <SyncPill />
      </View>

      <View style={{ gap: space.xxs }}>
        {today ? <Text style={[ty.small, { color: c.textMuted }]}>{today}</Text> : null}
        <Text style={[ty.display, { color: c.text }]} accessibilityRole="header">
          {name ? t("home.greeting", { name }) : t("tabs.today")}
        </Text>
        {!isServerMode() && <Text style={[ty.small, { color: c.warningInk }]}>{t("home.syntheticBanner")}</Text>}
      </View>

      {tour ? (
        <Card testID="active-tour" style={{ gap: space.md }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
            <View style={{ flex: 1, gap: space.xxs }}>
              <Text style={[ty.caption, { color: c.textMuted }]}>{t("home.todaysTour").toUpperCase()}</Text>
              <Text style={[ty.h2, { color: c.text }]} numberOfLines={1}>
                {tour.name}
              </Text>
            </View>
            {tour.origin === "driver" && <Pill label={t("home.personal")} tone="neutral" />}
            <Pill label={t(`status.${tour.status}`)} tone={tour.status === "in_progress" ? "primary" : tour.status === "completed" ? "success" : "neutral"} />
          </View>

          <View style={{ gap: space.xs }}>
            <ProgressBar value={progress.total ? progress.done / progress.total : 0} />
            <Text style={[ty.small, { color: c.textSecondary }]} testID="progress-text">
              {t("home.progress", { done: progress.done, total: progress.total })}
              {progress.failed ? ` · ${progress.failed} ✕` : ""}
            </Text>
          </View>

          {metrics && progress.total > 0 && (
            <View style={{ flexDirection: "row", gap: space.md, paddingTop: space.sm, borderTopWidth: 1, borderTopColor: c.border }}>
              <Stat label={t("home.openStops")} value={String(progress.pending)} hint={t("home.parcels", { n: progress.parcels })} />
              <Stat
                label={t("home.remainingDistance")}
                value={`${km(road?.metrics?.remainingMeters ?? metrics.remainingMeters)} km`}
                hint={t("home.ofTotal", { total: `${km(road?.metrics?.totalMeters ?? metrics.totalMeters)} km` })}
              />
              <Stat label={t("home.remainingTime")} value={duration(road?.metrics?.remainingDriveSeconds ?? metrics.remainingDriveSeconds)} hint={road ? t("common.roadNetwork") : t("common.straightLine")} />
            </View>
          )}

          {unlocated > 0 && <Banner text={t("home.needsLocation", { n: unlocated })} tone="warning" icon="location-outline" />}

          {next ? (
            <View style={{ gap: space.xs }}>
              <SectionTitle>{t("home.nextStop")}</SectionTitle>
              <StopCard stop={next} index={stops.indexOf(next)} current onPress={() => router.push(`/stop/${next.id}`)} testID="open-next-stop" />
            </View>
          ) : progress.total > 0 ? (
            <Banner text={t("home.allDone")} tone="success" />
          ) : null}

          <View style={{ flexDirection: "row", gap: space.sm }}>
            {tour.status === "planned" && <Button label={t("home.startTour")} icon="play" size="lg" onPress={() => tourAction(tour.id, "start")} style={{ flex: 1 }} testID="start-tour" />}
            {running && next && <Button label={t("home.continue")} icon="navigate" size="lg" onPress={() => router.push(`/stop/${next.id}`)} style={{ flex: 1 }} testID="continue-tour" />}
            {tour.status === "in_progress" && <Button label={t("home.pauseTour")} variant="secondary" size="lg" onPress={() => tourAction(tour.id, "pause")} testID="pause-tour" />}
            {tour.status === "paused" && <Button label={t("home.resumeTour")} variant="secondary" size="lg" onPress={() => tourAction(tour.id, "resume")} testID="resume-tour" />}
          </View>
          {running && !next && <Button label={t("home.finishTour")} variant="success" icon="flag" size="lg" onPress={() => tourAction(tour.id, "finish")} testID="finish-tour" />}
        </Card>
      ) : (
        <Card style={{ gap: space.md }}>
          <EmptyState icon="calendar-clear-outline" title={t("home.noRoutes")} text={isServerMode() ? t("home.noRoutesText") : t("home.noTour")} />
          <Button label={t("home.newRoute")} icon="add" size="lg" onPress={() => router.push("/new-route")} testID="empty-new-route" />
          {isServerMode() && <Text style={[ty.small, { color: c.textMuted, textAlign: "center" }]}>{t("home.pullToRefresh")}</Text>}
        </Card>
      )}

      <View style={{ flexDirection: "row", gap: space.sm }}>
        <ToolCard
          icon="scan"
          title={t("home.scan")}
          subtitle={tour ? t("home.loaded", { loaded: progress.parcelsLoaded, total: progress.parcels }) : t("home.scanHint")}
          onPress={() => router.push("/scan")}
          testID="hero-scan"
          primary
        />
        <ToolCard
          icon="git-network-outline"
          title={t("home.optimize")}
          subtitle={tour ? t("home.remaining", { n: progress.pending }) : t("home.optimizeHint")}
          onPress={() => router.push("/optimize")}
          disabled={!tour || progress.pending === 0}
          testID="hero-optimize"
        />
      </View>

      <View style={{ gap: space.xs }}>
        <SectionTitle>{t("home.addStops")}</SectionTitle>
        <View style={{ flexDirection: "row", gap: space.sm }}>
          <ActionTile icon="camera-outline" label={t("photoImport.home")} onPress={() => router.push("/photo-import")} disabled={!tour} testID="quick-photo" tone="primary" />
          <ActionTile icon="add-circle-outline" label={t("home.addStop")} onPress={() => router.push("/add-stop")} disabled={!tour} testID="quick-add" />
          <ActionTile icon="document-text-outline" label={t("home.import")} onPress={() => router.push("/import")} disabled={!tour} testID="quick-import" />
          <ActionTile icon="trail-sign-outline" label={t("home.newRoute")} onPress={() => router.push("/new-route")} testID="quick-route" />
        </View>
      </View>

      {tours.length > 1 && (
        <View style={{ gap: space.xs }}>
          <SectionTitle>{t("home.todaysTours")}</SectionTitle>
          {tours.map((x) => (
            <Card key={x.id} onPress={() => selectTour(x.id)} testID={`route-${x.id}`} style={{ borderColor: x.id === tour?.id ? c.primary : c.border, flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.md }}>
              <Ionicons name={x.origin === "driver" ? "person-outline" : "business-outline"} size={18} color={c.textMuted} />
              <Text style={[ty.bodyStrong, { color: c.text, flex: 1 }]} numberOfLines={1}>
                {x.name}
              </Text>
              <Pill label={t(`status.${x.status}`)} tone={x.status === "in_progress" ? "primary" : "neutral"} />
            </Card>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

/** One of the two daily tools: compact, primary one filled. */
function ToolCard({ icon, title, subtitle, onPress, disabled, testID, primary }: { icon: IconName; title: string; subtitle: string; onPress: () => void; disabled?: boolean; testID: string; primary?: boolean }) {
  const { c } = useTheme();
  const fg = primary ? "#FFFFFF" : c.text;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={subtitle}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => ({
        flex: 1,
        minHeight: 76,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: primary ? c.primary : c.border,
        backgroundColor: primary ? c.primary : c.card,
        padding: space.md,
        gap: space.xs,
        opacity: disabled ? 0.45 : pressed ? 0.85 : 1,
      })}
    >
      <Ionicons name={icon} size={20} color={primary ? "#FFFFFF" : c.primary} />
      <Text style={[ty.bodyStrong, { color: fg }]} numberOfLines={1}>
        {title}
      </Text>
      <Text style={[ty.caption, { color: primary ? "rgba(255,255,255,0.85)" : c.textMuted, fontWeight: "400", letterSpacing: 0 }]} numberOfLines={1}>
        {subtitle}
      </Text>
    </Pressable>
  );
}
