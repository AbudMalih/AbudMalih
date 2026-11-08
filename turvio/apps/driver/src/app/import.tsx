import { MAX_PARCELS_PER_STOP, parseDelimited, parseXlsx, planImport, rowsFromPastedText, rowsFromTable, summarizeImport, validateImportRow, XlsxError, type ImportRow } from "@turvio/shared";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
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
  const [resolutions, setResolutions] = useState<Record<string, number | "skip">>({});
  /** Company-wide check (server mode, online): parcels already planned or delivered elsewhere. */
  const [existing, setExisting] = useState<{ state: "idle" | "busy" | "done" | "offline"; found: { trackingNumber: string; blocking: boolean; tourName: string | null; stopStatus: string }[] }>({ state: "idle", found: [] });
  const [leaveOutExisting, setLeaveOutExisting] = useState(false);

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

  // Never throws: conflicts, duplicates and oversized stops are reported, not dropped.
  const plan = useMemo(() => (rows ? planImport(rows, resolutions) : null), [rows, resolutions]);
  const groups = useMemo(() => plan?.groups ?? [], [plan]);
  const summary = useMemo(() => (rows && plan ? summarizeImport(rows, groups, plan) : null), [rows, groups, plan]);
  const tracking = useMemo(() => [...new Set(groups.flatMap((g) => g.input.parcels?.map((p) => p.trackingNumber) ?? []))], [groups]);
  useEffect(() => {
    setLeaveOutExisting(false);
    if (!tracking.length || !tour || !isServerMode()) {
      setExisting({ state: "idle", found: [] });
      return;
    }
    let alive = true;
    setExisting({ state: "busy", found: [] });
    auth()
      .request<{ found: { trackingNumber: string; blocking: boolean; tourName: string | null; stopStatus: string }[] }>("POST", `/v1/orgs/${tour.organizationId}/parcels/lookup`, { trackingNumbers: tracking.slice(0, 5000) })
      .then((r) => alive && setExisting({ state: "done", found: r.found }))
      .catch(() => alive && setExisting({ state: "offline", found: [] }));
    return () => {
      alive = false;
    };
  }, [tracking, tour]);
  const blockingExisting = useMemo(() => existing.found.filter((f) => f.blocking), [existing.found]);
  const leftOut = useMemo(() => new Set(leaveOutExisting ? blockingExisting.map((f) => f.trackingNumber.toUpperCase()) : []), [leaveOutExisting, blockingExisting]);
  const inputs = useMemo(
    () =>
      groups
        .map((g) => {
          const parcels = (g.input.parcels ?? []).filter((p) => !leftOut.has(p.trackingNumber.toUpperCase()));
          return g.input.parcels?.length && !parcels.length ? null : { ...g.input, parcels, trackingNumbers: parcels.map((p) => p.trackingNumber) };
        })
        .filter((x): x is NonNullable<typeof x> => !!x),
    [groups, leftOut],
  );
  const blockedBy = !plan
    ? null
    : plan.unresolved
      ? t("import.blockedConflicts", { n: plan.unresolved })
      : plan.blockingGroups
        ? t("import.tooMany", { n: plan.blockingGroups, max: MAX_PARCELS_PER_STOP })
        : existing.state === "busy"
          ? t("import.checking")
          : blockingExisting.length && !leaveOutExisting
            ? t("import.alreadyPlanned", { n: blockingExisting.length })
            : null;
  // Problem rows first; long files show the first 50 others (all rows are imported).
  const shownRows = useMemo(() => (rows ? [...rows.filter((r) => r.errors.length), ...rows.filter((r) => !r.errors.length).slice(0, 50)] : []), [rows]);
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
    if (!tour || !inputs.length) return;
    if (blockedBy) return;
    const r = addStops(tour.id, inputs);
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
            {!!plan?.blockingGroups && <Banner text={t("import.tooMany", { n: plan.blockingGroups, max: MAX_PARCELS_PER_STOP })} tone="danger" />}
            {existing.state === "offline" && <Banner text={t("import.notChecked")} tone="warning" />}
            {blockingExisting.length > 0 && (
              <View testID="import-existing" style={{ gap: space.sm }}>
                <Banner
                  text={`${t("import.alreadyPlanned", { n: blockingExisting.length })} ${blockingExisting
                    .slice(0, 5)
                    .map((f) => `${f.trackingNumber} (${f.tourName ?? t("import.otherDepot")}, ${f.stopStatus})`)
                    .join(", ")}${blockingExisting.length > 5 ? " …" : ""}`}
                  tone="danger"
                />
                <Button
                  label={leaveOutExisting ? t("import.includeExisting") : t("import.leaveOutExisting", { n: blockingExisting.length })}
                  variant="secondary"
                  onPress={() => setLeaveOutExisting((v) => !v)}
                  testID="import-leave-out"
                />
              </View>
            )}
          </Card>
          {!!plan?.conflicts.length && (
            <Card testID="import-conflicts">
              <Text style={[ty.bodyStrong, { color: c.dangerInk }]}>{t("import.conflicts", { n: plan.conflicts.length })}</Text>
              {plan.conflicts.map((cf) => (
                <View key={cf.trackingNumber} style={{ gap: space.xs }}>
                  <Text style={[ty.small, { color: c.text }]}>{cf.trackingNumber}</Text>
                  {cf.options.map((o) => (
                    <Button
                      key={o.line}
                      label={`${cf.resolution === o.line ? "✓ " : ""}${t("import.rowError", { line: o.line })}: ${o.address}`}
                      variant={cf.resolution === o.line ? "primary" : "secondary"}
                      onPress={() => setResolutions((x) => ({ ...x, [cf.trackingNumber]: o.line }))}
                      testID={`conflict-${cf.trackingNumber}-${o.line}`}
                    />
                  ))}
                  <Button
                    label={`${cf.resolution === "skip" ? "✓ " : ""}${t("import.leaveOut")}`}
                    variant="ghost"
                    onPress={() => setResolutions((x) => ({ ...x, [cf.trackingNumber]: "skip" }))}
                    testID={`conflict-${cf.trackingNumber}-skip`}
                  />
                </View>
              ))}
            </Card>
          )}
          <SectionTitle>{t("import.preview")}</SectionTitle>
          {shownRows.map((r) => (
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
          {rows.length > shownRows.length && <Text style={[ty.small, { color: c.textMuted }]}>{t("import.moreRows", { n: rows.length - shownRows.length })}</Text>}
          {blockedBy && <Banner text={blockedBy} tone="warning" />}
          <Button label={t("import.run", { n: inputs.length })} size="lg" icon="download-outline" onPress={run} disabled={!inputs.length || !tour || !!blockedBy} testID="import-run" />
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
