/** Phase G design preview flag – server-safe part (see lib/ui.tsx). */
export const UI_COOKIE = "tv_ui";
export type UiVersion = "classic" | "g";
/** Phase G is the Dispatch default; the previous design stays available as a fallback (`?ui=classic`). */
export const resolveUi = (v: unknown): UiVersion => (v === "classic" ? "classic" : "g");
