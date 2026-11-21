"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import Magnet from "@/components/lab/rb/Magnet";
import s from "./NavExperiment.module.css";

const NAV = [
  { id: "start", label: "Start" },
  { id: "services", label: "Leistungen", mega: true },
  { id: "import", label: "Import" },
  { id: "brands", label: "Marken" },
  { id: "company", label: "Unternehmen" },
  { id: "insights", label: "Wissen" },
];
const SERVICES = [
  { t: "Globale Beschaffung", l: "Passende Hersteller und Materialien finden, bewerten und koordinieren.", img: "/story/desk-960.webp" },
  { t: "Import & Export", l: "Internationale Warenströme kaufmännisch steuern und nach Europa führen.", img: "/insights/container-terminal-960.webp" },
  { t: "Produktentwicklung", l: "Aus einer Idee ein marktfähiges Produkt machen.", img: "/story/check-960.webp" },
  { t: "Markenentwicklung", l: "Positionierung und Auftritt, die einem Produkt Identität geben.", img: "/story/desk-960.webp" },
  { t: "E-Commerce", l: "Produkte über eigene Shops und Marktplätze zum Kunden bringen.", img: "/sky/port-1600.webp" },
  { t: "Distribution", l: "Bestellungen zuverlässig an ihr Ziel bringen.", img: "/story/warehouse-960.webp" },
];
const LANGS = ["DE", "EN", "AR"];

