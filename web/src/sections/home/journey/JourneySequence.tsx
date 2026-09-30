"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Slashes } from "@/components/brand/Slashes";
import { StatRow } from "@/components/ui/StatRow";
import { processSteps } from "@/content/services";
import { countUp } from "@/motion/countUp";
import { GROUND_Y, PARALLAX, TRUCK } from "./geometry";

/**
 * Framing. The viewBox is computed from the stage's real aspect ratio so the
 * whole Sattelzug is composed deliberately on every screen instead of being
 * cropped: desktop shows ~1600+ units (truck ≈ 65 % of the width), mobile a
 * dedicated tall composition with ~1300 units (truck ≈ 82 %).
 * `sx` = truck rear position in view units, `ground` = road line height (0–1).
 */
const FRAMING = {
  desktop: { minWidth: 1600, height: 1000, ground: 0.74, cam0: 0, sx0: TRUCK.startX, sxEnd: 200 },
  // Mobile: truck ≈ 82 % of the width, door kept in frame at the start.
  mobile: { minWidth: 1300, height: 0, ground: 0.56, cam0: 140, sx0: TRUCK.startX - 140, sxEnd: 50 },
} as const;

/** Beat windows on the 0–100 timeline. */
const BEATS: [number, number][] = [
  [0, 16],
  [16, 30],
  [30, 46],
  [46, 72],
  [72, 87],
];

const STATUS = [
  { from: 0, label: "Bereitstellung" },
  { from: 30, label: "Unterwegs" },
  { from: 80, label: "Angekommen" },
];

/**
 * Client controller for the scroll story. The SVG stage (`scene`) is rendered
 * on the server and passed in, so its markup never ships as client JS.
 */
