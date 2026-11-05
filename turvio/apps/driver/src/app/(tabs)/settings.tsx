import { LOCALE_LABELS, SUPPORTED_LOCALES, isRtl, type Locale } from "@turvio/shared";
import Constants from "expo-constants";
import { useState } from "react";
import { Alert, Platform, Text, View } from "react-native";
import { Banner, Button, Card, ListRow, Pill, Screen, SectionTitle, Segmented } from "../../components/ui";
import { useLocale, useT } from "../../lib/i18n";
import { availableNavApps, type NavApp } from "../../lib/navigation";
import { apiBaseUrl } from "../../lib/optimizer";
import { isServerMode, useTourStore } from "../../store/tourStore";
import { space, type as ty, useTheme } from "../../theme";

export default function SettingsScreen() {
  const t = useT();
  const { c } = useTheme();
  const locale = useLocale();
  const s = useTourStore();
  const [rtlNote, setRtlNote] = useState(false);

  const chooseLocale = (l: Locale) => {
    if (isRtl(l) !== isRtl(locale)) setRtlNote(true);
    s.setLocale(l);
  };

  const signOut = () => {
    const pending = s.outbox.length;
    if (!pending) return void s.signOut();
    const msg = t("settings.signOutPending", { n: pending });
    if (Platform.OS === "web") {
      if (globalThis.confirm?.(msg)) void s.signOut();
      return;
    }
    Alert.alert(t("settings.signOut"), msg, [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("settings.signOut"), style: "destructive", onPress: () => void s.signOut() },
    ]);
  };

  return (
    <Screen testID="settings">
      {isServerMode() && s.user && (
        <Card>
          <SectionTitle>{t("settings.account")}</SectionTitle>
          <ListRow icon="person-outline" title={s.user.name ?? s.user.email} subtitle={[s.user.email, s.organizationName].filter(Boolean).join(" · ")} />
          <Button label={t("settings.signOut")} variant="secondary" icon="log-out-outline" onPress={signOut} testID="sign-out" />
        </Card>
      )}

      {isServerMode() && (
        <Card testID="sync-card">
          <SectionTitle>{t("settings.sync")}</SectionTitle>
          <Text style={[ty.body, { color: c.text }]}>{s.outbox.length ? t("settings.outbox", { n: s.outbox.length }) : t("settings.outboxEmpty")}</Text>
          {s.syncMessage && s.syncState !== "idle" && <Text style={[ty.small, { color: c.textMuted }]}>{s.syncMessage}</Text>}
          <Button label={t("sync.refresh")} variant="secondary" icon="sync" onPress={() => void s.sync()} />
          {s.failed.length > 0 && (
            <>
              <SectionTitle>{t("settings.failed")}</SectionTitle>
              {s.failed.map((f) => (
                <View key={f.item.id} style={{ gap: space.xs }}>
                  <Banner text={`${f.item.kind}: ${f.error}`} tone="danger" />
                  <View style={{ flexDirection: "row", gap: space.sm }}>
                    <Button label={t("common.retry")} variant="secondary" onPress={() => s.retryFailed(f.item.id)} style={{ flex: 1 }} />
                    <Button label={t("common.discard")} variant="danger" onPress={() => void s.discardFailed(f.item.id)} style={{ flex: 1 }} />
                  </View>
                </View>
              ))}
            </>
          )}
        </Card>
      )}

      <Card>
        <SectionTitle>{t("settings.language")}</SectionTitle>
        {SUPPORTED_LOCALES.map((l) => (
          <ListRow key={l} title={LOCALE_LABELS[l]} onPress={() => chooseLocale(l)} right={l === locale ? <Pill label="✓" tone="primary" /> : <View />} testID={`locale-${l}`} />
        ))}
        {rtlNote && <Banner text={t("settings.rtlRestart")} tone="primary" />}
      </Card>

      <Card>
        <SectionTitle>{t("settings.navigation")}</SectionTitle>
        <Segmented<NavApp | "ask">
          value={s.prefs.navApp ?? "ask"}
          onChange={(v) => s.setPrefs({ navApp: v === "ask" ? null : v })}
          options={[{ value: "ask", label: t("settings.ask") }, ...availableNavApps().map((a) => ({ value: a, label: t(`nav.${a}`) }))]}
        />
        <SectionTitle>{t("settings.appearance")}</SectionTitle>
        <Segmented
          value={s.prefs.colorScheme}
          onChange={(v) => s.setPrefs({ colorScheme: v })}
          options={[
            { value: "system", label: t("settings.system") },
            { value: "light", label: t("settings.light") },
            { value: "dark", label: t("settings.dark") },
          ]}
        />
      </Card>

      <Card>
        <SectionTitle>{t("settings.privacy")}</SectionTitle>
        <Text style={[ty.small, { color: c.textSecondary, lineHeight: 20 }]}>{t("settings.privacyText")}</Text>
      </Card>

      <Card>
        <ListRow icon="server-outline" title={t("settings.apiStatus")} subtitle={apiBaseUrl() ?? t("settings.apiNotConfigured")} />
        <Text style={[ty.small, { color: c.textSubtle }]}>{t("settings.version", { v: Constants.expoConfig?.version ?? "dev" })}</Text>
        {!isServerMode() && <Button label={t("settings.resetData")} variant="secondary" onPress={() => s.resetData()} />}
      </Card>
    </Screen>
  );
}
