import { useMemo, useRef, useState } from "react";
import { PanResponder, Text, View, type LayoutChangeEvent } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useT } from "../lib/i18n";
import { radii, type as ty, useTheme } from "../theme";
import { Button } from "./ui";

/**
 * Signature capture with react-native-svg (no WebView). Produces a minimal SVG
 * (paths only) that the API accepts after a strict whitelist check.
 */
export function strokesToSvg(strokes: string[], w: number, h: number): string {
  const paths = strokes.map((d) => `<path d="${d}" fill="none" stroke="#0F172A" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Math.round(w)} ${Math.round(h)}" width="${Math.round(w)}" height="${Math.round(h)}">${paths}</svg>`;
}

export function SignaturePad({ onChange, testID }: { onChange: (svg: string | null) => void; testID?: string }) {
  const t = useT();
  const { c } = useTheme();
  const [strokes, setStrokes] = useState<string[]>([]);
  const current = useRef<string>("");
  const [live, setLive] = useState("");
  const size = useRef({ w: 320, h: 180 });

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) => {
          const { locationX: x, locationY: y } = e.nativeEvent;
          current.current = `M${x.toFixed(1)} ${y.toFixed(1)}`;
          setLive(current.current);
        },
        onPanResponderMove: (e) => {
          const { locationX: x, locationY: y } = e.nativeEvent;
          current.current += ` L${x.toFixed(1)} ${y.toFixed(1)}`;
          setLive(current.current);
        },
        onPanResponderRelease: () => {
          const d = current.current.includes("L") ? current.current : `${current.current} L${current.current.slice(1)}`;
          current.current = "";
          setLive("");
          setStrokes((prev) => {
            const next = [...prev, d];
            onChange(strokesToSvg(next, size.current.w, size.current.h));
            return next;
          });
        },
      }),
    [onChange],
  );

  return (
    <View style={{ gap: 8 }}>
      <View
        {...responder.panHandlers}
        onLayout={(e: LayoutChangeEvent) => (size.current = { w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
        style={{ height: 180, borderRadius: radii.md, borderWidth: 1, borderStyle: "dashed", borderColor: c.borderStrong, backgroundColor: "#FFFFFF", overflow: "hidden" }}
        testID={testID ?? "signature-pad"}
        accessibilityLabel={t("pod.signHere")}
      >
        <Svg width="100%" height="100%">
          {strokes.map((d, i) => (
            <Path key={i} d={d} stroke="#0F172A" strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          ))}
          {live ? <Path d={live} stroke="#0F172A" strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" /> : null}
        </Svg>
        {strokes.length === 0 && !live && (
          <Text pointerEvents="none" style={[ty.small, { position: "absolute", bottom: 12, alignSelf: "center", color: "#94A3B8" }]}>
            {t("pod.signHere")}
          </Text>
        )}
      </View>
      {strokes.length > 0 && (
        <Button
          label={t("pod.clear")}
          variant="ghost"
          icon="refresh"
          onPress={() => {
            setStrokes([]);
            onChange(null);
          }}
          style={{ alignSelf: "flex-end", minHeight: 40 }}
        />
      )}
    </View>
  );
}
