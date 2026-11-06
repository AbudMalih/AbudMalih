import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { StopForm } from "../../components/StopForm";
import { Banner, Button, Screen } from "../../components/ui";
import { feedback } from "../../lib/haptics";
import { useT } from "../../lib/i18n";
import { geocodeDrafts, markDuplicates, type GeoState } from "../../lib/photoImport";
import { parseStopForm, type StopFormErrors, type StopFormValues } from "../../lib/stopForm";
import { useImportStore } from "../../store/importStore";
import { auth, isServerMode } from "../../store/tourStore";
import { useMyTour } from "../../store/useMyTour";

/**
 * Correct one address found in an image. A street-level suggestion is pre-placed as the pin
 * but only counts once the driver saves here (= confirms); moving the pin or picking an
 * address-search result replaces it.
 */
export default function PhotoImportEdit() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const t = useT();
  const { depot, stops } = useMyTour();
  const draft = useImportStore((s) => s.drafts.find((d) => d.key === key));
  const [value, setValue] = useState<StopFormValues | null>(() => {
    if (!draft) return null;
    const g = draft.geo;
    const location = g.status === "confirm" ? g.suggestion : "location" in g ? g.location : null;
    return { ...draft.values, location, locationSource: location ? ("geocoder" as const) : null };
  });
  const [errors, setErrors] = useState<StopFormErrors>({});
  if (!draft || !value) return null;

  const save = async () => {
    const r = parseStopForm(value);
    if (!r.ok) {
      feedback.error();
      return setErrors(r.errors);
    }
    const addressChanged = ["street", "houseNumber", "postalCode", "city"].some((k) => value[k as keyof typeof value] !== draft.values[k as keyof typeof draft.values]);
    let geo: GeoState;
    if (value.location) {
      const g = draft.geo;
      const unchangedSuggestion = g.status === "confirm" && g.suggestion.lat === value.location.lat && g.suggestion.lng === value.location.lng;
      const unchangedFound = g.status === "found" && g.location.lat === value.location.lat && g.location.lng === value.location.lng;
      geo = unchangedFound ? g : unchangedSuggestion || value.locationSource === "geocoder" ? { status: "confirmed", location: value.location } : { status: "pinned", location: value.location };
    } else geo = addressChanged ? { status: "pending" } : draft.geo;
    const { drafts, setDrafts } = useImportStore.getState();
    let next = drafts.map((d) => (d.key === draft.key ? { ...d, values: { ...value, location: null, locationSource: null }, geo, include: true } : d));
    if (geo.status === "pending") next = await geocodeDrafts(isServerMode() ? auth() : null, next);
    setDrafts(markDuplicates(next, stops));
    feedback.success();
    router.back();
  };

  return (
    <Screen testID="photo-import-edit">
      {draft.geo.status === "confirm" && <Banner text={t("photoImport.confirmHint")} tone="warning" icon="location-outline" />}
      <StopForm value={value} onChange={setValue} errors={errors} depot={depot} existing={stops} confidence={draft.confidence} />
      <Button label={t("common.save")} size="lg" icon="checkmark" onPress={() => void save()} testID="pi-edit-save" />
    </Screen>
  );
}
