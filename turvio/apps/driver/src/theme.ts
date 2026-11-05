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

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 } as const;
export const radii = { sm: 8, md: 12, lg: 16, xl: 22, pill: 999 } as const;
/** Large, glove-friendly touch targets. */
export const touch = { min: 48, button: 56, hero: 76 } as const;
export const type = {
  display: { fontSize: 28, fontWeight: "800" as const, letterSpacing: -0.5 },
  title: { fontSize: 22, fontWeight: "700" as const, letterSpacing: -0.3 },
  h2: { fontSize: 18, fontWeight: "700" as const },
  body: { fontSize: 16, fontWeight: "400" as const },
  bodyStrong: { fontSize: 16, fontWeight: "600" as const },
  small: { fontSize: 14, fontWeight: "400" as const },
  caption: { fontSize: 12, fontWeight: "600" as const, letterSpacing: 0.4 },
};
