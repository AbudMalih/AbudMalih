import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";
import { ActionTile, Banner, BottomBar, Button, Card, Checkbox, Field, Ionicons, Pill, Screen, Sheet, type IconName } from "../../components/ui";
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

  const allSelected = drafts.length > 0 && drafts.every((d) => d.include);
  const disabled = !!busy || !tour;

  return (
    <Screen
      testID="photo-import"
      footer={
        drafts.length > 0 ? (
          <BottomBar>
            {waiting.length > 0 && <Text style={[ty.small, { color: c.warningInk, textAlign: "center" }]}>{t("photoImport.waiting", { n: waiting.length })}</Text>}
            <Button label={t("photoImport.save", { n: ready.length, tour: tour?.name ?? "" })} size="lg" icon="checkmark" onPress={save} disabled={!ready.length || !tour} testID="pi-save" />
          </BottomBar>
        ) : undefined
      }
    >
      <Text style={[ty.small, { color: c.textMuted }]}>{t("photoImport.intro")}</Text>
      <View style={{ flexDirection: "row", gap: space.sm }}>
        <ActionTile icon="camera" label={t("photoImport.camera")} onPress={() => void run("camera")} disabled={disabled} testID="pi-camera" tone="primary" />
        <ActionTile icon="images-outline" label={t("photoImport.gallery")} onPress={() => void run("gallery")} disabled={disabled} testID="pi-gallery" />
        <ActionTile icon="clipboard-outline" label={t("photoImport.paste")} onPress={() => setPasteOpen(true)} disabled={disabled} testID="pi-paste" />
      </View>

      {busy && (
        <Card style={{ flexDirection: "row", alignItems: "center", gap: space.md }} testID="pi-busy">
          <ActivityIndicator color={c.primary} />
          <Text style={[ty.smallStrong, { color: c.text, flex: 1 }]}>{t("photoImport.reading", { n: busy.n, total: busy.total })}</Text>
        </Card>
      )}
      {!tour && <Banner text={t("photoImport.noTour")} tone="warning" />}
      {notes.map((n) => (
        <Banner key={n} text={n} tone="neutral" />
      ))}

      {drafts.length > 0 && (
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: space.xs }}>
          <Text style={[ty.caption, { color: c.textMuted, textTransform: "uppercase" }]}>{t("photoImport.found", { n: drafts.length })}</Text>
          <Pressable onPress={() => drafts.forEach((d) => update(d.key, { include: !allSelected }))} hitSlop={10} accessibilityRole="button" testID="pi-select-all">
            <Text style={[ty.smallStrong, { color: c.primary }]}>{allSelected ? t("photoImport.selectNone") : t("photoImport.selectAll")}</Text>
          </Pressable>
        </View>
      )}
      {drafts.map((d) => (
        <DraftCard key={d.key} d={d} onToggle={() => update(d.key, { include: !d.include })} onSkipPosition={() => update(d.key, { withoutPosition: true })} />
      ))}

      <Sheet visible={pasteOpen} onClose={() => setPasteOpen(false)} title={t("photoImport.paste")} testID="pi-paste-sheet">
        <Field label={t("photoImport.pasteHint")} value={pasted} onChangeText={setPasted} multiline autoFocus style={{ minHeight: 140 }} testID="pi-paste-input" />
        <Button label={t("photoImport.pasteRead")} icon="checkmark" size="lg" onPress={() => void readPasted()} disabled={!pasted.trim()} testID="pi-paste-read" />
      </Sheet>
    </Screen>
  );
}

