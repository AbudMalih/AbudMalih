import { addressKey, isOpen, type Depot, type Stop } from "@turvio/shared";
import { useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import type { Confidence } from "@turvio/shared";
import type { StopFormErrors, StopFormValues } from "../lib/stopForm";
import { useT } from "../lib/i18n";
import { radii, space, type as ty, useTheme } from "../theme";
import { AddressSearch } from "./AddressSearch";
import { TourMap } from "./TourMap";
import { Banner, Field, Pill, Segmented } from "./ui";

const CONF_TONE = { high: "success", medium: "warning", low: "danger", none: "neutral" } as const;

/** Stop form shared by manual entry and the label (OCR) review. */
export function StopForm({
  value,
  onChange,
  errors,
  depot,
  existing,
  confidence,
}: {
  value: StopFormValues;
  onChange: (v: StopFormValues) => void;
  errors: StopFormErrors;
  depot: Depot | undefined;
  existing: Stop[];
  confidence?: Partial<Record<keyof StopFormValues, Confidence>>;
}) {
  const t = useT();
  const { c } = useTheme();
  const set = <K extends keyof StopFormValues>(k: K, v: StopFormValues[K]) => onChange({ ...value, [k]: v });
  const label = (k: keyof StopFormValues, text: string) => {
    const conf = confidence?.[k];
    return conf ? `${text} · ${t(`label.confidence.${conf}`)}` : text;
  };
  const duplicate = useMemo(() => {
    if (!value.street || !value.postalCode) return null;
    const key = addressKey({ street: value.street, houseNumber: value.houseNumber || undefined, postalCode: value.postalCode, city: value.city, countryCode: "DE" });
    return existing.find((s) => isOpen(s.status) && s.type === value.type && addressKey(s.address) === key) ?? null;
  }, [existing, value.street, value.houseNumber, value.postalCode, value.city, value.type]);

  const confBadge = (k: keyof StopFormValues) => (confidence?.[k] ? <Pill label={t(`label.confidence.${confidence[k]!}`)} tone={CONF_TONE[confidence[k]!]} /> : null);

  return (
    <View style={{ gap: space.md }}>
      <Segmented value={value.type} onChange={(v) => set("type", v)} options={[{ value: "delivery", label: t("addStop.delivery") }, { value: "pickup", label: t("addStop.pickup") }]} testID="stop-type" />
      <AddressSearch
        near={depot?.location}
        onPick={(r) =>
          onChange({
            ...value,
            street: r.street ?? value.street,
            houseNumber: r.houseNumber ?? value.houseNumber,
            postalCode: r.postalCode ?? value.postalCode,
            city: r.city ?? value.city,
            location: r.location,
            locationSource: "geocoder",
          })
        }
      />
      <Field label={label("recipientName", t("addStop.recipient"))} value={value.recipientName} onChangeText={(v) => set("recipientName", v)} testID="field-recipient" right={confBadge("recipientName")} />
      <View style={{ flexDirection: "row", gap: space.sm }}>
        <Field label={label("street", t("addStop.street"))} value={value.street} onChangeText={(v) => set("street", v)} error={errors.street ? " " : null} style={{ flex: 3 }} testID="field-street" />
        <Field label={label("houseNumber", t("addStop.houseNumber"))} value={value.houseNumber} onChangeText={(v) => set("houseNumber", v)} style={{ flex: 1 }} testID="field-house" />
      </View>
      <View style={{ flexDirection: "row", gap: space.sm }}>
        <Field label={label("postalCode", t("addStop.postalCode"))} value={value.postalCode} onChangeText={(v) => set("postalCode", v)} keyboardType="number-pad" error={errors.postalCode ? " " : null} style={{ flex: 2 }} testID="field-postal" />
        <Field label={label("city", t("addStop.city"))} value={value.city} onChangeText={(v) => set("city", v)} error={errors.city ? " " : null} style={{ flex: 3 }} testID="field-city" />
      </View>
      {duplicate && <Banner text={t("address.duplicate")} tone="primary" icon="git-merge-outline" />}

      <View style={{ height: 200, borderRadius: radii.lg, overflow: "hidden", borderWidth: 1, borderColor: c.border }}>
        <TourMap depot={depot} stops={[]} pendingPin={value.location} onMapPress={(p) => onChange({ ...value, location: p, locationSource: "manual_pin" })} />
      </View>
      <Text style={[ty.small, { color: value.location ? c.successInk : c.warningInk }]} testID="pin-state">
        {value.location ? `${t("address.pinSet")} (${value.locationSource === "geocoder" ? t("address.search") : t("address.pin")})` : t("address.noPin")}
      </Text>

      <Field label={label("trackingNumbers", t("addStop.tracking"))} value={value.trackingNumbers} onChangeText={(v) => set("trackingNumbers", v)} multiline autoCapitalize="characters" style={{ minHeight: 60 }} testID="field-tracking" />
      <View style={{ flexDirection: "row", gap: space.sm }}>
        <Field label={t("addStop.windowFrom")} value={value.windowFrom} onChangeText={(v) => set("windowFrom", v)} placeholder="09:00" error={errors.windowFrom ? " " : null} style={{ flex: 1 }} />
        <Field label={t("addStop.windowTo")} value={value.windowTo} onChangeText={(v) => set("windowTo", v)} placeholder="12:00" error={errors.windowTo ? " " : null} style={{ flex: 1 }} />
      </View>
      <Field label={t("addStop.phone")} value={value.phone} onChangeText={(v) => set("phone", v)} keyboardType="phone-pad" />
      <Field label={t("addStop.notes")} value={value.notes} onChangeText={(v) => set("notes", v)} multiline />
      <Pressable onPress={() => set("priority", !value.priority)} accessibilityRole="switch" accessibilityState={{ checked: value.priority }} style={{ flexDirection: "row", alignItems: "center", gap: space.sm, minHeight: 48 }} testID="field-priority">
        <View style={{ width: 46, height: 28, borderRadius: 14, padding: 3, backgroundColor: value.priority ? c.warning : c.borderStrong, alignItems: value.priority ? "flex-end" : "flex-start" }}>
          <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: "#FFFFFF" }} />
        </View>
        <Text style={[ty.bodyStrong, { color: c.text }]}>{t("addStop.priority")}</Text>
      </Pressable>
    </View>
  );
}
