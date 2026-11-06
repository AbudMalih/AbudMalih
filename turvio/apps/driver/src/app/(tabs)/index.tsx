import { isOpen, routeMetrics, tourProgress } from "@turvio/shared";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Image, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StopCard } from "../../components/StopCard";
import { SyncPill } from "../../components/SyncPill";
import { Banner, Button, Card, EmptyState, HeroAction, Ionicons, Pill, ProgressBar, SectionTitle, Stat } from "../../components/ui";
import { duration, km } from "../../lib/format";
import { useT } from "../../lib/i18n";
import { isServerMode, useTourStore } from "../../store/tourStore";
import { useMyTour } from "../../store/useMyTour";
import { radii, space, type as ty, useTheme } from "../../theme";

export default function HomeScreen() {
  const t = useT();
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

  const refresh = async () => {
    setRefreshing(true);
    await sync();
    setRefreshing(false);
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={{ paddingTop: insets.top + space.md, paddingHorizontal: space.lg, paddingBottom: space.xxl * 2, gap: space.md }}
      refreshControl={isServerMode() ? <RefreshControl refreshing={refreshing || syncState === "syncing"} onRefresh={refresh} /> : undefined}
      testID="home"
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Image source={dark ? require("../../../assets/brand/turvio-lockup-dark.png") : require("../../../assets/brand/turvio-lockup-light.png")} style={{ width: 118, height: 21 }} resizeMode="contain" accessibilityLabel="TURVIO" />
        <SyncPill />
      </View>
      <View>
        <Text style={[ty.display, { color: c.text }]}>{name ? t("home.greeting", { name }) : t("tabs.today")}</Text>
        {!isServerMode() && <Text style={[ty.small, { color: c.warningInk, marginTop: 2 }]}>{t("home.syntheticBanner")}</Text>}
      </View>

      <HeroAction tone="primary" icon="scan" title={t("home.scan")} subtitle={tour ? t("home.loaded", { loaded: progress.parcelsLoaded, total: progress.parcels }) : t("home.scanHint")} onPress={() => router.push("/scan")} testID="hero-scan" />
      <HeroAction
        tone="dark"
        icon="git-network-outline"
        title={t("home.optimize")}
        subtitle={tour ? `${t("home.remaining", { n: progress.pending })} · ${t("home.optimizeHint")}` : t("home.optimizeHint")}
        onPress={() => router.push("/optimize")}
        disabled={!tour || progress.pending === 0}
        testID="hero-optimize"
      />

      {tour ? (
        <Card testID="active-tour">
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
            <View style={{ flex: 1 }}>
              <Text style={[ty.caption, { color: c.textMuted }]}>{t("home.todaysTour").toUpperCase()}</Text>
              <Text style={[ty.title, { color: c.text }]} numberOfLines={1}>
                {tour.name}
              </Text>
            </View>
            {tour.origin === "driver" && <Pill label={t("home.personal")} tone="neutral" />}
            <Pill label={t(`status.${tour.status}`)} tone={tour.status === "in_progress" ? "primary" : tour.status === "completed" ? "success" : "neutral"} />
          </View>
          <ProgressBar value={progress.total ? progress.done / progress.total : 0} />
          <Text style={[ty.small, { color: c.textSecondary }]} testID="progress-text">
            {t("home.progress", { done: progress.done, total: progress.total })}
            {progress.failed ? ` · ${progress.failed} ✕` : ""}
          </Text>
          {metrics && progress.total > 0 && (
            <View style={{ flexDirection: "row", gap: space.md, marginTop: space.xs }}>
              <Stat label={t("home.openStops")} value={String(progress.pending)} hint={t("home.parcels", { n: progress.parcels })} />
              <Stat
                label={t("home.remainingDistance")}
                value={`${km(road?.metrics?.remainingMeters ?? metrics.remainingMeters)} km`}
                hint={t("home.ofTotal", { total: `${km(road?.metrics?.totalMeters ?? metrics.totalMeters)} km` })}
              />
              <Stat
                label={t("home.remainingTime")}
                value={duration(road?.metrics?.remainingDriveSeconds ?? metrics.remainingDriveSeconds)}
                hint={road ? t("common.roadNetwork") : t("common.straightLine")}
              />
            </View>
          )}
          {unlocated > 0 && <Banner text={t("home.needsLocation", { n: unlocated })} tone="warning" icon="location-outline" />}
          {next ? (
            <>
              <SectionTitle>{t("home.nextStop")}</SectionTitle>
              <StopCard stop={next} index={stops.indexOf(next)} current onPress={() => router.push(`/stop/${next.id}`)} testID="open-next-stop" />
            </>
          ) : progress.total > 0 ? (
            <Banner text={t("home.allDone")} tone="success" />
          ) : null}
          <View style={{ flexDirection: "row", gap: space.sm, marginTop: space.xs }}>
            {tour.status === "planned" && <Button label={t("home.startTour")} icon="play" onPress={() => tourAction(tour.id, "start")} style={{ flex: 1 }} testID="start-tour" />}
            {running && next && <Button label={t("home.continue")} icon="arrow-forward" onPress={() => router.push(`/stop/${next.id}`)} style={{ flex: 1 }} testID="continue-tour" />}
            {tour.status === "in_progress" && <Button label={t("home.pauseTour")} variant="secondary" onPress={() => tourAction(tour.id, "pause")} testID="pause-tour" />}
            {tour.status === "paused" && <Button label={t("home.resumeTour")} variant="secondary" onPress={() => tourAction(tour.id, "resume")} testID="resume-tour" />}
          </View>
          {running && !next && <Button label={t("home.finishTour")} variant="success" icon="flag" onPress={() => tourAction(tour.id, "finish")} testID="finish-tour" />}
        </Card>
      ) : (
        <Card>
          <EmptyState icon="calendar-clear-outline" title={t("home.noRoutes")} text={isServerMode() ? t("home.noRoutesText") : t("home.noTour")} />
        </Card>
      )}

      <View style={{ flexDirection: "row", gap: space.sm }}>
        {[
          { icon: "camera-outline" as const, label: t("photoImport.home"), href: "/photo-import" as const, disabled: !tour, id: "quick-photo" },
          { icon: "add-circle-outline" as const, label: t("home.addStop"), href: "/add-stop" as const, disabled: !tour, id: "quick-add" },
          { icon: "document-text-outline" as const, label: t("home.import"), href: "/import" as const, disabled: !tour, id: "quick-import" },
          { icon: "trail-sign-outline" as const, label: t("home.newRoute"), href: "/new-route" as const, disabled: false, id: "quick-route" },
        ].map((q) => (
          <Pressable
            key={q.id}
            testID={q.id}
            disabled={q.disabled}
            onPress={() => router.push(q.href)}
            accessibilityRole="button"
            accessibilityLabel={q.label}
            style={({ pressed }) => ({ flex: 1, minHeight: 76, borderRadius: radii.lg, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, alignItems: "center", justifyContent: "center", gap: 6, opacity: q.disabled ? 0.4 : pressed ? 0.8 : 1 })}
          >
            <Ionicons name={q.icon} size={24} color={c.primary} />
            <Text style={[ty.small, { color: c.text, fontWeight: "700" }]} numberOfLines={1}>
              {q.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {tours.length > 1 && (
        <>
          <SectionTitle>{t("home.todaysTours")}</SectionTitle>
          {tours.map((x) => (
            <Card key={x.id} onPress={() => selectTour(x.id)} testID={`route-${x.id}`} style={{ borderColor: x.id === tour?.id ? c.primary : c.border, flexDirection: "row", alignItems: "center", gap: space.md }}>
              <Ionicons name={x.origin === "driver" ? "person-outline" : "business-outline"} size={20} color={c.textMuted} />
              <Text style={[ty.bodyStrong, { color: c.text, flex: 1 }]} numberOfLines={1}>
                {x.name}
              </Text>
              <Pill label={t(`status.${x.status}`)} tone={x.status === "in_progress" ? "primary" : "neutral"} />
            </Card>
          ))}
        </>
      )}
    </ScrollView>
  );
}
