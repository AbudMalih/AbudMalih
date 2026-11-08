import { boundingRegion, clusterForRegion, isOpen, isSuccess, type GeoPoint, type MapRegion, type Stop } from "@turvio/shared";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import Constants from "expo-constants";
import { Platform, StyleSheet, Text, View } from "react-native";
import MapView, { Marker, PROVIDER_DEFAULT, PROVIDER_GOOGLE, Polyline, type MapPressEvent } from "react-native-maps";
import { useT } from "../lib/i18n";
import { Ionicons } from "./ui";
import { useTheme, type Palette } from "../theme";
import { fallbackPath, initialMapPoints, markerTone, type TourMapProps } from "./TourMap.shared";
export type { TourMapProps };

type Located = Stop & { location: GeoPoint };

/** One stop marker; memoised and with tracksViewChanges off so panning does not re-render bitmaps. */
const StopMarker = memo(function StopMarker({ stop, index, current, c, onPress }: { stop: Located; index: number; current: boolean; c: Palette; onPress?: (s: Stop) => void }) {
  return (
    <Marker
      coordinate={{ latitude: stop.location.lat, longitude: stop.location.lng }}
      onPress={() => onPress?.(stop)}
      tracksViewChanges={false}
      zIndex={current ? 10 : isOpen(stop.status) ? 5 : 1}
    >
      <View style={[s.pin, stop.type === "pickup" && s.square, { backgroundColor: markerTone(stop, current, c), transform: [{ scale: current ? 1.25 : 1 }] }]}>
        <Text style={s.pinText}>{isOpen(stop.status) ? index + 1 : isSuccess(stop.status) ? "✓" : "!"}</Text>
      </View>
    </Marker>
  );
});

/**
 * Route map for tours of any size: markers outside the view are skipped and, when
 * zoomed out, nearby stops are merged into count bubbles (tap to zoom in). The current
 * stop is always shown. Road geometry (OSRM) replaces the straight order line when known.
 */
/** Android + Google Maps without an API key: creating a MapView throws and crashes the app. */
export const mapsAvailable = Platform.OS !== "android" || Constants.expoConfig?.extra?.googleMapsAndroid === true;

export function TourMap(props: TourMapProps) {
  return mapsAvailable ? <NativeTourMap {...props} /> : <MapUnavailable style={props.style} />;
}

/** Android: Google Maps (needs the restricted key). iOS: Apple Maps (no key, no extra SDK). */
const PROVIDER = Platform.OS === "android" ? PROVIDER_GOOGLE : PROVIDER_DEFAULT;
/** A map that has not reported "ready" by then is treated as failed (wrong key, no network). */
const MAP_READY_TIMEOUT_MS = 15_000;

function MapUnavailable({ style, text }: { style?: TourMapProps["style"]; text?: string }) {
  const t = useT();
  const { c } = useTheme();
  return (
    <View style={[StyleSheet.absoluteFill, s.unavailable, { backgroundColor: c.bg }, style]} testID="map-unavailable" accessibilityRole="alert">
      <Ionicons name="map-outline" size={28} color={c.textSubtle} />
      <Text style={{ color: c.textMuted, textAlign: "center", fontSize: 14, lineHeight: 20 }}>{text ?? t("map.unavailable")}</Text>
    </View>
  );
}

