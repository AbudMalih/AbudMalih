"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";

/**
 * Phase G design preview. The new enterprise design is opt-in per browser while it is being
 * reviewed: open any Dispatch page with `?ui=g` to switch it on, `?ui=classic` to switch it off.
 * The choice is a cookie, so the server renders `<html data-ds="g">` and there is no flash.
 * Admin never sets it. Nothing about data, permissions or behaviour depends on it.
 */
import { UI_COOKIE, type UiVersion } from "./ui-flag";

export { UI_COOKIE, resolveUi, type UiVersion } from "./ui-flag";

const Ctx = createContext<UiVersion>("classic");
export const useUiVersion = () => useContext(Ctx);
export const useDesignG = () => useContext(Ctx) === "g";

export function UiRoot({ ui, children }: { ui: UiVersion; children: ReactNode }) {
  // `?ui=g` / `?ui=classic`: remember the choice, then reload without the parameter.
  useEffect(() => {
    const url = new URL(window.location.href);
    const want = url.searchParams.get("ui");
    if (want !== "g" && want !== "classic") return;
    document.cookie = `${UI_COOKIE}=${want}; path=/; max-age=${60 * 60 * 24 * 180}; samesite=lax`;
    url.searchParams.delete("ui");
    window.location.replace(url.pathname + (url.search ? url.search : "") + url.hash);
  }, []);
  return <Ctx.Provider value={ui}>{children}</Ctx.Provider>;
}
