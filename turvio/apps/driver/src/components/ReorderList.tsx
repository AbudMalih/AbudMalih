import { isOpen, type Stop } from "@turvio/shared";
import { memo, useMemo, useRef, useState } from "react";
import { FlatList, PanResponder, Text, View } from "react-native";
import { addressLine } from "../lib/format";
import { feedback } from "../lib/haptics";
import { useT } from "../lib/i18n";
import { lift, radii, space, type as ty, useTheme } from "../theme";
import { IconButton, Ionicons } from "./ui";

export const ROW = 68;

/** Pure: where a drag that moved `dy` pixels from row `from` ends (clamped). */
export function dropIndex(from: number, dy: number, count: number): number {
  return Math.max(0, Math.min(count - 1, from + Math.round(dy / ROW)));
}

const Row = memo(function Row(props: {
  stop: Stop;
  index: number;
  number: number;
  offset: number;
  dragging: boolean;
  onStart: (i: number) => void;
  onMove: (dy: number) => void;
  onEnd: () => void;
  onToggleLock: (s: Stop) => void;
}) {
  const { c } = useTheme();
  const t = useT();
  const { stop, index } = props;
  const latest = useRef(props);
  latest.current = props;
  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !latest.current.stop.locked,
        onMoveShouldSetPanResponder: () => !latest.current.stop.locked,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          feedback.tap();
          latest.current.onStart(latest.current.index);
        },
        onPanResponderMove: (_e, g) => latest.current.onMove(g.dy),
        onPanResponderRelease: () => latest.current.onEnd(),
        onPanResponderTerminate: () => latest.current.onEnd(),
      }),
    [],
  );
  return (
    <View
      style={{
        height: ROW - 6,
        marginBottom: 6,
        flexDirection: "row",
        alignItems: "center",
        gap: space.md,
        paddingHorizontal: space.md,
        borderRadius: radii.md,
        borderWidth: props.dragging ? 2 : 1,
        borderColor: props.dragging ? c.primary : c.border,
        backgroundColor: c.card,
        transform: [{ translateY: props.offset }],
        zIndex: props.dragging ? 10 : 0,
        ...(props.dragging ? lift(3, { opaque: true }) : null),
      }}
      testID={`reorder-row-${index}`}
    >
      <View {...responder.panHandlers} accessibilityLabel={t("stops.reorder")} style={{ padding: 6, opacity: stop.locked ? 0.25 : 1 }} testID={`drag-handle-${index}`}>
        <Ionicons name="reorder-three" size={26} color={c.textMuted} />
      </View>
      <Text style={[ty.bodyStrong, { color: c.primary, width: 28 }]}>{props.number}</Text>
      <View style={{ flex: 1 }}>
        <Text style={[ty.bodyStrong, { color: c.text }]} numberOfLines={1}>
          {stop.recipientName ?? addressLine(stop)}
        </Text>
        <Text style={[ty.small, { color: c.textMuted }]} numberOfLines={1}>
          {addressLine(stop)}
        </Text>
      </View>
      <IconButton size={40} icon={stop.locked ? "lock-closed" : "lock-open-outline"} label={stop.locked ? t("stops.unlock") : t("stops.lock")} active={stop.locked} onPress={() => props.onToggleLock(stop)} />
    </View>
  );
});

/**
 * Drag-and-drop ordering of the open stops (fixed row height keeps the maths exact
 * and the list fast for long tours). `onMove` receives indices in the open-stop list.
 */
export function ReorderList({ stops, firstNumber, onMove, onToggleLock }: { stops: Stop[]; firstNumber: number; onMove: (from: number, to: number) => void; onToggleLock: (s: Stop) => void }) {
  const t = useT();
  const { c } = useTheme();
  const open = stops.filter((s) => isOpen(s.status));
  const [drag, setDrag] = useState<{ from: number; dy: number } | null>(null);
  const to = drag ? dropIndex(drag.from, drag.dy, open.length) : -1;
  const offsetFor = (i: number) => {
    if (!drag) return 0;
    if (i === drag.from) return drag.dy;
    if (drag.from < to && i > drag.from && i <= to) return -ROW;
    if (drag.from > to && i < drag.from && i >= to) return ROW;
    return 0;
  };
  return (
    <FlatList
      data={open}
      keyExtractor={(s) => s.id}
      scrollEnabled={!drag}
      getItemLayout={(_d, i) => ({ length: ROW, offset: ROW * i, index: i })}
      contentContainerStyle={{ padding: space.lg, paddingTop: space.sm, paddingBottom: 120 }}
      ListHeaderComponent={<Text style={[ty.small, { color: c.textMuted, marginBottom: space.sm }]}>{t("stops.dragHint")}</Text>}
      renderItem={({ item, index }) => (
        <Row
          stop={item}
          index={index}
          number={firstNumber + index}
          offset={offsetFor(index)}
          dragging={drag?.from === index}
          onStart={(i) => setDrag({ from: i, dy: 0 })}
          onMove={(dy) => setDrag((d) => (d ? { ...d, dy } : d))}
          onEnd={() =>
            setDrag((d) => {
              if (d) {
                const target = dropIndex(d.from, d.dy, open.length);
                if (target !== d.from) {
                  feedback.success();
                  onMove(d.from, target);
                }
              }
              return null;
            })
          }
          onToggleLock={onToggleLock}
        />
      )}
      testID="reorder-list"
    />
  );
}
