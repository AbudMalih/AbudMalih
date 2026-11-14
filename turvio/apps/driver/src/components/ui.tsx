import Ionicons from "@expo/vector-icons/Ionicons";
import { HeaderHeightContext } from "expo-router/react-navigation";
import { useContext, useId, type ComponentProps, type ReactNode } from "react";
import { ActivityIndicator, I18nManager, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { fw, glow, lift, radii, space, touch, type as ty, useTheme, type Palette } from "../theme";

export type IconName = ComponentProps<typeof Ionicons>["name"];
export { Ionicons };

type Variant = "primary" | "secondary" | "ghost" | "danger" | "success" | "dark";

/** TURVIO NEXT gradients (prototype .bb-nav / .bb-ok / scan button). */
export const GRADIENTS = {
  violet: ["#8C76FF", "#6F55FF", "#4F3BE0"],
  mint: ["#4BF2BC", "#2CD9A0", "#22C98F"],
  scan: ["#8C76FF", "#5F67FF", "#3478FF"],
} as const;

/**
 * Base style for any view painted by a GradientFill: an opaque background (the gradient's middle
 * colour) so the view's own rounded shape matches what is painted, no border (a border insets the
 * fill and leaves a ring), and clipping to the radius. Use together with glow(), never elevation.
 */
export function gradientSurface(colors: readonly string[], radius: number): ViewStyle {
  return { backgroundColor: colors[Math.floor(colors.length / 2)], borderRadius: radius, borderWidth: 0, overflow: "hidden" };
}

/** Diagonal (135°) gradient filling its parent (style the parent with gradientSurface()). */
export function GradientFill({ colors, radius = 0 }: { colors: readonly string[]; radius?: number }) {
  // Unique per instance: on the web, ids are document-wide and hidden screens stay mounted.
  const id = `g${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          {colors.map((col, i) => (
            <Stop key={col + i} offset={colors.length === 1 ? 0 : i / (colors.length - 1)} stopColor={col} />
          ))}
        </LinearGradient>
      </Defs>
      <Rect width="100%" height="100%" rx={radius} ry={radius} fill={`url(#${id})`} />
    </Svg>
  );
}

function variantColors(c: Palette, v: Variant): { bg: string; fg: string; border: string; gradient?: readonly string[]; glow?: string } {
  switch (v) {
    case "primary":
      return { bg: c.primary, fg: "#FFFFFF", border: "transparent", gradient: GRADIENTS.violet, glow: "#6F55FF" };
    case "success":
      return { bg: c.success, fg: "#04150D", border: "transparent", gradient: GRADIENTS.mint, glow: "#2CE6A6" };
    case "danger":
      return { bg: c.dangerSoft, fg: c.danger, border: c.dangerSoft };
    case "dark":
      return { bg: c.surface2, fg: c.text, border: c.borderStrong };
    case "ghost":
      return { bg: "transparent", fg: c.primaryText, border: "transparent" };
    default:
      return { bg: c.surface2, fg: c.text, border: c.borderStrong };
  }
}

export function Button(props: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  icon?: IconName;
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  testID?: string;
  accessibilityHint?: string;
}) {
  const height = props.size === "lg" ? touch.buttonLg : props.size === "sm" ? 40 : touch.button;
  const { c } = useTheme();
  const v = variantColors(c, props.variant ?? "primary");
  const disabled = props.disabled || props.loading;
  const radius = props.size === "sm" ? 14 : 18;
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
        {
          minHeight: height,
          borderRadius: radius,
          paddingHorizontal: props.size === "sm" ? space.md : space.lg,
          backgroundColor: v.bg,
          borderColor: v.border,
          opacity: disabled ? 0.45 : 1,
          transform: [{ scale: pressed ? 0.97 : 1 }],
        },
        v.gradient ? gradientSurface(v.gradient, radius) : null,
        v.glow && !disabled ? glow(v.glow) : null,
        props.style,
      ]}
    >
      {v.gradient && <GradientFill colors={v.gradient} radius={radius} />}
      {props.loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <>
          {props.icon && <Ionicons name={props.icon} size={props.size === "sm" ? 16 : 18} color={v.fg} />}
          <Text style={[props.size === "sm" ? ty.smallStrong : ty.bodyStrong, props.size === "lg" ? { fontSize: 16, ...fw("800") } : null, { color: v.fg }]} numberOfLines={1}>
            {props.label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

/** The two hero actions on the home screen. */
export function HeroAction(props: { title: string; subtitle?: string; icon: IconName; onPress: () => void; tone: "primary" | "dark"; testID?: string; disabled?: boolean; loading?: boolean }) {
  const { c } = useTheme();
  const primary = props.tone === "primary";
  const bg = c.surface2;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.title}
      accessibilityHint={props.subtitle}
      testID={props.testID}
      disabled={props.disabled || props.loading}
      onPress={props.onPress}
      style={({ pressed }) => [
        s.hero,
        { backgroundColor: bg, borderColor: c.borderStrong, opacity: props.disabled ? 0.5 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] },
        primary ? gradientSurface(GRADIENTS.violet, 20) : null,
        primary && !props.disabled ? glow("#6F55FF", "lg") : null,
      ]}
    >
      {primary && <GradientFill colors={GRADIENTS.violet} radius={20} />}
      <View style={[s.heroIcon, !primary && { backgroundColor: c.primarySoft }]}>
        {props.loading ? <ActivityIndicator color={primary ? "#FFFFFF" : c.primaryText} /> : <Ionicons name={props.icon} size={22} color={primary ? "#FFFFFF" : c.primaryText} />}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[ty.bodyStrong, { fontSize: 16, ...fw("800"), color: primary ? "#FFFFFF" : c.text }]} numberOfLines={1}>{props.title}</Text>
        {props.subtitle ? (
          <Text style={[ty.small, { color: primary ? "rgba(255,255,255,0.82)" : c.textMuted }]} numberOfLines={1}>
            {props.subtitle}
          </Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={primary ? "rgba(255,255,255,0.85)" : c.textMuted} style={s.flipRtl} />
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
    primary: [c.primarySoft, c.primaryText],
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
      <Text style={[ty.smallStrong, { color: fg, flex: 1 }]}>{text}</Text>
      {action && (
        <Pressable onPress={action.onPress} hitSlop={10} accessibilityRole="button">
          <Text style={[ty.small, { color: fg, ...fw("800") }]}>{action.label}</Text>
        </Pressable>
      )}
    </View>
  );
}

