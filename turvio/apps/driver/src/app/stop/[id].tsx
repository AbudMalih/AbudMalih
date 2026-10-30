import { formatAddress, formatMinuteOfDay, spacing, type StopStatus } from "@turvio/shared";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, ScrollView, Text, TextInput, View } from "react-native";
import { statusTone } from "../../components/StopRow";
import { Button, Card, Pill, styles as ui } from "../../components/ui";
import { useT } from "../../lib/i18n";
import { openNavigation } from "../../lib/navigation";
import { useTourStore } from "../../store/tourStore";

export default function StopDetailScreen() {
  const t = useT();
  const { id } = useLocalSearchParams<{ id: string }>();
  const stop = useTourStore((s) => s.stops.find((x) => x.id === id));
  const setStopStatus = useTourStore((s) => s.setStopStatus);
  const [notes, setNotes] = useState(stop?.notes ?? "");

  if (!stop) {
    return (
      <View style={[ui.screen, ui.content]}>
        <Text style={ui.body}>404</Text>
      </View>
    );
  }

  const complete = (status: StopStatus) => {
    try {
      setStopStatus(stop.id, status, notes.trim() || undefined);
      if (status !== "pending") router.back();
    } catch (e) {
      Alert.alert(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <ScrollView style={ui.screen} contentContainerStyle={ui.content}>
      <Stack.Screen options={{ title: `#${stop.sequence + 1}` }} />
      <Card>
        <View style={ui.row}>
          <Pill label={t(`stopStatus.${stop.status}`)} tone={statusTone(stop.status)} />
          <Pill label={t(`stopType.${stop.type}`)} tone="primary" />
          {stop.priority && <Pill label={t("stops.priority")} tone="warning" />}
        </View>
        <Text style={ui.h2}>{stop.recipientName ?? formatAddress(stop)}</Text>
        <Text style={ui.body}>{formatAddress(stop)}</Text>
        {stop.timeWindow && (
          <Text style={ui.muted}>
            {t("stops.window", {
              from: formatMinuteOfDay(stop.timeWindow.start),
              to: formatMinuteOfDay(stop.timeWindow.end),
            })}
          </Text>
        )}
        <Button
          label={t("stop.navigate")}
          onPress={() => openNavigation({ location: stop.location, addressText: formatAddress(stop) }).catch((e) => Alert.alert(String(e)))}
        />
      </Card>

      {stop.parcels.length > 0 && (
        <Card>
          <Text style={ui.h2}>{t("stop.parcels")}</Text>
          {stop.parcels.map((p) => (
            <Text key={p.id} style={[ui.body, { fontVariant: ["tabular-nums"] }]} selectable>
              {p.trackingNumber}
            </Text>
          ))}
        </Card>
      )}

      <Card>
        <Text style={ui.label}>{t("stop.notes")}</Text>
        <TextInput value={notes} onChangeText={setNotes} multiline style={[ui.input, { minHeight: 88, paddingTop: 12 }]} testID="stop-notes" />
      </Card>

      {stop.status === "pending" ? (
        <View style={{ gap: spacing.sm }}>
          {stop.type === "pickup" ? (
            <Button label={t("stop.markPickedUp")} variant="success" onPress={() => complete("picked_up")} />
          ) : (
            <Button label={t("stop.markDelivered")} variant="success" onPress={() => complete("delivered")} testID="mark-delivered" />
          )}
          <View style={ui.row}>
            <Button label={t("stop.markFailed")} variant="danger" style={{ flex: 1 }} onPress={() => complete("failed")} />
            <Button label={t("stop.markSkipped")} variant="secondary" style={{ flex: 1 }} onPress={() => complete("skipped")} />
          </View>
        </View>
      ) : (
        <Button label={t("stop.reopen")} variant="secondary" onPress={() => complete("pending")} />
      )}
    </ScrollView>
  );
}
