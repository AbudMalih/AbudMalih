import { isOpen, routeMetrics } from "@turvio/shared";
import { router } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import { Banner, BottomBar, Button, Card, Screen, SectionTitle, Segmented, Stat } from "../components/ui";
import { duration, km } from "../lib/format";
import { feedback } from "../lib/haptics";
import { useT } from "../lib/i18n";
import { currentPosition } from "../lib/location";
import type { OptimizationOutcome } from "../lib/optimizer";
import { useTourStore } from "../store/tourStore";
import { useMyTour } from "../store/useMyTour";
import { space, type as ty, useTheme } from "../theme";

export default function OptimizeScreen() {
  const t = useT();
  const { c } = useTheme();
  const { tour, depot, stops, road } = useMyTour();
  const optimize = useTourStore((s) => s.optimize);
  const optimizing = useTourStore((s) => s.optimizing);
  const prefs = useTourStore((s) => s.prefs);
  const setPrefs = useTourStore((s) => s.setPrefs);
  const [end, setEnd] = useState<"depot" | "none">("depot");
  const [respectLocks, setRespectLocks] = useState(true);
  const [result, setResult] = useState<OptimizationOutcome | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!tour || !depot) return null;
  const open = stops.filter((s) => isOpen(s.status));
  const locked = open.filter((s) => s.locked).length;
  const estimate = routeMetrics(tour.startLocation ?? depot.location, stops, end === "none" ? undefined : (tour.endLocation ?? depot.location));
  // Road figures only from road routing (OSRM): the road route of the tour, or the optimizer's
  // own road totals. Otherwise the straight-line estimate, labelled as such – never mixed.
  const roadFig =
    result?.engine === "server" && result.matrixSource === "osrm"
      ? road?.metrics
        ? { meters: road.metrics.remainingMeters, seconds: road.metrics.remainingDriveSeconds }
        : result.distanceMeters != null && result.durationSeconds != null
          ? { meters: result.distanceMeters, seconds: result.durationSeconds }
          : null
      : null;
  const shown = roadFig ?? { meters: estimate.remainingMeters, seconds: estimate.remainingDriveSeconds };
  const shownHint = roadFig ? t("common.roadNetwork") : t("common.straightLine");

  const run = async () => {
    setError(null);
    setNotice(null);
    let start: { lat: number; lng: number } | undefined;
    if (prefs.optimizeFromDevice) {
      const pos = await currentPosition(true);
      if (pos.ok) start = pos.point;
      else setNotice(t("optimize.locationDenied"));
    }
    try {
      const r = await optimize(tour.id, { start, end, respectLocks });
      setResult(r);
      feedback.success();
    } catch (e) {
      feedback.error();
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <Screen
      testID="optimize"
      footer={
        <BottomBar>
          {result ? (
            <Button label={t("common.done")} size="lg" onPress={() => router.back()} testID="optimize-done" />
          ) : (
            <Button label={optimizing ? t("optimize.running") : t("optimize.run")} size="lg" icon="git-network-outline" loading={optimizing} disabled={!open.length} onPress={() => void run()} testID="optimize-run" />
          )}
        </BottomBar>
      }
    >
      <Card>
        <Text style={[ty.h2, { color: c.text }]}>{t("optimize.scopeRemaining", { n: open.length })}</Text>
        <Text style={[ty.small, { color: c.textMuted }]}>{t("optimize.considers")}</Text>
        <SectionTitle>{t("optimize.start")}</SectionTitle>
        <Segmented
          value={prefs.optimizeFromDevice ? "here" : "depot"}
          onChange={(v) => setPrefs({ optimizeFromDevice: v === "here" })}
          options={[
            { value: "depot", label: t("optimize.startDepot") },
            { value: "here", label: t("optimize.startHere") },
          ]}
        />
        <SectionTitle>{t("optimize.end")}</SectionTitle>
        <Segmented value={end} onChange={setEnd} options={[{ value: "depot", label: t("optimize.endDepot") }, { value: "none", label: t("optimize.endNone") }]} />
        {locked > 0 && (
          <Segmented
            value={respectLocks ? "keep" : "free"}
            onChange={(v) => setRespectLocks(v === "keep")}
            options={[
              { value: "keep", label: t("optimize.locks", { n: locked }) },
              { value: "free", label: t("stops.unlock") },
            ]}
          />
        )}
      </Card>
      {notice && <Banner text={notice} tone="warning" />}
      {error && <Banner text={error} tone="danger" />}

      {result && (
        <Card testID="optimize-result">
          <Banner
            tone={result.engine === "server" ? "success" : "warning"}
            text={result.engine === "server" ? t("optimize.resultServer", { source: result.matrixSource === "osrm" ? t("common.roadNetwork") : t("common.straightLine") }) : t("optimize.resultLocal")}
          />
          <View style={{ flexDirection: "row", gap: space.md }}>
            <Stat label={t("home.remainingDistance")} value={`${km(shown.meters)} km`} hint={shownHint} />
            <Stat label={t("home.remainingTime")} value={duration(shown.seconds)} hint={shownHint} />
          </View>
          {result.unassignedStopIds.length > 0 && <Banner text={t("optimize.unassigned", { n: result.unassignedStopIds.length })} tone="warning" />}
          {result.unlocatedStopIds.length > 0 && <Banner text={t("optimize.unlocated", { n: result.unlocatedStopIds.length })} tone="warning" />}
        </Card>
      )}
    </Screen>
  );
}
