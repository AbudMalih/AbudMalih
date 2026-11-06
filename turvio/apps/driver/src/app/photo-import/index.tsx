import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";
import { Banner, Button, Card, Field, Pill, Screen, SectionTitle, Sheet } from "../../components/ui";
import { feedback } from "../../lib/haptics";
import { useT } from "../../lib/i18n";
import {
  draftsFromExtraction,
  geocodeDrafts,
  markDuplicates,
  pickImages,
  positionOf,
  readImage,
  readText,
  readiness,
  toStopInput,
  type ImageSource,
  type ImportDraft,
} from "../../lib/photoImport";
import { consumeSharedItems } from "../../lib/share";
import { useImportStore } from "../../store/importStore";
import { auth, isServerMode, useTourStore } from "../../store/tourStore";
import { useMyTour } from "../../store/useMyTour";
import { space, type as ty, useTheme } from "../../theme";

const LOW = new Set(["low", "none"]);

/**
 * Stops from photos and screenshots: Camera / Gallery → every address found becomes a card →
 * driver checks (tap to correct) → "Add N stops" → optional re-optimization.
 */
export default function PhotoImport() {
  const t = useT();
  const { c } = useTheme();
  const params = useLocalSearchParams<{ shared?: string }>();
  const { tour, depot, stops } = useMyTour();
  const addStops = useTourStore((s) => s.addStops);
  const { drafts, notes, setDrafts, update, addNotes, nextImage, reset } = useImportStore();
  const [busy, setBusy] = useState<{ n: number; total: number } | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasted, setPasted] = useState("");
  const started = useRef(false);

  // Fresh session per visit; then items shared from other apps (Phase B), if any.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    reset();
    if (params.shared) void processShared();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finish = async (fresh: ImportDraft[]) => {
    const client = isServerMode() ? auth() : null;
    const located = await geocodeDrafts(client, [...useImportStore.getState().drafts, ...fresh]);
    setDrafts(markDuplicates(located, stops));
  };

  const processUris = async (uris: string[], ownsFiles = true) => {
    const fresh: ImportDraft[] = [];
    const msgs: string[] = [];
    for (let i = 0; i < uris.length; i++) {
      setBusy({ n: i + 1, total: uris.length });
      const n = nextImage();
      const { extraction, ocr } = await readImage(uris[i]!, ownsFiles);
      if (!ocr) msgs.push(t("photoImport.ocrUnavailable"));
      const d = draftsFromExtraction(extraction, n);
      if (!d.length) msgs.push(t("photoImport.none", { n }));
      if (extraction.unassignedTrackingNumbers.length) msgs.push(t("photoImport.unassigned", { n, codes: extraction.unassignedTrackingNumbers.map((x) => x.code).join(", ") }));
      fresh.push(...d);
    }
    addNotes([...msgs, t("photoImport.imagesDeleted")]);
    await finish(fresh);
    setBusy(null);
    if (fresh.length) feedback.success();
    else feedback.error();
  };

  const run = async (source: ImageSource) => {
    const { uris, denied } = await pickImages(source);
    if (denied) return addNotes([t("pod.cameraDenied")]);
    if (uris.length) await processUris(uris);
  };

  const readPasted = async () => {
    const text = pasted.trim();
    setPasteOpen(false);
    setPasted("");
    if (!text) return;
    const fresh = draftsFromExtraction(readText(text), 0);
    if (!fresh.length) addNotes([t("photoImport.noneText")]);
    await finish(fresh);
    if (fresh.length) feedback.success();
    else feedback.error();
  };

  async function processShared() {
    const items = await consumeSharedItems();
    const texts = items.filter((i) => i.kind === "text").map((i) => i.text);
    const fresh: ImportDraft[] = [];
    for (const text of texts) fresh.push(...draftsFromExtraction(readText(text), 0));
    if (texts.length) await finish(fresh);
    const images = items.filter((i) => i.kind === "image").map((i) => i.uri);
    if (images.length) await processUris(images, true);
    if (!items.length) addNotes([t("photoImport.sharedNothing")]);
  }

  const ready = drafts.filter((d) => readiness(d).ready);
  const waiting = drafts.filter((d) => readiness(d).reason === "needs_position_decision" || readiness(d).reason === "invalid");

  const save = () => {
    if (!tour || !ready.length) return;
    const r = addStops(tour.id, ready.map(toStopInput));
    feedback.success();
    reset();
    Alert.alert(t("photoImport.saved", { created: r.created, merged: r.merged }), t("photoImport.reoptimizeText"), [
      { text: t("photoImport.reoptimizeNo"), style: "cancel", onPress: () => router.back() },
      { text: t("photoImport.reoptimizeYes"), onPress: () => router.replace("/optimize") },
    ]);
  };

  return (
    <Screen testID="photo-import">
      <Card>
        <Text style={[ty.small, { color: c.textMuted }]}>{t("photoImport.intro")}</Text>
        <View style={{ gap: space.sm }}>
          <Button label={t("photoImport.camera")} icon="camera" size="lg" onPress={() => void run("camera")} disabled={!!busy || !tour} testID="pi-camera" />
          <Button label={t("photoImport.gallery")} icon="images-outline" size="lg" variant="secondary" onPress={() => void run("gallery")} disabled={!!busy || !tour} testID="pi-gallery" />
          <Button label={t("photoImport.paste")} icon="clipboard-outline" variant="ghost" onPress={() => setPasteOpen(true)} disabled={!!busy || !tour} testID="pi-paste" />
        </View>
        {busy && (
          <View style={{ flexDirection: "row", gap: space.sm, alignItems: "center" }}>
            <ActivityIndicator />
            <Text style={[ty.small, { color: c.textMuted }]}>{t("photoImport.reading", { n: busy.n, total: busy.total })}</Text>
          </View>
        )}
        {!tour && <Banner text={t("photoImport.noTour")} tone="warning" />}
        {notes.map((n) => (
          <Banner key={n} text={n} tone="neutral" />
        ))}
      </Card>

      {drafts.length > 0 && <SectionTitle>{t("photoImport.found", { n: drafts.length })}</SectionTitle>}
      {drafts.map((d) => (
        <DraftCard key={d.key} d={d} onToggle={() => update(d.key, { include: !d.include })} onSkipPosition={() => update(d.key, { withoutPosition: true })} />
      ))}

      {drafts.length > 0 && (
        <View style={{ gap: space.xs }}>
          {waiting.length > 0 && <Text style={[ty.small, { color: c.warningInk, textAlign: "center" }]}>{t("photoImport.waiting", { n: waiting.length })}</Text>}
          <Button label={t("photoImport.save", { n: ready.length, tour: tour?.name ?? "" })} size="lg" icon="checkmark" onPress={save} disabled={!ready.length || !tour} testID="pi-save" />
        </View>
      )}
      <Sheet visible={pasteOpen} onClose={() => setPasteOpen(false)} title={t("photoImport.paste")} testID="pi-paste-sheet">
        <Field label={t("photoImport.pasteHint")} value={pasted} onChangeText={setPasted} multiline autoFocus style={{ minHeight: 140 }} testID="pi-paste-input" />
        <Button label={t("photoImport.pasteRead")} icon="checkmark" size="lg" onPress={() => void readPasted()} disabled={!pasted.trim()} testID="pi-paste-read" />
      </Sheet>
    </Screen>
  );
}

