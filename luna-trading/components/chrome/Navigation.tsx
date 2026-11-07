"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { NAV, LEGAL_NAV, COMPANY, CONTACT_EMAIL } from "@/content/site";
import { LunaLogo } from "@/components/brand/Logos";
import { lockScroll } from "@/lib/motion/scroll";
import { formatLat, formatLon } from "@/lib/globe/coords";
import { useI18n } from "@/content/i18n/I18nProvider";
import { canonicalPath, stripLocale } from "@/content/i18n/config";
import LanguageSelector from "./LanguageSelector";
import { QUOTE_COPY } from "@/content/quotePage";
import styles from "./Navigation.module.css";

/**
 * The corporate header: one architectural axis.
 *  - Desktop (≥1024px): wordmark · Leistungen, Marken, Unternehmen ·
 *    DE / EN / AR · the framed "Kontakt +" action. Links never retract; the
 *    current page carries a short red rule (not colour alone).
 *  - On scroll a solid plate fades in under the bar (no blur, no shadow):
 *    mineral on light grounds, graphite on dark ones (<html data-tone>).
 *  - Mobile / tablet: "Menü +" is the trigger; the "+" turns into the "×".
 *    The index is a light editorial page: numbered links (current one marked
 *    with the red +), a direct contact block, languages, company line, legal.
 *  - Dialog semantics, focus trap, Escape, scroll lock, focus return.
 */
export default function Navigation() {
  const { dict, href, locale } = useI18n();
  const quote = QUOTE_COPY[locale].nav;
  const contactHref = href(
    NAV.find((n) => n.key === "contact")?.href ?? "/contact",
  );
  const [solid, setSolid] = useState(false);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const panelRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 24);
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
        const all = [
          toggleRef.current!,
          ...Array.from(
            panelRef.current.querySelectorAll<HTMLElement>("a,button"),
          ),
        ];
        const i = all.indexOf(document.activeElement as HTMLElement);
        if (e.shiftKey && i <= 0)
          (e.preventDefault(), all[all.length - 1].focus());
        else if (!e.shiftKey && i === all.length - 1)
          (e.preventDefault(), all[0].focus());
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  useEffect(() => setOpen(false), [pathname]);
  const current = canonicalPath(stripLocale(pathname || "/"));

  return (
    <>
      <header
        className={`${styles.bar} ${solid ? styles.solid : ""} ${open ? styles.isOpen : ""}`}
      >
        <span className={styles.plate} aria-hidden="true" />
        <Link
          href={href("/")}
          className={styles.brand}
          aria-label={dict.a11y.home}
          data-cursor="link"
          id="nav-brand"
        >
          <LunaLogo height="100%" priority className={styles.logoDark} />
          {/* light chapters use the master wordmark (its native ground) */}
          <LunaLogo
            height="100%"
            variant="master"
            className={styles.logoLight}
          />
        </Link>

        <div className={styles.right}>
          <div className={styles.group}>
            <nav className={styles.links} aria-label={dict.a11y.primaryNav}>
              <ul>
                {NAV.filter((n) => n.key !== "contact").map((n) => (
                  <li key={n.href}>
                    <Link
                      href={href(n.href)}
                      data-cursor="link"
                      aria-current={current === n.href ? "page" : undefined}
                    >
                      {dict.nav[n.key]}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
            <div className={styles.lang}>
              <span className={styles.divider} aria-hidden="true" />
              <LanguageSelector />
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
              <span className="t-label">
                {open ? dict.a11y.close : dict.a11y.menu}
              </span>
              <span className={styles.plus} aria-hidden="true">
                <i />
                <i />
              </span>
            </button>
          </div>

          <Link
            href={href("/quote")}
            className={styles.quote}
            aria-current={current === "/quote" ? "page" : undefined}
          >
            {quote}
          </Link>
          <Link
            href={contactHref}
            className={styles.cta}
            data-cursor="invert"
            aria-current={current === "/contact" ? "page" : undefined}
          >
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
                <Link
                  href={href(n.href)}
                  onClick={close}
                  data-cursor="link"
                  aria-current={current === n.href ? "page" : undefined}
                >
                  <span className={`t-label ${styles.num}`}>
                    {String(i).padStart(2, "0")}
                  </span>
                  <span className={styles.word}>{dict.nav[n.key]}</span>
                  <span className={styles.mark} aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ol>
          <div className={styles.direct}>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className={styles.mail}
              dir="ltr"
              data-cursor="link"
            >
              {CONTACT_EMAIL}
            </a>
            <Link
              href={href("/quote")}
              onClick={close}
              className={styles.quotePanel}
            >
              {quote}
            </Link>
            <Link
              href={contactHref}
              onClick={close}
              className={`${styles.cta} ${styles.ctaPanel}`}
              data-cursor="invert"
            >
              {/* the index already lists "Kontakt": the action says what happens there */}
              <span className={styles.ctaLabel}>
                {dict.contactPage.inquiry.title}
              </span>
              <span className={styles.ctaPlus} aria-hidden="true" />
            </Link>
          </div>
          <div className={styles.panelFoot}>
            <LanguageSelector size="l" />
            <p className="t-label">
              {COMPANY.name} · {dict.company.place}
            </p>
            <p className="t-label t-mono" dir="ltr">
              {formatLat(COMPANY.coordinates.lat)}{" "}
              {formatLon(COMPANY.coordinates.lon)}
            </p>
            <ul className={styles.legal}>
              {LEGAL_NAV.map((n) => (
                <li key={n.href}>
                  <Link
                    href={href(n.href)}
                    className="link-line t-label"
                    onClick={close}
                    data-cursor="link"
                  >
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
