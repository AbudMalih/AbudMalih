import { router } from "expo-router";
import { Redirect } from "expo-router";
import { useState } from "react";
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Banner, Button, Field } from "../components/ui";
import { createAuthClient } from "../lib/auth";
import { useT } from "../lib/i18n";
import { apiBaseUrl } from "../lib/optimizer";
import { buildServerUrl, canOverrideServerUrl, setServerUrlOverride } from "../lib/serverUrl";
import { useTourStore } from "../store/tourStore";
import { fw, radii, space, type as ty, useTheme } from "../theme";

export default function LoginScreen() {
  const t = useT();
  const { c, dark } = useTheme();
  const insets = useSafeAreaInsets();
  const user = useTourStore((s) => s.user);
  const signIn = useTourStore((s) => s.signIn);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [server, setServer] = useState(() => apiBaseUrl() ?? "");
  const [serverError, setServerError] = useState<string | null>(null);
  const [serverOpen, setServerOpen] = useState(false);

  if (user) return <Redirect href="/" />;

  // Development and preview builds only; production always uses the built-in server.
  const showServer = canOverrideServerUrl();
  const saveServer = async (value: string | null) => {
    setServerError(null);
    const r = await setServerUrlOverride(value);
    if (!r.ok) return setServerError(t(r.reason === "insecure" ? "login.serverInsecure" : "login.serverInvalid"));
    const active = apiBaseUrl() ?? "";
    // Test build without a built-in server: "reset" goes back to demo mode.
    if (!active) return router.replace("/");
    setServer(active);
    setServerOpen(false);
    setInfo(t("login.serverSaved", { url: active }));
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await signIn(email, password);
      router.replace("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const forgot = async () => {
    if (!email.trim()) return setError(t("login.forgotNeedEmail"));
    setError(null);
    try {
      await createAuthClient().forgotPassword(email.trim());
      setInfo(t("login.forgotSent", { email: email.trim() }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingHorizontal: space.xl, paddingTop: insets.top + space.xl, paddingBottom: insets.bottom + space.xl, gap: space.xl }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ alignItems: "center", gap: space.sm }}>
          <Image source={dark ? require("../../assets/brand/turvio-lockup-dark.png") : require("../../assets/brand/turvio-lockup-light.png")} style={{ width: 190, height: 34 }} resizeMode="contain" accessibilityLabel="TURVIO" />
          <Text style={[ty.caption, { color: c.textMuted, letterSpacing: 2 }]}>DRIVER</Text>
        </View>
        <View style={{ backgroundColor: c.card, borderRadius: radii.xl, borderWidth: 1, borderColor: c.border, padding: space.xl, gap: space.md }}>
          <View style={{ gap: 4 }}>
            <Text style={[ty.title, { color: c.text }]}>{t("login.title")}</Text>
            <Text style={[ty.small, { color: c.textMuted }]}>{t("login.subtitle")}</Text>
          </View>
          {error && <Banner text={error} tone="danger" />}
          {info && <Banner text={info} tone="primary" />}
          <Field label={t("login.email")} value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="username" testID="login-email" />
          <Field label={t("login.password")} value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" textContentType="password" onSubmitEditing={submit} testID="login-password" />
          <Button label={t("login.submit")} size="lg" onPress={submit} loading={busy} disabled={!email || !password} testID="login-submit" />
          <Pressable onPress={forgot} accessibilityRole="button" style={{ alignSelf: "center", padding: space.sm }}>
            <Text style={[ty.small, { color: c.primary, ...fw("700") }]}>{t("login.forgot")}</Text>
          </Pressable>
        </View>
        {showServer && (
          <View style={{ backgroundColor: c.card, borderRadius: radii.xl, borderWidth: 1, borderColor: c.border, padding: space.lg, gap: space.sm }} testID="login-server">
            <Pressable onPress={() => setServerOpen((o) => !o)} accessibilityRole="button" testID="login-server-toggle">
              <Text style={[ty.small, { color: c.textMuted, ...fw("700") }]}>{t("login.server")}</Text>
              <Text style={[ty.small, { color: c.text }]} testID="login-server-active">
                {apiBaseUrl()}
              </Text>
            </Pressable>
            {serverOpen && (
              <>
                <Field
                  label={t("login.serverLabel")}
                  value={server}
                  onChangeText={setServer}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  error={serverError}
                  hint={t("login.serverHint", { url: buildServerUrl() ?? "" })}
                  testID="login-server-url"
                />
                <Button label={t("login.serverSave")} variant="secondary" onPress={() => void saveServer(server)} disabled={!server.trim()} testID="login-server-save" />
                <Button label={t("login.serverReset")} variant="ghost" onPress={() => void saveServer(null)} testID="login-server-reset" />
              </>
            )}
          </View>
        )}
        <Text style={[ty.small, { color: c.textSubtle, textAlign: "center" }]}>{t("app.tagline")}</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
