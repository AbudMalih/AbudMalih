import { colors, spacing } from "@turvio/shared";
import { Redirect } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Banner, Button, Card, styles as ui } from "../components/ui";
import { createAuthClient } from "../lib/auth";
import { useT } from "../lib/i18n";
import { useTourStore } from "../store/tourStore";

export default function LoginScreen() {
  const t = useT();
  const user = useTourStore((s) => s.user);
  const signIn = useTourStore((s) => s.signIn);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  if (user) return <Redirect href="/" />;

  const submit = async () => {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await signIn(email, password);
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
    <KeyboardAvoidingView style={ui.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: spacing.xl, gap: spacing.lg }} keyboardShouldPersistTaps="handled">
        <View style={{ alignItems: "center", gap: spacing.sm, marginBottom: spacing.md }}>
          <Image source={require("../../assets/icon.png")} style={{ width: 72, height: 72, borderRadius: 18 }} accessibilityIgnoresInvertColors />
          <Text style={[ui.h1, { textAlign: "center" }]}>TURVIO Driver</Text>
          <Text style={[ui.muted, { textAlign: "center" }]}>{t("app.tagline")}</Text>
        </View>
        <Card>
          <Text style={ui.h2}>{t("login.title")}</Text>
          <Text style={ui.muted}>{t("login.subtitle")}</Text>
          {error && <Banner text={error} />}
          {info && <Banner text={info} tone="primary" />}
          <View style={{ gap: 4 }}>
            <Text style={ui.label}>{t("login.email")}</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              style={ui.input}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="username"
              accessibilityLabel={t("login.email")}
              testID="login-email"
            />
          </View>
          <View style={{ gap: 4 }}>
            <Text style={ui.label}>{t("login.password")}</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              style={ui.input}
              secureTextEntry
              autoComplete="password"
              textContentType="password"
              onSubmitEditing={submit}
              accessibilityLabel={t("login.password")}
              testID="login-password"
            />
          </View>
          <Button label={busy ? "…" : t("login.submit")} onPress={submit} disabled={busy || !email || !password} testID="login-submit" />
          {busy && <ActivityIndicator color={colors.primary} />}
          <Pressable onPress={forgot} accessibilityRole="button" style={{ alignSelf: "center", padding: spacing.sm }}>
            <Text style={{ color: colors.primary, fontWeight: "600" }}>{t("login.forgot")}</Text>
          </Pressable>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
