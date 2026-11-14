import { Platform, useColorScheme, type ViewStyle } from "react-native";
import { useTourStore } from "./store/tourStore";

/*
 * TURVIO NEXT – Driver palette and typography (approved prototype: design/next/driver).
 * Values are the prototype's own (base.css / driver.css): obsidian/charcoal dark, warm porcelain light.
 * Web counterpart: packages/web-ui/src/ds/tokens.css – keep values in sync.
 *
 * Roles: bg = screen background · card = cards/sheets · surface = inputs/inner tiles ·
 * surface2 = chips/pressed · border/borderStrong = hairlines · primary = violet actions.
 */
export type Palette = {
  white: string;
  bg: string;
  card: string;
  surface: string;
  surface2: string;
  raised: string;
  overlay: string;
  primary: string;
  primaryHi: string;
  primaryText: string;
  primaryPressed: string;
  primarySoft: string;
  navy: string;
  ink: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  textSubtle: string;
  border: string;
  borderStrong: string;
  success: string;
  successInk: string;
  successSoft: string;
  danger: string;
  dangerInk: string;
  dangerSoft: string;
  warning: string;
  warningInk: string;
  warningSoft: string;
  cobalt: string;
  cyan: string;
  cyanSoft: string;
  /** Hero card gradient (top-left → middle → bottom-right), glow and grid/outline line. */
  heroFrom: string;
  heroMid: string;
  heroTo: string;
  heroGlow: string;
  heroLine: string;
  /** Floating tab bar. */
  tabBar: string;
};

export const DARK: Palette = {
  white: "#FFFFFF",
  bg: "#090B11",
  card: "#141821",
  surface: "#1A1F2B",
  surface2: "#212736",
  raised: "#212736",
  overlay: "rgba(5,7,12,0.62)",
  primary: "#6F55FF",
  primaryHi: "#8C76FF",
  primaryText: "#AA9BFF",
  primaryPressed: "#5B44E8",
  primarySoft: "rgba(117,91,255,0.16)",
  navy: "#F1F3F9",
  ink: "#F1F3F9",
  text: "#F1F3F9",
  textSecondary: "#B4BBCC",
  textMuted: "#8A93A8",
  textSubtle: "#6E778C",
  border: "rgba(166,180,224,0.11)",
  borderStrong: "rgba(166,180,224,0.2)",
  success: "#2CE6A6",
  successInk: "#2CE6A6",
  successSoft: "rgba(44,230,166,0.13)",
  danger: "#FF718B",
  dangerInk: "#FF8FA3",
  dangerSoft: "rgba(255,113,139,0.14)",
  warning: "#FFB85C",
  warningInk: "#FFB85C",
  warningSoft: "rgba(255,184,92,0.14)",
  cobalt: "#3478FF",
  cyan: "#18D9E8",
  cyanSoft: "rgba(24,217,232,0.13)",
  heroFrom: "#1E2148",
  heroMid: "#171C38",
  heroTo: "#121730",
  heroGlow: "rgba(117,91,255,0.45)",
  heroLine: "rgba(170,155,255,0.24)",
  tabBar: "rgba(20,24,33,0.94)",
};

export const LIGHT: Palette = {
  white: "#FFFFFF",
  bg: "#F6F4EF",
  card: "#FFFFFF",
  surface: "#FAF8F4",
  surface2: "#EFECE5",
  raised: "#FFFFFF",
  overlay: "rgba(40,36,60,0.32)",
  primary: "#5B44E8",
  primaryHi: "#6A55F0",
  primaryText: "#4A34D4",
  primaryPressed: "#4A34D4",
  primarySoft: "rgba(91,68,232,0.1)",
  navy: "#161922",
  ink: "#161922",
  text: "#161922",
  textSecondary: "#454B5C",
  textMuted: "#646A7C",
  textSubtle: "#8A8F9E",
  border: "rgba(44,40,66,0.09)",
  borderStrong: "rgba(44,40,66,0.16)",
  success: "#0B8A5F",
  successInk: "#0B8A5F",
  successSoft: "rgba(11,138,95,0.1)",
  danger: "#CF3558",
  dangerInk: "#CF3558",
  dangerSoft: "rgba(207,53,88,0.09)",
  warning: "#A35C00",
  warningInk: "#A35C00",
  warningSoft: "rgba(163,92,0,0.1)",
  cobalt: "#2563EB",
  cyan: "#0A8B99",
  cyanSoft: "rgba(10,139,153,0.1)",
  heroFrom: "#FFFFFF",
  heroMid: "#F5F3FF",
  heroTo: "#EEF0FF",
  heroGlow: "rgba(122,98,255,0.28)",
  heroLine: "rgba(91,68,232,0.16)",
  tabBar: "rgba(255,255,255,0.95)",
};

export function useTheme(): { c: Palette; dark: boolean } {
  const system = useColorScheme();
  const pref = useTourStore((s) => s.prefs?.colorScheme ?? "system");
  const dark = pref === "dark" || (pref === "system" && system !== "light");
  return { c: dark ? DARK : LIGHT, dark };
}

