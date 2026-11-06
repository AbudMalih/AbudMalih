import { boundingRegion, clusterForRegion, isOpen, isSuccess, type GeoPoint, type MapRegion, type Stop } from "@turvio/shared";
import { memo, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import MapView, { Marker, Polyline, type MapPressEvent } from "react-native-maps";
import { useTheme, type Palette } from "../theme";
import { markerTone, type TourMapProps } from "./TourMap.shared";
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
export function TourMap({ depot, stops, currentStopId, showUserLocation, pendingPin, onMapPress, onStopPress, style, roadGeometry }: TourMapProps) {
  const { c } = useTheme();
  const mapRef = useRef<MapView>(null);
  const located = useMemo(() => stops.filter((x): x is Located => x.location !== null), [stops]);
  const indexOf = useMemo(() => new Map(stops.map((x, i) => [x.id, i])), [stops]);
  const initial = useMemo(
    () => boundingRegion([...(depot ? [depot.location] : []), ...located.map((x) => x.location), ...(pendingPin ? [pendingPin] : [])]),
    // Only on first render / tour change: later updates must not jump the camera.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [depot?.id, located.length === 0],
  );
  const [region, setRegion] = useState<MapRegion | null>(initial);
  const items = useMemo(
    () => (region ? clusterForRegion(located, (x) => x.location, region, { keep: (x) => x.id === currentStopId, maxMarkers: 60 }) : []),
    [located, region, currentStopId],
  );
  const path = useMemo(() => {
    if (roadGeometry && roadGeometry.length > 1) return roadGeometry.map(([lat, lng]) => ({ latitude: lat, longitude: lng }));
    const open = located.filter((x) => isOpen(x.status));
    const lastDone = located.filter((x) => !isOpen(x.status)).at(-1)?.location ?? depot?.location;
    return [...(lastDone ? [lastDone] : []), ...open.map((x) => x.location)].map((p) => ({ latitude: p.lat, longitude: p.lng }));
  }, [roadGeometry, located, depot]);

  return (
    <MapView
      ref={mapRef}
      style={[StyleSheet.absoluteFill, style]}
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
          <StopMarker key={m.item.id} stop={m.item} index={indexOf.get(m.item.id) ?? 0} current={m.item.id === currentStopId} c={c} onPress={onStopPress} />
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
  );
}

const s = StyleSheet.create({
  pin: { minWidth: 30, height: 30, paddingHorizontal: 6, borderRadius: 15, borderWidth: 2, borderColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  square: { borderRadius: 7 },
  pinText: { color: "#FFFFFF", fontWeight: "800", fontSize: 13 },
  cluster: { minWidth: 38, height: 38, paddingHorizontal: 8, borderRadius: 19, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  clusterText: { fontWeight: "800", fontSize: 14 },
});
