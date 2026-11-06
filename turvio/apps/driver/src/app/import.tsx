import { groupImportRows, parseDelimited, parseXlsx, rowsFromPastedText, rowsFromTable, summarizeImport, validateImportRow, XlsxError, type ImportRow } from "@turvio/shared";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Platform, Text, TextInput, View } from "react-native";
import { Banner, Button, Card, Field, Ionicons, Pill, Screen, SectionTitle, Segmented, Sheet } from "../components/ui";
import { geocodeImportRows } from "../lib/geocode";
import { feedback } from "../lib/haptics";
import { useT } from "../lib/i18n";
import { auth, isServerMode, useTourStore } from "../store/tourStore";
import { useMyTour } from "../store/useMyTour";
import { radii, space, type as ty, useTheme } from "../theme";

async function readPicked(asset: DocumentPicker.DocumentPickerAsset): Promise<{ text?: string; bytes?: Uint8Array }> {
  const isXlsx = /\.xlsx?$/i.test(asset.name) || /spreadsheetml|ms-excel/.test(asset.mimeType ?? "");
  if (Platform.OS === "web") {
    const res = await fetch(asset.uri);
    return isXlsx ? { bytes: new Uint8Array(await res.arrayBuffer()) } : { text: await res.text() };
  }
  const f = new File(asset.uri);
  return isXlsx ? { bytes: await f.bytes() } : { text: await f.text() };
}

