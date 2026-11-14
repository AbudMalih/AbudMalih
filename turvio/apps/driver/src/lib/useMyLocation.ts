import { useCallback, useRef, useState } from "react";
import { Linking } from "react-native";
import { useT } from "./i18n";
import { currentPosition, lastKnownPosition, requestLocationPermission } from "./location";
import { useTrackingStatus } from "./tracking";

export interface LocationNotice {
  text: string;
  tone: "neutral" | "warning";
  action?: { label: string; onPress: () => void };
}

/**
 * Map "My location": permission (asked when it still can be) → instant centre on the last known fix →
 * fresh high-accuracy fix (12 s) → centre again unless the driver panned/zoomed meanwhile.
 * Failures are reported with Retry / Settings – never silently ignored. Sends nothing anywhere.
 */
export function useMyLocation() {
  const t = useT();
  const tracking = useTrackingStatus((s) => s.state);
  const [showMe, setShowMe] = useState(false);
  const [locating, setLocating] = useState(false);
  const [focus, setFocus] = useState<{ lat: number; lng: number; n: number } | null>(null);
  const [notice, setNotice] = useState<LocationNotice | null>(null);
  // The driver's own pans/zooms since the tap: a fresh fix only moves the camera if there were none.
  const gestures = useRef(0);
  const run = useRef(0);

  const center = (lat: number, lng: number) => setFocus((f) => ({ lat, lng, n: (f?.n ?? 0) + 1 }));

  const locate = useCallback(async (): Promise<void> => {
    const id = ++run.current;
    setNotice(null);
    setLocating(true);
    try {
      const perm = await requestLocationPermission();
      if (perm !== "granted") {
        setNotice({
          text: t("map.locationDenied"),
          tone: "warning",
          action: perm === "blocked" ? { label: t("map.openSettings"), onPress: () => void Linking.openSettings() } : { label: t("map.retry"), onPress: () => void locate() },
        });
        return;
      }
      setShowMe(true);
      const startGestures = gestures.current;
      const last = await lastKnownPosition();
      if (id !== run.current) return;
      if (last?.ok) center(last.point.lat, last.point.lng);
      const fresh = await currentPosition(false, { precise: true, timeoutMs: 12_000 });
      if (id !== run.current) return;
      if (fresh.ok) {
        if (gestures.current === startGestures) center(fresh.point.lat, fresh.point.lng);
        // What showing the position means for privacy – accurate for the current tracking state.
        setNotice({ text: useTrackingStatus.getState().state === "active" ? t("map.positionTracked") : t("map.positionLocal"), tone: "neutral" });
      } else {
        setNotice({ text: last?.ok ? t("map.lastKnownOnly") : t("map.locationUnavailable"), tone: "warning", action: { label: t("map.retry"), onPress: () => void locate() } });
      }
    } finally {
      if (id === run.current) setLocating(false);
    }
  }, [t]);

  return { showMe, setShowMe, locating, focus, notice, locate, onUserGesture: () => void (gestures.current += 1), tracking };
}