/**
 * Plus Jakarta Sans, one family per weight (assets/fonts, SIL OFL; loaded in app/_layout.tsx).
 * Set the family instead of fontWeight: Android would otherwise synthesise bold on top of it.
 * Arabic glyphs fall back to the system's Arabic font.
 */
export const FONT_FILES = {
  PlusJakartaSans_400Regular: require("../assets/fonts/PlusJakartaSans_400Regular.ttf"),
  PlusJakartaSans_500Medium: require("../assets/fonts/PlusJakartaSans_500Medium.ttf"),
  PlusJakartaSans_600SemiBold: require("../assets/fonts/PlusJakartaSans_600SemiBold.ttf"),
  PlusJakartaSans_700Bold: require("../assets/fonts/PlusJakartaSans_700Bold.ttf"),
  PlusJakartaSans_800ExtraBold: require("../assets/fonts/PlusJakartaSans_800ExtraBold.ttf"),
} as const;

export const font = {
  regular: { fontFamily: "PlusJakartaSans_400Regular" },
  medium: { fontFamily: "PlusJakartaSans_500Medium" },
  semibold: { fontFamily: "PlusJakartaSans_600SemiBold" },
  bold: { fontFamily: "PlusJakartaSans_700Bold" },
  extrabold: { fontFamily: "PlusJakartaSans_800ExtraBold" },
} as const;

/**
 * TURVIO mobile design tokens (see docs/MOBILE_DESIGN_SYSTEM.md).
 * Hierarchy from weight and colour; 4-pt spacing grid; prototype radii (12/16/22).
 */
export const space = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24 } as const;
export const radii = { sm: 10, md: 12, lg: 16, xl: 22, pill: 999 } as const;
/** Touch targets: never below 44 pt (iOS) / 48 dp (Material) for anything a driver taps. */
export const touch = { min: 48, button: 52, buttonLg: 58, tile: 64, hero: 64 } as const;
export const type = {
  /** Screen titles on tab roots ("Hello, Lena"). */
  display: { fontSize: 24, ...font.extrabold, letterSpacing: -0.5, lineHeight: 30 },
  title: { fontSize: 21, ...font.extrabold, letterSpacing: -0.4, lineHeight: 27 },
  h2: { fontSize: 17, ...font.bold, letterSpacing: -0.2, lineHeight: 22 },
  body: { fontSize: 15, ...font.medium, lineHeight: 21 },
  bodyStrong: { fontSize: 15, ...font.bold, lineHeight: 21 },
  small: { fontSize: 13, ...font.medium, lineHeight: 18 },
  smallStrong: { fontSize: 13, ...font.bold, lineHeight: 18 },
  caption: { fontSize: 12, ...font.bold, letterSpacing: 0.2, lineHeight: 16 },
  /** Key figures (km, minutes, counts). Tabular so numbers do not jump while updating. */
  metric: { fontSize: 18, ...font.extrabold, lineHeight: 22, fontVariant: ["tabular-nums" as const] },
};

/** Family for an explicit weight (replaces inline fontWeight). */
export function fw(weight: "400" | "500" | "600" | "700" | "800") {
  return { "400": font.regular, "500": font.medium, "600": font.semibold, "700": font.bold, "800": font.extrabold }[weight];
}

/*
 * Depth effects – the only place shadows/elevation are defined (enforced by __tests__/depth.test.ts).
 *
 * Why: iOS (and the web build) draw a shadow from the layer's painted content and honour
 * shadowOpacity/Radius/Offset. Android does not: `elevation` draws an outline-based shadow in
 * `shadowColor` at full strength and ignores opacity/radius/offset, and it shows through any
 * transparent or translucent background. On our gradient buttons (transparent view + SVG gradient)
 * that produced the solid blue/purple block and the rectangular extensions around buttons.
 */

/** Coloured glow under a gradient action (violet/mint). iOS and web only – none on Android. */
export function glow(color: string, size: "md" | "lg" = "md"): ViewStyle {
  if (Platform.OS === "android") return {};
  return size === "lg"
    ? { shadowColor: color, shadowOpacity: 0.55, shadowRadius: 18, shadowOffset: { width: 0, height: 10 } }
    : { shadowColor: color, shadowOpacity: 0.45, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } };
}

/**
 * Neutral lift for cards, sheets and floating bars. On Android `elevation` is only used for
 * surfaces with an opaque background (pass opaque: false for transparent/translucent ones).
 */
export function lift(level: 1 | 2 | 3, opts: { opaque: boolean }): ViewStyle {
  if (Platform.OS === "android") return opts.opaque ? { elevation: level * 2 } : {};
  const t = { 1: [0.18, 6, 2], 2: [0.25, 14, 6], 3: [0.32, 22, 10] }[level];
  return { shadowColor: "#000", shadowOpacity: t[0], shadowRadius: t[1], shadowOffset: { width: 0, height: t[2] } };
}
