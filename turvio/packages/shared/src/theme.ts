/** TURVIO design tokens shared by the driver app and the dispatch dashboard. */
export const colors = {
  white: "#FFFFFF",
  surface: "#F7F8FA",
  primary: "#2563EB",
  primaryPressed: "#1D4ED8",
  primarySoft: "#DBEAFE",
  text: "#1F2937",
  textMuted: "#6B7280",
  border: "#E5E7EB",
  success: "#16A34A",
  successSoft: "#DCFCE7",
  danger: "#DC2626",
  dangerSoft: "#FEE2E2",
  warning: "#D97706",
  warningSoft: "#FEF3C7",
} as const;

export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
/** Minimum touch target (dp/px) for driver-facing controls. */
export const touchTarget = 52;
