"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Logo } from "@/components/brand/Logo";
import { ButtonLink } from "@/components/ui/Button";
import { ctas, mainNav } from "@/content/navigation";

/**
 * Header: transparent over the top of the page, solid graphite once scrolled.
 * Hides on scroll-down, reveals on scroll-up. Always dark → constant contrast.
 */
export function Header() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [open, setOpen] = useState(false);
  const lastY = useRef(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        setScrolled(y > 24);
        const delta = y - lastY.current;
        if (Math.abs(delta) > 6) setHidden(delta > 0 && y > 160);
        lastY.current = y;
        ticking = false;
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the menu on navigation (state derived during render).
  const [menuPath, setMenuPath] = useState(pathname);
  if (menuPath !== pathname) {
    setMenuPath(pathname);
    setOpen(false);
  }

  // Mobile menu: lock scroll, close on Escape, move focus.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
      }
      if (e.key === "Tab" && menuRef.current) {
        const f = menuRef.current.querySelectorAll<HTMLElement>("a, button");
        const first = f[0];
        const last = f[f.length - 1];
        if (!first || !last) return;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    menuRef.current?.querySelector<HTMLElement>("a")?.focus();
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-[transform,background-color,border-color] duration-500 ease-[var(--ease-out-expo)] ${
        hidden && !open ? "-translate-y-full" : "translate-y-0"
      } ${scrolled || open ? "border-b border-white/10 bg-ink/95 backdrop-blur-sm" : "border-b border-transparent bg-transparent"}`}
    >
      <div className="shell flex h-16 items-center justify-between gap-6 lg:h-20">
        <Logo link height={30} className="lg:!h-[34px]" />

        <nav aria-label="Hauptnavigation" className="hidden xl:block">
          <ul className="flex items-center gap-8">
            {mainNav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive(item.href) ? "page" : undefined}
                  className="group relative py-2 text-[0.82rem] font-medium tracking-[0.02em] text-steel-200 transition-colors hover:text-white aria-[current=page]:text-white"
                >
                  {item.label}
                  <span
                    aria-hidden="true"
                    className="absolute -bottom-0.5 left-0 h-0.5 w-full origin-left scale-x-0 bg-red transition-transform duration-300 group-hover:scale-x-100 group-aria-[current=page]:scale-x-100"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href={ctas.apply.href}
            className="hidden min-h-11 items-center px-3 text-[0.78rem] font-semibold uppercase tracking-[0.12em] text-white underline-offset-8 hover:underline md:inline-flex"
          >
            {ctas.apply.label}
          </Link>
          <span className="hidden sm:block">
            <ButtonLink href={ctas.business.href} className="!min-h-11 !px-5" arrow={false}>
              {ctas.business.label}
            </ButtonLink>
          </span>
          <button
            ref={toggleRef}
            type="button"
            className="relative inline-flex size-11 items-center justify-center xl:hidden"
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? "Menü schließen" : "Menü öffnen"}
            onClick={() => setOpen((v) => !v)}
          >
            <span aria-hidden="true" className="relative block h-3 w-6">
              <span className={`absolute left-0 top-0 h-0.5 w-6 bg-white transition-transform duration-300 ${open ? "translate-y-[5px] rotate-45" : ""}`} />
              <span className={`absolute bottom-0 left-0 h-0.5 w-6 bg-white transition-transform duration-300 ${open ? "-translate-y-[5px] -rotate-45" : ""}`} />
            </span>
          </button>
        </div>
      </div>

      <div
        id="mobile-menu"
        ref={menuRef}
        hidden={!open}
        className="h-[calc(100svh-4rem)] overflow-y-auto border-t border-white/10 bg-ink xl:hidden"
      >
        <nav aria-label="Mobile Navigation" className="shell flex min-h-full flex-col justify-between py-8">
          <ul className="space-y-1">
            {mainNav.map((item, i) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive(item.href) ? "page" : undefined}
                  className="flex items-baseline gap-4 py-2 text-[2rem] font-bold uppercase leading-tight tracking-[-0.02em] aria-[current=page]:text-red"
                >
                  <span className="font-mono text-xs font-normal text-steel-500">0{i + 1}</span>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-10 grid gap-3">
            <ButtonLink href={ctas.business.href}>{ctas.business.label}</ButtonLink>
            <ButtonLink href={ctas.apply.href} variant="outline">
              {ctas.apply.label}
            </ButtonLink>
          </div>
        </nav>
      </div>
    </header>
  );
}
