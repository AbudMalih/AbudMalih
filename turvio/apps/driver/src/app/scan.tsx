import { PARCEL_BARCODE_TYPES, SCAN_BARCODE_TYPES, ScanSession, parcelIndex, scanStats, type ScanEntry, type ScanOutcome } from "@turvio/shared";
import { CameraView, useCameraPermissions } from "expo-camera";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, Animated, FlatList, Linking, Platform, Pressable, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, Ionicons, Sheet } from "../components/ui";
import { todayIso } from "../lib/format";
import { feedback } from "../lib/haptics";
import { useT } from "../lib/i18n";
import { useTourStore } from "../store/tourStore";
import { useMyTour } from "../store/useMyTour";
import { radii, space, type as ty, useTheme } from "../theme";

type Flash = { tone: "ok" | "new" | "dup" | "bad"; text: string } | null;

/**
 * Continuous parcel scanning: the camera stays open, every new barcode is
 * registered immediately (haptic + visual feedback), repeats of the same code
 * in front of the lens are ignored, real duplicates are flagged. Scans are
 * stored on the phone at once and synced in batches (works offline).
 */
export default function ScanScreen() {
  const t = useT();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { tour, stops } = useMyTour();
  const history = useTourStore((s) => (tour ? s.scans[tour.id] : undefined));
  const recordScans = useTourStore((s) => s.recordScans);
  const createRoute = useTourStore((s) => s.createRoute);
  const [permission, requestPermission] = useCameraPermissions();
  const [paused, setPaused] = useState(false);
  const [torch, setTorch] = useState(false);
  const [manual, setManual] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [flash, setFlash] = useState<Flash>(null);
  const [cameraError, setCameraError] = useState(false);
  const [, force] = useState(0);
  const flashAnim = useRef(new Animated.Value(0)).current;
  const buffer = useRef<ScanEntry[]>([]);
  const allTypes = useTourStore((s) => s.prefs.allBarcodeTypes ?? false);
  const [appActive, setAppActive] = useState(true);
  const lastScanAt = useRef(Date.now());
  const [idlePaused, setIdlePaused] = useState(false);

  // Battery: no camera while the app is in the background, auto-pause after 60 s without a scan.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => setAppActive(s === "active"));
    const idle = setInterval(() => {
      if (Date.now() - lastScanAt.current > 60_000) setIdlePaused(true);
    }, 5000);
    return () => {
      sub.remove();
      clearInterval(idle);
    };
  }, []);
  const cameraActive = !paused && !idlePaused && appActive;

  // A route is needed to attach scans to: create a personal route if there is none yet.
  useEffect(() => {
    if (!tour) createRoute(t("route.defaultName", { date: todayIso() }), todayIso());
  }, [tour, createRoute, t]);

  const session = useMemo(() => new ScanSession({ known: parcelIndex(stops), entries: history ?? [] }), [tour?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const flush = useCallback(() => {
    if (!tour || !buffer.current.length) return;
    recordScans(tour.id, buffer.current);
    buffer.current = [];
  }, [tour, recordScans]);

  // Batch sync: every 3 s and when leaving the scanner.
  useEffect(() => {
    const timer = setInterval(flush, 3000);
    return () => {
      clearInterval(timer);
      flush();
    };
  }, [flush]);

  const show = (f: NonNullable<Flash>) => {
    setFlash(f);
    flashAnim.setValue(1);
    Animated.timing(flashAnim, { toValue: 0, duration: 1400, delay: 300, useNativeDriver: true }).start();
  };

  const handle = (outcome: ScanOutcome) => {
    if (outcome.kind !== "repeat") lastScanAt.current = Date.now();
    switch (outcome.kind) {
      case "repeat":
        return;
      case "invalid":
        feedback.error();
        return show({ tone: "bad", text: t("scan.invalid") });
      case "duplicate":
        feedback.warning();
        return show({ tone: "dup", text: `${t("scan.duplicate")} · ${outcome.entry.code}` });
      case "matched": {
        feedback.success();
        buffer.current.push(outcome.entry);
        const n = stops.findIndex((s) => s.id === outcome.entry.stopId) + 1;
        show({ tone: "ok", text: `${t("scan.onRoute", { n })} · ${outcome.entry.code}` });
        break;
      }
      case "unknown":
        feedback.success();
        buffer.current.push(outcome.entry);
        show({ tone: "new", text: `${t("scan.newParcel")} · ${outcome.entry.code}` });
        break;
    }
    force((x) => x + 1);
  };

  const onBarcode = ({ data, type }: { data: string; type: string }) => {
    if (!cameraActive) return;
    handle(session.handle(data, type, "camera"));
  };

  const addManual = () => {
    if (!manual.trim()) return;
    handle(session.handle(manual, "manual", "manual"));
    setManual("");
  };

  const finish = () => {
    flush();
    router.back();
  };

  const unknown = session.entries.filter((e) => !e.stopId);
  const toneColor = (tone: NonNullable<Flash>["tone"]) => (tone === "ok" ? c.success : tone === "new" ? c.primary : tone === "dup" ? c.warning : c.danger);
  const cameraUsable = permission?.granted && !cameraError;

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }} testID="scanner">
      {cameraUsable ? (
        <CameraView
          style={{ flex: 1 }}
          facing="back"
          enableTorch={torch}
          active={cameraActive}
          autofocus="on"
          barcodeScannerSettings={{ barcodeTypes: allTypes ? [...SCAN_BARCODE_TYPES] : PARCEL_BARCODE_TYPES }}
          onBarcodeScanned={cameraActive ? onBarcode : undefined}
          onMountError={() => setCameraError(true)}
        />
      ) : (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: space.xl, gap: space.md }}>
          <Ionicons name="camera-outline" size={44} color="#FFFFFF" />
          <Text style={[ty.h2, { color: "#FFFFFF", textAlign: "center" }]}>{cameraError ? t("scan.noCamera") : t("scan.permissionTitle")}</Text>
          {!cameraError && <Text style={[ty.small, { color: "rgba(255,255,255,0.75)", textAlign: "center" }]}>{t("scan.permissionText")}</Text>}
          {!cameraError && permission && !permission.granted && (
            permission.canAskAgain ? (
              <Button label={t("scan.allowCamera")} icon="camera" onPress={() => void requestPermission()} testID="allow-camera" />
            ) : (
              <Button label={t("scan.openSettings")} icon="settings-outline" onPress={() => void Linking.openSettings()} />
            )
          )}
        </View>
      )}

      {/* Top bar */}
      <View style={{ position: "absolute", top: insets.top + space.sm, left: space.md, right: space.md, flexDirection: "row", alignItems: "center", gap: space.sm }}>
        <Pressable onPress={finish} accessibilityRole="button" accessibilityLabel={t("common.close")} style={pill} testID="scan-close">
          <Ionicons name="close" size={22} color="#FFFFFF" />
        </Pressable>
        <View style={[pill, { flex: 1, flexDirection: "column", alignItems: "flex-start", justifyContent: "center", paddingHorizontal: space.md, height: 52 }]}>
          <Text style={[ty.bodyStrong, { color: "#FFFFFF" }]} testID="scan-count">
            {t("scan.count", { n: session.count })}
          </Text>
          <Text style={[ty.small, { color: "rgba(255,255,255,0.8)", fontSize: 12 }]}>
            {t("scan.matched", { n: session.matchedCount })} · {t("scan.unknown", { n: session.unknownCount })}
          </Text>
        </View>
        {cameraUsable && Platform.OS !== "web" && (
          <Pressable onPress={() => setTorch(!torch)} accessibilityRole="switch" accessibilityState={{ checked: torch }} accessibilityLabel={t("scan.torch")} style={[pill, torch && { backgroundColor: c.warning }]} testID="scan-torch">
            <Ionicons name={torch ? "flashlight" : "flashlight-outline"} size={20} color="#FFFFFF" />
          </Pressable>
        )}
        <Pressable
          onPress={() => {
            lastScanAt.current = Date.now();
            if (idlePaused) return setIdlePaused(false);
            setPaused(!paused);
          }}
          accessibilityRole="button"
          accessibilityLabel={paused || idlePaused ? t("scan.resume") : t("scan.pause")}
          style={[pill, (paused || idlePaused) && { backgroundColor: c.primary }]}
          testID="scan-pause"
        >
          <Ionicons name={paused || idlePaused ? "play" : "pause"} size={20} color="#FFFFFF" />
        </Pressable>
      </View>

      {/* Viewfinder */}
      {idlePaused && (
        <View pointerEvents="none" style={{ position: "absolute", top: "45%", left: space.lg, right: space.lg, alignItems: "center" }}>
          <Text style={[ty.bodyStrong, { color: "#FFFFFF", textAlign: "center" }]}>{t("scan.idlePaused")}</Text>
        </View>
      )}
      {cameraUsable && (
        <View pointerEvents="none" style={{ position: "absolute", top: "30%", left: "12%", right: "12%", height: 170, borderRadius: radii.lg, borderWidth: 3, borderColor: paused ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.9)" }} />
      )}

      {/* Feedback */}
      {flash && (
        <Animated.View pointerEvents="none" style={{ position: "absolute", top: insets.top + 72, left: space.lg, right: space.lg, zIndex: 5, opacity: flashAnim, transform: [{ scale: flashAnim.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) }] }}>
          <View style={{ backgroundColor: toneColor(flash.tone), borderRadius: radii.lg, padding: space.md, flexDirection: "row", alignItems: "center", gap: space.sm }} testID="scan-feedback">
            <Ionicons name={flash.tone === "ok" ? "checkmark-circle" : flash.tone === "new" ? "add-circle" : flash.tone === "dup" ? "copy" : "alert-circle"} size={24} color="#FFFFFF" />
            <Text style={[ty.bodyStrong, { color: "#FFFFFF", flex: 1 }]} numberOfLines={2}>
              {flash.text}
            </Text>
          </View>
        </Animated.View>
      )}

      {/* Bottom panel */}
      <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: c.card, borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl, padding: space.lg, paddingBottom: insets.bottom + space.lg, gap: space.sm }}>
        {session.count === 0 && <Text style={[ty.small, { color: c.textMuted }]}>{t("scan.empty")}</Text>}
        <View style={{ flexDirection: "row", gap: space.sm }}>
          <TextInput
            value={manual}
            onChangeText={setManual}
            onSubmitEditing={addManual}
            placeholder={t("scan.manualPlaceholder")}
            placeholderTextColor={c.textSubtle}
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="done"
            style={[ty.body, { flex: 1, minHeight: 50, borderRadius: radii.md, borderWidth: 1, borderColor: c.border, paddingHorizontal: space.md, color: c.text, backgroundColor: c.bg }]}
            accessibilityLabel={t("scan.manual")}
            testID="scan-manual-input"
          />
          <Button label={t("scan.add")} onPress={addManual} disabled={!manual.trim()} testID="scan-manual-add" />
        </View>
        <View style={{ flexDirection: "row", gap: space.sm }}>
          <Button label={t("scan.history")} variant="secondary" icon="list" onPress={() => setShowHistory(true)} style={{ flex: 1 }} testID="scan-history" />
          <Button label={t("scan.finish", { n: session.count })} icon="checkmark" onPress={finish} style={{ flex: 1 }} testID="scan-finish" />
        </View>
        {unknown.length > 0 && (
          <Button
            label={t("scan.createStops", { n: unknown.length })}
            variant="secondary"
            icon="add-circle-outline"
            onPress={() => {
              flush();
              router.replace({ pathname: "/label", params: { codes: unknown.map((e) => e.code).join(",") } });
            }}
            testID="scan-create-stops"
          />
        )}
        <Text style={[ty.small, { color: c.textSubtle, fontSize: 12 }]}>{t("scan.offlineNote")}</Text>
      </View>

      <Sheet visible={showHistory} onClose={() => setShowHistory(false)} title={t("scan.history")}>
        {(() => {
          const st = scanStats(session.entries);
          return (
            <Text style={[ty.small, { color: c.textMuted }]} testID="scan-stats">
              {t("scan.stats", { n: st.scanned, dup: st.duplicates, rate: st.perMinute ?? "–", gap: st.medianIntervalSeconds ?? "–" })}
            </Text>
          );
        })()}
        <FlatList
          data={session.entries}
          scrollEnabled={false}
          keyExtractor={(e) => e.code}
          renderItem={({ item }) => (
            <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm, paddingVertical: 8 }}>
              <Ionicons name={item.stopId ? "checkmark-circle" : "add-circle-outline"} size={20} color={item.stopId ? c.success : c.primary} />
              <Text style={[ty.body, { color: c.text, flex: 1 }]}>{item.code}</Text>
              <Text style={[ty.small, { color: c.textMuted }]}>
                {item.source === "manual" ? "⌨" : item.format}
                {item.repeats ? ` · ×${item.repeats + 1}` : ""}
              </Text>
            </View>
          )}
        />
      </Sheet>
    </View>
  );
}

const pill = { minWidth: 48, height: 48, borderRadius: 24, backgroundColor: "rgba(15,23,42,0.72)", alignItems: "center" as const, justifyContent: "center" as const, flexDirection: "row" as const };
