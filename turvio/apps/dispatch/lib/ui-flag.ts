/** Phase G design preview flag – server-safe part (see lib/ui.tsx). */
export const UI_COOKIE = "tv_ui";
export type UiVersion = "classic" | "g";
export const resolveUi = (v: unknown): UiVersion => (v === "g" ? "g" : "classic");
