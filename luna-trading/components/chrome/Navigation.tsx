"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { NAV, LEGAL_NAV, COMPANY } from "@/content/site";
import { LunaLogo } from "@/components/brand/Logos";
import { lockScroll } from "@/lib/motion/scroll";
import { formatLat, formatLon } from "@/lib/globe/geo";
import { useI18n } from "@/content/i18n/I18nProvider";
import { canonicalPath, stripLocale } from "@/content/i18n/config";
import LanguageSelector from "./LanguageSelector";
import styles from "./Navigation.module.css";

/**
 * Floating navigation inside a protected header zone (--header-h).
 *  - Top of page: reverse wordmark (no plate), quiet links, DE · EN · AR.
 *  - After the first viewport: links and languages retract into the "+".
 *  - The "+" opens a full-screen index; it rotates 45° into the close "×".
 *  - Mobile uses the "+" from the start; languages live in the index.
 *  - One commercial action, always at the far right: a compact Luna-red
 *    "Let's talk +" (contact). In the compact state the menu "+" sits just
 *    before it. On mobile it lives inside the index instead.
 *  - Light / dark treatment follows <html data-tone> (set from the page's
 *    scroll state by Atmosphere), with crossfades rather than switches.
 */
export default function Navigation() {
  const { dict, href } = useI18n();
  const contactHref = href(NAV.find((n) => n.key === "contact")?.href ?? "/contact");
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
    lockScroll(open);
    if (!open) return;
    panelRef.current?.querySelector<HTMLElement>("a")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "Tab" && panelRef.current) {
        const all = [toggleRef.current!, ...Array.from(panelRef.current.querySelectorAll<HTMLElement>("a,button"))];
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
        <Link href={href("/")} className={styles.brand} aria-label={dict.a11y.home} data-cursor="link" id="nav-brand">
          <LunaLogo height="100%" priority className={styles.logoDark} />
          {/* light chapters use the master wordmark (its native ground) */}
          <LunaLogo height="100%" variant="master" className={styles.logoLight} />
        </Link>

        <div className={styles.right}>
          <div className={styles.group}>
          <nav className={styles.links} aria-label={dict.a11y.primaryNav}>
            <ul>
              {NAV.slice(1).map((n) => (
                <li key={n.href}>
                  <Link href={href(n.href)} className="link-line t-label" data-cursor="link" tabIndex={compact ? -1 : 0}>
                    {dict.nav[n.key]}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className={styles.lang}>
            <span className={styles.divider} aria-hidden="true" />
            <LanguageSelector tabIndex={compact ? -1 : 0} />
          </div>

          <button
            ref={toggleRef}
            type="button"
            className={styles.toggle}
            aria-expanded={open}
            aria-controls="site-menu"
            onClick={() => setOpen((o) => !o)}
            data-cursor="link"
          >
            <span className="t-label">{open ? dict.a11y.close : dict.a11y.menu}</span>
            <span className={styles.plus} aria-hidden="true">
              <i />
              <i />
            </span>
          </button>
          </div>

          <Link href={contactHref} className={styles.cta} data-cursor="invert">
            <span className={styles.ctaLabel}>{dict.nav.cta}</span>
            <span className={styles.ctaPlus} aria-hidden="true" />
          </Link>
        </div>
      </header>

      <div
        id="site-menu"
        ref={panelRef}
        className={`${styles.panel} ${open ? styles.panelOpen : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={dict.a11y.siteMenu}
        hidden={!open}
      >
        <div className={styles.panelInner}>
          <ol className={styles.big}>
            {NAV.map((n, i) => (
              <li key={n.href} style={{ ["--i" as string]: i }}>
                <Link href={href(n.href)} onClick={close} data-cursor="link" aria-current={canonicalPath(stripLocale(pathname || "/")) === n.href ? "page" : undefined}>
                  <span className={`t-label ${styles.num}`}>{String(i).padStart(2, "0")}</span>
                  <span className={styles.word}>{dict.nav[n.key]}</span>
                </Link>
              </li>
            ))}
          </ol>
          <Link href={contactHref} onClick={close} className={`${styles.cta} ${styles.ctaPanel}`} data-cursor="invert">
            <span className={styles.ctaLabel}>{dict.nav.cta}</span>
            <span className={styles.ctaPlus} aria-hidden="true" />
          </Link>
          <div className={styles.panelFoot}>
            <LanguageSelector size="l" />
            <p className="t-label">
              {COMPANY.legalName} · {dict.company.place}
            </p>
            <p className="t-label t-mono" dir="ltr">
              {formatLat(COMPANY.coordinates.lat)} {formatLon(COMPANY.coordinates.lon)}
            </p>
            <ul className={styles.legal}>
              {LEGAL_NAV.map((n) => (
                <li key={n.href}>
                  <Link href={href(n.href)} className="link-line t-label" onClick={close} data-cursor="link">
                    {dict.legal[n.key]}
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
