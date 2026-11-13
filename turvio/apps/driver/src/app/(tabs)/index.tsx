import { isOpen, routeMetrics, tourEndPoint, tourProgress, tourStartPoint } from "@turvio/shared";
import { router } from "expo-router";
import { useId, useMemo, useState } from "react";
import { Image, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NavigateButton } from "../../components/NavigateButton";
import { StopCard } from "../../components/StopCard";
import { SyncPill } from "../../components/SyncPill";
import { TrackingPill } from "../../components/Tracking";
import { ActionTile, Banner, Button, Card, EmptyState, GRADIENTS, GradientFill, Ionicons, Pill, SectionTitle, type IconName } from "../../components/ui";
import Svg, { Defs, LinearGradient, Line, RadialGradient, Rect, Stop as SvgStop } from "react-native-svg";
import { duration, km } from "../../lib/format";
import { useLocale, useT } from "../../lib/i18n";
import { isServerMode, useTourStore } from "../../store/tourStore";
import { useMyTour } from "../../store/useMyTour";
import { fw, radii, space, type as ty, useTheme } from "../../theme";

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
  const metrics = useMemo(() => (depot ? routeMetrics(tourStartPoint(tour ?? {}, depot.location), stops, tourEndPoint(tour ?? {}, depot.location)) : null), [depot, stops, tour]);
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
      {/* Prototype header: TURVIO mark, date + greeting, live status on the right. */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 52 }}>
        <Image source={dark ? require("../../../assets/brand/turvio-mark-dark.png") : require("../../../assets/brand/turvio-mark-light.png")} style={{ width: 40, height: 32 }} resizeMode="contain" accessibilityLabel="TURVIO" />
        <View style={{ flex: 1, minWidth: 0 }}>
          {today ? <Text style={[ty.small, { color: c.textMuted }]} numberOfLines={1}>{today}</Text> : null}
          <Text style={[ty.title, { color: c.text }]} accessibilityRole="header" numberOfLines={1}>
            {name ? t("home.greeting", { name }) : t("tabs.today")}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end", gap: space.xs }}>
          <SyncPill />
          <TrackingPill />
        </View>
      </View>
      {!isServerMode() && <Text style={[ty.small, { color: c.warningInk }]}>{t("home.syntheticBanner")}</Text>}

      {tour ? (
        <>
          <HeroCard testID="active-tour">
            <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
              <Text style={[ty.smallStrong, { color: c.primaryText, flex: 1 }]} numberOfLines={1}>
                {tour.name}
              </Text>
              {tour.origin === "driver" && <Pill label={t("home.personal")} tone="neutral" />}
              <Pill label={t(`status.${tour.status}`)} tone={tour.status === "in_progress" ? "primary" : tour.status === "completed" ? "success" : "neutral"} />
            </View>

            <View style={{ flexDirection: "row", alignItems: "flex-end", gap: space.md, marginTop: space.sm }}>
              <Text style={{ color: c.text, fontSize: 46, lineHeight: 50, letterSpacing: -1.6, ...fw("800"), fontVariant: ["tabular-nums"] }}>
                {progress.done}
                <Text style={{ color: c.textMuted, fontSize: 22, letterSpacing: -0.4, ...fw("700") }}>/{progress.total}</Text>
              </Text>
              <View style={{ flex: 1, paddingBottom: 6, gap: 2 }}>
                <Text style={[ty.smallStrong, { color: c.text }]} testID="progress-text">
                  {t("home.progress", { done: progress.done, total: progress.total })}
                </Text>
                {progress.failed ? <Text style={[ty.caption, { color: c.dangerInk }]}>{`${progress.failed} ✕`}</Text> : null}
              </View>
            </View>

            <ProgressTicks done={progress.done} failed={progress.failed} total={progress.total} />

            {metrics && progress.total > 0 && (
              <View style={{ flexDirection: "row", gap: space.sm }}>
                <HeroStat value={String(progress.pending)} label={t("home.statOpen")} />
                <HeroStat value={String(progress.parcels)} label={t("home.statParcels")} />
                <HeroStat value={km(road?.metrics?.remainingMeters ?? metrics.remainingMeters)} label={t("home.statKmLeft")} />
                <HeroStat value={duration(road?.metrics?.remainingDriveSeconds ?? metrics.remainingDriveSeconds)} label={t("home.statTimeLeft")} />
              </View>
            )}
            {metrics && progress.total > 0 && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Ionicons name={road ? "git-network-outline" : "resize-outline"} size={14} color={c.textMuted} />
                <Text style={[ty.small, { color: c.textSecondary }]}>{t("home.ofTotal", { total: `${km(road?.metrics?.totalMeters ?? metrics.totalMeters)} km` })} ·</Text>
                <Text style={[ty.smallStrong, { color: road ? c.successInk : c.warningInk }]}>{road ? t("common.roadNetwork") : t("common.straightLine")}</Text>
              </View>
            )}
          </HeroCard>

          {unlocated > 0 && <Banner text={t("home.needsLocation", { n: unlocated })} tone="warning" icon="location-outline" />}

          <View style={{ flexDirection: "row", gap: space.sm }}>
            {tour.status === "planned" && <Button label={t("home.startTour")} icon="play" size="lg" onPress={() => tourAction(tour.id, "start")} style={{ flex: 1 }} testID="start-tour" />}
            {running && next && <Button label={t("home.continue")} icon="navigate" size="lg" onPress={() => router.push(`/stop/${next.id}`)} style={{ flex: 1 }} testID="continue-tour" />}
            {tour.status === "in_progress" && <Button label={t("home.pauseTour")} variant="secondary" size="lg" onPress={() => tourAction(tour.id, "pause")} testID="pause-tour" />}
            {tour.status === "paused" && <Button label={t("home.resumeTour")} variant="secondary" size="lg" onPress={() => tourAction(tour.id, "resume")} testID="resume-tour" />}
          </View>
          {running && !next && <Button label={t("home.finishTour")} variant="success" icon="flag" size="lg" onPress={() => tourAction(tour.id, "finish")} testID="finish-tour" />}

          {next ? (
            <View style={{ gap: space.xs }}>
              <SectionTitle>{t("home.nextStop")}</SectionTitle>
              <StopCard stop={next} index={stops.indexOf(next)} current onPress={() => router.push(`/stop/${next.id}`)} testID="open-next-stop" />
              {/* Prototype next-stop card: navigate straight from Today, or open the stop. */}
              {running && (
                <View style={{ flexDirection: "row", gap: space.sm, alignItems: "flex-start" }}>
                  <NavigateButton stop={next} testID="home-navigate" />
                  <View style={{ flex: 1 }}>
                    <Button label={t("home.details")} variant="secondary" onPress={() => router.push(`/stop/${next.id}`)} testID="home-details" />
                  </View>
                </View>
              )}
            </View>
          ) : progress.total > 0 ? (
            <Banner text={t("home.allDone")} tone="success" />
          ) : null}
        </>
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
  const radius = 20;
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
        minHeight: 84,
        borderRadius: radius,
        borderWidth: 1,
        borderColor: primary ? "transparent" : c.border,
        backgroundColor: primary ? "transparent" : c.card,
        overflow: "hidden",
        padding: space.md,
        gap: space.xs,
        opacity: disabled ? 0.45 : 1,
        transform: [{ scale: pressed ? 0.97 : 1 }],
      })}
    >
      {primary && <GradientFill colors={GRADIENTS.scan} radius={radius} />}
      <Ionicons name={icon} size={20} color={primary ? "#FFFFFF" : c.primaryText} />
      <Text style={[ty.bodyStrong, { color: fg }]} numberOfLines={1}>
        {title}
      </Text>
      <Text style={[ty.caption, { color: primary ? "rgba(255,255,255,0.85)" : c.textMuted, ...fw("400"), letterSpacing: 0 }]} numberOfLines={1}>
        {subtitle}
      </Text>
    </Pressable>
  );
}

