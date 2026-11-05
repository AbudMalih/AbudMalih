import Ionicons from "@expo/vector-icons/Ionicons";
import type { ComponentProps, ReactNode } from "react";
import { ActivityIndicator, I18nManager, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { radii, space, touch, type as ty, useTheme, type Palette } from "../theme";

export type IconName = ComponentProps<typeof Ionicons>["name"];
export { Ionicons };

type Variant = "primary" | "secondary" | "ghost" | "danger" | "success" | "dark";

function variantColors(c: Palette, v: Variant) {
  switch (v) {
    case "primary":
      return { bg: c.primary, fg: "#FFFFFF", border: c.primary };
    case "success":
      return { bg: c.success, fg: "#FFFFFF", border: c.success };
    case "danger":
      return { bg: c.dangerSoft, fg: c.dangerInk, border: c.dangerSoft };
    case "dark":
      return { bg: c.ink === "#F8FAFC" ? c.surface2 : "#0F172A", fg: "#FFFFFF", border: "transparent" };
    case "ghost":
      return { bg: "transparent", fg: c.primary, border: "transparent" };
    default:
      return { bg: c.card, fg: c.text, border: c.border };
  }
}

export function Button(props: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  icon?: IconName;
  size?: "md" | "lg";
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  testID?: string;
  accessibilityHint?: string;
}) {
  const { c } = useTheme();
  const v = variantColors(c, props.variant ?? "primary");
  const disabled = props.disabled || props.loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.label}
      accessibilityHint={props.accessibilityHint}
      accessibilityState={{ disabled: !!disabled, busy: !!props.loading }}
      testID={props.testID}
      disabled={disabled}
      onPress={props.onPress}
      style={({ pressed }) => [
        s.button,
        { minHeight: props.size === "lg" ? touch.button + 4 : touch.button - 4, backgroundColor: v.bg, borderColor: v.border, opacity: disabled ? 0.45 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
        props.style,
      ]}
    >
      {props.loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <>
          {props.icon && <Ionicons name={props.icon} size={20} color={v.fg} />}
          <Text style={[ty.bodyStrong, { color: v.fg, fontSize: props.size === "lg" ? 17 : 16 }]} numberOfLines={1}>
            {props.label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

/** The two hero actions on the home screen. */
export function HeroAction(props: { title: string; subtitle?: string; icon: IconName; onPress: () => void; tone: "primary" | "dark"; testID?: string; disabled?: boolean; loading?: boolean }) {
  const { c, dark } = useTheme();
  const bg = props.tone === "primary" ? c.primary : dark ? c.surface2 : "#0F172A";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.title}
      accessibilityHint={props.subtitle}
      testID={props.testID}
      disabled={props.disabled || props.loading}
      onPress={props.onPress}
      style={({ pressed }) => [s.hero, { backgroundColor: bg, opacity: props.disabled ? 0.5 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }]}
    >
      <View style={s.heroIcon}>{props.loading ? <ActivityIndicator color="#FFFFFF" /> : <Ionicons name={props.icon} size={28} color="#FFFFFF" />}</View>
      <View style={{ flex: 1 }}>
        <Text style={[ty.h2, { color: "#FFFFFF" }]}>{props.title}</Text>
        {props.subtitle ? (
          <Text style={[ty.small, { color: "rgba(255,255,255,0.8)", marginTop: 2 }]} numberOfLines={2}>
            {props.subtitle}
          </Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={22} color="rgba(255,255,255,0.85)" style={s.flipRtl} />
    </Pressable>
  );
}

export function Card({ children, style, onPress, testID }: { children: ReactNode; style?: ViewStyle; onPress?: () => void; testID?: string }) {
  const { c } = useTheme();
  const base = [s.card, { backgroundColor: c.card, borderColor: c.border }, style];
  if (!onPress) return <View style={base} testID={testID}>{children}</View>;
  return (
    <Pressable onPress={onPress} testID={testID} accessibilityRole="button" style={({ pressed }) => [...base, { opacity: pressed ? 0.9 : 1 }]}>
      {children}
    </Pressable>
  );
}

export type Tone = "neutral" | "primary" | "success" | "danger" | "warning";
export function toneColors(c: Palette, tone: Tone) {
  return {
    neutral: [c.surface2, c.textMuted],
    primary: [c.primarySoft, c.primary],
    success: [c.successSoft, c.successInk],
    danger: [c.dangerSoft, c.dangerInk],
    warning: [c.warningSoft, c.warningInk],
  }[tone] as [string, string];
}

export function Pill({ label, tone = "neutral", icon, testID }: { label: string; tone?: Tone; icon?: IconName; testID?: string }) {
  const { c } = useTheme();
  const [bg, fg] = toneColors(c, tone);
  return (
    <View style={[s.pill, { backgroundColor: bg }]} testID={testID}>
      {icon && <Ionicons name={icon} size={12} color={fg} />}
      <Text style={[ty.caption, { color: fg, letterSpacing: 0.2 }]}>{label}</Text>
    </View>
  );
}

export function Banner({ text, tone = "warning", icon, action }: { text: string; tone?: Tone; icon?: IconName; action?: { label: string; onPress: () => void } }) {
  const { c } = useTheme();
  const [bg, fg] = toneColors(c, tone);
  return (
    <View style={[s.banner, { backgroundColor: bg }]} accessibilityRole="alert">
      <Ionicons name={icon ?? (tone === "danger" ? "alert-circle" : tone === "success" ? "checkmark-circle" : "information-circle")} size={18} color={fg} />
      <Text style={[ty.small, { color: fg, flex: 1, fontWeight: "600" }]}>{text}</Text>
      {action && (
        <Pressable onPress={action.onPress} hitSlop={10} accessibilityRole="button">
          <Text style={[ty.small, { color: fg, fontWeight: "800" }]}>{action.label}</Text>
        </Pressable>
      )}
    </View>
  );
}

export function ProgressBar({ value, tone = "success" }: { value: number; tone?: "success" | "primary" }) {
  const { c } = useTheme();
  return (
    <View style={[s.track, { backgroundColor: c.surface2 }]} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}>
      <View style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, height: "100%", borderRadius: 4, backgroundColor: tone === "success" ? c.success : c.primary }} />
    </View>
  );
}