function NativeTourMap({ depot, tour, stops, currentStopId, showUserLocation, pendingPin, onMapPress, onStopPress, style, roadGeometry }: TourMapProps) {
  const { c } = useTheme();
  const mapRef = useRef<MapView>(null);
  const located = useMemo(() => stops.filter((x): x is Located => x.location !== null), [stops]);
  const indexOf = useMemo(() => new Map(stops.map((x, i) => [x.id, i])), [stops]);
  const initial = useMemo(
    // The tour's own start/end, not a far-away depot it never visits (HER-01: depot Suhl, tour in Hannover).
    () => boundingRegion(initialMapPoints({ depot, tour, stops, pendingPin })),
    // Only on first render / tour change: later updates must not jump the camera.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [depot?.id, located.length === 0],
  );
  const [region, setRegion] = useState<MapRegion | null>(initial);
  const t = useT();
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  // Stops that arrive after the first render (sync, tour switch, first geocode) – fit them once.
  useEffect(() => {
    if (initial && ready) {
      mapRef.current?.animateToRegion(initial, 300);
      setRegion(initial);
    }
  }, [initial, ready]);
  useEffect(() => {
    if (ready) return;
    const timer = setTimeout(() => setFailed(true), MAP_READY_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [ready]);
  const items = useMemo(
    () => (region ? clusterForRegion(located, (x) => x.location, region, { keep: (x) => x.id === currentStopId, maxMarkers: 60 }) : []),
    [located, region, currentStopId],
  );
  const path = useMemo(() => {
    if (roadGeometry && roadGeometry.length > 1) return roadGeometry.map(([lat, lng]) => ({ latitude: lat, longitude: lng }));
    return fallbackPath({ depot, tour, stops }).map((p) => ({ latitude: p.lat, longitude: p.lng }));
  }, [roadGeometry, depot, tour, stops]);

  return (
    <View style={[StyleSheet.absoluteFill, style]}>
    <MapView
      ref={mapRef}
      provider={PROVIDER}
      onMapReady={() => {
        setReady(true);
        setFailed(false);
      }}
      style={StyleSheet.absoluteFill}
      initialRegion={initial ?? undefined}
      onRegionChangeComplete={(r) => setRegion(r)}
      showsUserLocation={!!showUserLocation}
      showsMyLocationButton={false}
      toolbarEnabled={false}
      moveOnMarkerPress={false}
      onPress={(e: MapPressEvent) => onMapPress?.({ lat: e.nativeEvent.coordinate.latitude, lng: e.nativeEvent.coordinate.longitude })}
      testID="tour-map"
    >
      {path.length > 1 && (
        // Road geometry is solid; the straight order preview is dashed (not a road route).
        <Polyline coordinates={path} strokeColor={c.primary} strokeWidth={4} lineDashPattern={roadGeometry ? undefined : [10, 8]} />
      )}
      {depot && (
        <Marker coordinate={{ latitude: depot.location.lat, longitude: depot.location.lng }} title={depot.name} tracksViewChanges={false}>
          <View style={[s.pin, s.square, { backgroundColor: "#0F172A" }]}>
            <Text style={s.pinText}>D</Text>
          </View>
        </Marker>
      )}
      {items.map((m) =>
        m.kind === "single" ? (
          // tracksViewChanges is off, so Android keeps the first bitmap: the key changes with
          // everything the pin shows (number after re-optimizing, done/failed, current stop).
          <StopMarker key={`${m.item.id}:${m.item.status}:${indexOf.get(m.item.id) ?? 0}:${m.item.id === currentStopId ? 1 : 0}`} stop={m.item} index={indexOf.get(m.item.id) ?? 0} current={m.item.id === currentStopId} c={c} onPress={onStopPress} />
        ) : (
          <Marker
            key={`c-${m.id}`}
            coordinate={{ latitude: m.point.lat, longitude: m.point.lng }}
            tracksViewChanges={false}
            onPress={() =>
              region &&
              mapRef.current?.animateToRegion({ latitude: m.point.lat, longitude: m.point.lng, latitudeDelta: region.latitudeDelta / 3, longitudeDelta: region.longitudeDelta / 3 }, 250)
            }
          >
            <View style={[s.cluster, { backgroundColor: c.primarySoft, borderColor: c.primary }]}>
              <Text style={[s.clusterText, { color: c.primary }]}>{m.items.length}</Text>
            </View>
          </Marker>
        ),
      )}
      {pendingPin && (
        <Marker
          coordinate={{ latitude: pendingPin.lat, longitude: pendingPin.lng }}
          pinColor={c.primary}
          draggable
          onDragEnd={(e) => onMapPress?.({ lat: e.nativeEvent.coordinate.latitude, lng: e.nativeEvent.coordinate.longitude })}
        />
      )}
    </MapView>
    {failed && !ready && <MapUnavailable text={t("map.loadFailed")} />}
    </View>
  );
}

const s = StyleSheet.create({
  pin: { minWidth: 30, height: 30, paddingHorizontal: 6, borderRadius: 15, borderWidth: 2, borderColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  square: { borderRadius: 7 },
  pinText: { color: "#FFFFFF", fontWeight: "800", fontSize: 13 },
  cluster: { minWidth: 38, height: 38, paddingHorizontal: 8, borderRadius: 19, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  clusterText: { fontWeight: "800", fontSize: 14 },
  unavailable: { alignItems: "center", justifyContent: "center", padding: 24, gap: 8 },
});