/** One address found in an image or text: select, see what needs attention, tap to correct. */
function DraftCard({ d, onToggle, onSkipPosition }: { d: ImportDraft; onToggle: () => void; onSkipPosition: () => void }) {
  const t = useT();
  const { c } = useTheme();
  const v = d.values;
  const check = (Object.keys(d.confidence) as (keyof typeof d.confidence)[]).filter((k) => LOW.has(d.confidence[k]!) || (d.confidence[k] === "medium" && k !== "recipientName"));
  const r = readiness(d);
  const geo = d.geo;
  const pos = positionOf(d);
  const needsDecision = d.include && !pos && !d.withoutPosition && geo.status !== "pending";
  const geoTone = pos ? c.successInk : geo.status === "pending" ? c.textMuted : c.warningInk;
  const edit = () => router.push(`/photo-import/${d.key}`);
  return (
    <Card testID={`pi-draft-${d.key}`} style={{ gap: space.sm, opacity: d.include ? 1 : 0.6, padding: space.md }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: space.md }}>
        <View style={{ paddingTop: 2 }}>
          <Checkbox checked={d.include} onChange={onToggle} label={v.recipientName || t("photoImport.noName")} testID={`pi-toggle-${d.key}`} />
        </View>
        <Pressable onPress={edit} style={{ flex: 1, gap: 2 }} accessibilityRole="button" accessibilityHint={t("photoImport.edit")}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
            <Text style={[ty.bodyStrong, { color: c.text, flex: 1 }]} numberOfLines={1}>
              {v.recipientName || t("photoImport.noName")}
            </Text>
            <Text style={[ty.caption, { color: c.textSubtle, letterSpacing: 0 }]}>{d.image ? t("photoImport.image", { n: d.image }) : t("photoImport.text")}</Text>
          </View>
          <Text style={[ty.small, { color: c.textSecondary }]} numberOfLines={2}>
            {[v.street, v.houseNumber].filter(Boolean).join(" ") || "—"}, {[v.postalCode, v.city].filter(Boolean).join(" ") || "—"}
          </Text>
        </Pressable>
        <Pressable onPress={edit} hitSlop={10} accessibilityRole="button" accessibilityLabel={t("photoImport.edit")} style={{ paddingTop: 2 }}>
          <Ionicons name="create-outline" size={20} color={c.textMuted} />
        </Pressable>
      </View>

      {(d.kind !== "address" || d.tracking.length > 0) && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.xs, paddingLeft: 36 }}>
          {d.kind !== "address" && <Pill label={t(`photoImport.kind.${d.kind}`)} tone="primary" />}
          {d.tracking.map((x) => (
            <Pill key={x.code} label={`${x.carrier === "unknown" ? "" : `${x.carrier.toUpperCase()} `}${x.code}`} tone={x.confidence === "high" ? "success" : "warning"} />
          ))}
        </View>
      )}

      {d.include && (
        <View style={{ paddingLeft: 36, gap: space.xs }}>
          {r.reason === "invalid" && <IssueLine icon="alert-circle" color={c.dangerInk} text={t("photoImport.invalid")} />}
          {r.ready !== true && r.reason !== "invalid" && check.length > 0 && <IssueLine icon="eye-outline" color={c.warningInk} text={t("photoImport.checkFields", { fields: check.map((k) => t(`photoImport.field.${k}` as never)).join(", ") })} />}
          <IssueLine icon={pos ? "location" : geo.status === "pending" ? "time-outline" : "location-outline"} color={geoTone} text={d.withoutPosition && !pos ? t("photoImport.positionLater") : t(`photoImport.geo.${geo.status}`)} strong />
          {d.duplicates.map((x) => (
            <IssueLine key={`${x.kind}${x.stopId ?? ""}${x.trackingNumber ?? ""}`} icon="git-merge-outline" color={x.kind === "open_stop_same_address" ? c.primary : c.warningInk} text={t(`photoImport.dup.${x.kind}`, { code: x.trackingNumber ?? "" })} strong />
          ))}
          {needsDecision && (
            <View style={{ flexDirection: "row", gap: space.lg, flexWrap: "wrap" }}>
              <Pressable onPress={edit} hitSlop={8} accessibilityRole="button">
                <Text style={[ty.smallStrong, { color: c.primary }]}>{geo.status === "confirm" ? t("photoImport.confirmPosition") : t("photoImport.setPin")}</Text>
              </Pressable>
              <Pressable onPress={onSkipPosition} hitSlop={8} accessibilityRole="button" testID={`pi-nopos-${d.key}`}>
                <Text style={[ty.small, { color: c.textMuted, textDecorationLine: "underline" }]}>{t("photoImport.withoutPosition")}</Text>
              </Pressable>
            </View>
          )}
          {d.warnings
            .filter((w) => w === "post_number_missing" || w === "parcel_shop" || w === "multiple_addresses" || w === "care_of")
            .map((w) => (
              <IssueLine key={w} icon="warning-outline" color={c.warningInk} text={t(`photoImport.warning.${w}` as never)} />
            ))}
        </View>
      )}
    </Card>
  );
}

function IssueLine({ icon, color, text, strong }: { icon: IconName; color: string; text: string; strong?: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: space.xs }}>
      <Ionicons name={icon} size={15} color={color} style={{ marginTop: 1 }} />
      <Text style={[strong ? ty.smallStrong : ty.small, { color, flex: 1 }]}>{text}</Text>
    </View>
  );
}
