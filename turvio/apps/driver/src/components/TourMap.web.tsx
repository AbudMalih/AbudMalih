import { isOpen, isSuccess, type GeoPoint, type Stop } from "@turvio/shared";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, G, Line, Polyline, Rect, Text as SvgText } from "react-native-svg";
import { useT } from "../lib/i18n";
import { type as ty, useTheme } from "../theme";
import { markerTone, type TourMapProps } from "./TourMap.shared";

/**
 * react-native-maps has no web implementation and the web build is used only
 * for automated tests: a schematic projection of the stops (straight lines, no
 * map tiles), clearly labelled as such.
 */
export function TourMap({ depot, stops, currentStopId, pendingPin, onMapPress, onStopPress, roadGeometry }: TourMapProps) {
  const t = useT();
  const { c } = useTheme();
  const [size, setSize] = useState({ w: 360, h: 480 });
  const located = stops.filter((s): s is Stop & { location: GeoPoint } => s.location !== null);
  const pts = [...(depot ? [depot.location] : []), ...located.map((s) => s.location), ...(pendingPin ? [pendingPin] : [])];
  if (pts.length === 0) pts.push({ lat: 52.37, lng: 9.73 });
  const minLat = Math.min(...pts.map((p) => p.lat)), maxLat = Math.max(...pts.map((p) => p.lat));
  const minLng = Math.min(...pts.map((p) => p.lng)), maxLng = Math.max(...pts.map((p) => p.lng));
  const pad = 36;
  const kx = Math.cos(((minLat + maxLat) / 2) * (Math.PI / 180));
  const spanX = Math.max((maxLng - minLng) * kx, 0.002), spanY = Math.max(maxLat - minLat, 0.002);
  const scale = Math.min((size.w - 2 * pad) / spanX, (size.h - 2 * pad - 40) / spanY);
  const proj = (p: GeoPoint) => ({ x: pad + (p.lng - minLng) * kx * scale + ((size.w - 2 * pad) - spanX * scale) / 2, y: pad + (maxLat - p.lat) * scale });
  const unproj = (x: number, y: number): GeoPoint => ({ lat: maxLat - (y - pad) / scale, lng: minLng + (x - pad - ((size.w - 2 * pad) - spanX * scale) / 2) / (kx * scale) });
  const open = located.filter((s) => isOpen(s.status));
  const lastDone = located.filter((s) => !isOpen(s.status)).at(-1)?.location ?? depot?.location;
  const path = (roadGeometry && roadGeometry.length > 1 ? roadGeometry.map(([lat, lng]) => ({ lat, lng })) : [...(lastDone ? [lastDone] : []), ...open.map((s) => s.location)]).map(proj);
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: c.surface2 }]} onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })} testID="tour-map">
      <Pressable style={StyleSheet.absoluteFill} onPress={(e) => onMapPress?.(unproj(e.nativeEvent.locationX, e.nativeEvent.locationY))} disabled={!onMapPress}>
        <Svg width={size.w} height={size.h}>
          {Array.from({ length: 8 }, (_, i) => (
            <G key={i}>
              <Line x1={0} x2={size.w} y1={(size.h / 8) * i} y2={(size.h / 8) * i} stroke={c.border} strokeWidth={1} />
              <Line y1={0} y2={size.h} x1={(size.w / 8) * i} x2={(size.w / 8) * i} stroke={c.border} strokeWidth={1} />
            </G>
          ))}
          {path.length > 1 && <Polyline points={path.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke={c.primary} strokeWidth={3} strokeDasharray={roadGeometry ? undefined : "8 6"} />}
          {depot && (() => {
            const p = proj(depot.location);
            return (
              <G>
                <Rect x={p.x - 13} y={p.y - 13} width={26} height={26} rx={6} fill="#0F172A" stroke="#fff" strokeWidth={2} />
                <SvgText x={p.x} y={p.y + 4.5} fill="#fff" fontSize={12} fontWeight="bold" textAnchor="middle">D</SvgText>
              </G>
            );
          })()}
          {located.map((stop) => {
            const p = proj(stop.location);
            const current = stop.id === currentStopId;
            const r = current ? 17 : 13;
            const label = isOpen(stop.status) ? String(stops.indexOf(stop) + 1) : isSuccess(stop.status) ? "✓" : "!";
            return (
              <G key={stop.id} onPress={() => onStopPress?.(stop)}>
                {stop.type === "pickup" ? (
                  <Rect x={p.x - r} y={p.y - r} width={2 * r} height={2 * r} rx={6} fill={markerTone(stop, current, c)} stroke="#fff" strokeWidth={2} />
                ) : (
                  <Circle cx={p.x} cy={p.y} r={r} fill={markerTone(stop, current, c)} stroke="#fff" strokeWidth={2} />
                )}
                <SvgText x={p.x} y={p.y + 4.5} fill="#fff" fontSize={current ? 14 : 12} fontWeight="bold" textAnchor="middle">{label}</SvgText>
              </G>
            );
          })}
          {pendingPin && (() => {
            const p = proj(pendingPin);
            return <Circle cx={p.x} cy={p.y} r={10} fill={c.primary} stroke="#fff" strokeWidth={3} />;
          })()}
        </Svg>
      </Pressable>
      <View style={{ position: "absolute", top: 8, left: 8, right: 8, alignItems: "center" }} pointerEvents="none">
        <Text style={[ty.small, { color: c.textMuted, backgroundColor: c.card, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, overflow: "hidden" }]}>{t("map.schematic")}</Text>
      </View>
    </View>
  );
}
export type { TourMapProps };
