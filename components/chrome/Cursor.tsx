"use client";

import { useEffect, useRef } from "react";
import styles from "./Cursor.module.css";

/**
 * Desktop-only "+" cursor. The glyph tracks the pointer 1:1 (no lag — it
 * must remain a precise pointer). Over interactive elements it turns 45°
 * and takes the Luna red. Disabled for touch, coarse pointers and
 * reduced motion (html.has-cursor is set before first paint).
 * It is a pointer, never scenery: when the mouse rests (or the page is
 * scrolled under a still mouse) it fades out, and returns on movement.
 */
export default function Cursor() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!document.documentElement.classList.contains("has-cursor")) return;
    const el = ref.current!;
    let x = -100, y = -100, raf = 0, idle = 0;
    const rest = () => (el.dataset.visible = "false");
    const arm = (ms: number) => {
      window.clearTimeout(idle);
      idle = window.setTimeout(rest, ms);
    };
    const paint = () => {
      raf = 0;
      el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    };
    const move = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      // ignore synthetic moves the browser fires while content scrolls
      if (e.clientX === x && e.clientY === y) return;
      x = e.clientX;
      y = e.clientY;
      el.dataset.visible = "true";
      arm(1400);
      if (!raf) raf = requestAnimationFrame(paint);
      const t = (e.target as Element | null)?.closest?.("a, button, [data-cursor], input, textarea, select, label");
      el.dataset.state = t ? (t.matches("input, textarea") ? "text" : "link") : "idle";
    };
    const leave = rest;
    const wheel = () => arm(120);
    const down = () => (el.dataset.down = "true");
    const up = () => (el.dataset.down = "false");
    window.addEventListener("pointermove", move, { passive: true });
    document.documentElement.addEventListener("pointerleave", leave);
    window.addEventListener("pointerdown", down);
    window.addEventListener("pointerup", up);
    window.addEventListener("wheel", wheel, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(idle);
      window.removeEventListener("wheel", wheel);
      window.removeEventListener("pointermove", move);
      document.documentElement.removeEventListener("pointerleave", leave);
      window.removeEventListener("pointerdown", down);
      window.removeEventListener("pointerup", up);
    };
  }, []);
  return (
    <div ref={ref} className={styles.cursor} aria-hidden="true" data-visible="false" data-state="idle">
      <i />
      <i />
    </div>
  );
}
