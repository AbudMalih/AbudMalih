import { colors, radius, spacing } from "@turvio/shared";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Switch, Text, TextInput, View } from "react-native";
import { TourMap } from "../components/TourMap";
import { Banner, Button, styles as ui } from "../components/ui";
import { useT } from "../lib/i18n";
import { emptyStopForm, parseStopForm, type StopFormErrors, type StopFormValues } from "../lib/stopForm";
import { useTourStore } from "../store/tourStore";
import { useMyTour } from "../store/useMyTour";

export default function AddStopScreen() {
  const t = useT();
  const { tour, depot, stops } = useMyTour();
  const addStop = useTourStore((s) => s.addStop);
  const [form, setForm] = useState<StopFormValues>(() => emptyStopForm(depot?.address.city ?? ""));
  const [errors, setErrors] = useState<StopFormErrors>({});

  const set = <K extends keyof StopFormValues>(key: K, value: StopFormValues[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const field = (key: keyof StopFormValues & string, label: string, opts: Partial<React.ComponentProps<typeof TextInput>> = {}) => (
    <View style={{ flex: 1 }}>
      <Text style={ui.label}>{label}</Text>
      <TextInput
        value={String(form[key] ?? "")}
        onChangeText={(text) => set(key, text as never)}
        style={[ui.input, errors[key] && ui.inputError]}
        placeholderTextColor={colors.textMuted}
        accessibilityLabel={label}
        testID={`field-${key}`}
        {...opts}
      />
    </View>
  );

  const save = () => {
    if (!tour) return;
    const parsed = parseStopForm(form);
    if (!parsed.ok) {
      setErrors(parsed.errors);
      return;
    }
    const { merged } = addStop(tour.id, parsed.value);
    if (merged) Alert.alert(t("addStop.merged"));
    router.back();
  };

  return (
    <KeyboardAvoidingView style={ui.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled">
        <View style={[ui.row, { gap: spacing.sm }]}>
          {(["delivery", "pickup"] as const).map((type) => (
            <Pressable
              key={type}
              accessibilityRole="radio"
              accessibilityState={{ checked: form.type === type }}
              onPress={() => set("type", type)}
              style={{
                flex: 1,
                minHeight: 48,
                borderRadius: radius.md,
                borderWidth: 1,
                alignItems: "center",
                justifyContent: "center",
                borderColor: form.type === type ? colors.primary : colors.border,
                backgroundColor: form.type === type ? colors.primarySoft : colors.white,
              }}
            >
              <Text style={{ color: form.type === type ? colors.primary : colors.text, fontWeight: "600" }}>
                {t(`stopType.${type}`)}
              </Text>
            </Pressable>
          ))}
        </View>

        {field("recipientName", t("addStop.recipient"), { autoComplete: "off" })}
        <View style={ui.row}>
          <View style={{ flex: 3 }}>{field("street", t("addStop.street"))}</View>
          <View style={{ flex: 1 }}>{field("houseNumber", t("addStop.houseNumber"))}</View>
        </View>
        <View style={ui.row}>
          <View style={{ flex: 1 }}>{field("postalCode", t("addStop.postalCode"), { keyboardType: "number-pad" })}</View>
          <View style={{ flex: 2 }}>{field("city", t("addStop.city"))}</View>
        </View>
        {field("trackingNumbers", t("addStop.tracking"), { multiline: true, autoCapitalize: "characters", style: [ui.input, { minHeight: 80, paddingTop: 12 }] })}
        <View style={ui.row}>
          {field("windowFrom", t("addStop.windowFrom"), { placeholder: "09:00", keyboardType: "numbers-and-punctuation" })}
          {field("windowTo", t("addStop.windowTo"), { placeholder: "12:00", keyboardType: "numbers-and-punctuation" })}
        </View>
        <View style={[ui.row, { justifyContent: "space-between", minHeight: 48 }]}>
          <Text style={ui.body}>{t("addStop.priority")}</Text>
          <Switch value={form.priority} onValueChange={(v) => set("priority", v)} trackColor={{ true: colors.primary }} testID="field-priority" />
        </View>
        {field("notes", t("addStop.notes"), { multiline: true, style: [ui.input, { minHeight: 64, paddingTop: 12 }] })}

        <Text style={ui.label}>{form.location ? t("addStop.positionSet") : t("addStop.placeOnMap")}</Text>
        {depot && (
          <View style={{ height: 220, borderRadius: radius.md, overflow: "hidden", borderWidth: 1, borderColor: colors.border }}>
            <TourMap depot={depot} stops={stops} pendingPin={form.location} onMapPress={(p) => set("location", p)} />
          </View>
        )}

        {Object.keys(errors).length > 0 && <Banner text={t("addStop.invalid")} />}
        <View style={ui.row}>
          <Button label={t("common.cancel")} variant="secondary" style={{ flex: 1 }} onPress={() => router.back()} />
          <Button label={t("common.save")} style={{ flex: 1 }} onPress={save} testID="save-stop" />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