export function SectionTitle({ children, right }: { children: string; right?: ReactNode }) {
  const { c } = useTheme();
  return (
    <View style={[s.row, { justifyContent: "space-between", marginTop: space.sm }]}>
      <Text style={[ty.caption, { color: c.textMuted, textTransform: "uppercase" }]}>{children}</Text>
      {right}
    </View>
  );
}

export function IconButton({ icon, label, onPress, active, testID, size = touch.min }: { icon: IconName; label: string; onPress: () => void; active?: boolean; testID?: string; size?: number }) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!active }}
      onPress={onPress}
      testID={testID}
      hitSlop={6}
      style={({ pressed }) => [s.iconBtn, { width: size, height: size, backgroundColor: active ? c.primary : c.card, borderColor: active ? c.primary : c.border, opacity: pressed ? 0.8 : 1 }]}
    >
      <Ionicons name={icon} size={22} color={active ? "#FFFFFF" : c.text} />
    </Pressable>
  );
}

export function Field(props: TextInputProps & { label: string; error?: string | null; hint?: string; right?: ReactNode }) {
  const { c } = useTheme();
  const { label, error, hint, right, style, ...input } = props;
  return (
    <View style={{ gap: 6, flex: (style as ViewStyle | undefined)?.flex, minWidth: 0, flexBasis: (style as ViewStyle | undefined)?.flex ? 0 : undefined }}>
      <Text style={[ty.small, { color: c.textSecondary, fontWeight: "600" }]}>{label}</Text>
      <View style={[s.row, { gap: 0 }]}>
        <TextInput
          placeholderTextColor={c.textSubtle}
          accessibilityLabel={label}
          {...input}
          style={[s.input, { backgroundColor: c.card, color: c.text, borderColor: error ? c.danger : c.border, flex: 1, minWidth: 0 }, (style as ViewStyle | undefined)?.minHeight ? { minHeight: (style as ViewStyle).minHeight } : null]}
        />
        {right}
      </View>
      {error ? <Text style={[ty.small, { color: c.dangerInk }]}>{error}</Text> : hint ? <Text style={[ty.small, { color: c.textMuted }]}>{hint}</Text> : null}
    </View>
  );
}

export function Segmented<T extends string>({ value, options, onChange, testID }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; testID?: string }) {
  const { c } = useTheme();
  return (
    <View style={[s.segment, { backgroundColor: c.surface2 }]} testID={testID} accessibilityRole="tablist">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.value)}
            style={[s.segmentItem, on && { backgroundColor: c.card, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 4, elevation: 1 }]}
          >
            <Text style={[ty.small, { fontWeight: "700", color: on ? c.text : c.textMuted }]} numberOfLines={1}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Bottom sheet built on Modal (no extra native dependency). */
export function Sheet({ visible, onClose, title, children, testID }: { visible: boolean; onClose: () => void; title: string; children: ReactNode; testID?: string }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: c.overlay }]} onPress={onClose} accessibilityLabel="Close" />
      <View style={[s.sheet, { backgroundColor: c.card, paddingBottom: insets.bottom + space.lg }]} testID={testID}>
        <View style={[s.grabber, { backgroundColor: c.borderStrong }]} />
        <Text style={[ty.title, { color: c.text, marginBottom: space.md }]}>{title}</Text>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: space.md }}>
          {children}
        </ScrollView>
      </View>
    </Modal>
  );
}

