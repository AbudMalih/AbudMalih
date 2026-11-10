import { isOpen, isSuccess } from "@turvio/shared";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, Linking, Platform, Text, TextInput, View } from "react-native";
import { NavigateButton } from "../../components/NavigateButton";
import { Banner, Button, Card, EmptyState, Ionicons, ListRow, Pill, Screen, SectionTitle, Sheet } from "../../components/ui";
import { addressLine, statusTone, timeOf, windowText } from "../../lib/format";
import { feedback } from "../../lib/haptics";
import { useT } from "../../lib/i18n";
import { pendingProofIds } from "../../lib/sync";
import { locationNotices } from "../../lib/locationCheck";
import { useTourStore } from "../../store/tourStore";
import { useStop } from "../../store/useMyTour";
import { radii, space, type as ty, useTheme } from "../../theme";

export default function StopDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useT();
  const { c } = useTheme();
  const { stop, tour, settings } = useStop(id);
  const setStopStatus = useTourStore((s) => s.setStopStatus);
  const addNote = useTourStore((s) => s.addNote);
  const setLocked = useTourStore((s) => s.setLocked);
  const removeStop = useTourStore((s) => s.removeStop);
  const mergeStops = useTourStore((s) => s.mergeStops);
  const [merging, setMerging] = useState(false);
  const outbox = useTourStore((s) => s.outbox);
  const stops = useTourStore((s) => s.stops);
  const locationCheck = useTourStore((s) => (id ? s.locationChecks[String(id)] : undefined));
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!stop || !tour) return <EmptyState icon="alert-circle-outline" title="—" />;
  const open = isOpen(stop.status);
  const index = stops.filter((s) => s.tourId === stop.tourId).sort((a, b) => a.sequence - b.sequence).findIndex((s) => s.id === stop.id);
  const pendingProofs = pendingProofIds(outbox);
  const reasonLabel = (code?: string) => {
    if (!code) return "";
    const custom = settings.failureReasons.find((r) => r.code === code)?.label;
    return custom ?? t(`reason.${code}` as never);
  };

  const act = (fn: () => void) => {
    try {
      setError(null);
      fn();
      feedback.success();
    } catch (e) {
      feedback.error();
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <Screen testID="stop-detail">
      <Stack.Screen options={{ title: t("stop.title", { n: index + 1 }) }} />
      <View style={{ gap: 4 }}>
        <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
          <Pill label={t(`stopType.${stop.type}`)} tone={stop.type === "pickup" ? "warning" : "primary"} icon={stop.type === "pickup" ? "arrow-up-circle-outline" : "arrow-down-circle-outline"} />
          <Pill label={t(`stopStatus.${stop.status}` as never)} tone={statusTone(stop.status)} testID="stop-status" />
          {stop.priority && <Pill label={t("stops.priority")} tone="warning" icon="flash" />}
          {stop.locked && <Pill label={t("stops.locked")} icon="lock-closed" />}
        </View>
        <Text style={[ty.display, { color: c.text, fontSize: 26 }]} testID="stop-title">
          {stop.recipientName ?? addressLine(stop)}
        </Text>
        <Text style={[ty.body, { color: c.textSecondary }]}>{addressLine(stop)}</Text>
        {stop.completedAt && <Text style={[ty.small, { color: c.textMuted }]}>{t("stop.completedAt", { time: timeOf(stop.completedAt) })}</Text>}
        {stop.failureReason && <Banner text={`${t("stop.reason")}: ${reasonLabel(stop.failureReason)}`} tone="danger" />}
      </View>

      {error && <Banner text={error} tone="danger" />}

      <View style={{ flexDirection: "row", gap: space.sm }}>
        <NavigateButton stop={stop} variant={open ? "primary" : "secondary"} />
      </View>
      {!stop.location && (
        <Banner text={t("address.noPin")} tone="warning" icon="location-outline" action={{ label: t("stop.setLocation"), onPress: () => router.push(`/pick-location/${stop.id}`) }} />
      )}
      {open &&
        locationNotices(stop, locationCheck).map((n) => (
          <Banner
            key={n.key}
            text={n.key === "location.approach" ? t(n.key, { road: n.text }) : `${t(n.key)}${n.text ? ` ${n.text}` : ""}`}
            tone={n.tone === "info" ? "primary" : n.tone}
            icon={n.key === "location.approach" ? "navigate-outline" : "alert-circle-outline"}
          />
        ))}

      {open && (
        <Card>
          {stop.status === "pending" && <Button label={t("stop.arrived")} variant="secondary" icon="location" onPress={() => act(() => setStopStatus(stop.id, "in_progress"))} testID="arrived" />}
          {stop.type === "pickup" ? (
            <Button label={t("stop.pickup")} variant="success" size="lg" icon="checkmark-circle" onPress={() => act(() => setStopStatus(stop.id, "picked_up"))} testID="mark-picked-up" />
          ) : (
            <Button label={t("stop.deliver")} variant="success" size="lg" icon="checkmark-circle" onPress={() => router.push(`/pod/${stop.id}`)} testID="mark-delivered" />
          )}
          <Button label={t("stop.notDelivered")} variant="danger" icon="close-circle" onPress={() => router.push(`/outcome/${stop.id}`)} testID="mark-not-delivered" />
        </Card>
      )}
      {!open && (
        <Button label={t("stop.reopen")} variant="secondary" icon="arrow-undo" onPress={() => act(() => setStopStatus(stop.id, "pending"))} testID="reopen" />
      )}

      {stop.notes ? (
        <Card>
          <SectionTitle>{t("stop.instructions")}</SectionTitle>
          <Text style={[ty.body, { color: c.text }]}>{stop.notes}</Text>
        </Card>
      ) : null}

      {(stop.timeWindow || stop.recipientPhone) && (
        <Card>
          {stop.timeWindow && <ListRow icon="time-outline" title={windowText(stop)!} subtitle={t("stop.timeWindow")} />}
          {stop.recipientPhone && settings.showRecipientPhone && (
            <ListRow icon="call-outline" title={stop.recipientPhone} subtitle={t("stop.contact")} onPress={() => void Linking.openURL(`tel:${stop.recipientPhone}`)} />
          )}
        </Card>
      )}

      <Card>
        <SectionTitle>{`${t("stop.parcels")} · ${stop.parcels.length}`}</SectionTitle>
        {stop.parcels.length === 0 && <Text style={[ty.small, { color: c.textMuted }]}>—</Text>}
        {stop.parcels.map((p) => (
          <View key={p.id} style={{ flexDirection: "row", alignItems: "center", gap: space.sm, paddingVertical: 6 }}>
            <Ionicons name={p.loadedAt ? "checkmark-circle" : "cube-outline"} size={18} color={p.loadedAt ? c.success : c.textMuted} />
            <Text style={[ty.body, { color: c.text, flex: 1, fontVariant: ["tabular-nums"] }]} selectable>
              {p.trackingNumber}
            </Text>
            <Text style={[ty.small, { color: p.loadedAt ? c.successInk : c.textSubtle }]}>{p.loadedAt ? t("stop.loaded") : t("stop.notLoaded")}</Text>
          </View>
        ))}
      </Card>

      {(stop.proofs?.length ?? 0) > 0 && (
        <Card testID="stop-proofs">
          <SectionTitle>{t("stop.proofs")}</SectionTitle>
          {stop.proofs!.map((p) => (
            <ListRow
              key={p.id}
              icon={p.kind === "photo" ? "camera-outline" : "create-outline"}
              title={`${t(p.kind === "photo" ? "pod.photo" : "pod.signature")}${p.recipientName ? ` · ${p.recipientName}` : ""}`}
              subtitle={`${timeOf(p.capturedAt)}${pendingProofs.has(p.id) ? ` · ${t("stop.proofPending")}` : ""}`}
              tone={pendingProofs.has(p.id) ? "warning" : "success"}
            />
          ))}
        </Card>
      )}

      <Card>
        <SectionTitle>{t("stop.driverNote")}</SectionTitle>
        {stop.driverNotes && note === null && <Text style={[ty.body, { color: c.text }]}>{stop.driverNotes}</Text>}
        {note === null ? (
          <Button label={stop.driverNotes ? t("common.edit") : t("stop.addNote")} variant="secondary" icon="create-outline" onPress={() => setNote(stop.driverNotes ?? "")} testID="add-note" />
        ) : (
          <>
            <TextInput
              value={note}
              onChangeText={setNote}
              multiline
              maxLength={1000}
              autoFocus
              style={[ty.body, { minHeight: 90, borderWidth: 1, borderColor: c.border, borderRadius: radii.md, padding: space.md, color: c.text, backgroundColor: c.card, textAlignVertical: "top" }]}
              testID="note-input"
              accessibilityLabel={t("stop.driverNote")}
            />
            <Button
              label={t("stop.saveNote")}
              onPress={() => {
                addNote(stop.id, note);
                setNote(null);
                feedback.success();
              }}
              disabled={!note.trim()}
              testID="save-note"
            />
          </>
        )}
      </Card>

      {open && (
        <View style={{ flexDirection: "row", gap: space.sm }}>
          <Button label={stop.locked ? t("stops.unlock") : t("stops.lock")} variant="secondary" icon={stop.locked ? "lock-open-outline" : "lock-closed-outline"} onPress={() => setLocked(stop.id, !stop.locked)} style={{ flex: 1 }} />
          <Button label={stop.location ? t("stop.adjustLocation") : t("stop.setLocation")} variant="secondary" icon="pin-outline" onPress={() => router.push(`/pick-location/${stop.id}`)} style={{ flex: 1 }} />
        </View>
      )}
      {open && (
        <Card>
          <Button label={t("stop.editAddress")} variant="secondary" icon="create-outline" onPress={() => router.push(`/edit-stop/${stop.id}`)} testID="edit-address" />
          <Button label={t("stop.merge")} variant="secondary" icon="git-merge-outline" onPress={() => setMerging(true)} testID="merge-stop" />
          {tour.origin === "driver" ? (
            <Button
              label={t("stop.remove")}
              variant="danger"
              icon="trash-outline"
              testID="remove-stop"
              onPress={() => {
                const go = () => {
                  removeStop(stop.id);
                  router.back();
                };
                if (Platform.OS === "web") return globalThis.confirm?.(t("stop.removeConfirm")) && go();
                Alert.alert(t("stop.remove"), t("stop.removeConfirm"), [
                  { text: t("common.cancel"), style: "cancel" },
                  { text: t("stop.remove"), style: "destructive", onPress: go },
                ]);
              }}
            />
          ) : (
            <Text style={[ty.small, { color: c.textMuted }]}>{t("stop.removeDispatchOnly")}</Text>
          )}
        </Card>
      )}
      <Sheet visible={merging} onClose={() => setMerging(false)} title={t("stop.merge")}>
        <Text style={[ty.small, { color: c.textMuted }]}>{t("stop.mergeHint")}</Text>
        {stops
          .filter((x) => x.tourId === stop.tourId && x.id !== stop.id && isOpen(x.status) && x.type === stop.type)
          .sort((a, b) => a.sequence - b.sequence)
          .map((x) => (
            <ListRow
              key={x.id}
              icon="location-outline"
              title={x.recipientName ?? addressLine(x)}
              subtitle={addressLine(x)}
              testID={`merge-into-${x.id}`}
              onPress={() => {
                act(() => mergeStops(stop.id, x.id));
                setMerging(false);
                router.replace(`/stop/${x.id}`);
              }}
            />
          ))}
      </Sheet>
      {isSuccess(stop.status) && <Text style={[ty.small, { color: c.textMuted, textAlign: "center" }]}>{t("pod.privacy")}</Text>}
    </Screen>
  );
}
