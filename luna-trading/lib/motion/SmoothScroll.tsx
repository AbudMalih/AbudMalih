"use client";

import { useEffect, useState } from "react";
import Lenis from "lenis";
import { gsap, ScrollTrigger } from "./gsap";
import { stage, detectTier, updateViewport } from "@/lib/stage/store";
import { isCine } from "./env";

let lenis: Lenis | null = null;
export const getLenis = () => lenis;

/**
 * Scroll engine comparison (temporary, for choosing on real hardware).
 *   current  Lenis as approved so far (lerp 0.11, wheel ×1.1). Default.
 *   near     near-native: trackpads follow 1:1 with ~2 frames of smoothing,
 *            mouse-wheel notches get a short glide, native distance.
 *   native   no Lenis at all; ScrollTrigger reads the browser's own scroll.
 * Select with ?scroll=native|near|current (kept for the browser session,
 * including language switches and reloads); ?scroll=reset ends the test.
 * Visitors who never use the parameter always get "current".
 */
export type ScrollMode = "current" | "near" | "native";
const MODES: ScrollMode[] = ["current", "near", "native"];
const KEY = "luna:scroll-test";
function resolveMode(): { mode: ScrollMode; testing: boolean } {
  try {
    const q = new URLSearchParams(location.search).get("scroll");
    if (q === "reset") sessionStorage.removeItem(KEY);
    else if (q && (MODES as string[]).includes(q)) sessionStorage.setItem(KEY, q);
    const s = sessionStorage.getItem(KEY) as ScrollMode | null;
    if (s && MODES.includes(s)) return { mode: s, testing: true };
  } catch {}
  return { mode: "current", testing: false };
}

/** Pause / resume page scrolling (intro, open menu) whatever the engine. */
export function lockScroll(locked: boolean) {
  if (lenis) {
    if (locked) lenis.stop();
    else lenis.start();
    return;
  }
  document.documentElement.style.overflow = locked ? "hidden" : "";
}

/** Scroll to an element or offset — through Lenis when present. */
export function scrollToTarget(target: string | number | HTMLElement, immediate = false) {
  if (lenis) {
    lenis.scrollTo(target, { immediate, duration: 2.2, easing: (t) => 1 - Math.pow(1 - t, 4) });
    return;
  }
  const behavior: ScrollBehavior = immediate ? "auto" : "smooth";
  if (typeof target === "number") window.scrollTo({ top: target, behavior });
  else {
    const el = typeof target === "string" ? document.querySelector(target) : target;
    el?.scrollIntoView({ behavior });
  }
}

/** Mac trackpads send pixel deltas that are not whole wheel notches. */
const isTrackpad = (e: WheelEvent & { wheelDeltaY?: number }) =>
  e.deltaMode === 0 && (e.wheelDeltaY === undefined || e.wheelDeltaY === 0 ? !Number.isInteger(e.deltaY) || Math.abs(e.deltaY) < 50 : e.wheelDeltaY % 120 !== 0);

/**
 * Owns the scroll engine: Lenis (desktop smooth scroll, native touch scroll),
 * bridged to GSAP's ticker so ScrollTrigger and Lenis update in the same frame.
 */
export default function SmoothScroll() {
  const [test, setTest] = useState<ScrollMode | null>(null);

  useEffect(() => {
    stage.cine = isCine();
    stage.rtl = document.documentElement.dir === "rtl";
    stage.tier = detectTier();
    updateViewport();

    const { mode, testing } = resolveMode();
    if (testing) setTest(mode);
    document.documentElement.dataset.scroll = mode;

    let onTick: ((time: number) => void) | null = null;
    if (stage.cine && mode !== "native") {
      const near = mode === "near";
      lenis = new Lenis({
        // current: responsive glide (time constant ≈ 150 ms), wheel ×1.1
        // near:    trackpad ≈ 33 ms (2 frames), wheel notch ≈ 55 ms, native distance
        lerp: near ? 0.3 : 0.11,
        wheelMultiplier: near ? 1 : 1.1,
        // Touch keeps native momentum — natural on phones.
        syncTouch: false,
        virtualScroll: near
          ? (data) => {
              const e = data.event as WheelEvent & { wheelDeltaY?: number };
              if (e.type === "wheel" && lenis) lenis.options.lerp = isTrackpad(e) ? 0.5 : 0.3;
              return true;
            }
          : undefined,
      });
      lenis.on("scroll", ScrollTrigger.update);
      onTick = (time: number) => lenis?.raf(time * 1000);
      gsap.ticker.add(onTick);
      gsap.ticker.lagSmoothing(0);
    }

    // after switching engine in a test session, return to the same place
    let resumeT = 0;
    try {
      const y = sessionStorage.getItem("luna:scroll-y");
      if (y !== null) {
        sessionStorage.removeItem("luna:scroll-y");
        resumeT = window.setTimeout(() => {
          ScrollTrigger.refresh();
          scrollToTarget(Number(y), true);
        }, 350);
      }
    } catch {}

    // Review hook: ?debug exposes the engine for automated capture.
    if (/[?&]debug\b/.test(location.search)) {
      (window as unknown as { __luna: unknown }).__luna = { lenis, stage, ScrollTrigger, mode };
    }

    let rid = 0;
    const onResize = () => {
      cancelAnimationFrame(rid);
      rid = requestAnimationFrame(() => {
        updateViewport();
      });
    };
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      clearTimeout(resumeT);
      if (onTick) gsap.ticker.remove(onTick);
      lenis?.destroy();
      lenis = null;
    };
  }, []);

  if (!test) return null;
  // Visible only inside a test session (after ?scroll=…): switch engines on the same page.
  const pick = (m: ScrollMode | "reset") => {
    const u = new URL(location.href);
    u.searchParams.set("scroll", m);
    u.hash = "";
    sessionStorage.setItem("luna:scroll-y", String(Math.round(scrollY)));
    location.href = u.toString();
  };
  return (
    <div
      role="group"
      aria-label="Scroll test"
      style={{
        position: "fixed",
        left: 12,
        bottom: 12,
        zIndex: 2147483000,
        display: "flex",
        gap: 4,
        padding: 4,
        background: "rgba(16,17,19,0.86)",
        border: "1px solid rgba(255,255,255,0.18)",
        font: "500 11px/1 ui-monospace, Menlo, monospace",
        letterSpacing: "0.08em",
        direction: "ltr",
      }}
    >
      {(["native", "near", "current"] as const).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => pick(m)}
          aria-pressed={test === m}
          style={{
            padding: "7px 9px",
            border: 0,
            cursor: "pointer",
            color: test === m ? "#111" : "#eee",
            background: test === m ? "#f2f2f0" : "transparent",
            textTransform: "uppercase",
          }}
        >
          {m === "near" ? "Near-native" : m}
        </button>
      ))}
      <button type="button" onClick={() => pick("reset")} title="End test" style={{ padding: "7px 8px", border: 0, cursor: "pointer", color: "#999", background: "transparent" }}>
        ×
      </button>
    </div>
  );
}
