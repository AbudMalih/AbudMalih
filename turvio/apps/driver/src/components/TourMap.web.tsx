import { colors } from "@turvio/shared";
import { StyleSheet, Text, View } from "react-native";
import type { TourMapProps } from "./TourMap";

/**
 * react-native-maps has no web implementation. The driver app targets iOS and
 * Android; on web we show a notice instead of a map.
 */
export function TourMap({ stops }: TourMapProps) {
  return (
    <View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center", backgroundColor: colors.surface }]}>
      <Text style={{ color: colors.textMuted, padding: 24, textAlign: "center" }}>
        Map preview is available in the iOS/Android app ({stops.length} stops).
      </Text>
    </View>
  );
}
export type { TourMapProps };
