import { colors, estimateRoute, formatAddress, spacing, tourProgress } from "@turvio/shared";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import { Banner, Button, Card, Pill, styles as ui } from "../../components/ui";
import { useT } from "../../lib/i18n";
import { openNavigation } from "../../lib/navigation";
import { useTourStore } from "../../store/tourStore";
import { useMyTour } from "../../store/useMyTour";

export default function HomeScreen() {
  const t = useT();
  const { tour, depot, driver, stops } = useMyTour();
  const tourAction = useTourStore((s) => s.tourAction);
  const optimize = useTourStore((s) => s.optimize);
  const optimizing = useTourStore((s) => s.optimizing);
  const lastOptimization = useTourStore((s) => s.lastOptimization);
  const [optError, setOptError] = useState<string | null>(null);

  const progress = useMemo(() => tourProgress(stops), [stops]);
  const pending = useMemo(() => stops.filter((s) => s.status === "pending"), [stops]);
  const estimate = useMemo(
    () => (depot ? estimateRoute(depot.location, pending, depot.location) : null),
    [depot, pending],
  );
  const next = pending[0];

  if (!tour || !depot) {
    return (
      <View style={[ui.screen, ui.content]}>
        <Text style={ui.body}>{t("home.noTour")}</Text>
      </View>
    );
  }

  const runOptimize = async () => {
    setOptError(null);
    try {
      await optimize(tour.id);
    } catch (e) {
      setOptError(e instanceof Error ? e.message : String(e));
    }
  };

  const lastOpt = lastOptimization?.tourId === tour.id ? lastOptimization : null;
  const ratio = progress.total ? progress.done / progress.total : 0;

  return (
    <ScrollView style={ui.screen} contentContainerStyle={ui.content}>
      <Banner text={t("home.syntheticBanner")} />
      <Text style={ui.h1}>{t("home.greeting", { name: driver?.displayName.split(" ")[0] ?? "" })}</Text>

      <Card>
        <View style={[ui.row, { justifyContent: "space-between" }]}>
          <Text style={ui.muted}>{t("home.todaysTour")}</Text>
          <Pill label={t(`status.${tour.status}`)} tone={tour.status === "in_progress" ? "primary" : "neutral"} />
        </View>
        <Text style={ui.h2}>{tour.name}</Text>
        <Text style={ui.muted}>{depot.name}</Text>
        <View style={{ height: 8, backgroundColor: colors.surface, borderRadius: 4, overflow: "hidden", marginTop: spacing.sm }}>
          <View
            testID="progress-bar"
            style={{ width: `${Math.round(ratio * 100)}%`, height: "100%", backgroundColor: colors.primary }}
          />
        </View>
        <Text style={ui.body} testID="progress-text">
          {t("home.progress", { done: progress.done, total: progress.total })} · {t("home.parcels", { n: progress.parcels })}
        </Text>
        {estimate && pending.length > 0 && (
          <View style={[ui.row, { gap: spacing.xl }]}>
            <View>
              <Text style={ui.muted}>{t("home.estimatedDrive")}</Text>
              <Text style={ui.body}>{t("common.minutes", { n: Math.round(estimate.driveSeconds / 60) })}</Text>
            </View>
            <View>
              <Text style={ui.muted}>{t("home.estimatedDistance")}</Text>
              <Text style={ui.body}>{t("common.km", { n: (estimate.distanceMeters / 1000).toFixed(1) })}</Text>
            </View>
          </View>
        )}
      </Card>

      {next && (
        <Card>
          <Text style={ui.muted}>#{next.sequence + 1}</Text>
          <Text style={ui.h2}>{next.recipientName ?? formatAddress(next)}</Text>
          <Text style={ui.body}>{formatAddress(next)}</Text>
          <View style={[ui.row, { marginTop: spacing.sm }]}>
            <Button
              label={t("stop.navigate")}
              style={{ flex: 1 }}
              onPress={() =>
                openNavigation({ location: next.location, addressText: formatAddress(next) }).catch((e) =>
                  Alert.alert(String(e)),
                )
              }
            />
            <Button
              label={t("stops.title")}
              variant="secondary"
              style={{ flex: 1 }}
              onPress={() => router.push({ pathname: "/stop/[id]", params: { id: next.id } })}
            />
          </View>
        </Card>
      )}

      {tour.status === "planned" && <Button label={t("home.startTour")} onPress={() => tourAction(tour.id, "start")} testID="start-tour" />}
      {tour.status === "in_progress" && (
        <View style={ui.row}>
          <Button label={t("home.pauseTour")} variant="secondary" style={{ flex: 1 }} onPress={() => tourAction(tour.id, "pause")} />
          <Button label={t("home.finishTour")} variant="success" style={{ flex: 1 }} onPress={() => tourAction(tour.id, "finish")} />
        </View>
      )}
      {tour.status === "paused" && (
        <View style={ui.row}>
          <Button label={t("home.resumeTour")} style={{ flex: 1 }} onPress={() => tourAction(tour.id, "resume")} />
          <Button label={t("home.finishTour")} variant="success" style={{ flex: 1 }} onPress={() => tourAction(tour.id, "finish")} />
        </View>
      )}

      <View style={ui.row}>
        <Button
          label={optimizing ? t("home.optimizing") : t("home.optimize")}
          variant="secondary"
          loading={optimizing}
          disabled={pending.length < 2 || tour.status === "completed"}
          style={{ flex: 1 }}
          onPress={runOptimize}
          testID="optimize"
        />
        <Button
          label={t("home.addStop")}
          variant="secondary"
          style={{ flex: 1 }}
          disabled={tour.status === "completed"}
          onPress={() => router.push("/add-stop")}
          testID="add-stop"
        />
      </View>

      {lastOpt && (
        <Text style={ui.muted} testID="optimization-note">
          {lastOpt.engine === "server"
            ? t("home.optimizedServer", { source: lastOpt.matrixSource ?? "" })
            : t("home.optimizedLocally")}
          {lastOpt.fallbackReason ? ` (${lastOpt.fallbackReason})` : ""}
          {lastOpt.unlocatedStopIds.length > 0 ? `\n${t("home.unlocated", { n: lastOpt.unlocatedStopIds.length })}` : ""}
        </Text>
      )}
      {optError && <Banner text={optError} />}
    </ScrollView>
  );
}