/** Paste / CSV / Excel import with preview, per-row correction and address grouping. */
export default function ImportScreen() {
  const t = useT();
  const { c } = useTheme();
  const { tour } = useMyTour();
  const addStops = useTourStore((s) => s.addStops);
  const [mode, setMode] = useState<"paste" | "file">("paste");
  const [text, setText] = useState("");
  const [rows, setRows] = useState<ImportRow[] | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<ImportRow | null>(null);
  const [geoBusy, setGeoBusy] = useState(false);

  const locate = async () => {
    if (!rows) return;
    setGeoBusy(true);
    const r = await geocodeImportRows(isServerMode() ? auth() : null, rows);
    setGeoBusy(false);
    const located = r.rows.map((row) => (row.location ? validateImportRow({ ...row, errors: [] }) : row));
    setRows(located);
    setError(
      r.status === "ok"
        ? t("import.located", { n: r.applied, street: r.streetOnly })
        : r.status === "unavailable"
          ? t("address.unavailable")
          : t("address.offline"),
    );
  };

  const groups = useMemo(() => (rows ? groupImportRows(rows) : []), [rows]);
  const summary = useMemo(() => (rows ? summarizeImport(rows, groups) : null), [rows, groups]);
  const errText = (codes: string[]) => codes.map((e) => t(`import.error.${e}` as never)).join(", ");

  const pick = async () => {
    setError(null);
    const r = await DocumentPicker.getDocumentAsync({
      type: ["text/csv", "text/comma-separated-values", "text/plain", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.ms-excel"],
      copyToCacheDirectory: true,
    });
    if (r.canceled || !r.assets[0]) return;
    const asset = r.assets[0];
    setFileName(asset.name);
    try {
      const data = await readPicked(asset);
      const table = data.bytes ? parseXlsx(data.bytes) : parseDelimited(data.text ?? "");
      setRows(rowsFromTable(table).rows);
    } catch (e) {
      setRows(null);
      setError(e instanceof XlsxError ? t(`import.error.${e.message}` as never) : e instanceof Error ? e.message : String(e));
    }
  };

  const run = () => {
    if (!tour || !groups.length) return;
    const r = addStops(tour.id, groups.map((g) => g.input));
    feedback.success();
    setRows(null);
    setText("");
    setError(t("import.done", { created: r.created, merged: r.merged }));
    setTimeout(() => router.back(), 600);
  };

  return (
    <Screen testID="import">
      <Segmented value={mode} onChange={(m) => { setMode(m); setRows(null); }} options={[{ value: "paste", label: t("import.paste") }, { value: "file", label: t("import.file") }]} />
      {mode === "paste" ? (
        <Card>
          <TextInput
            value={text}
            onChangeText={setText}
            multiline
            placeholder={t("import.pastePlaceholder")}
            placeholderTextColor={c.textSubtle}
            style={[ty.body, { minHeight: 150, color: c.text, textAlignVertical: "top", borderWidth: 1, borderColor: c.border, borderRadius: radii.md, padding: space.md }]}
            testID="import-text"
            accessibilityLabel={t("import.paste")}
          />
          <Button label={t("import.preview")} icon="eye-outline" onPress={() => setRows(rowsFromPastedText(text))} disabled={!text.trim()} testID="import-preview" />
        </Card>
      ) : (
        <Card>
          <Button label={t("import.chooseFile")} icon="folder-open-outline" onPress={() => void pick()} testID="import-file" />
          {fileName && <Pill label={fileName} icon="document-outline" />}
          <Text style={[ty.small, { color: c.textMuted }]}>{t("import.fileHint")}</Text>
        </Card>
      )}
      {error && <Banner text={error} tone={rows === null && error.includes("…") ? "danger" : "primary"} />}

      {rows && summary && (
        <>
          <Card testID="import-summary">
            <Text style={[ty.bodyStrong, { color: c.text }]}>{t("import.summary", { stops: summary.stops, parcels: summary.parcels, invalid: summary.invalid })}</Text>
            {summary.needsLocation > 0 && <Banner text={t("import.needsLocation", { n: summary.needsLocation })} tone="warning" icon="location-outline" />}
            {summary.needsLocation > 0 && <Button label={t("import.locate")} variant="secondary" icon="locate-outline" loading={geoBusy} onPress={() => void locate()} testID="import-locate" />}
            {summary.duplicates > 0 && <Banner text={t("import.duplicates", { n: summary.duplicates })} tone="warning" />}
          </Card>
          <SectionTitle>{t("import.preview")}</SectionTitle>
          {rows.map((r) => (
            <View key={r.line} style={{ flexDirection: "row", alignItems: "center", gap: space.sm, padding: space.md, borderRadius: radii.md, borderWidth: 1, borderColor: r.errors.length ? c.danger : c.border, backgroundColor: c.card }}>
              <Ionicons name={r.errors.length ? "alert-circle" : r.warnings.includes("needs_location") ? "location-outline" : "checkmark-circle"} size={20} color={r.errors.length ? c.danger : r.warnings.includes("needs_location") ? c.warning : c.success} />
              <View style={{ flex: 1 }}>
                <Text style={[ty.bodyStrong, { color: c.text }]} numberOfLines={1}>
                  {[r.street, r.houseNumber].filter(Boolean).join(" ") || "—"}, {r.postalCode} {r.city}
                </Text>
                <Text style={[ty.small, { color: r.errors.length ? c.dangerInk : c.textMuted }]} numberOfLines={2}>
                  {t("import.rowError", { line: r.line })}
                  {r.recipientName ? ` · ${r.recipientName}` : ""}
                  {r.trackingNumbers.length ? ` · ${r.trackingNumbers.length}📦` : ""}
                  {r.errors.length ? ` · ${errText(r.errors)}` : ""}
                </Text>
              </View>
              <Button label={t("common.edit")} variant="ghost" onPress={() => setEditing(r)} style={{ minHeight: 40, paddingHorizontal: 8 }} />
            </View>
          ))}
          <Button label={t("import.run", { n: summary.stops })} size="lg" icon="download-outline" onPress={run} disabled={!summary.stops || !tour} testID="import-run" />
        </>
      )}

      <Sheet visible={!!editing} onClose={() => setEditing(null)} title={editing ? t("import.rowError", { line: editing.line }) : ""}>
        {editing && (
          <>
            <Field label={t("addStop.recipient")} value={editing.recipientName ?? ""} onChangeText={(v) => setEditing({ ...editing, recipientName: v || undefined })} />
            <Field label={t("addStop.street")} value={editing.street} onChangeText={(v) => setEditing({ ...editing, street: v })} />
            <Field label={t("addStop.houseNumber")} value={editing.houseNumber ?? ""} onChangeText={(v) => setEditing({ ...editing, houseNumber: v || undefined })} />
            <Field label={t("addStop.postalCode")} value={editing.postalCode} onChangeText={(v) => setEditing({ ...editing, postalCode: v })} keyboardType="number-pad" />
            <Field label={t("addStop.city")} value={editing.city} onChangeText={(v) => setEditing({ ...editing, city: v })} />
            <View style={{ flexDirection: "row", gap: space.sm }}>
              <Button label={t("import.removeRow")} variant="danger" onPress={() => { setRows((rows ?? []).filter((x) => x.line !== editing.line)); setEditing(null); }} style={{ flex: 1 }} />
              <Button
                label={t("common.save")}
                onPress={() => {
                  const fixed = validateImportRow({ ...editing, errors: [] });
                  setRows((rows ?? []).map((x) => (x.line === editing.line ? fixed : x)));
                  setEditing(null);
                }}
                style={{ flex: 1 }}
              />
            </View>
          </>
        )}
      </Sheet>
    </Screen>
  );
}
