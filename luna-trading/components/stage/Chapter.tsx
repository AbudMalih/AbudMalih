"use client";

import { createContext, useContext, useEffect, useLayoutEffect, useRef, type ReactNode, type RefObject } from "react";
import { gsap, ScrollTrigger } from "@/lib/motion/gsap";
import { setProgress, stage } from "@/lib/stage/store";
import { CHAPTERS, type ChapterId } from "@/content/chapters";
import { isCine } from "@/lib/motion/env";

const useIso = typeof window !== "undefined" ? useLayoutEffect : useEffect;

type Ctx = {
  id: ChapterId;
  register: (tl: gsap.core.Timeline) => () => void;
};
const ChapterCtx = createContext<Ctx | null>(null);

type Props = {
  id: ChapterId;
  /** Accessible name of the chapter (visually the headline usually carries it). */
  title: string;
  className?: string;
  stageClassName?: string;
  children: ReactNode;
};

/**
 * A chapter is a scroll spacer (<section>) + a stage (fixed overlay in
 * cinematic mode, normal block in static mode). Its single ScrollTrigger:
 *   1. writes chapter progress into the stage store (read by WebGL layers)
 *   2. drives every registered DOM timeline (normalised to duration 1)
 *   3. toggles stage visibility with half-open intervals so exactly one
 *      chapter stage is visible at any scroll position.
 */
export default function Chapter({ id, title, className, stageClassName, children }: Props) {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const timelines = useRef(new Set<gsap.core.Timeline>());
  const meta = CHAPTERS.find((c) => c.id === id)!;
  const isLast = CHAPTERS[CHAPTERS.length - 1].id === id;
  const isFirst = CHAPTERS[0].id === id;

  const ctx = useRef<Ctx>({
    id,
    register: (tl) => {
      timelines.current.add(tl);
      tl.progress(stage.p[id] ?? 0);
      return () => timelines.current.delete(tl);
    },
  });

  useIso(() => {
    if (!isCine() || !sectionRef.current || !stageRef.current) return;
    const el = stageRef.current;
    let active = false;

    const apply = (self: ScrollTrigger) => {
      const p = self.progress;
      setProgress(id, p);
      timelines.current.forEach((tl) => tl.progress(p));
      const y = self.scroll();
      const on = (isFirst || y >= self.start) && (isLast || y < self.end);
      if (on !== active) {
        active = on;
        el.classList.toggle("is-active", on);
        el.toggleAttribute("inert", !on);
        el.setAttribute("aria-hidden", on ? "false" : "true");
      }
    };

    const st = ScrollTrigger.create({
      trigger: sectionRef.current,
      start: "top top",
      end: "bottom bottom",
      onUpdate: apply,
      onRefresh: apply,
    });
    apply(st);
    return () => st.kill();
  }, [id, isFirst, isLast]);

  return (
    <ChapterCtx.Provider value={ctx.current}>
      <section
        ref={sectionRef}
        id={id}
        data-chapter={id}
        aria-label={title}
        className={`chapter ${className ?? ""}`}
        style={{ ["--len" as string]: meta.len, ["--len-m" as string]: meta.lenM }}
      >
        <div ref={stageRef} className={`chapter-stage ${stageClassName ?? ""}`}>
          {children}
        </div>
      </section>
    </ChapterCtx.Provider>
  );
}

/**
 * Build a scrubbed timeline for the current chapter. Author it on a 0..1
 * time axis: position `0.4` == 40 % through the chapter. Only built in
 * cinematic mode — the static layout is the DOM's natural state.
 */
export function useChapterTimeline(
  scope: RefObject<HTMLElement | null>,
  build: (tl: gsap.core.Timeline, q: (sel: string) => Element[]) => void,
  deps: unknown[] = []
) {
  const ctx = useContext(ChapterCtx);
  useIso(() => {
    if (!ctx || !scope.current || !isCine()) return;
    const gctx = gsap.context(() => {
      const tl = gsap.timeline({ paused: true, defaults: { ease: "none", duration: 0.1 } });
      build(tl, gsap.utils.selector(scope.current));
      // normalise to exactly 1 unit
      if (tl.duration() < 1) tl.set({}, {}, 1);
      const unregister = ctx.register(tl);
      return () => unregister();
    }, scope);
    return () => gctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

export function useChapterId() {
  return useContext(ChapterCtx)?.id;
}
