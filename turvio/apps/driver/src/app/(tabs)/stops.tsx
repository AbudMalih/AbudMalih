import { isOpen, searchStops, type Stop } from "@turvio/shared";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, Text, TextInput, View } from "react-native";
import { StopCard } from "../../components/StopCard";
import { EmptyState, IconButton, Ionicons, Segmented } from "../../components/ui";
import { useT } from "../../lib/i18n";
import { useTourStore } from "../../store/tourStore";
import { useMyTour } from "../../store/useMyTour";
import { radii, space, type as ty, useTheme } from "../../theme";

type Filter = "open" | "done" | "all";

export default function StopsScreen() {
  const t = useT();
  const { c } = useTheme();
  const { tour, stops } = useMyTour();
  const moveStop = useTourStore((s) => s.moveStop);
  const setLocked = useTourStore((s) => s.setLocked);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("open");
  const [reorder, setReorder] = useState(false);

  const visible = useMemo(() => {
    const byFilter = stops.filter((s) => (filter === "all" ? true : filter === "open" ? isOpen(s.status) : !isOpen(s.status)));
    return searchStops(byFilter, query);
  }, [stops, filter, query]);
  const current = stops.find((s) => isOpen(s.status));

  if (!tour) return <EmptyState icon="list-outline" title={t("home.noRoutes")} text={t("home.noRoutesText")} />;

  const renderItem = ({ item }: { item: Stop }) => {
    const index = stops.indexOf(item);
    return (
      <StopCard
        stop={item}
        index={index}
        current={item.id === current?.id}
        onPress={() => router.push(`/stop/${item.id}`)}
        testID={`stop-${index}`}
        right={
          reorder && isOpen(item.status) ? (
            <View style={{ gap: 4 }}>
              <IconButton size={38} icon="chevron-up" label={t("stops.moveUp")} onPress={() => moveStop(tour.id, index, index - 1)} />
              <IconButton size={38} icon={item.locked ? "lock-closed" : "lock-open-outline"} label={item.locked ? t("stops.unlock") : t("stops.lock")} active={item.locked} onPress={() => setLocked(item.id, !item.locked)} />
              <IconButton size={38} icon="chevron-down" label={t("stops.moveDown")} onPress={() => moveStop(tour.id, index, index + 1)} />
            </View>
          ) : undefined
        }
      />
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ padding: space.lg, paddingBottom: space.sm, gap: space.sm }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm, backgroundColor: c.card, borderRadius: radii.md, borderWidth: 1, borderColor: c.border, paddingHorizontal: space.md }}>
          <Ionicons name="search" size={18} color={c.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t("stops.searchPlaceholder")}
            placeholderTextColor={c.textSubtle}
            style={[ty.body, { flex: 1, minHeight: 48, color: c.text }]}
            accessibilityLabel={t("common.search")}
            testID="stop-search"
          />
        </View>
        <View style={{ flexDirection: "row", gap: space.sm, alignItems: "center" }}>
          <View style={{ flex: 1 }}>
            <Segmented
              value={filter}
              onChange={setFilter}
              options={[
                { value: "open", label: `${t("stops.filterOpen")} · ${stops.filter((s) => isOpen(s.status)).length}` },
                { value: "done", label: t("stops.filterDone") },
                { value: "all", label: t("stops.filterAll") },
              ]}
            />
          </View>
          <IconButton icon={reorder ? "checkmark" : "swap-vertical"} label={reorder ? t("stops.reorderDone") : t("stops.reorder")} active={reorder} onPress={() => setReorder(!reorder)} testID="reorder-toggle" />
        </View>
      </View>
      <FlatList
        data={visible}
        keyExtractor={(s) => s.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: space.lg, paddingTop: space.sm, gap: space.sm, paddingBottom: 120 }}
        ListEmptyComponent={<Text style={[ty.body, { color: c.textMuted, textAlign: "center", marginTop: space.xl }]}>{query ? t("stops.noResults") : t("stops.empty")}</Text>}
        testID="stop-list"
      />
    </View>
  );
}
