import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { StopForm } from "../components/StopForm";
import { Banner, Button, Screen } from "../components/ui";
import { feedback } from "../lib/haptics";
import { useT } from "../lib/i18n";
import { emptyStopForm, parseStopForm, type StopFormErrors } from "../lib/stopForm";
import { useTourStore } from "../store/tourStore";
import { useMyTour } from "../store/useMyTour";

export default function AddStopScreen() {
  const t = useT();
  const params = useLocalSearchParams<{ tracking?: string }>();
  const { tour, depot, stops } = useMyTour();
  const addStop = useTourStore((s) => s.addStop);
  const [value, setValue] = useState(() => ({ ...emptyStopForm(depot?.address.city ?? ""), trackingNumbers: params.tracking ?? "" }));
  const [errors, setErrors] = useState<StopFormErrors>({});
  const [message, setMessage] = useState<string | null>(null);

  const save = () => {
    if (!tour) return;
    const r = parseStopForm(value);
    if (!r.ok) {
      feedback.error();
      setErrors(r.errors);
      return setMessage(t("addStop.invalid"));
    }
    const { merged } = addStop(tour.id, r.value);
    feedback.success();
    if (merged) setMessage(t("addStop.merged"));
    router.back();
  };

  return (
    <Screen testID="add-stop">
      <StopForm value={value} onChange={setValue} errors={errors} depot={depot} existing={stops} />
      {message && <Banner text={message} tone="warning" />}
      <Button label={t("common.save")} size="lg" icon="checkmark" onPress={save} disabled={!tour} testID="add-stop-save" />
    </Screen>
  );
}
