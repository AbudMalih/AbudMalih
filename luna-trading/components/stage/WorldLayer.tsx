"use client";

import { useEffect, useRef } from "react";
import type { WorldHandle } from "@/lib/world/createWorld";
import { ANCHOR_DEFS } from "@/lib/world/anchors";
import { stage, journeyT, range, smooth, JOURNEY_SEGMENTS } from "@/lib/stage/store";
import { onFrame, damp } from "@/lib/stage/ticker";
import { worldShared } from "@/lib/world/shared";
import { SEQUENCES, type SequenceManifest, type SequenceTier } from "@/content/sequences";
import { FrameSequence } from "@/lib/sequence/FrameSequence";
import { isCine } from "@/lib/motion/env";
import { useI18n } from "@/content/i18n/I18nProvider";
import styles from "./WorldLayer.module.css";

const LABEL_IDX: Record<string, string> = { germany: "03.1", eu: "03.2", ecommerce: "03.3", b2b: "03.4" };

/** World visibility as a pure function of chapter progress. */
function worldOpacity() {
  const { source: s, brands: b } = stage.p;
  return smooth(range(s, 0.16, 0.27)) * (1 - smooth(range(b, 0.6, 0.74)));
}

/**
 * Fixed layer for the journey (chapters 01–04).
 * Renders the procedural line-world, OR — per segment — a production image
 * sequence when a manifest exists in content/sequences.ts.
 */
export default function WorldLayer() {
  const { dict } = useI18n();
  const labels = dict.warehouse.labels as Record<string, string>;
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const seqRef = useRef<HTMLCanvasElement>(null);
  const labelRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (!isCine()) return;
    let disposed = false;
    let world: WorldHandle | null = null;
    let stop: (() => void) | null = null;
    let ro: ResizeObserver | null = null;
    const wrap = wrapRef.current!;
    const canvas = canvasRef.current!;
    const seqCanvas = seqRef.current!;
    const seqCtx = seqCanvas.getContext("2d");
    let cur = journeyT();
    let dirty = true;
    let lastV = -1;
    let built = false;

    // ---- production sequences (only those with manifests) -----------------
    const tierKey: SequenceTier = stage.mobile ? "mobile" : stage.vw < 1600 ? "laptop" : "desktop";
    const players = new Map<string, { m: SequenceManifest; seq: FrameSequence; from: number; to: number }>();
    for (const m of Object.values(SEQUENCES)) {
      if (!m) continue;
      const seg = JOURNEY_SEGMENTS.find((s) => s.id === m.segment)!;
      const seq = new FrameSequence(m, tierKey);
      players.set(m.id, { m, seq, from: seg.from, to: seg.to });
    }
    let seqStarted = false;

    const size = () => {
      const r = wrap.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, stage.tier === "high" ? 2 : 1.5);
      world?.setSize(Math.max(1, r.width), Math.max(1, r.height), dpr);
      seqCanvas.width = Math.round(r.width * Math.min(dpr, 1.5));
      seqCanvas.height = Math.round(r.height * Math.min(dpr, 1.5));
      players.forEach((p) => p.seq.invalidate());
      dirty = true;
    };

    const build = async () => {
      if (built) return;
      built = true;
      const { createWorld } = await import("@/lib/world/createWorld");
      if (disposed) return;
      world = createWorld(canvas, stage.tier);
      size();
    };

    ro = new ResizeObserver(size);
    ro.observe(wrap);

    // Build lazily: as soon as the hero is a third through (well before needed),
    // or immediately if the page was loaded deeper down.
    stop = onFrame((dt) => {
      if (!built && (stage.p.hero > 0.3 || stage.p.source > 0 || journeyT() > 0)) build();
      if (!seqStarted && players.size && stage.p.hero > 0.5) {
        seqStarted = true;
        players.forEach((p) => p.seq.start());
      }

      const o = worldOpacity();
      wrap.style.opacity = o.toFixed(3);
      wrap.style.visibility = o > 0.002 ? "visible" : "hidden";
      if (o <= 0.002 || !world) return;

      const tgt = journeyT();
      if (stage.version !== lastV) {
        lastV = stage.version;
        dirty = true;
      }
      const d = tgt - cur;
      const moving = Math.abs(d) > 1e-6;
      cur = moving ? cur + d * damp(stage.mobile ? 11 : 10, dt) : tgt;
      if (!moving && !dirty) return;
      dirty = false;

      // Production sequence for the active segment?
      let usedSeq = false;
      players.forEach((p) => {
        if (cur >= p.from && cur <= p.to && seqCtx) {
          usedSeq = p.seq.draw(seqCtx, (cur - p.from) / (p.to - p.from), p.m.focus) || usedSeq;
        }
      });
      seqCanvas.style.opacity = usedSeq ? "1" : "0";
      if (!usedSeq) world.render(cur);
      worldShared.carton = world.cartonRect();
      worldShared.t = cur;

      // environment-integrated labels
      const anchors = world.anchors();
      for (const a of anchors) {
        const el = labelRefs.current[a.id];
        const def = ANCHOR_DEFS.find((x) => x.id === a.id)!;
        if (!el) continue;
        const k = Math.min(range(cur, def.from, def.from + 0.015), 1 - range(cur, def.to - 0.015, def.to));
        const show = a.visible && k > 0 && !usedSeq;
        el.style.opacity = show ? String(k) : "0";
        if (show) el.style.transform = `translate3d(${a.x.toFixed(1)}px, ${a.y.toFixed(1)}px, 0)`;
      }
    });

    if (stage.p.source > 0) build();

    return () => {
      disposed = true;
      stop?.();
      ro?.disconnect();
      world?.dispose();
      players.forEach((p) => p.seq.dispose());
    };
  }, []);

  return (
    <div ref={wrapRef} className={`stage-layer ${styles.layer}`} aria-hidden="true" dir="ltr">
      <canvas ref={canvasRef} className={styles.canvas} />
      <canvas ref={seqRef} className={`${styles.canvas} ${styles.seq}`} />
      <div className={styles.labels}>
        {ANCHOR_DEFS.map((a) => (
          <div key={a.id} ref={(el) => void (labelRefs.current[a.id] = el)} className={styles.label}>
            <i className={styles.pin} />
            <span className={styles.stem} />
            <span className={styles.text}>
              <span className={`t-label ${styles.idx}`}>{LABEL_IDX[a.id]}</span>
              <span className={styles.name}>{labels[a.id]}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
