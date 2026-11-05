import { SCAN_BARCODE_TYPES, parseLabelText, type Confidence } from "@turvio/shared";
import { formFromExtraction } from "../lib/labelForm";
import { scanFromURLAsync } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Platform, Text, View } from "react-native";
import { StopForm } from "../components/StopForm";
import { Banner, Button, Card, Pill, Screen, SectionTitle } from "../components/ui";
import { deleteTemporary } from "../lib/files";
import { feedback } from "../lib/haptics";
import { useT } from "../lib/i18n";
import { ocrEngine } from "../lib/ocr";
import { emptyStopForm, parseStopForm, type StopFormErrors, type StopFormValues } from "../lib/stopForm";
import { useTourStore } from "../store/tourStore";
import { useMyTour } from "../store/useMyTour";
import { space, type as ty, useTheme } from "../theme";

export default function LabelCapture() {
  const t = useT();
  const { c } = useTheme();
  const params = useLocalSearchParams<{ codes?: string }>();
  const queue = useMemo(() => (params.codes ? params.codes.split(",").filter(Boolean) : []), [params.codes]);
  const { tour, depot, stops } = useMyTour();
  const addStop = useTourStore((s) => s.addStop);
  const [index, setIndex] = useState(0);
  const code = queue[index];
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState<string[]>([]);
  const [value, setValue] = useState<StopFormValues>(() => ({ ...emptyStopForm(depot?.address.city ?? ""), trackingNumbers: code ?? "" }));
  const [confidence, setConfidence] = useState<Partial<Record<keyof StopFormValues, Confidence>>>({});
  const [errors, setErrors] = useState<StopFormErrors>({});
  const [reviewed, setReviewed] = useState(false);

  const capture = async () => {
    setNotes([]);
    const perm = await ImagePicker.requestCameraPermissionsAsync().catch(() => ({ granted: false }));
    if (!perm.granted && Platform.OS !== "web") return setNotes([t("pod.cameraDenied")]);
    const shot = Platform.OS === "web" ? await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.9 }) : await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.9, exif: false });
    if (shot.canceled || !shot.assets[0]) return;
    const uri = shot.assets[0].uri;
    setBusy(true);
    const out: string[] = [];
    try {
      const barcodes = await scanFromURLAsync(uri, [...SCAN_BARCODE_TYPES]).catch(() => []);
      const engine = ocrEngine();
      const lines = engine ? await engine.recognize(uri).catch(() => []) : [];
      if (!engine) out.push(t("label.ocrUnavailable"));
      const x = parseLabelText(lines, barcodes.map((b) => ({ data: b.data, type: b.type })));
      if (x.barcode.value) out.push(t("label.barcodeFound", { code: x.barcode.value }));
      else out.push(t("label.noBarcode"));
      if (engine) for (const w of x.warnings) out.push(t(`label.warning.${w}` as never));
      const f = formFromExtraction(x, value, code);
      setValue(f.value);
      setConfidence(engine ? f.confidence : { trackingNumbers: f.confidence.trackingNumbers });
      setReviewed(true);
      feedback.success();
    } finally {
      // The label photo contains personal data and is not kept.
      await deleteTemporary(uri).catch(() => undefined);
      out.push(t("label.photoDeleted"));
      setNotes(out);
      setBusy(false);
    }
  };

  const save = () => {
    if (!tour) return;
    const r = parseStopForm(value);
    if (!r.ok) {
      setErrors(r.errors);
      feedback.error();
      return;
    }
    addStop(tour.id, r.value);
    feedback.success();
    if (index + 1 < queue.length) {
      setIndex(index + 1);
      setValue({ ...emptyStopForm(value.city), trackingNumbers: queue[index + 1] ?? "" });
      setConfidence({});
      setErrors({});
      setReviewed(false);
      setNotes([]);
    } else router.back();
  };

  return (
    <Screen testID="label">
      {queue.length > 0 && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
          <Pill label={`${index + 1} / ${queue.length}`} tone="primary" />
          <Text style={[ty.bodyStrong, { color: c.text }]}>{code}</Text>
        </View>
      )}
      <Card>
        <Button label={t("label.capture")} icon="camera" size="lg" onPress={() => void capture()} disabled={busy} testID="label-capture" />
        {busy && (
          <View style={{ flexDirection: "row", gap: space.sm, alignItems: "center" }}>
            <ActivityIndicator />
            <Text style={[ty.small, { color: c.textMuted }]}>{t("label.processing")}</Text>
          </View>
        )}
        {notes.map((n) => (
          <Banner key={n} text={n} tone="neutral" />
        ))}
      </Card>
      <SectionTitle>{reviewed ? t("label.review") : t("addStop.title")}</SectionTitle>
      <StopForm value={value} onChange={setValue} errors={errors} depot={depot} existing={stops} confidence={confidence} />
      <Button label={t("label.save")} size="lg" icon="checkmark" onPress={save} disabled={!tour} testID="label-save" />
    </Screen>
  );
}
