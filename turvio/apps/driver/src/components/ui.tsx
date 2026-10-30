import { colors, radius, spacing, touchTarget } from "@turvio/shared";
import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";

type ButtonVariant = "primary" | "secondary" | "danger" | "success";

const VARIANTS: Record<ButtonVariant, { bg: string; fg: string; border: string }> = {
  primary: { bg: colors.primary, fg: colors.white, border: colors.primary },
  secondary: { bg: colors.white, fg: colors.text, border: colors.border },
  danger: { bg: colors.dangerSoft, fg: colors.danger, border: colors.dangerSoft },
  success: { bg: colors.success, fg: colors.white, border: colors.success },
};

export function Button(props: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  testID?: string;
}) {
  const v = VARIANTS[props.variant ?? "primary"];
  const disabled = props.disabled || props.loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.label}
      accessibilityState={{ disabled: !!disabled }}
      testID={props.testID}
      disabled={disabled}
      onPress={props.onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: v.bg, borderColor: v.border, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
        props.style,
      ]}
    >
      {props.loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <Text style={[styles.buttonLabel, { color: v.fg }]}>{props.label}</Text>
      )}
    </Pressable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Pill({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "primary" | "success" | "danger" | "warning" }) {
  const map = {
    neutral: [colors.surface, colors.textMuted],
    primary: [colors.primarySoft, colors.primary],
    success: [colors.successSoft, colors.success],
    danger: [colors.dangerSoft, colors.danger],
    warning: [colors.warningSoft, colors.warning],
  } as const;
  const [bg, fg] = map[tone];
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text style={[styles.pillText, { color: fg }]}>{label}</Text>
    </View>
  );
}

export function Banner({ text, tone = "warning" }: { text: string; tone?: "warning" | "primary" }) {
  const bg = tone === "warning" ? colors.warningSoft : colors.primarySoft;
  const fg = tone === "warning" ? colors.warning : colors.primary;
  return (
    <View style={[styles.banner, { backgroundColor: bg }]} accessibilityRole="text">
      <Text style={{ color: fg, fontSize: 13, fontWeight: "600" }}>{text}</Text>
    </View>
  );
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { padding: spacing.lg, gap: spacing.md },
  button: {
    minHeight: touchTarget,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonLabel: { fontSize: 17, fontWeight: "600" },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, alignSelf: "flex-start" },
  pillText: { fontSize: 12, fontWeight: "700" },
  banner: { padding: spacing.md, borderRadius: radius.md },
  h1: { fontSize: 24, fontWeight: "700", color: colors.text, textAlign: "left" },
  h2: { fontSize: 18, fontWeight: "700", color: colors.text, textAlign: "left" },
  body: { fontSize: 16, color: colors.text, textAlign: "left" },
  muted: { fontSize: 14, color: colors.textMuted, textAlign: "left" },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  input: {
    minHeight: touchTarget,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: 16,
    color: colors.text,
    textAlign: "left",
  },
  inputError: { borderColor: colors.danger },
  label: { fontSize: 14, fontWeight: "600", color: colors.text, marginBottom: 4, textAlign: "left" },
});
