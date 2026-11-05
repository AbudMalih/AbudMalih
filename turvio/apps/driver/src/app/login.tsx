import { router } from "expo-router";
import { Redirect } from "expo-router";
import { useState } from "react";
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { Banner, Button, Field } from "../components/ui";
import { createAuthClient } from "../lib/auth";
import { useT } from "../lib/i18n";
import { useTourStore } from "../store/tourStore";
import { radii, space, type as ty, useTheme } from "../theme";

export default function LoginScreen() {
  const t = useT();
  const { c, dark } = useTheme();
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
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: space.xl, gap: space.xl }} keyboardShouldPersistTaps="handled">
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
            <Text style={[ty.small, { color: c.primary, fontWeight: "700" }]}>{t("login.forgot")}</Text>
          </Pressable>
        </View>
        <Text style={[ty.small, { color: c.textSubtle, textAlign: "center" }]}>{t("app.tagline")}</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
