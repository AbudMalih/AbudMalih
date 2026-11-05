import { NOT_DELIVERED_STATUSES, validateOutcome, type StopStatus } from "@turvio/shared";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { Banner, Button, Card, Ionicons, Screen, SectionTitle } from "../../components/ui";
import { feedback } from "../../lib/haptics";
import { useT } from "../../lib/i18n";
import { useTourStore } from "../../store/tourStore";
import { useStop } from "../../store/useMyTour";
import { radii, space, type as ty, useTheme } from "../../theme";

const STATUS_ICON = { failed: "close-circle", attempted: "repeat", rescheduled: "calendar", returned: "return-down-back" } as const;

export default function OutcomeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useT();
  const { c } = useTheme();
  const { stop, settings } = useStop(id);
  const setStopStatus = useTourStore((s) => s.setStopStatus);
  const [status, setStatus] = useState<StopStatus>("failed");
  const [reason, setReason] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  if (!stop) return null;

  const reasons = settings.failureReasons.filter((r) => !r.statuses || r.statuses.includes(status));
  const needsNote = !!reasons.find((r) => r.code === reason)?.requiresNote;
  const choice = (selected: boolean) => ({ flexDirection: "row" as const, alignItems: "center" as const, gap: space.md, minHeight: 54, paddingHorizontal: space.md, borderRadius: radii.md, borderWidth: selected ? 2 : 1, borderColor: selected ? c.danger : c.border, backgroundColor: selected ? c.dangerSoft : c.card });

  const save = () => {
    const invalid = validateOutcome({ status, failureReason: reason, notes: note }, settings.failureReasons);
    if (invalid) {
      feedback.error();
      return setError(t(`outcome.${invalid}` as never));
    }
    setStopStatus(stop.id, status, { failureReason: reason!, notes: note.trim() || undefined });
    feedback.warning();
    router.back();
  };

  return (
    <Screen testID="outcome">
      <SectionTitle>{t("outcome.status")}</SectionTitle>
      {NOT_DELIVERED_STATUSES.map((st) => (
        <Pressable key={st} onPress={() => setStatus(st)} style={choice(status === st)} accessibilityRole="radio" accessibilityState={{ selected: status === st }} testID={`outcome-${st}`}>
          <Ionicons name={STATUS_ICON[st]} size={22} color={status === st ? c.dangerInk : c.textMuted} />
          <Text style={[ty.bodyStrong, { color: c.text }]}>{t(`outcome.${st}`)}</Text>
        </Pressable>
      ))}
      <SectionTitle>{t("outcome.reason")}</SectionTitle>
      <Card style={{ padding: space.sm, gap: 6 }}>
        {reasons.map((r) => (
          <Pressable key={r.code} onPress={() => setReason(r.code)} style={[choice(reason === r.code), { minHeight: 48 }]} accessibilityRole="radio" accessibilityState={{ selected: reason === r.code }} testID={`reason-${r.code}`}>
            <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: reason === r.code ? c.danger : c.borderStrong, backgroundColor: reason === r.code ? c.danger : "transparent" }} />
            <Text style={[ty.body, { color: c.text, flex: 1 }]}>{r.label ?? t(`reason.${r.code}` as never)}</Text>
          </Pressable>
        ))}
      </Card>
      <Text style={[ty.small, { color: c.textSecondary, fontWeight: "600" }]}>{needsNote ? t("outcome.noteRequired") : t("outcome.note")}</Text>
      <TextInput
        value={note}
        onChangeText={setNote}
        multiline
        maxLength={1000}
        style={[ty.body, { minHeight: 80, borderWidth: 1, borderColor: c.border, borderRadius: radii.md, padding: space.md, color: c.text, backgroundColor: c.card, textAlignVertical: "top" }]}
        testID="outcome-note"
        accessibilityLabel={t("outcome.note")}
      />
      {error && <Banner text={error} tone="danger" />}
      <Button label={t("outcome.save")} variant="primary" size="lg" icon="checkmark" onPress={save} testID="outcome-save" />
    </Screen>
  );
}
