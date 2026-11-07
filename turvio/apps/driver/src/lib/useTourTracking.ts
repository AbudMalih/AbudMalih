import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { useT } from "./i18n";
import { startTracking, stopTracking, uploadNow, useTrackingStatus } from "./tracking";
import { isServerMode, useTourStore } from "../store/tourStore";
import { useMyTour } from "../store/useMyTour";

/**
 * Ties live tracking to the tour lifecycle: on while the driver's tour is "in progress",
 * off when it is paused, finished, when the driver signs out or the company switches it off.
 * Re-evaluated on app start and whenever the app returns to the foreground (restarts and
 * permission changes are picked up, no duplicate sessions).
 */
export function useTourTracking() {
  const t = useT();
  const user = useTourStore((s) => s.user);
  const { tours } = useMyTour();
  const onRoad = tours.find((x) => x.status === "in_progress");
  const key = isServerMode() && user && onRoad ? `${onRoad.organizationId}:${onRoad.id}` : null;
  const state = useTrackingStatus((s) => s.state);
  const askedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!key || !onRoad) {
      void stopTracking();
      return;
    }
    // Ask for permissions once per tour start; later checks only read them.
    const request = askedFor.current !== key;
    askedFor.current = key;
    void startTracking(
      {
        orgId: onRoad.organizationId,
        tourId: onRoad.id,
        tourName: onRoad.name,
        notificationTitle: t("tracking.notificationTitle"),
        notificationBody: t("tracking.notificationBody", { tour: onRoad.name }),
      },
      { requestPermissions: request },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (!key || !onRoad) return;
    const sub = AppState.addEventListener("change", (s) => {
      if (s !== "active") return;
      void uploadNow().catch(() => undefined);
      void startTracking(
        { orgId: onRoad.organizationId, tourId: onRoad.id, tourName: onRoad.name, notificationTitle: t("tracking.notificationTitle"), notificationBody: t("tracking.notificationBody", { tour: onRoad.name }) },
        { requestPermissions: false },
      );
    });
    // While the app is open: regular uploads (network back after a dead zone).
    const timer = setInterval(() => state === "active" && void uploadNow().catch(() => undefined), 30_000);
    return () => {
      sub.remove();
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, state]);
}
