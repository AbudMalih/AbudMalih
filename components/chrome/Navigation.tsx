"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { NAV, LEGAL_NAV, COMPANY } from "@/content/site";
import { LunaLogo } from "@/components/brand/Logos";
import { getLenis } from "@/lib/motion/SmoothScroll";
import { formatLat, formatLon } from "@/lib/globe/geo";
import styles from "./Navigation.module.css";

/**
 * Floating navigation.
 *  - Top of page: transparent; logo plate left, quiet text links right.
 *  - After the first viewport: links retract into the Luna "+" control.
 *  - The "+" opens a full-screen index; it rotates 45° to become the close "×".
 *  - Mobile uses the "+" from the start (a deliberate control, not a hamburger).
 */
export default function Navigation() {
  const [compact, setCompact] = useState(false);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const panelRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onScroll = () => setCompact(window.scrollY > window.innerHeight * 0.6);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    toggleRef.current?.focus();
  }, []);

  useEffect(() => {
    const lenis = getLenis();
    if (open) lenis?.stop();
    else lenis?.start();
    document.documentElement.classList.toggle("menu-open", open);
    if (!open) return;
    const first = panelRef.current?.querySelector<HTMLElement>("a");
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "Tab" && panelRef.current) {
        const f = Array.from(panelRef.current.querySelectorAll<HTMLElement>("a,button"));
        const all = [toggleRef.current!, ...f];
        const i = all.indexOf(document.activeElement as HTMLElement);
        if (e.shiftKey && i <= 0) (e.preventDefault(), all[all.length - 1].focus());
        else if (!e.shiftKey && i === all.length - 1) (e.preventDefault(), all[0].focus());
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  useEffect(() => setOpen(false), [pathname]);

  return (
    <>
      <header className={`${styles.bar} ${compact ? styles.compact : ""} ${open ? styles.isOpen : ""}`}>
        <Link href="/" className={`${styles.brand} interactive`} aria-label="Luna Trading — Home" data-cursor="link" id="nav-brand">
          <LunaLogo plate height="100%" priority />
        </Link>

        <nav className={styles.links} aria-label="Primary">
          <ul>
            {NAV.slice(1).map((n) => (
              <li key={n.href}>
                <Link href={n.href} className="link-line t-label" data-cursor="link" tabIndex={compact ? -1 : 0}>
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <button
          ref={toggleRef}
          type="button"
          className={styles.toggle}
          aria-expanded={open}
          aria-controls="site-menu"
          onClick={() => setOpen((o) => !o)}
          data-cursor="link"
        >
          <span className="t-label">{open ? "Close" : "Menu"}</span>
          <span className={styles.plus} aria-hidden="true">
            <i />
            <i />
          </span>
        </button>
      </header>

      <div
        id="site-menu"
        ref={panelRef}
        className={`${styles.panel} ${open ? styles.panelOpen : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Site menu"
        hidden={!open}
      >
        <div className={styles.panelInner}>
          <ol className={styles.big}>
            {NAV.map((n, i) => (
              <li key={n.href} style={{ ["--i" as string]: i }}>
                <Link href={n.href} onClick={close} data-cursor="link" aria-current={pathname === n.href ? "page" : undefined}>
                  <span className={`t-label ${styles.num}`}>{String(i).padStart(2, "0")}</span>
                  <span className={styles.word}>{n.label}</span>
                </Link>
              </li>
            ))}
          </ol>
          <div className={styles.panelFoot}>
            <p className="t-label">
              {COMPANY.legalName} · {COMPANY.cityEn}, {COMPANY.country}
            </p>
            <p className="t-label t-mono">
              {formatLat(COMPANY.coordinates.lat)} {formatLon(COMPANY.coordinates.lon)}
            </p>
            <ul className={styles.legal}>
              {LEGAL_NAV.map((n) => (
                <li key={n.href}>
                  <Link href={n.href} className="link-line t-label" onClick={close} data-cursor="link">
                    {n.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}
