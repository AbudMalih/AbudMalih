"use client";

import { Moon, Sun } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { cn } from "./cn";

/** localStorage key for an explicit choice; absent = follow the system (dark when unknown). */
export const THEME_KEY = "turvio-theme";
export type Theme = "dark" | "light";

/**
 * Runs before first paint (render inside <head>): sets <html data-theme> from the stored choice or the
 * system preference, so there is no flash of the wrong theme. Follows system changes while no explicit
 * choice is stored.
 */
const SCRIPT = `(function(){try{var k=${JSON.stringify(THEME_KEY)},d=document.documentElement,m=window.matchMedia("(prefers-color-scheme: light)");function a(){var s=null;try{s=localStorage.getItem(k)}catch(e){}d.dataset.theme=s==="light"||s==="dark"?s:(m.matches?"light":"dark")}a();m.addEventListener&&m.addEventListener("change",a)}catch(e){}})();`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />;
}

function readTheme(): Theme {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

export function useTheme(): [Theme, (t: Theme) => void] {
  const [theme, setThemeState] = useState<Theme>("dark");
  useEffect(() => {
    setThemeState(readTheme());
    const obs = new MutationObserver(() => setThemeState(readTheme()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);
  const setTheme = useCallback((t: Theme) => {
    try {
      localStorage.setItem(THEME_KEY, t);
    } catch {
      /* private mode: the choice lasts for this page only */
    }
    const apply = () => {
      document.documentElement.dataset.theme = t;
    };
    // Cross-fade like the prototype where the browser supports view transitions.
    const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
    if (doc.startViewTransition && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) doc.startViewTransition(apply);
    else apply();
  }, []);
  return [theme, setTheme];
}

/** The prototype's pill switch: violet moon knob (dark) ↔ amber sun knob (light). */
export function ThemeSwitch({ className, labels = { toDark: "Switch to dark mode", toLight: "Switch to light mode" } }: { className?: string; labels?: { toDark: string; toLight: string } }) {
  const [theme, setTheme] = useTheme();
  const light = theme === "light";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={light}
      aria-label={light ? labels.toDark : labels.toLight}
      title={light ? labels.toDark : labels.toLight}
      onClick={() => setTheme(light ? "dark" : "light")}
      className={cn("relative flex h-[34px] w-16 shrink-0 items-center rounded-full border border-line-strong bg-surface-2 p-[3px]", className)}
    >
      <span
        className={cn(
          "grid size-[26px] place-items-center rounded-full text-white transition-transform duration-[450ms] ease-[var(--ease-spring)]",
          light
            ? "translate-x-[30px] bg-[linear-gradient(140deg,#FFC66B,#FF8A6B)] shadow-[0_4px_12px_-2px_rgba(255,138,107,.55)] rtl:-translate-x-[30px]"
            : "bg-[linear-gradient(140deg,#8C76FF,#3478FF)] shadow-[0_4px_12px_-2px_rgba(117,91,255,.6)]",
        )}
      >
        {light ? <Sun className="size-3.5" aria-hidden="true" /> : <Moon className="size-3.5" aria-hidden="true" />}
      </span>
    </button>
  );
}
