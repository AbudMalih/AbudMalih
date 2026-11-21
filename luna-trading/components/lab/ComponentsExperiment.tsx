"use client";

import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { Flip } from "gsap/Flip";
import { Draggable } from "gsap/Draggable";
import { InertiaPlugin } from "gsap/InertiaPlugin";
import SpotlightCard from "@/components/lab/rb/SpotlightCard";
import TiltedCard, { TiltedCardLayer } from "@/components/lab/rb/TiltedCard";
import Magnet from "@/components/lab/rb/Magnet";
import s from "./ComponentsExperiment.module.css";

gsap.registerPlugin(Flip, Draggable, InertiaPlugin);

const SERVICES = [
  { t: "Globale Beschaffung", l: "Passende Hersteller und Materialien finden, bewerten und koordinieren.", img: "/story/desk-960.webp" },
  { t: "Import & Export", l: "Internationale Warenströme kaufmännisch steuern und nach Europa führen.", img: "/insights/container-terminal-960.webp" },
  { t: "Produktentwicklung", l: "Aus einer Idee ein marktfähiges Produkt machen.", img: "/story/check-960.webp" },
  { t: "Markenentwicklung", l: "Positionierung und Auftritt, die einem Produkt Identität geben.", img: "/story/desk-960.webp" },
  { t: "E-Commerce", l: "Produkte über eigene Shops und Marktplätze zum Kunden bringen.", img: "/sky/port-1600.webp" },
  { t: "Distribution", l: "Bestellungen zuverlässig an ihr Ziel bringen.", img: "/story/warehouse-960.webp" },
];
const MODES = [
  { id: "sea", name: "Seefracht", time: "30 bis 45 Tage", best: "Große Mengen, planbare Ware, günstigste Kosten pro Einheit." },
  { id: "rail", name: "Schienenfracht", time: "18 bis 25 Tage", best: "Schneller als See, günstiger als Luft. Für Ware mit Termin." },
  { id: "air", name: "Luftfracht", time: "3 bis 7 Tage", best: "Muster, Eilaufträge und hochwertige, leichte Produkte." },
];
const LANES = ["Shanghai → Hamburg", "Ningbo → Rotterdam", "Shenzhen → Antwerpen", "Qingdao → Bremerhaven", "Xi’an → Duisburg · Schiene", "Guangzhou → Frankfurt · Luft", "Xiamen → Hamburg", "Tianjin → Rotterdam"];

