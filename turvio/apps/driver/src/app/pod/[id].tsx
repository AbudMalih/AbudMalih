import { SaveFormat, manipulateAsync } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { Image, Platform, Text, View } from "react-native";
import { SignaturePad } from "../../components/SignaturePad";
import { Banner, Button, Card, Field, Screen, SectionTitle } from "../../components/ui";
import { storePrivateCopy } from "../../lib/files";
import { feedback } from "../../lib/haptics";
import { uuid } from "../../lib/ids";
import { useT } from "../../lib/i18n";
import { currentPosition } from "../../lib/location";
import { useTourStore } from "../../store/tourStore";
import { useStop } from "../../store/useMyTour";
import { radii, space, type as ty, useTheme } from "../../theme";

/** Proof of delivery: photo + signature + name, captured offline-first. */
export default function ProofOfDelivery() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useT();
  const { c } = useTheme();
  const { stop, settings } = useStop(id);
  const captureProof = useTourStore((s) => s.captureProof);
  const setStopStatus = useTourStore((s) => s.setStopStatus);
  const [photo, setPhoto] = useState<{ uri: string; base64?: string } | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onSignature = useCallback((svg: string | null) => setSignature(svg), []);
  if (!stop) return null;

  const takePhoto = async () => {
    setError(null);
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted && Platform.OS !== "web") return setError(t("pod.cameraDenied"));
      const r = Platform.OS === "web"
        ? await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.6 })
        : await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.6, exif: false });
      if (r.canceled || !r.assets[0]) return;
      // Downscale + re-encode: strips EXIF metadata and keeps uploads small.
      const small = await manipulateAsync(r.assets[0].uri, [{ resize: { width: 1280 } }], { compress: 0.6, format: SaveFormat.JPEG, base64: Platform.OS === "web" });
      if (Platform.OS === "web") setPhoto({ uri: small.uri, base64: small.base64 });
      else setPhoto({ uri: await storePrivateCopy(small.uri, `${uuid()}.jpg`) });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const complete = async (withProof: boolean) => {
    setBusy(true);
    setError(null);
    try {
      if (withProof && (photo || signature)) {
        const loc = settings.podLocation ? await currentPosition(true) : null;
        await captureProof(stop.id, {
          photo: photo ?? undefined,
          signatureSvg: signature ?? undefined,
          recipientName: name.trim() || undefined,
          notes: notes.trim() || undefined,
          location: loc?.ok ? loc.point : undefined,
        });
      }
      setStopStatus(stop.id, "delivered", notes.trim() ? { notes: notes.trim() } : {});
      feedback.success();
      router.back();
    } catch (e) {
      feedback.error();
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen testID="pod">
      <Text style={[ty.title, { color: c.text }]} numberOfLines={2}>
        {stop.recipientName ?? stop.address.street}
      </Text>
      <Card>
        <SectionTitle>{t("pod.photo")}</SectionTitle>
        {photo ? (
          <Image source={{ uri: photo.base64 ? `data:image/jpeg;base64,${photo.base64}` : photo.uri }} style={{ width: "100%", height: 200, borderRadius: radii.md, backgroundColor: c.surface2 }} resizeMode="cover" accessibilityLabel={t("pod.photo")} />
        ) : null}
        <Button label={photo ? t("pod.retakePhoto") : t("pod.takePhoto")} variant="secondary" icon="camera" onPress={() => void takePhoto()} testID="pod-photo" />
      </Card>
      <Card>
        <SectionTitle>{t("pod.signature")}</SectionTitle>
        <SignaturePad onChange={onSignature} />
      </Card>
      <Field label={t("pod.recipientName")} value={name} onChangeText={setName} autoCapitalize="words" testID="pod-name" />
      <Field label={t("pod.notes")} value={notes} onChangeText={setNotes} testID="pod-notes" />
      {settings.podLocation && <Banner text={t("pod.locationOn")} tone="primary" icon="location-outline" />}
      {error && <Banner text={error} tone="danger" />}
      <Button label={t("pod.complete")} variant="success" size="lg" icon="checkmark-done" onPress={() => void complete(true)} loading={busy} disabled={!photo && !signature} testID="pod-complete" />
      <Button label={t("pod.skip")} variant="ghost" onPress={() => void complete(false)} disabled={busy} testID="pod-skip" />
      <View>
        <Text style={[ty.small, { color: c.textMuted, textAlign: "center" }]}>{t("pod.privacy")}</Text>
      </View>
    </Screen>
  );
}
