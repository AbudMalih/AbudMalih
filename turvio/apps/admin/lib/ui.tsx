"use client";

import { useEffect } from "react";

/**
 * Phase G design (default in Admin, as in Dispatch). The previous design stays available as a
 * fallback during development: `?ui=classic` (back with `?ui=g`), remembered per browser in a cookie
 * so the server renders `<html data-ds>` without a flash. Same cookie name as Dispatch.
 */
export function UiSwitch() {
  useEffect(() => {
    const url = new URL(window.location.href);
    const want = url.searchParams.get("ui");
    if (want !== "g" && want !== "classic") return;
    document.cookie = `tv_ui=${want}; path=/; max-age=${60 * 60 * 24 * 180}; samesite=lax`;
    url.searchParams.delete("ui");
    window.location.replace(url.pathname + url.search + url.hash);
  }, []);
  return null;
}
