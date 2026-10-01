"use client";

import { useEffect, useRef } from "react";
import { Slashes } from "@/components/brand/Slashes";
import { StatRow } from "@/components/ui/StatRow";
import { processSteps } from "@/content/services";
import { countUp } from "@/motion/countUp";
import { createFramePlayer, supportsAvif } from "./framePlayer";
import { FILM_END, FRAME_COUNT, FRAME_SETS, frameSrc, POSTER_FRAME, STILL_FRAME } from "./frames";

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

const DESKTOP = "(min-width: 768px) and (min-aspect-ratio: 1/1)";

/**
 * Scroll story: a pre-rendered, photorealistic film (warehouse → Autobahn →
 * hub) scrubbed frame by frame on a canvas, with the text beats, the
 * illustrative HUD and the finale wipe layered on top as HTML.
 */
export function JourneySequence() {
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    let revert: (() => void) | undefined;
    let cancelled = false;

    // GSAP is only needed once the story is near – keep it off the critical path.
    const init = async () => {
      const [{ gsap }, { ScrollTrigger }, avif] = await Promise.all([import("gsap"), import("gsap/ScrollTrigger"), supportsAvif()]);
      if (cancelled) return;
      gsap.registerPlugin(ScrollTrigger);

      const q = <T extends Element = HTMLElement>(sel: string) => el.querySelector(sel) as unknown as T;
      const qa = <T extends Element = HTMLElement>(sel: string) => Array.from(el.querySelectorAll(sel)) as unknown as T[];
      const stage = q<HTMLElement>("[data-stage]");
      const canvas = q<HTMLCanvasElement>("[data-film]");

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
          // Landscape screens get the wide film; phones and portrait tablets the tall one.
          desktop: DESKTOP,
          mobile: "(max-width: 767.98px), (max-aspect-ratio: 1/1)",
          reduce: "(prefers-reduced-motion: reduce)",
        },
        (ctx) => {
          const { desktop, reduce } = ctx.conditions as { desktop: boolean; reduce: boolean };
          if (reduce) return;

          const player = createFramePlayer(canvas, desktop ? FRAME_SETS.desktop : FRAME_SETS.mobile, avif ? "avif" : "webp");
          const film = { frame: 0 };
          player.seek(0);

          const s = setSlant();
          const onResize = () => setSlant();
          window.addEventListener("resize", onResize);

          const tl = gsap.timeline({
            defaults: { ease: "none" },
            scrollTrigger: {
              trigger: q<HTMLElement>("[data-track]"),
              start: "top top",
              end: "bottom bottom",
              scrub: 0.3,
              invalidateOnRefresh: true,
            },
          });

          // The film: warehouse, door, pull-out, Autobahn, braking into the hub.
          tl.to(film, { frame: FRAME_COUNT - 1, duration: FILM_END, onUpdate: () => player.seek(film.frame) }, 0);

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

          return () => {
            window.removeEventListener("resize", onResize);
            player.dispose();
          };
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
          {/* Opening frame until the film has loaded; a still for reduced motion */}
          <picture className="absolute inset-0 motion-reduce:hidden">
            <source media={DESKTOP} type="image/avif" srcSet={frameSrc(FRAME_SETS.desktop, POSTER_FRAME, "avif")} />
            <source media={DESKTOP} srcSet={frameSrc(FRAME_SETS.desktop, POSTER_FRAME)} />
            <source type="image/avif" srcSet={frameSrc(FRAME_SETS.mobile, POSTER_FRAME, "avif")} />
            <img src={frameSrc(FRAME_SETS.mobile, POSTER_FRAME)} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
          </picture>
          <picture className="absolute inset-0 hidden motion-reduce:block">
            <source media={DESKTOP} type="image/avif" srcSet={frameSrc(FRAME_SETS.desktop, STILL_FRAME, "avif")} />
            <source media={DESKTOP} srcSet={frameSrc(FRAME_SETS.desktop, STILL_FRAME)} />
            <source type="image/avif" srcSet={frameSrc(FRAME_SETS.mobile, STILL_FRAME, "avif")} />
            <img
              src={frameSrc(FRAME_SETS.mobile, STILL_FRAME)}
              alt="Ein JARBOU-Sattelzug fährt in der Abenddämmerung über die Autobahn."
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
            />
          </picture>
          <canvas
            data-film
            role="img"
            aria-label="Film: Ein JARBOU-Sattelzug verlässt das Lager, fährt über die Autobahn und erreicht den Logistik-Hub."
            className="absolute inset-0 h-full w-full opacity-0 transition-opacity duration-500 data-[ready=true]:opacity-100 motion-reduce:hidden"
          />
          <div aria-hidden="true" className="film-grain pointer-events-none absolute inset-0 motion-reduce:hidden" />
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[55%] bg-gradient-to-b from-ink/80 via-ink/30 to-transparent" />
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-[30%] bg-gradient-to-t from-ink/70 to-transparent lg:hidden" />

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
            className="absolute bottom-8 left-5 right-5 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-steel-300 motion-reduce:hidden lg:bottom-auto lg:left-auto lg:right-12 lg:top-32 lg:w-80"
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
