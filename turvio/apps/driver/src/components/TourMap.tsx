import { boundingRegion, colors, type Depot, type GeoPoint, type Stop } from "@turvio/shared";
import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import MapView, { Marker, Polyline, type MapPressEvent } from "react-native-maps";

export interface TourMapProps {
  depot: Depot;
  stops: Stop[];
  /** Extra pin, e.g. the position being chosen for a new stop. */
  pendingPin?: GeoPoint | null;
  onMapPress?: (point: GeoPoint) => void;
  onStopPress?: (stop: Stop) => void;
  style?: ViewStyle;
}

function markerColor(stop: Stop) {
  if (stop.status === "delivered" || stop.status === "picked_up") return colors.success;
  if (stop.status === "failed") return colors.danger;
  if (stop.status === "skipped") return colors.textMuted;
  return stop.priority ? colors.warning : colors.primary;
}

export function TourMap({ depot, stops, pendingPin, onMapPress, onStopPress, style }: TourMapProps) {
  const located = stops.filter((s): s is Stop & { location: GeoPoint } => s.location !== null);
  const region = boundingRegion([depot.location, ...located.map((s) => s.location), ...(pendingPin ? [pendingPin] : [])]);
  // Straight connections between remaining stops in visiting order – this is
  // an order preview, not road geometry.
  const pendingPath = [depot.location, ...located.filter((s) => s.status === "pending").map((s) => s.location)];

  return (
    <MapView
      style={[StyleSheet.absoluteFill, style]}
      initialRegion={region ?? undefined}
      showsUserLocation={false}
      onPress={(e: MapPressEvent) => onMapPress?.({ lat: e.nativeEvent.coordinate.latitude, lng: e.nativeEvent.coordinate.longitude })}
      testID="tour-map"
    >
      <Polyline
        coordinates={pendingPath.map((p) => ({ latitude: p.lat, longitude: p.lng }))}
        strokeColor={colors.primary}
        strokeWidth={3}
        lineDashPattern={[8, 6]}
      />
      <Marker coordinate={{ latitude: depot.location.lat, longitude: depot.location.lng }} title={depot.name}>
        <View style={[s.pin, { backgroundColor: colors.text }]}>
          <Text style={s.pinText}>D</Text>
        </View>
      </Marker>
      {located.map((stop) => (
        <Marker
          key={stop.id}
          coordinate={{ latitude: stop.location.lat, longitude: stop.location.lng }}
          title={`${stop.sequence + 1}. ${stop.recipientName ?? ""}`}
          onPress={() => onStopPress?.(stop)}
        >
          <View style={[s.pin, { backgroundColor: markerColor(stop) }]}>
            <Text style={s.pinText}>{stop.sequence + 1}</Text>
          </View>
        </Marker>
      ))}
      {pendingPin && (
        <Marker coordinate={{ latitude: pendingPin.lat, longitude: pendingPin.lng }} pinColor={colors.primary} />
      )}
    </MapView>
  );
}

const s = StyleSheet.create({
  pin: {
    minWidth: 30,
    height: 30,
    paddingHorizontal: 6,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  pinText: { color: colors.white, fontWeight: "700", fontSize: 13 },
});
