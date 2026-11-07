import { colors as light } from "@turvio/shared";
import { useColorScheme } from "react-native";
import { useTourStore } from "./store/tourStore";

/** Driver palette: TURVIO tokens (light) and a matching dark variant for night shifts. */
export type Palette = { [K in keyof typeof light]: string } & {
  bg: string;
  card: string;
  overlay: string;
  ink: string;
};

export const LIGHT: Palette = { ...light, bg: "#F4F6F9", card: "#FFFFFF", overlay: "rgba(15,23,42,0.45)", ink: light.text };

export const DARK: Palette = {
  ...light,
  white: "#FFFFFF",
  surface: "#0B1220",
  surface2: "#1E293B",
  primary: "#3B82F6",
  primaryPressed: "#2563EB",
  primarySoft: "#172554",
  navy: "#E2E8F0",
  text: "#F1F5F9",
  textSecondary: "#CBD5E1",
  textMuted: "#94A3B8",
  textSubtle: "#64748B",
  border: "#1E293B",
  borderStrong: "#334155",
  successSoft: "#052E22",
  successInk: "#34D399",
  dangerSoft: "#3B0D0D",
  dangerInk: "#F87171",
  warningSoft: "#3A2604",
  warningInk: "#FBBF24",
  bg: "#060B16",
  card: "#0F172A",
  overlay: "rgba(0,0,0,0.6)",
  ink: "#F8FAFC",
};

export function useTheme(): { c: Palette; dark: boolean } {
  const system = useColorScheme();
  const pref = useTourStore((s) => s.prefs?.colorScheme ?? "system");
  const dark = pref === "dark" || (pref === "system" && system === "dark");
  return { c: dark ? DARK : LIGHT, dark };
}

/**
 * TURVIO mobile design tokens (see docs/MOBILE_DESIGN_SYSTEM.md).
 * Dense but readable: drivers glance at the phone between stops, so hierarchy comes from
 * weight and colour, not from size. 4-pt spacing grid, 1-px borders instead of shadows.
 */
export const space = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24 } as const;
export const radii = { sm: 8, md: 10, lg: 14, xl: 18, pill: 999 } as const;
/** Touch targets: never below 44 pt (iOS) / 48 dp (Material) for anything a driver taps. */
export const touch = { min: 48, button: 48, buttonLg: 52, tile: 64, hero: 64 } as const;
export const type = {
  /** Screen titles on tab roots ("Hello, Lena"). */
  display: { fontSize: 24, fontWeight: "700" as const, letterSpacing: -0.4, lineHeight: 30 },
  title: { fontSize: 20, fontWeight: "700" as const, letterSpacing: -0.2, lineHeight: 26 },
  h2: { fontSize: 17, fontWeight: "600" as const, lineHeight: 22 },
  body: { fontSize: 15, fontWeight: "400" as const, lineHeight: 21 },
  bodyStrong: { fontSize: 15, fontWeight: "600" as const, lineHeight: 21 },
  small: { fontSize: 13, fontWeight: "400" as const, lineHeight: 18 },
  smallStrong: { fontSize: 13, fontWeight: "600" as const, lineHeight: 18 },
  caption: { fontSize: 12, fontWeight: "600" as const, letterSpacing: 0.3, lineHeight: 16 },
  /** Key figures (km, minutes, counts). Tabular so numbers do not jump while updating. */
  metric: { fontSize: 18, fontWeight: "700" as const, lineHeight: 22, fontVariant: ["tabular-nums" as const] },
};