export default function NavExperiment() {
  const hdr = useRef<HTMLElement>(null);
  const pill = useRef<HTMLSpanElement>(null);
  const items = useRef<Record<string, HTMLAnchorElement | HTMLButtonElement | null>>({});
  const langPill = useRef<HTMLSpanElement>(null);
  const langRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const mega = useRef<HTMLDivElement>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const megaBtn = useRef<HTMLButtonElement | null>(null);
  const menuBtn = useRef<HTMLButtonElement>(null);
  const [active] = useState("start");
  const [megaOpen, setMegaOpen] = useState(false);
  const [svc, setSvc] = useState(0);
  const [lang, setLang] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const still = useRef(false);

  // the pill glides to whatever is hovered or focused, back to the active page
  const moveTo = useCallback((id: string, instant = false) => {
    const el = items.current[id], p = pill.current;
    if (!el || !p) return;
    Object.values(items.current).forEach((n) => n?.toggleAttribute("data-under", n === el));
    const r = el.getBoundingClientRect(), pr = p.parentElement!.getBoundingClientRect();
    gsap.to(p, { x: r.left - pr.left, width: r.width, duration: instant || still.current ? 0 : 0.55, ease: "expo.out" });
  }, []);

  useEffect(() => {
    still.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    moveTo(active, true);
    const onResize = () => moveTo(active, true);
    window.addEventListener("resize", onResize);
    // header: condenses after the first scroll, hides while reading down, returns on the way up
    let lastY = 0;
    const onScroll = () => {
      const y = window.scrollY, h = hdr.current!;
      h.toggleAttribute("data-solid", y > 30);
      if (!megaOpen) h.toggleAttribute("data-hidden", y > 260 && y > lastY + 2);
      if (y < lastY - 2) h.removeAttribute("data-hidden");
      lastY = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll);
    };
  }, [active, moveTo, megaOpen]);

  // language pill
  useEffect(() => {
    const el = langRefs.current[lang], p = langPill.current;
    if (!el || !p) return;
    gsap.to(p, { x: el.offsetLeft, width: el.offsetWidth, duration: still.current ? 0 : 0.5, ease: "expo.out" });
  }, [lang]);

  // mega menu: opens with a clip reveal, the rows rise
  useEffect(() => {
    const m = mega.current;
    if (!m) return;
    const d = still.current ? 0 : 1;
    if (megaOpen) {
      gsap.set(m, { display: "block" });
      gsap.fromTo(m, { clipPath: "inset(0 0 100% 0 round 26px)" }, { clipPath: "inset(0 0 0% 0 round 26px)", duration: 0.7 * d, ease: "expo.out" });
      gsap.fromTo(m.querySelectorAll("[data-row]"), { y: 18, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.04, duration: 0.6 * d, ease: "expo.out", delay: 0.12 * d });
    } else {
      gsap.to(m, { clipPath: "inset(0 0 100% 0 round 26px)", duration: 0.4 * d, ease: "expo.in", onComplete: () => void gsap.set(m, { display: "none" }) });
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && megaOpen) {
        setMegaOpen(false);
        megaBtn.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [megaOpen]);

  // full-screen menu: two colour layers sweep in, then the links rise
  useEffect(() => {
    const el = sheet.current;
    if (!el) return;
    const d = still.current ? 0 : 1;
    const layers = el.querySelectorAll("[data-layer]");
    const links = el.querySelectorAll("[data-link]");
    if (menuOpen) {
      gsap.set(el, { display: "grid" });
      const tl = gsap.timeline();
      tl.fromTo(layers, { yPercent: -100 }, { yPercent: 0, duration: 0.7 * d, stagger: 0.08 * d, ease: "expo.inOut" })
        .fromTo(links, { yPercent: 120 }, { yPercent: 0, duration: 0.8 * d, stagger: 0.05 * d, ease: "expo.out" }, 0.35 * d)
        .fromTo(el.querySelectorAll("[data-foot]"), { opacity: 0 }, { opacity: 1, duration: 0.5 * d }, 0.6 * d);
      document.documentElement.style.overflow = "hidden";
      (el.querySelector("a, button") as HTMLElement | null)?.focus();
    } else if (el.style.display === "grid") {
      gsap.timeline({ onComplete: () => void gsap.set(el, { display: "none" }) })
        .to(links, { yPercent: -120, duration: 0.4 * d, stagger: 0.02 * d, ease: "expo.in" })
        .to(layers, { yPercent: 100, duration: 0.6 * d, stagger: 0.06 * d, ease: "expo.inOut" }, 0.15 * d);
      document.documentElement.style.overflow = "";
      menuBtn.current?.focus();
    }
    // keep focus inside the open menu; Escape closes it
    const onKey = (e: KeyboardEvent) => {
      if (!menuOpen) return;
      if (e.key === "Escape") setMenuOpen(false);
      if (e.key === "Tab") {
        const f = Array.from(el.querySelectorAll<HTMLElement>("a, button"));
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  return (
    <div className={s.root}>
      <header ref={hdr} className={s.header}>
        <a href="#" className={s.logo} aria-label="Luna Trading Startseite">
          <img src="/brand/luna-trading-logo-reverse-640.webp" alt="Luna Trading" width={640} height={170} />
        </a>

        <nav className={s.nav} aria-label="Hauptnavigation" onMouseLeave={() => !megaOpen && moveTo(active)}>
          <span ref={pill} className={s.pill} aria-hidden="true" />
          {NAV.map((n) =>
            n.mega ? (
              <button
                key={n.id}
                ref={(el) => { items.current[n.id] = el; megaBtn.current = el; }}
                className={s.item}
                aria-expanded={megaOpen}
                aria-controls="mega"
                onMouseEnter={() => { moveTo(n.id); setMegaOpen(true); }}
                onFocus={() => moveTo(n.id)}
                onClick={() => setMegaOpen((o) => !o)}
              >
                {n.label}
                <svg viewBox="0 0 10 10" className={s.chev} data-open={megaOpen || undefined} aria-hidden="true"><path d="M2 4l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.4" /></svg>
              </button>
            ) : (
              <a
                key={n.id}
                href="#"
                ref={(el) => { items.current[n.id] = el; }}
                className={s.item}
                aria-current={n.id === active ? "page" : undefined}
                onMouseEnter={() => { moveTo(n.id); setMegaOpen(false); }}
                onFocus={() => moveTo(n.id)}
              >
                {n.label}
              </a>
            ),
          )}
        </nav>

        <div className={s.right}>
          <div className={s.lang} role="group" aria-label="Sprache">
            <span ref={langPill} className={s.langPill} aria-hidden="true" />
            {LANGS.map((l, i) => (
              <button key={l} ref={(el) => { langRefs.current[i] = el; }} aria-pressed={i === lang} onClick={() => setLang(i)}>{l}</button>
            ))}
          </div>
          <a href="#" className={s.contact}>Kontakt</a>
          <Magnet padding={40} magnetStrength={3}>
            <a href="#" className={s.cta}>Angebot anfragen <span aria-hidden="true">+</span></a>
          </Magnet>
          <button ref={menuBtn} className={s.menuBtn} aria-expanded={menuOpen} aria-controls="sheet" onClick={() => setMenuOpen(true)}>
            Menü <span className={s.burger} aria-hidden="true"><i /><i /></span>
          </button>
        </div>

        {/* mega menu: Leistungen with a live preview */}
        <div id="mega" ref={mega} className={s.mega} onMouseLeave={() => { setMegaOpen(false); moveTo(active); }} style={{ display: "none" }}>
          <div className={s.megaGrid}>
            <div>
              <p className={`mono ${s.megaKick}`} data-row>Sechs Disziplinen. Eine Kette.</p>
              <ul className={s.megaList}>
                {SERVICES.map((x, i) => (
                  <li key={x.t} data-row>
                    <a href="#" onMouseEnter={() => setSvc(i)} onFocus={() => setSvc(i)} aria-describedby={i === svc ? "svc-desc" : undefined} data-on={i === svc || undefined}>
                      <span className="mono">0{i + 1}</span> {x.t}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div className={s.preview} data-row>
              {SERVICES.map((x, i) => (
                <img key={x.t + i} src={x.img} alt="" data-on={i === svc || undefined} />
              ))}
              <p id="svc-desc" className={s.previewText}>{SERVICES[svc].l}</p>
            </div>
            <div className={s.megaSide} data-row>
              <p className={s.sideTitle}>Sprechen wir über Ihr nächstes Projekt.</p>
              <a href="#" className={s.cta}>Angebot anfragen <span aria-hidden="true">+</span></a>
              <a href="#" className={s.sideLink}>Alle Leistungen →</a>
            </div>
          </div>
        </div>
      </header>

      {/* full-screen menu (phones, or anyone who prefers it) */}
      <div id="sheet" ref={sheet} className={s.sheet} role="dialog" aria-modal="true" aria-label="Menü" style={{ display: "none" }}>
        <span className={s.layer} data-layer style={{ background: "#c90216" }} />
        <span className={s.layer} data-layer style={{ background: "#0f1012" }} />
        <div className={s.sheetInner}>
          <div className={s.sheetTop}>
            <img src="/brand/luna-trading-logo-reverse-640.webp" alt="Luna Trading" width={640} height={170} />
            <button className={s.close} onClick={() => setMenuOpen(false)}>Schließen ✕</button>
          </div>
          <ol className={s.sheetList}>
            {[...NAV.map((n) => n.label), "Kontakt"].map((l, i) => (
              <li key={l}>
                <a href="#" onClick={() => setMenuOpen(false)}>
                  <span className={s.mask}><span data-link className={s.sheetLink}><span className="mono">0{i + 1}</span>{l}</span></span>
                </a>
              </li>
            ))}
          </ol>
          <div className={s.sheetFoot} data-foot>
            <a href="#" className={s.cta}>Angebot anfragen <span aria-hidden="true">+</span></a>
            <span className={s.sheetLang}>{LANGS.map((l, i) => <button key={l} aria-pressed={i === lang} onClick={() => setLang(i)}>{l}</button>)}</span>
            <span className={s.sheetMail}>info@luna-trading.de</span>
          </div>
        </div>
      </div>

      <main className={s.page}>
        <section className={s.hero}>
          <p className="mono" style={{ color: "var(--red-on-dark)" }}>04 · Premium-Navigation</p>
          <h1 className={s.h1}>Navigation, die man <em>gern benutzt.</em></h1>
          <p className={s.lead}>Fahren Sie über die Menüpunkte, öffnen Sie „Leistungen“, wechseln Sie die Sprache, scrollen Sie nach unten und wieder nach oben. Auf dem Telefon: „Menü“.</p>
        </section>
        {["Von der Quelle bis zum Markt.", "Von China nach Deutschland.", "Deutschland als Basis. Europa als Markt.", "Vom Produkt zur Plattform."].map((t, i) => (
          <section key={t} className={s.block} data-alt={i % 2 || undefined}>
            <h2>{t}</h2>
            <p>Scrollen Sie weiter nach unten: die Kopfzeile tritt zurück. Ein Stück nach oben: sie ist sofort wieder da.</p>
          </section>
        ))}
      </main>
    </div>
  );
}
