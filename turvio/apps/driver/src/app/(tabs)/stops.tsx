import { colors, searchStops, spacing } from "@turvio/shared";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, Text, TextInput, View } from "react-native";
import { StopRow } from "../../components/StopRow";
import { Button, styles as ui } from "../../components/ui";
import { useT } from "../../lib/i18n";
import { useTourStore } from "../../store/tourStore";
import { useMyTour } from "../../store/useMyTour";

export default function StopsScreen() {
  const t = useT();
  const { tour, stops } = useMyTour();
  const moveStop = useTourStore((s) => s.moveStop);
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => searchStops(stops, query), [stops, query]);
  // Manual reordering only makes sense on the full, unfiltered list.
  const canReorder = !query.trim() && tour?.status !== "completed";

  return (
    <View style={ui.screen}>
      <View style={{ padding: spacing.lg, gap: spacing.sm, backgroundColor: colors.white }}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t("stops.searchPlaceholder")}
          placeholderTextColor={colors.textMuted}
          style={ui.input}
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
          accessibilityLabel={t("common.search")}
          testID="stop-search"
        />
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(s) => s.id}
        renderItem={({ item }) => {
          const index = stops.findIndex((s) => s.id === item.id);
          return (
            <StopRow
              stop={item}
              position={index + 1}
              onPress={() => router.push({ pathname: "/stop/[id]", params: { id: item.id } })}
              onMoveUp={canReorder && index > 0 && tour ? () => moveStop(tour.id, index, index - 1) : undefined}
              onMoveDown={canReorder && index < stops.length - 1 && tour ? () => moveStop(tour.id, index, index + 1) : undefined}
            />
          );
        }}
        ListEmptyComponent={
          <Text style={[ui.muted, { padding: spacing.lg }]}>
            {query ? t("stops.noResults") : t("stops.empty")}
          </Text>
        }
        ListFooterComponent={
          tour?.status !== "completed" ? (
            <View style={{ padding: spacing.lg }}>
              <Button label={t("home.addStop")} onPress={() => router.push("/add-stop")} />
            </View>
          ) : undefined
        }
      />
    </View>
  );
}
