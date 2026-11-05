import type { GeoPoint } from "@turvio/shared";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { searchAddress, type AddressSuggestion } from "../lib/geocode";
import { useT } from "../lib/i18n";
import { auth, isServerMode } from "../store/tourStore";
import { radii, space, type as ty, useTheme } from "../theme";
import { Banner, Field, Ionicons, Pill } from "./ui";

/**
 * Address autocomplete through the configured provider. When no provider is
 * configured (or offline) it says so – the typed address is kept and marked
 * as needing a map position. It never makes up coordinates.
 */
export function AddressSearch({ onPick, near }: { onPick: (s: AddressSuggestion) => void; near?: GeoPoint }) {
  const t = useT();
  const { c } = useTheme();
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<AddressSuggestion[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    if (q.trim().length < 4) {
      setResults([]);
      return;
    }
    const id = ++seq.current;
    const timer = setTimeout(async () => {
      setBusy(true);
      const r = await searchAddress(isServerMode() ? auth() : null, q.trim(), near);
      if (id !== seq.current) return;
      setBusy(false);
      if (r.status === "ok") {
        setResults(r.results);
        setNotice(r.results.length ? null : t("address.noResults"));
      } else {
        setResults([]);
        setNotice(r.status === "unavailable" ? t("address.unavailable") : r.status === "offline" ? t("address.offline") : r.message);
      }
    }, 450);
    return () => clearTimeout(timer);
  }, [q, near, t]);

  return (
    <View style={{ gap: space.sm }}>
      <Field label={t("address.search")} value={q} onChangeText={setQ} placeholder={t("address.searchPlaceholder")} autoCorrect={false} testID="address-search" right={busy ? <ActivityIndicator style={{ marginStart: 8 }} /> : null} />
      {notice && <Banner text={notice} tone="neutral" />}
      {results.map((r, i) => (
        <Pressable
          key={`${r.label}-${i}`}
          onPress={() => {
            onPick(r);
            setResults([]);
            setQ(r.label);
          }}
          accessibilityRole="button"
          style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: space.sm, padding: space.md, borderRadius: radii.md, borderWidth: 1, borderColor: c.border, backgroundColor: pressed ? c.surface2 : c.card })}
        >
          <Ionicons name="location-outline" size={18} color={c.primary} />
          <Text style={[ty.body, { color: c.text, flex: 1 }]} numberOfLines={2}>
            {r.label}
          </Text>
          <Pill label={t(`address.precision.${r.precision}` as never)} tone={r.precision === "house" ? "success" : "warning"} />
        </Pressable>
      ))}
    </View>
  );
}