export function ListRow({ icon, title, subtitle, right, onPress, testID, tone }: { icon?: IconName; title: string; subtitle?: string; right?: ReactNode; onPress?: () => void; testID?: string; tone?: Tone }) {
  const { c } = useTheme();
  const [bg, fg] = toneColors(c, tone ?? "neutral");
  const body = (
    <>
      {icon && (
        <View style={[s.rowIcon, { backgroundColor: tone ? bg : c.surface2 }]}>
          <Ionicons name={icon} size={20} color={tone ? fg : c.textSecondary} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={[ty.bodyStrong, { color: c.text }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[ty.small, { color: c.textMuted }]} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ?? (onPress ? <Ionicons name="chevron-forward" size={18} color={c.textSubtle} style={s.flipRtl} /> : null)}
    </>
  );
  if (!onPress) return <View style={s.listRow}>{body}</View>;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={title} testID={testID} style={({ pressed }) => [s.listRow, { opacity: pressed ? 0.7 : 1 }]}>
      {body}
    </Pressable>
  );
}

export function EmptyState({ icon, title, text, action }: { icon: IconName; title: string; text?: string; action?: ReactNode }) {
  const { c } = useTheme();
  return (
    <View style={{ alignItems: "center", paddingVertical: space.xxl, paddingHorizontal: space.xl, gap: space.sm }}>
      <View style={[s.emptyIcon, { backgroundColor: c.primarySoft }]}>
        <Ionicons name={icon} size={28} color={c.primary} />
      </View>
      <Text style={[ty.h2, { color: c.text, textAlign: "center" }]}>{title}</Text>
      {text ? <Text style={[ty.small, { color: c.textMuted, textAlign: "center" }]}>{text}</Text> : null}
      {action}
    </View>
  );
}

export function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  const { c } = useTheme();
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Text style={[ty.caption, { color: c.textMuted, letterSpacing: 0 }]} numberOfLines={2}>
        {label}
      </Text>
      <Text style={[ty.h2, { color: c.text }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      {hint ? (
        <Text style={[ty.small, { color: c.textSubtle, fontSize: 12 }]} numberOfLines={2}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

export function Screen({ children, scroll = true, testID, padded = true }: { children: ReactNode; scroll?: boolean; testID?: string; padded?: boolean }) {
  const { c } = useTheme();
  if (!scroll) return <View style={{ flex: 1, backgroundColor: c.bg }} testID={testID}>{children}</View>;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={padded ? { padding: space.lg, gap: space.md, paddingBottom: space.xxl * 2 } : undefined} keyboardShouldPersistTaps="handled" testID={testID}>
      {children}
    </ScrollView>
  );
}

export const s = StyleSheet.create({
  button: { borderRadius: radii.md, borderWidth: 1, paddingHorizontal: space.lg, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: space.sm },
  hero: { minHeight: touch.hero + 8, borderRadius: radii.xl, padding: space.lg, flexDirection: "row", alignItems: "center", gap: space.md },
  heroIcon: { width: 52, height: 52, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.16)", alignItems: "center", justifyContent: "center" },
  card: { borderRadius: radii.lg, padding: space.lg, borderWidth: 1, gap: space.sm },
  pill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: radii.pill, alignSelf: "flex-start" },
  banner: { flexDirection: "row", alignItems: "center", gap: space.sm, padding: space.md, borderRadius: radii.md },
  track: { height: 8, borderRadius: 4, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: space.sm },
  iconBtn: { borderRadius: radii.md, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  input: { minHeight: touch.min + 4, borderWidth: 1, borderRadius: radii.md, paddingHorizontal: space.md, fontSize: 16, textAlign: "auto" },
  segment: { flexDirection: "row", padding: 3, borderRadius: radii.md, gap: 3 },
  segmentItem: { flex: 1, minHeight: 40, borderRadius: radii.sm, alignItems: "center", justifyContent: "center", paddingHorizontal: space.sm },
  sheet: { position: "absolute", left: 0, right: 0, bottom: 0, maxHeight: "88%", borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl, padding: space.lg, paddingTop: space.sm },
  grabber: { width: 40, height: 5, borderRadius: 3, alignSelf: "center", marginBottom: space.md },
  listRow: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: touch.button, paddingVertical: space.sm },
  rowIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  emptyIcon: { width: 60, height: 60, borderRadius: 20, alignItems: "center", justifyContent: "center", marginBottom: space.sm },
  // Directional icons follow the layout direction (RTL takes effect after an app restart).
  flipRtl: { transform: [{ scaleX: I18nManager.isRTL ? -1 : 1 }] },
});
