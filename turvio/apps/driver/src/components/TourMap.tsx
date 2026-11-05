import { boundingRegion, isOpen, isSuccess, type GeoPoint, type Stop } from "@turvio/shared";
import { markerTone, type TourMapProps } from "./TourMap.shared";
export type { TourMapProps };
import { StyleSheet, Text, View } from "react-native";
import MapView, { Marker, Polyline, type MapPressEvent } from "react-native-maps";
import { useTheme } from "../theme";

export function TourMap({ depot, stops, currentStopId, showUserLocation, pendingPin, onMapPress, onStopPress, style }: TourMapProps) {
  const { c } = useTheme();
  const located = stops.filter((s): s is Stop & { location: GeoPoint } => s.location !== null);
  const region = boundingRegion([...(depot ? [depot.location] : []), ...located.map((s) => s.location), ...(pendingPin ? [pendingPin] : [])]);
  const open = located.filter((s) => isOpen(s.status));
  const done = located.filter((s) => !isOpen(s.status));
  const lastDone = done.at(-1)?.location ?? depot?.location;
  // Straight connections in visiting order: an order preview, not road geometry.
  const path = [...(lastDone ? [lastDone] : []), ...open.map((s) => s.location)];
  return (
    <MapView
      style={[StyleSheet.absoluteFill, style]}
      initialRegion={region ?? undefined}
      showsUserLocation={!!showUserLocation}
      showsMyLocationButton={false}
      toolbarEnabled={false}
      onPress={(e: MapPressEvent) => onMapPress?.({ lat: e.nativeEvent.coordinate.latitude, lng: e.nativeEvent.coordinate.longitude })}
      testID="tour-map"
    >
      {path.length > 1 && <Polyline coordinates={path.map((p) => ({ latitude: p.lat, longitude: p.lng }))} strokeColor={c.primary} strokeWidth={4} lineDashPattern={[10, 8]} />}
      {depot && (
        <Marker coordinate={{ latitude: depot.location.lat, longitude: depot.location.lng }} title={depot.name} tracksViewChanges={false}>
          <View style={[s.pin, s.square, { backgroundColor: "#0F172A" }]}>
            <Text style={s.pinText}>D</Text>
          </View>
        </Marker>
      )}
      {located.map((stop) => {
        const current = stop.id === currentStopId;
        const index = stops.indexOf(stop);
        return (
          <Marker
            key={stop.id}
            coordinate={{ latitude: stop.location.lat, longitude: stop.location.lng }}
            onPress={() => onStopPress?.(stop)}
            tracksViewChanges={false}
            zIndex={current ? 10 : isOpen(stop.status) ? 5 : 1}
          >
            <View style={[s.pin, stop.type === "pickup" && s.square, { backgroundColor: markerTone(stop, current, c), transform: [{ scale: current ? 1.25 : 1 }] }]}>
              <Text style={s.pinText}>{isOpen(stop.status) ? index + 1 : isSuccess(stop.status) ? "✓" : "!"}</Text>
            </View>
          </Marker>
        );
      })}
      {pendingPin && <Marker coordinate={{ latitude: pendingPin.lat, longitude: pendingPin.lng }} pinColor={c.primary} draggable onDragEnd={(e) => onMapPress?.({ lat: e.nativeEvent.coordinate.latitude, lng: e.nativeEvent.coordinate.longitude })} />}
    </MapView>
  );
}

const s = StyleSheet.create({
  pin: { minWidth: 30, height: 30, paddingHorizontal: 6, borderRadius: 15, borderWidth: 2, borderColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  square: { borderRadius: 7 },
  pinText: { color: "#FFFFFF", fontWeight: "800", fontSize: 13 },
});