/** Prototype .hero-t: 28-px card, violet glow from the top corner over a deep gradient, fine grid. */
function HeroCard({ children, testID }: { children: React.ReactNode; testID?: string }) {
  const { c } = useTheme();
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
    <View testID={testID} style={{ borderRadius: 28, borderWidth: 1, borderColor: c.heroLine, overflow: "hidden", padding: 18, gap: space.md, shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 24, shadowOffset: { width: 0, height: 14 }, elevation: 6 }}>
      <Svg width="100%" height="100%" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} pointerEvents="none">
        <Defs>
          <LinearGradient id={`heroBg${uid}`} x1="0" y1="0" x2="1" y2="1">
            <SvgStop offset="0" stopColor={c.heroFrom} />
            <SvgStop offset="1" stopColor={c.heroTo} />
          </LinearGradient>
          <RadialGradient id={`heroGlow${uid}`} cx="100%" cy="0%" rx="85%" ry="95%">
            <SvgStop offset="0" stopColor={c.heroGlow} stopOpacity="1" />
            <SvgStop offset="1" stopColor={c.heroGlow} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#heroBg${uid})`} />
        <Rect width="100%" height="100%" fill={`url(#heroGlow${uid})`} />
        {/* Fine grid fading out from the top corner (prototype .hero-t::before). */}
        {Array.from({ length: 6 }, (_, i) => (
          <Line key={`v${i}`} x1={`${100 - i * 9}%`} y1="0" x2={`${100 - i * 9}%`} y2="40%" stroke={c.heroLine} strokeWidth={1} opacity={0.32 - i * 0.05} />
        ))}
        {Array.from({ length: 4 }, (_, i) => (
          <Line key={`h${i}`} x1="52%" y1={`${4 + i * 10}%`} x2="100%" y2={`${4 + i * 10}%`} stroke={c.heroLine} strokeWidth={1} opacity={0.28 - i * 0.06} />
        ))}
      </Svg>
      {children}
    </View>
  );
}

/** Per-stop progress ticks (done = mint, failed = coral, open = muted), like the prototype. */
function ProgressTicks({ done, failed, total }: { done: number; failed: number; total: number }) {
  const { c } = useTheme();
  if (!total) return null;
  const n = Math.min(total, 64);
  const okUpTo = Math.round(((done - failed) / total) * n);
  const failUpTo = Math.round((done / total) * n);
  return (
    <View style={{ flexDirection: "row", gap: 2, height: 18, alignItems: "flex-end" }} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: total, now: done }}>
      {Array.from({ length: n }, (_, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            height: i === failUpTo - 1 ? 18 : 14,
            borderRadius: 1.5,
            backgroundColor: i < okUpTo ? c.success : i < failUpTo ? c.danger : c.borderStrong,
            opacity: i < failUpTo ? 1 : 0.9,
          }}
        />
      ))}
    </View>
  );
}

function HeroStat({ value, label }: { value: string; label: string }) {
  const { c } = useTheme();
  return (
    <View style={{ flex: 1, minWidth: 0, borderRadius: 14, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface + "00", paddingHorizontal: 10, paddingVertical: 9, gap: 2, overflow: "hidden" }}>
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: c.card, opacity: 0.55 }} />
      <Text style={{ color: c.text, fontSize: 16, lineHeight: 20, letterSpacing: -0.3, ...fw("800"), fontVariant: ["tabular-nums"] }} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={[ty.caption, { color: c.textMuted, letterSpacing: 0, fontSize: 11 }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}