export function ProgressBar({ value, tone = "success" }: { value: number; tone?: "success" | "primary" }) {
  const { c } = useTheme();
  return (
    <View style={[s.track, { backgroundColor: c.surface2 }]} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}>
      <View style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, height: "100%", borderRadius: 4, backgroundColor: tone === "success" ? c.success : c.primaryHi }} />
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
      style={({ pressed }) => [s.iconBtn, { width: size, height: size, backgroundColor: active ? c.primary : c.card, borderColor: active ? c.primary : c.borderStrong, opacity: pressed ? 0.8 : 1, transform: [{ scale: pressed ? 0.93 : 1 }] }]}
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
      <Text style={[ty.small, { color: c.textSecondary, ...fw("600") }]}>{label}</Text>
      <View style={[s.row, { gap: 0 }]}>
        <TextInput
          placeholderTextColor={c.textSubtle}
          accessibilityLabel={label}
          {...input}
          style={[s.input, { backgroundColor: c.card, color: c.text, borderColor: error ? c.danger : c.borderStrong, flex: 1, minWidth: 0, ...fw("500") }, (style as ViewStyle | undefined)?.minHeight ? { minHeight: (style as ViewStyle).minHeight } : null]}
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
    <View style={[s.segment, { backgroundColor: c.card, borderColor: c.border }]} testID={testID} accessibilityRole="tablist">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.value)}
            style={[s.segmentItem, on && { backgroundColor: c.raised, borderColor: c.borderStrong, borderWidth: 1, ...lift(1, { opaque: true }) }]}
          >
            <Text style={[ty.small, { ...fw("700"), color: on ? c.text : c.textMuted, textAlign: "center" }]} numberOfLines={2}>
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
      {/* The sheet rides on top of the keyboard (paste/edit fields) on iOS and Android. */}
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.sheetHost} pointerEvents="box-none">
        <View style={[s.sheet, { backgroundColor: c.card, borderColor: c.borderStrong, paddingBottom: insets.bottom + space.lg }]} testID={testID}>
          <View style={[s.grabber, { backgroundColor: c.borderStrong }]} />
          <Text style={[ty.h2, { color: c.text, marginBottom: space.md }]}>{title}</Text>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: space.md }}>
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
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
        <Text style={[ty.bodyStrong, { color: c.text }]} numberOfLines={2}>
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
    <View style={{ alignItems: "center", paddingVertical: space.xl, paddingHorizontal: space.lg, gap: space.xs }}>
      <View style={[s.emptyIcon, { backgroundColor: c.primarySoft }]}>
        <Ionicons name={icon} size={26} color={c.primaryText} />
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
      <Text style={[ty.metric, { color: c.text }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      {hint ? (
        <Text style={[ty.caption, { color: c.textSubtle, ...fw("400"), letterSpacing: 0 }]} numberOfLines={2}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * Screen body for stack screens (the navigation header handles the top inset).
 * - bottom: content clears the Android navigation bar / gesture area and the iPhone home
 *   indicator (edge-to-edge), or sits above a sticky `footer` (BottomBar) that does so;
 * - keyboard: the content moves above the on-screen keyboard on both platforms.
 */
export function Screen({ children, scroll = true, testID, padded = true, footer, inTabs = false }: { children: ReactNode; scroll?: boolean; testID?: string; padded?: boolean; footer?: ReactNode; /** Tab screen: the tab bar already covers the bottom inset. */ inTabs?: boolean }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  // Inside the tab navigator the tab bar already sits above the home indicator / system bar,
  // so the bottom inset must not be added a second time.
  const bottom = inTabs ? 0 : insets.bottom;
  // iOS: the keyboard frame is measured from the window, the content starts below the header.
  const headerHeight = useContext(HeaderHeightContext) ?? 0;
  const body = !scroll ? (
    <View style={{ flex: 1, paddingBottom: footer ? 0 : bottom }}>{children}</View>
  ) : (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={padded ? { padding: space.lg, gap: space.md, paddingBottom: footer ? space.lg : bottom + space.xl } : { paddingBottom: footer ? 0 : bottom }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      testID={testID}
    >
      {children}
    </ScrollView>
  );
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={Platform.OS === "ios" ? headerHeight : 0} testID={scroll ? undefined : testID}>
      {body}
      {footer}
    </KeyboardAvoidingView>
  );
}

/** Sticky action bar at the bottom of a screen, above the system navigation / home indicator. */
export function BottomBar({ children, testID }: { children: ReactNode; testID?: string }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.bottomBar, { backgroundColor: c.card, borderTopColor: c.border, paddingBottom: Math.max(insets.bottom, space.sm) + space.sm }]} testID={testID}>
      {children}
    </View>
  );
}

/** Compact square action (icon + short label), e.g. the home quick actions. */
export function ActionTile({ icon, label, onPress, disabled, testID, tone = "neutral" }: { icon: IconName; label: string; onPress: () => void; disabled?: boolean; testID?: string; tone?: "neutral" | "primary" }) {
  const { c } = useTheme();
  const primary = tone === "primary";
  return (
    <Pressable
      testID={testID}
      disabled={disabled}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [s.tile, { backgroundColor: primary ? c.primarySoft : c.card, borderColor: primary ? c.primarySoft : c.border, opacity: disabled ? 0.4 : pressed ? 0.75 : 1 }]}
    >
      <Ionicons name={icon} size={20} color={c.primaryText} />
      <Text style={[ty.caption, { color: c.text, letterSpacing: 0, textAlign: "center" }]} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

/** 24-pt checkbox with a 48-pt touch area. */
export function Checkbox({ checked, onChange, label, testID }: { checked: boolean; onChange: () => void; label: string; testID?: string }) {
  const { c } = useTheme();
  return (
    <Pressable onPress={onChange} hitSlop={12} accessibilityRole="checkbox" accessibilityState={{ checked }} accessibilityLabel={label} testID={testID} style={[s.checkbox, { borderColor: checked ? c.primary : c.borderStrong, backgroundColor: checked ? c.primary : "transparent" }]}>
      {checked && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
    </Pressable>
  );
}

export const s = StyleSheet.create({
  button: { borderRadius: 18, borderWidth: 1, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 9, overflow: "hidden" },
  hero: { minHeight: touch.hero, borderRadius: 20, borderWidth: 1, paddingHorizontal: space.md, paddingVertical: space.sm, flexDirection: "row", alignItems: "center", gap: space.md, overflow: "hidden" },
  heroIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  card: { borderRadius: radii.xl, padding: space.lg, borderWidth: 1, gap: space.sm },
  bottomBar: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: space.lg, paddingTop: space.sm, gap: space.xs },
  tile: { flex: 1, minHeight: touch.tile, borderRadius: 18, borderWidth: 1, alignItems: "center", justifyContent: "center", gap: space.xs, paddingHorizontal: space.xs, paddingVertical: space.sm },
  checkbox: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  pill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: radii.pill, alignSelf: "flex-start" },
  banner: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingHorizontal: space.md, paddingVertical: 12, borderRadius: radii.lg },
  track: { height: 6, borderRadius: 3, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: space.sm },
  iconBtn: { borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  input: { minHeight: touch.min, borderWidth: 1, borderRadius: 16, paddingHorizontal: space.md, fontSize: 16, textAlign: "auto" },
  segment: { flexDirection: "row", padding: 3, borderRadius: 14, gap: 3, borderWidth: 1 },
  segmentItem: { flex: 1, minHeight: 44, borderRadius: 11, alignItems: "center", justifyContent: "center", paddingHorizontal: space.sm },
  sheetHost: { flex: 1, justifyContent: "flex-end" },
  sheet: { maxHeight: "88%", borderTopLeftRadius: 26, borderTopRightRadius: 26, borderWidth: 1, borderBottomWidth: 0, padding: space.lg, paddingTop: space.sm },
  grabber: { width: 40, height: 5, borderRadius: 3, alignSelf: "center", marginBottom: space.md },
  listRow: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: touch.min + 4, paddingVertical: space.sm },
  rowIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  emptyIcon: { width: 72, height: 72, borderRadius: 22, alignItems: "center", justifyContent: "center", marginBottom: space.sm },
  // Directional icons follow the layout direction (RTL takes effect after an app restart).
  flipRtl: { transform: [{ scaleX: I18nManager.isRTL ? -1 : 1 }] },
});
