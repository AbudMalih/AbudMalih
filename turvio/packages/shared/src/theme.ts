/**
 * TURVIO design tokens for React Native (driver app).
 * Web counterpart: packages/web-ui/src/ds/tokens.css – keep values in sync.
 */
export const colors = {
  white: "#FFFFFF",
  /** App background (off-white). */
  surface: "#F8FAFC",
  /** Secondary surface, pressed/hover states. */
  surface2: "#F1F5F9",
  primary: "#2563EB",
  primaryPressed: "#1D4ED8",
  primarySoft: "#EFF6FF",
  navy: "#0F172A",
  text: "#0F172A",
  textSecondary: "#334155",
  textMuted: "#64748B",
  textSubtle: "#94A3B8",
  border: "#E2E8F0",
  borderStrong: "#CBD5E1",
  success: "#10B981",
  successInk: "#047857",
  successSoft: "#ECFDF5",
  danger: "#EF4444",
  dangerInk: "#B91C1C",
  dangerSoft: "#FEF2F2",
  warning: "#F59E0B",
  warningInk: "#B45309",
  warningSoft: "#FFFBEB",
} as const;

export const radius = { sm: 6, md: 8, lg: 12, xl: 16, pill: 999 } as const;
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
/** Minimum touch target (dp/px) for driver-facing controls. */
export const touchTarget = 52;
/** Motion durations in ms (respect reduced-motion settings). */
export const motion = { fast: 120, base: 180, slow: 260 } as const;
