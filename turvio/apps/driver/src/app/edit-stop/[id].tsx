import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { StopForm } from "../../components/StopForm";
import { Banner, Button, Screen } from "../../components/ui";
import { feedback } from "../../lib/haptics";
import { useT } from "../../lib/i18n";
import { emptyStopForm, parseStopForm, type StopFormErrors, type StopFormValues } from "../../lib/stopForm";
import { useTourStore } from "../../store/tourStore";
import { useMyTour, useStop } from "../../store/useMyTour";

/** Correct the address of an open stop. A new address without a new pin loses the old position. */
export default function EditStop() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useT();
  const { stop } = useStop(id);
  const { depot, stops } = useMyTour();
  const editStop = useTourStore((s) => s.editStop);
  const [value, setValue] = useState<StopFormValues>(() => ({
    ...emptyStopForm(),
    type: stop?.type === "pickup" ? "pickup" : "delivery",
    recipientName: stop?.recipientName ?? "",
    street: stop?.address.street ?? "",
    houseNumber: stop?.address.houseNumber ?? "",
    postalCode: stop?.address.postalCode ?? "",
    city: stop?.address.city ?? "",
    trackingNumbers: stop?.parcels.map((p) => p.trackingNumber).join("\n") ?? "",
    location: stop?.location ?? null,
    locationSource: stop?.locationSource === "geocoder" || stop?.locationSource === "manual_pin" ? stop.locationSource : null,
  }));
  const [errors, setErrors] = useState<StopFormErrors>({});
  const [error, setError] = useState<string | null>(null);
  if (!stop) return null;

  const save = () => {
    const r = parseStopForm(value);
    if (!r.ok) {
      setErrors(r.errors);
      return feedback.error();
    }
    try {
      const pinChanged = value.location && (value.location.lat !== stop.location?.lat || value.location.lng !== stop.location?.lng);
      editStop(stop.id, {
        recipientName: r.value.recipientName,
        address: { street: r.value.address.street, houseNumber: r.value.address.houseNumber, postalCode: r.value.address.postalCode, city: r.value.address.city },
        location: pinChanged ? value.location : undefined,
        locationSource: pinChanged ? (value.locationSource ?? "manual_pin") : undefined,
      });
      feedback.success();
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <Screen testID="edit-stop">
      <StopForm value={value} onChange={setValue} errors={errors} depot={depot} existing={stops.filter((s) => s.id !== stop.id)} />
      {error && <Banner text={error} tone="danger" />}
      <Button label={t("common.save")} size="lg" icon="checkmark" onPress={save} testID="edit-stop-save" />
    </Screen>
  );
}
