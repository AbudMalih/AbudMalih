"use client";

import { useEffect, useRef } from "react";
import styles from "./Cursor.module.css";

/**
 * Desktop-only "+" cursor. The glyph tracks the pointer 1:1 (no lag — it
 * must remain a precise pointer). Over interactive elements it turns 45°
 * and takes the Luna red. Disabled for touch, coarse pointers and
 * reduced motion (html.has-cursor is set before first paint).
 */
export default function Cursor() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!document.documentElement.classList.contains("has-cursor")) return;
    const el = ref.current!;
    let x = -100, y = -100, raf = 0;
    const paint = () => {
      raf = 0;
      el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    };
    const move = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      x = e.clientX;
      y = e.clientY;
      el.dataset.visible = "true";
      if (!raf) raf = requestAnimationFrame(paint);
      const t = (e.target as Element | null)?.closest?.("a, button, [data-cursor], input, textarea, select, label");
      el.dataset.state = t ? (t.matches("input, textarea") ? "text" : "link") : "idle";
    };
    const leave = () => (el.dataset.visible = "false");
    const down = () => (el.dataset.down = "true");
    const up = () => (el.dataset.down = "false");
    window.addEventListener("pointermove", move, { passive: true });
    document.documentElement.addEventListener("pointerleave", leave);
    window.addEventListener("pointerdown", down);
    window.addEventListener("pointerup", up);
    return () => {
      cancelAnimationFrame(raf);
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
