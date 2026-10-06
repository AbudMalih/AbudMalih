"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import Chapter, { useChapterTimeline } from "@/components/stage/Chapter";
import { LuviscentLogo } from "@/components/brand/Logos";
import BrandMediaSlot from "@/components/ui/BrandMediaSlot";
import MagneticLink from "@/components/ui/MagneticLink";
import { BRANDS } from "@/content/site";
import { useI18n } from "@/content/i18n/I18nProvider";
import { isCine } from "@/lib/motion/env";
import s from "./Luviscent.module.css";

/**
 * 07 · LUVISCENT®: entering an owned brand universe.
 * The red commerce connection has dissolved into air (Atmosphere); its main
 * strand settles as the champagne horizon. A plastered wall and one lit
 * niche emerge from the atmosphere (the niche is where real product
 * photography / renders will stand), then the official mark and the slogan
 * are revealed by a soft wipe of light, never altered. Motion is calm.
 * Luna Trading is present only as the owner, never merged with the mark.
 */
export default function Luviscent() {
  return (
    <Chapter id="luviscent" stageClassName={s.stage}>
      <Content />
    </Chapter>
  );
}

function Content() {
  const { dict, locale, href } = useI18n();
  const t = dict.luviscent;
  const brand = BRANDS.luviscent;
  const link = brand.url ?? href(brand.internal);
  const scope = useRef<HTMLDivElement>(null);
  const copy = useRef<HTMLDivElement>(null);

  // The horizon rests as one continuous divider BELOW the paragraph and
  // above the CTA (desktop / tablet). Measured from layout, so it holds at
  // every size; the niche keeps standing on it (--drop). On narrow screens
  // the line stays the niche's floor above the copy (CSS --drop).
  useEffect(() => {
    if (!isCine()) return;
    const wrap = scope.current!;
    const c = copy.current!;
    const narrow = window.matchMedia("(max-width: 860px)");
    const place = () => {
      if (narrow.matches) {
        wrap.style.removeProperty("--drop");
        return;
      }
      const body = c.querySelector("[data-body]") as HTMLElement;
      const cta = c.querySelector("[data-cta]") as HTMLElement;
      const top = c.offsetTop;
      const bodyBottom = top + body.offsetTop + body.offsetHeight;
      const ctaTop = top + cta.offsetTop;
      const lineY = bodyBottom + (ctaTop - bodyBottom) * 0.62;
      wrap.style.setProperty("--drop", `${(lineY - wrap.clientHeight / 2).toFixed(1)}px`);
    };
    place();
    const ro = new ResizeObserver(place);
    ro.observe(wrap);
    ro.observe(c);
    narrow.addEventListener("change", place);
    document.fonts?.ready.then(place);
    return () => {
      ro.disconnect();
      narrow.removeEventListener("change", place);
    };
  }, [locale]);

  useChapterTimeline(
    scope,
    (tl, q) => {
      // arrival: the air from the commerce node settles into the horizon;
      // the room emerges from the atmosphere, then the mark, then the words
      tl.fromTo(q("[data-gold]"), { opacity: 0 }, { opacity: 1, duration: 0.1 }, 0.15)
        .fromTo(q("[data-glow]"), { opacity: 0, scaleX: 0.3 }, { opacity: 1, scaleX: 1, duration: 0.2, ease: "power2.out" }, 0.12)
        // the horizon settles below the copy area BEFORE any text appears
        .fromTo(scope.current, { "--shift": 0 }, { "--shift": 1, duration: 0.1, ease: "power2.inOut" }, 0.13)
        .fromTo(q("[data-wall]"), { opacity: 0 }, { opacity: 1, duration: 0.22, ease: "power1.out" }, 0.1)
        .fromTo(q("[data-media-slot]"), { opacity: 0, scale: 1.035 }, { opacity: 1, scale: 1, duration: 0.24, ease: "power2.out" }, 0.14)
        .fromTo(q("[data-key]"), { yPercent: 24, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.28 }, 0.2)
        .fromTo(q("[data-mist]"), { xPercent: -6 }, { xPercent: 6, duration: 0.8 }, 0.1)
        .fromTo(q("[data-mist2]"), { xPercent: 6 }, { xPercent: -8, duration: 0.8 }, 0.1)
        .fromTo(q("[data-owner]"), { opacity: 0 }, { opacity: 1, duration: 0.06 }, 0.27)
        .fromTo(q("[data-logo]"), { "--rv": 0 }, { "--rv": 1, duration: 0.17, ease: "power1.inOut" }, 0.24)
        .fromTo(q("[data-claim]"), { "--rv": 0 }, { "--rv": 1, duration: 0.14, ease: "power1.inOut" }, 0.4)
        .fromTo(q("[data-body], [data-cta]"), { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.07, stagger: 0.03 }, 0.5)
        // once established: calm depth in the room only; the words stay anchored
        .fromTo(q("[data-depth-a]"), { y: 0 }, { y: -14, duration: 0.42, ease: "none" }, 0.3)
        .fromTo(q("[data-key]"), { scale: 1 }, { scale: 1.06, duration: 0.42, ease: "none", immediateRender: false }, 0.3)
        // exit: the world recedes, the horizon cools back to Luna red
        .to(q("[data-owner], [data-logo], [data-claim], [data-body], [data-cta]"), { opacity: 0, duration: 0.07 }, 0.72)
        .to(q("[data-media-slot], [data-wall]"), { opacity: 0, duration: 0.1, ease: "power2.in" }, 0.72)
        .to(q("[data-glow]"), { opacity: 0, duration: 0.08 }, 0.76)
        // ...and rises again only after the copy has fully faded
        .to(scope.current, { "--shift": 0, duration: 0.11, ease: "power2.inOut" }, 0.8)
        .fromTo(q("[data-red]"), { opacity: 0 }, { opacity: 1, duration: 0.08 }, 0.84)
        .fromTo(q("[data-horizon]"), { opacity: 1 }, { opacity: 0, duration: 0.06 }, 0.92);
    },
    [locale]
  );

  return (
    <div ref={scope} className={s.wrap}>
      <div className={s.horizon} data-horizon aria-hidden="true">
        <span className={s.gold} data-gold />
        <span className={s.glow} data-glow />
        <span className={s.red} data-red />
      </div>

      {/* a plastered wall with one lit niche: the place for the real product */}
      <div className={s.room} data-depth-a>
        <div className={s.wall} data-wall aria-hidden="true" />
        <BrandMediaSlot className={s.arch} />
      </div>

      <div ref={copy} className={s.copy} data-depth-b>
        <p className={`t-label ${s.owner}`} data-owner>
          07 &nbsp;·&nbsp; {t.owner}
        </p>
        <h2 className={s.logo} data-logo>
          <LuviscentLogo />
        </h2>
        <p className={s.claim} data-claim lang="de" dir="ltr">
          {brand.claim}
        </p>
        <p className={s.body} data-body>
          {t.body}
        </p>
        <div data-cta className={`${s.cta} interactive`}>
          <MagneticLink href={link} external={!!brand.url} className={s.ctaLink}>
            <span>{t.cta}</span>
            <span className={s.ctaPlus} aria-hidden="true" />
          </MagneticLink>
        </div>
      </div>

      <Link href={href("/brands")} className="sr-only">
        {t.allBrands}
      </Link>
    </div>
  );
}