export function JourneySequence({ scene }: { scene: ReactNode }) {
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    let revert: (() => void) | undefined;
    let cancelled = false;

    // GSAP is only needed once the story is near – keep it off the critical path.
    const init = async () => {
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([import("gsap"), import("gsap/ScrollTrigger")]);
      if (cancelled) return;
      gsap.registerPlugin(ScrollTrigger);

      const q = <T extends Element = SVGElement>(s: string) => el.querySelector<T & Element>(s) as T;
      const qa = <T extends Element = SVGElement>(s: string) => Array.from(el.querySelectorAll<T & Element>(s)) as T[];

      const svg = q<SVGSVGElement>("[data-scene]");
      const layers = {
        far: q("[data-layer=far]"),
        mid: q("[data-layer=mid]"),
        roadfar: q("[data-layer=roadfar]"),
        world: q("[data-layer=world]"),
        shade: q("[data-layer=shade]"),
        lamps: q("[data-layer=lamps]"),
        fg: q("[data-layer=fg]"),
      };
      const truck = q("[data-truck]");
      const wheels = qa("[data-wheel]");
      const blades = qa("[data-blades]");
      const trail = q("[data-trail]");
      const stage = q<HTMLElement>("[data-stage]");

      const state = { cam: 0, sx: TRUCK.startX as number, zoom: 1 };
      let frame = { x: 0, y: 0, w: 1600, h: 1000, ground: 0.74 };
      const wheelCenters = wheels.map((w) => {
        const c = w.querySelector("circle");
        return { x: Number(c?.getAttribute("cx") ?? 0), y: Number(c?.getAttribute("cy") ?? 0) };
      });
      const trailStart = Number(trail.getAttribute("x1"));
      const trailEnd = Number(trail.getAttribute("x2"));

      const render = () => {
        const { cam, sx, zoom } = state;
        // Camera push: zoom around the road line at the horizontal centre.
        const w = frame.w / zoom;
        const h = frame.h / zoom;
        svg.setAttribute(
          "viewBox",
          `${(frame.x + (frame.w - w) / 2).toFixed(1)} ${(frame.y + (frame.h - h) * frame.ground).toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)}`,
        );
        const tx = (f: number) => `translate(${(-cam * f).toFixed(2)} 0)`;
        layers.far.setAttribute("transform", tx(PARALLAX.far));
        layers.mid.setAttribute("transform", tx(PARALLAX.mid));
        layers.roadfar.setAttribute("transform", tx(PARALLAX.roadFar));
        layers.world.setAttribute("transform", tx(1));
        layers.shade.setAttribute("transform", tx(1));
        layers.lamps.setAttribute("transform", tx(1));
        layers.fg.setAttribute("transform", tx(PARALLAX.fg));
        const worldX = cam + sx;
        const bob = Math.sin(worldX / 29) * 0.35;
        truck.setAttribute("transform", `translate(${sx.toFixed(2)} ${(740 + bob).toFixed(2)})`);
        const angle = ((worldX - TRUCK.startX) / TRUCK.wheelR) * (180 / Math.PI);
        wheels.forEach((w, i) => {
          const c = wheelCenters[i]!;
          w.setAttribute("transform", `rotate(${angle.toFixed(1)} ${c.x} ${c.y})`);
        });
        const p = Math.min(1, Math.max(0, (worldX - trailStart) / (trailEnd - trailStart)));
        trail.setAttribute("stroke-dashoffset", String(1 - p));
        // Wind turbines turn with the scroll instead of a constant animation.
        blades.forEach((b, i) => b.setAttribute("transform", `rotate(${(i * 37 + cam * 0.08).toFixed(1)})`));
      };

      const setSlant = () => {
        const r = stage.getBoundingClientRect();
        // Keep the wipe edge at the logo's slash angle (≈28°).
        const s = ((r.height * 0.532) / Math.max(1, r.width)) * 100;
        stage.style.setProperty("--s", s.toFixed(2));
        return s;
      };

      const mm = gsap.matchMedia(el);
      mm.add(
        {
          desktop: "(min-width: 768px)",
          mobile: "(max-width: 767.98px)",
          reduce: "(prefers-reduced-motion: reduce)",
        },
        (ctx) => {
          const { desktop, reduce } = ctx.conditions as { desktop: boolean; reduce: boolean };
          const f = desktop ? FRAMING.desktop : FRAMING.mobile;
          const measure = () => {
            const r = stage.getBoundingClientRect();
            const aspect = Math.max(0.3, r.width / Math.max(1, r.height));
            let w = f.height ? f.height * aspect : f.minWidth;
            if (w < f.minWidth) w = f.minWidth;
            const h = w / aspect;
            frame = { x: 0, y: GROUND_Y - h * f.ground, w, h, ground: f.ground };
          };
          measure();
          svg.setAttribute("preserveAspectRatio", "xMidYMid slice");
          // Centre the Sattelzug in the frame while driving.
          const sxDrive = (frame.w - TRUCK.length) / 2;

          if (reduce) {
            // Static, low-motion frame: the Sattelzug on the Autobahn, lights on.
            state.cam = 3300;
            state.sx = sxDrive;
            state.zoom = 1;
            render();
            gsap.set("[data-lamp]", { opacity: 1 });
            gsap.set("[data-beam], [data-headlight], [data-trail-start], [data-marker]", { opacity: 1 });
            const onResizeStatic = () => {
              measure();
              render();
            };
            window.addEventListener("resize", onResizeStatic);
            return () => window.removeEventListener("resize", onResizeStatic);
          }

          state.cam = f.cam0;
          state.sx = f.sx0;
          state.zoom = 1.08;
          render();

          // Rear of the trailer must clear the door (world x ≈ 1390) before the Autobahn.
          const camA = 1560 - sxDrive;
          const cam76 = TRUCK.endX - 900 - sxDrive;
          const camEnd = TRUCK.endX - f.sxEnd;
          const s = setSlant();
          const onResize = () => {
            setSlant();
            measure();
            render();
          };
          window.addEventListener("resize", onResize);

          const tl = gsap.timeline({
            defaults: { ease: "none" },
            scrollTrigger: {
              trigger: q<HTMLElement>("[data-track]"),
              start: "top top",
              end: "bottom bottom",
              scrub: 0.6,
              invalidateOnRefresh: true,
            },
          });

          // Scene 1 – hall lights, truck lights, door
          tl.to("[data-dark]", { opacity: 0.18, duration: 7 }, 0);
          qa("[data-lamp]").forEach((lamp) => tl.to(lamp, { opacity: 1, duration: 1.2, ease: "power1.in" }, 0.5 + Number(lamp.getAttribute("data-lamp")) * 1.4));
          tl.to("[data-marker]", { opacity: 1, duration: 1.5 }, 6);
          tl.to("[data-headlight], [data-beam]", { opacity: 1, duration: 2 }, 7.5);
          tl.to("[data-door]", { y: -330, duration: 12, ease: "power1.inOut" }, 8);
          tl.to("[data-door-light]", { opacity: 1, duration: 7 }, 9);

          // Scene 2 – departure: slow pull-away, camera eases back out
          tl.to(state, { cam: camA, sx: sxDrive, duration: 16, ease: "power2.in", onUpdate: render }, 20);
          tl.to(state, { zoom: 1, duration: 16, ease: "sine.inOut", onUpdate: render }, 18);
          tl.to("[data-trail-start]", { opacity: 1, duration: 2 }, 30);

          // Scene 3/4 – Autobahn at constant speed
          tl.to(state, { cam: cam76, duration: 40, onUpdate: render }, 36);

          // Scene 5 – braking into the hub yard, brake lights, dock light
          tl.to(state, { cam: camEnd, sx: f.sxEnd, duration: 12, ease: "power3.out", onUpdate: render }, 76);
          tl.to(state, { zoom: 1.05, duration: 12, ease: "sine.inOut", onUpdate: render }, 76);
          tl.to("[data-tail]", { opacity: 1, duration: 2 }, 78);
          tl.to("[data-dock]", { opacity: 1, duration: 6 }, 80);
          tl.to("[data-beam]", { opacity: 0.35, duration: 4 }, 85);

          // Beats
          const beats = qa<HTMLElement>("[data-beat]");
          beats.forEach((b, i) => {
            const [a, z] = BEATS[i]!;
            if (i > 0) tl.fromTo(b, { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 2 }, a);
            tl.to(b, { autoAlpha: 0, y: -24, duration: 2 }, z - 2);
          });

          // HUD
          tl.fromTo("[data-route-fill]", { scaleX: 0 }, { scaleX: 1, duration: 56 }, 30);
          qa<HTMLElement>("[data-node]").forEach((n, i) => tl.to(n, { backgroundColor: "#f0080f", borderColor: "#f0080f", duration: 1 }, BEATS[i]![0] + 0.5));
          qa<HTMLElement>("[data-status]").forEach((st, i) => {
            if (i > 0) tl.fromTo(st, { autoAlpha: 0 }, { autoAlpha: 1, duration: 1 }, STATUS[i]!.from);
            if (i < STATUS.length - 1) tl.to(st, { autoAlpha: 0, duration: 1 }, STATUS[i + 1]!.from - 1);
          });
          tl.fromTo("[data-qc-open]", { autoAlpha: 1 }, { autoAlpha: 0, duration: 1 }, 83);
          tl.fromTo("[data-qc-done]", { autoAlpha: 0 }, { autoAlpha: 1, duration: 1 }, 84);
          tl.fromTo("[data-progress]", { scaleX: 0 }, { scaleX: 1, duration: 58 }, 30);
          tl.to("[data-hud]", { autoAlpha: 0, duration: 2 }, 87);

          // Finale – slash wipe into the claim + figures
          tl.fromTo(stage, { "--w": -80 }, { "--w": 108 + s + 12, duration: 9, ease: "power2.inOut" }, 88);
          tl.fromTo("[data-panel-content] > *", { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 3, stagger: 1 }, 92);
          tl.call(() => qa<HTMLElement>("[data-panel] [data-count]").forEach((n) => countUp(n)), undefined, 91.5);
          tl.to({}, { duration: 3 }, 97);

          return () => window.removeEventListener("resize", onResize);
        },
      );
      revert = () => mm.revert();
    };

    let started = false;
    const start = () => {
      if (started) return;
      started = true;
      io.disconnect();
      window.removeEventListener("scroll", start);
      void init();
    };
    // Load on first scroll (user intent) or when the section is already in view.
    const io = new IntersectionObserver(([entry]) => entry?.isIntersecting && start());
    io.observe(el);
    window.addEventListener("scroll", start, { passive: true, once: true });

    return () => {
      cancelled = true;
      io.disconnect();
      window.removeEventListener("scroll", start);
      revert?.();
    };
  }, []);

  return (
    <section ref={root} id="ablauf" aria-labelledby="journey-title" className="relative bg-ink">
      <h2 id="journey-title" className="sr-only">
        Vom Lager zum Ziel: So läuft ein Einsatz bei JARBOU
      </h2>
      <div data-track className="relative h-[600vh] max-md:h-[480vh] motion-reduce:h-auto">
        <div
          data-stage
          className="sticky top-0 h-svh overflow-hidden bg-ink motion-reduce:relative motion-reduce:h-[70svh] motion-reduce:min-h-[420px]"
          style={{ "--w": -80, "--s": 33 } as React.CSSProperties}
        >
          {scene}
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[55%] bg-gradient-to-b from-ink/80 via-ink/30 to-transparent" />

          {/* Beats */}
          <ol className="pointer-events-none absolute inset-x-0 top-24 motion-reduce:hidden md:top-32">
            {processSteps.map((step, i) => (
              <li
                key={step.id}
                data-beat
                className={`shell absolute inset-x-0 top-0 ${i === 0 ? "" : "invisible opacity-0"}`}
              >
                <p className="eyebrow text-steel-300">
                  <span className="text-red">{step.index}</span> / 05
                </p>
                <p className="display mt-3 text-[clamp(2.75rem,9vw,8.5rem)] text-white">{step.title}</p>
                <p className="mt-3 max-w-md text-sm leading-relaxed text-steel-200 md:mt-4 md:text-[0.95rem]">{step.text}</p>
              </li>
            ))}
          </ol>

          {/* Operational HUD – illustrative, not live data */}
          <aside
            data-hud
            aria-label="Illustrative Tourübersicht"
            className="absolute bottom-8 left-5 right-5 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-steel-300 motion-reduce:hidden md:bottom-auto md:left-auto md:right-12 md:top-32 md:w-80"
          >
            <div className="flex items-center gap-3">
              <Slashes className="h-3 w-auto shrink-0 text-red" />
              <div className="relative h-px flex-1 bg-white/20">
                <div data-route-fill className="absolute inset-0 origin-left scale-x-0 bg-red" />
                <div className="absolute inset-x-0 -top-[5px] flex justify-between">
                  {processSteps.map((s) => (
                    <span key={s.id} data-node className="size-[11px] border border-white/40 bg-ink" />
                  ))}
                </div>
              </div>
            </div>
            <dl className="mt-5 grid grid-cols-2 gap-y-2 border-t border-white/10 pt-4">
              <dt>Fahrzeugstatus</dt>
              <dd className="relative text-right text-white">
                {STATUS.map((st, i) => (
                  <span key={st.label} data-status className={`absolute right-0 top-0 ${i === 0 ? "" : "invisible opacity-0"}`}>
                    {st.label}
                  </span>
                ))}
                &nbsp;
              </dd>
              <dt>Qualitätsprüfung</dt>
              <dd className="relative text-right text-white">
                <span data-qc-open className="absolute right-0 top-0">Ausstehend</span>
                <span data-qc-done className="invisible absolute right-0 top-0 text-red opacity-0">Abgeschlossen</span>
                &nbsp;
              </dd>
              <dt>Tourfortschritt</dt>
              <dd className="flex items-center">
                <span className="relative h-1 w-full bg-white/15">
                  <span data-progress className="absolute inset-0 origin-left scale-x-0 bg-white" />
                </span>
              </dd>
            </dl>
            <p className="mt-4 text-[0.62rem] text-steel-500">Illustrative Darstellung</p>
          </aside>

          {/* Finale */}
          <div
            data-panel
            className="absolute inset-0 bg-ink motion-reduce:hidden"
            style={{ clipPath: "polygon(-20% 0, calc(var(--w) * 1%) 0, calc((var(--w) - var(--s)) * 1%) 100%, -20% 100%)" }}
          >
            <div data-panel-content className="shell flex h-full flex-col justify-center gap-12 pt-16 md:gap-16">
              <div>
                <p className="eyebrow text-steel-300">
                  <span className="text-red">{"//"}</span> Ziel erreicht
                </p>
                <p className="display mt-5 max-w-5xl text-[clamp(2.6rem,7vw,7.25rem)] text-white">
                  <span className="block">Logistik,</span>
                  <span className="block">die messbar</span>
                  <span className="block">
                    funktioniert<span className="text-red">.</span>
                  </span>
                </p>
              </div>
              <StatRow />
            </div>
          </div>
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden motion-reduce:hidden">
            <span
              className="absolute inset-y-0 w-[max(14px,2.2vw)] bg-red"
              style={{ left: "calc((var(--w) - var(--s) / 2) * 1%)", transform: "translateX(-100%) skewX(-28deg)" }}
            />
            <span
              className="absolute inset-y-0 w-[max(14px,2.2vw)] bg-red"
              style={{ left: "calc((var(--w) - var(--s) / 2) * 1% + max(26px, 3.6vw))", transform: "translateX(-100%) skewX(-28deg)" }}
            />
          </div>
        </div>
      </div>

      {/* Reduced-motion: static claim + figures */}
      <div className="hidden motion-reduce:block">
        <div className="shell py-20">
          <p className="display max-w-5xl text-[clamp(2.6rem,7vw,7.25rem)] text-white">
            <span className="block">Logistik,</span>
            <span className="block">die messbar</span>
            <span className="block">
              funktioniert<span className="text-red">.</span>
            </span>
          </p>
          <StatRow className="mt-14" />
        </div>
      </div>
    </section>
  );
}
