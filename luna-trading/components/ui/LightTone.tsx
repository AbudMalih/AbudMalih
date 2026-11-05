"use client";

import { useEffect } from "react";

/**
 * For pages that are one light surface without a scroll-driven tone probe
 * (legal pages, 404, error): the header switches to ink on <html data-tone>.
 */
export default function LightTone() {
  useEffect(() => {
    const html = document.documentElement;
    html.dataset.tone = "light";
    return () => {
      delete html.dataset.tone;
    };
  }, []);
  return null;
}