function DraftCard({ d, onToggle, onSkipPosition }: { d: ImportDraft; onToggle: () => void; onSkipPosition: () => void }) {
  const t = useT();
  const { c } = useTheme();
  const v = d.values;
  const check = (Object.keys(d.confidence) as (keyof typeof d.confidence)[]).filter((k) => LOW.has(d.confidence[k]!) || (d.confidence[k] === "medium" && k !== "recipientName"));
  const r = readiness(d);
  const geo = d.geo;
  const pos = positionOf(d);
  return (
    <Card testID={`pi-draft-${d.key}`} onPress={() => router.push(`/photo-import/${d.key}`)}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: space.sm }}>
        <Text style={[ty.bodyStrong, { color: d.include ? c.text : c.textMuted, flex: 1 }]} numberOfLines={1}>
          {v.recipientName || t("photoImport.noName")}
        </Text>
        <Pill label={d.image ? t("photoImport.image", { n: d.image }) : t("photoImport.text")} />
        <Pressable onPress={onToggle} accessibilityRole="switch" accessibilityState={{ checked: d.include }} testID={`pi-toggle-${d.key}`} hitSlop={8}>
          <Pill label={d.include ? t("photoImport.include") : t("photoImport.skipped")} tone={d.include ? "primary" : "neutral"} icon={d.include ? "checkmark" : "close"} />
        </Pressable>
      </View>
      <Text style={[ty.body, { color: c.text }]}>
        {[v.street, v.houseNumber].filter(Boolean).join(" ") || "—"}, {[v.postalCode, v.city].filter(Boolean).join(" ") || "—"}
      </Text>
      {(d.kind !== "address" || d.tracking.length > 0) && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.xs }}>
          {d.kind !== "address" && <Pill label={t(`photoImport.kind.${d.kind}`)} tone="primary" />}
          {d.tracking.map((x) => (
            <Pill key={x.code} label={`${x.carrier === "unknown" ? "" : `${x.carrier.toUpperCase()} `}${x.code}`} tone={x.confidence === "high" ? "success" : "warning"} />
          ))}
        </View>
      )}
      {r.reason === "invalid" && <Banner text={t("photoImport.invalid")} tone="danger" />}
      {r.ready !== true && r.reason !== "invalid" && check.length > 0 && <Text style={[ty.small, { color: c.warningInk }]}>{t("photoImport.checkFields", { fields: check.map((k) => t(`photoImport.field.${k}` as never)).join(", ") })}</Text>}
      {d.include && (
        <Banner
          text={d.withoutPosition && !pos ? t("photoImport.positionLater") : t(`photoImport.geo.${geo.status}`)}
          tone={pos ? "success" : geo.status === "pending" ? "neutral" : "warning"}
          icon={pos ? "location" : "location-outline"}
          action={!pos && !d.withoutPosition && geo.status !== "pending" ? { label: geo.status === "confirm" ? t("photoImport.confirmPosition") : t("photoImport.setPin"), onPress: () => router.push(`/photo-import/${d.key}`) } : undefined}
        />
      )}
      {d.include && !pos && !d.withoutPosition && geo.status !== "pending" && (
        <Pressable onPress={onSkipPosition} testID={`pi-nopos-${d.key}`}>
          <Text style={[ty.small, { color: c.primary }]}>{t("photoImport.withoutPosition")}</Text>
        </Pressable>
      )}
      {d.duplicates.map((x) => (
        <Banner key={`${x.kind}${x.stopId ?? ""}${x.trackingNumber ?? ""}`} text={t(`photoImport.dup.${x.kind}`, { code: x.trackingNumber ?? "" })} tone={x.kind === "open_stop_same_address" ? "primary" : "warning"} icon="git-merge-outline" />
      ))}
      {d.warnings
        .filter((w) => w === "post_number_missing" || w === "parcel_shop" || w === "multiple_addresses" || w === "care_of")
        .map((w) => (
          <Text key={w} style={[ty.small, { color: c.warningInk }]}>
            {t(`photoImport.warning.${w}` as never)}
          </Text>
        ))}
    </Card>
  );
}
