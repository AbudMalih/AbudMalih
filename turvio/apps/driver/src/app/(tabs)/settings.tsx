import { LOCALE_LABELS, SUPPORTED_LOCALES, colors, spacing } from "@turvio/shared";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { Button, Card, styles as ui } from "../../components/ui";
import { applyLayoutDirection, useLocale, useT } from "../../lib/i18n";
import { apiBaseUrl } from "../../lib/optimizer";
import { useTourStore } from "../../store/tourStore";

export default function SettingsScreen() {
  const t = useT();
  const locale = useLocale();
  const setLocale = useTourStore((s) => s.setLocale);
  const resetData = useTourStore((s) => s.resetData);
  const api = apiBaseUrl();

  return (
    <ScrollView style={ui.screen} contentContainerStyle={ui.content}>
      <Card>
        <Text style={ui.h2}>{t("settings.language")}</Text>
        {SUPPORTED_LOCALES.map((l) => (
          <Pressable
            key={l}
            accessibilityRole="radio"
            accessibilityState={{ checked: l === locale }}
            onPress={() => {
              setLocale(l);
              if (applyLayoutDirection(l)) Alert.alert(t("settings.rtlRestart"));
            }}
            style={{
              minHeight: 48,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}
          >
            <Text style={ui.body}>{LOCALE_LABELS[l]}</Text>
            {l === locale && <Text style={{ color: colors.primary, fontWeight: "700" }}>✓</Text>}
          </Pressable>
        ))}
        <Text style={ui.muted}>{t("settings.rtlRestart")}</Text>
      </Card>

      <Card>
        <Text style={ui.h2}>{t("settings.apiStatus")}</Text>
        <Text style={ui.body}>{api ?? t("settings.apiNotConfigured")}</Text>
      </Card>

      <View style={{ marginTop: spacing.md }}>
        <Button label={t("settings.resetData")} variant="danger" onPress={resetData} />
      </View>
      <Text style={[ui.muted, { textAlign: "center", marginTop: spacing.lg }]}>
        {t("app.name")} · {t("app.tagline")}
      </Text>
    </ScrollView>
  );
}