export default function ComponentsExperiment() {
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const follower = useRef<HTMLDivElement>(null);
  const modesRef = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [open, setOpen] = useState<number | null>(null); // touch: tap to open a row
  const [mode, setMode] = useState("sea");

  // A · the image follows the pointer with lag; it leans into the movement
  useEffect(() => {
    const f = follower.current, l = list.current;
    if (!f || !l || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const xTo = gsap.quickTo(f, "x", { duration: still ? 0 : 0.6, ease: "power3" });
    const yTo = gsap.quickTo(f, "y", { duration: still ? 0 : 0.6, ease: "power3" });
    const rTo = gsap.quickTo(f, "rotation", { duration: 0.8, ease: "power3" });
    let lastX = 0;
    const onMove = (e: PointerEvent) => {
      const r = l.getBoundingClientRect();
      xTo(e.clientX - r.left);
      yTo(e.clientY - r.top);
      if (!still) rTo(gsap.utils.clamp(-10, 10, (e.clientX - lastX) * 0.6));
      lastX = e.clientX;
    };
    l.addEventListener("pointermove", onMove);
    return () => l.removeEventListener("pointermove", onMove);
  }, []);
  useEffect(() => {
    const f = follower.current;
    if (!f) return;
    gsap.to(f, { autoAlpha: hover === null ? 0 : 1, scale: hover === null ? 0.7 : 1, duration: 0.45, ease: "expo.out" });
  }, [hover]);

  // D · Flip: the chosen transport mode takes the room, the others make way
  const pickMode = (id: string) => {
    const el = modesRef.current;
    if (!el || id === mode) return;
    const state = Flip.getState(el.querySelectorAll("[data-mode], [data-mode] [data-flip]"));
    setMode(id);
    requestAnimationFrame(() =>
      Flip.from(state, {
        duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 0.75,
        ease: "expo.inOut",
        nested: true,
        absolute: false,
        onEnter: (els) => gsap.fromTo(els, { opacity: 0 }, { opacity: 1, duration: 0.4 }),
      }),
    );
  };

  // E · lanes: drag with momentum, snapping to cards (keyboard: arrows on the list)
  useEffect(() => {
    const t = track.current;
    if (!t) return;
    const cards = Array.from(t.children) as HTMLElement[];
    const step = () => cards[1].offsetLeft - cards[0].offsetLeft;
    const minX = () => Math.min(0, t.parentElement!.clientWidth - t.scrollWidth - 24);
    const d = Draggable.create(t, {
      type: "x",
      inertia: true,
      edgeResistance: 0.85,
      bounds: { minX: minX(), maxX: 0 },
      snap: (v: number) => gsap.utils.clamp(minX(), 0, Math.round(v / step()) * step()),
      onPress() { this.applyBounds({ minX: minX(), maxX: 0 }); },
    })[0];
    return () => void d.kill();
  }, []);
  const nudge = (dir: number) => {
    const t = track.current;
    if (!t) return;
    const cards = Array.from(t.children) as HTMLElement[];
    const step = cards[1].offsetLeft - cards[0].offsetLeft;
    const minX = Math.min(0, t.parentElement!.clientWidth - t.scrollWidth - 24);
    const x = Number(gsap.getProperty(t, "x"));
    gsap.to(t, { x: gsap.utils.clamp(minX, 0, Math.round((x - dir * step) / step) * step), duration: 0.7, ease: "expo.out" });
  };

  const current = MODES.find((m) => m.id === mode)!;

  return (
    <div ref={root} className={s.root}>
      <header className={s.head}>
        <p className="mono" style={{ color: "var(--red)" }}>05 · Signatur-Komponenten</p>
        <h1 className={s.h1}>Details, die man <em>spürt.</em></h1>
      </header>

      {/* A · service index with a trailing image */}
      <section className={s.sec} aria-labelledby="c-a">
        <p className={`mono ${s.kick}`}>A · Leistungsindex mit Bildspur (GSAP quickTo)</p>
        <h2 id="c-a" className={s.h2}>Sechs Disziplinen. <em>Eine Kette.</em></h2>
        <div ref={list} className={s.indexWrap} onPointerLeave={() => setHover(null)}>
        <ul className={s.index}>
          {SERVICES.map((x, i) => (
            <li key={x.t}>
              <a
                href="#"
                className={s.row}
                data-dim={hover !== null && hover !== i ? "" : undefined}
                onPointerEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                onClick={(e) => {
                  if (!window.matchMedia("(hover: hover)").matches) { e.preventDefault(); setOpen(open === i ? null : i); }
                }}
                aria-expanded={open === i}
              >
                <span className="mono">0{i + 1}</span>
                <span className={s.rowT}>{x.t}</span>
                <span className={s.rowL}>{x.l}</span>
                <span className={s.rowA} aria-hidden="true">→</span>
              </a>
              {open === i && <img className={s.rowImg} src={x.img} alt="" />}
            </li>
          ))}
        </ul>
          <div ref={follower} className={s.follower} aria-hidden="true">
            {SERVICES.map((x, i) => (
              <img key={x.t + i} src={x.img} alt="" data-on={hover === i || undefined} />
            ))}
          </div>
        </div>
      </section>

      {/* B · spotlight cards (React Bits) */}
      <section className={`${s.sec} ${s.dark}`} aria-labelledby="c-b">
        <p className={`mono ${s.kick}`}>B · React Bits SpotlightCard</p>
        <h2 id="c-b" className={s.h2}>Deutschland als Basis. <em>Europa als Markt.</em></h2>
        <div className={s.spots}>
          {["Deutschland", "EU-Distribution", "E-Commerce", "B2B"].map((t, i) => (
            <SpotlightCard key={t} className={s.spot} theme="dark" spotlightColor="rgba(201, 182, 142, 0.35)" intensity={0.18} spotlightSize={300}>
              <span className="mono" style={{ color: "var(--red-on-dark)" }}>0{i + 1}</span>
              <span className={s.spotT}>{t}</span>
            </SpotlightCard>
          ))}
        </div>
      </section>

      {/* C · tilted card + D · Flip transport modes */}
      <section className={s.sec} aria-labelledby="c-c">
        <div className={s.pair}>
          <div>
            <p className={`mono ${s.kick}`}>C · React Bits TiltedCard (Tiefenebenen)</p>
            <TiltedCard
              imageSrc="/story/warehouse-960.webp"
              altText="Lager mit Paletten, Symbolbild"
              captionText="Wir bauen Marken"
              containerHeight="460px"
              containerWidth="100%"
              imageHeight="460px"
              imageWidth="100%"
              rotateAmplitude={9}
              scaleOnHover={1.03}
              glare={0.25}
              radius={26}
              displayOverlayContent
              overlayContent={
                <TiltedCardLayer depth={40} className={s.tiltLayer}>
                  <span className={s.tiltSmall}>Wir bewegen nicht nur Produkte.</span>
                  <span className={s.tiltBig}>Wir bauen <em>Marken.</em></span>
                </TiltedCardLayer>
              }
            />
          </div>
          <div>
            <p className={`mono ${s.kick}`} id="c-c">D · GSAP Flip: Transportwege</p>
            <div ref={modesRef} className={s.modes} role="tablist" aria-label="Transportweg">
              {MODES.map((m) => (
                <button key={m.id} data-mode role="tab" aria-selected={m.id === mode} className={s.mode} data-on={m.id === mode || undefined} onClick={() => pickMode(m.id)}>
                  <span className={s.modeName} data-flip>{m.name}</span>
                  <span className={s.modeTime} data-flip>Richtwert {m.time}</span>
                </button>
              ))}
            </div>
            <div className={s.modeDetail} role="tabpanel" key={current.id}>
              <p className={s.modeBig}>{current.time}</p>
              <p className={s.modeBest}>{current.best}</p>
              <p className={s.fine}>Transitzeiten sind Richtwerte und hängen von Route, Saison und Abfertigung ab.</p>
            </div>
          </div>
        </div>
      </section>

      {/* E · lanes carousel */}
      <section className={`${s.sec} ${s.dark}`} aria-labelledby="c-e">
        <div className={s.carHead}>
          <div>
            <p className={`mono ${s.kick}`}>E · GSAP Draggable + Inertia</p>
            <h2 id="c-e" className={s.h2}>Typische <em>Handelsrouten.</em></h2>
          </div>
          <div className={s.arrows}>
            <button onClick={() => nudge(-1)} aria-label="Zurück">←</button>
            <button onClick={() => nudge(1)} aria-label="Weiter">→</button>
          </div>
        </div>
        <div className={s.viewport}>
          <div ref={track} className={s.track}>
            {LANES.map((l, i) => {
              const [a, rest] = l.split(" → ");
              const [b, via] = rest.split(" · ");
              return (
                <article key={l} className={s.laneCard}>
                  <span className="mono">{String(i + 1).padStart(2, "0")}</span>
                  <span className={s.laneFrom}>{a}</span>
                  <span className={s.laneArrow} aria-hidden="true" />
                  <span className={s.laneTo}>{b}</span>
                  <span className={s.laneVia}>{via ?? "See"}</span>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* F · magnetic actions */}
      <section className={s.sec} aria-labelledby="c-f">
        <p className={`mono ${s.kick}`}>F · React Bits Magnet</p>
        <h2 id="c-f" className={s.h2}>Sprechen wir über <em>Ihr nächstes Projekt.</em></h2>
        <div className={s.magnets}>
          <Magnet padding={70} magnetStrength={2.5}>
            <a href="#" className={s.bigCta}>Angebot anfragen <span aria-hidden="true">+</span></a>
          </Magnet>
          <Magnet padding={60} magnetStrength={3}>
            <a href="#" className={s.ghost}>Das Unternehmen</a>
          </Magnet>
        </div>
      </section>
    </div>
  );
}
