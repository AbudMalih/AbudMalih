"use client";

import Link from "next/link";
import { useRef } from "react";
import Chapter, { useChapterTimeline } from "@/components/stage/Chapter";
import { LuviscentLogo } from "@/components/brand/Logos";
import BrandMediaSlot from "@/components/ui/BrandMediaSlot";
import MagneticLink from "@/components/ui/MagneticLink";
import { BRANDS } from "@/content/site";
import s from "./Luviscent.module.css";

/**
 * 06 — LUVISCENT®
 * The red line of the chain turns gold and becomes a horizon. The brand
 * rises from it in its own world (forest / warm light — see Atmosphere).
 * Luna Trading is present only as the owner, never merged with the mark.
 */
export default function Luviscent() {
  const brand = BRANDS.luviscent;
  return (
    <Chapter id="luviscent" title="LUVISCENT® — an owned brand of Luna Trading" stageClassName={s.stage}>
      <Content href={brand.url ?? brand.internal} external={!!brand.url} />
    </Chapter>
  );
}

function Content({ href, external }: { href: string; external: boolean }) {
  const scope = useRef<HTMLDivElement>(null);
  useChapterTimeline(scope, (tl, q) => {
    tl.fromTo(q("[data-gold]"), { opacity: 0 }, { opacity: 1, duration: 0.14 }, 0.02)
      .fromTo(q("[data-red]"), { opacity: 1 }, { opacity: 0, duration: 0.12 }, 0.04)
      .to(q("[data-red]"), { opacity: 1, duration: 0.08 }, 0.9)
      .fromTo(scope.current, { "--shift": 0 }, { "--shift": 1, duration: 0.2, ease: "power2.inOut" }, 0.1)
      .fromTo(q("[data-media-slot]"), { clipPath: "inset(100% 0 0 0)" }, { clipPath: "inset(0% 0 0 0)", duration: 0.22, ease: "power2.out" }, 0.22)
      .fromTo(q("[data-key]"), { yPercent: 30, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.3 }, 0.24)
      .fromTo(q("[data-mist]"), { xPercent: -8 }, { xPercent: 10, duration: 0.6 }, 0.22)
      .fromTo(q("[data-mist2]"), { xPercent: 8 }, { xPercent: -12, duration: 0.6 }, 0.22)
      .fromTo(q("[data-owner]"), { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.06 }, 0.3)
      .fromTo(q("[data-logo]"), { clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0% 0 0)", duration: 0.14, ease: "power2.inOut" }, 0.32)
      .fromTo(q("[data-claim]"), { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.08 }, 0.42)
      .fromTo(q("[data-body], [data-cta]"), { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.07, stagger: 0.03 }, 0.48)
      .fromTo(q("[data-statement] > *"), { opacity: 0 }, { opacity: 1, duration: 0.06, stagger: 0.04 }, 0.54)
      // exit
      .to(q("[data-owner], [data-logo], [data-claim], [data-body], [data-cta], [data-statement]"), { opacity: 0, duration: 0.07 }, 0.8)
      .to(q("[data-media-slot]"), { clipPath: "inset(100% 0 0 0)", duration: 0.1, ease: "power2.in" }, 0.8)
      .to(scope.current, { "--shift": 0, duration: 0.12, ease: "power2.inOut" }, 0.84)
      .to(q("[data-gold]"), { opacity: 0, duration: 0.08 }, 0.9)
      .to(q("[data-horizon]"), { opacity: 0, duration: 0.05 }, 0.95);
  });

  return (
    <div ref={scope} className={s.wrap}>
      <div className={s.horizon} data-horizon aria-hidden="true">
        <span className={s.red} data-red />
        <span className={s.gold} data-gold />
      </div>

      <BrandMediaSlot className={s.arch} />

      <div className={s.copy}>
        <p className={`t-label ${s.owner}`} data-owner>
          06 &nbsp;·&nbsp; Owned brand of Luna Trading GmbH
        </p>
        <h2 className={s.logo} data-logo>
          <LuviscentLogo />
        </h2>
        <p className={`t-serif ${s.claim}`} data-claim lang="de">
          Eleganz liegt in der Luft.
        </p>
        <p className={s.body} data-body>
          A premium home fragrance brand owned by Luna Trading — built on the company&rsquo;s sourcing, development and distribution
          infrastructure, with a world entirely its own.
        </p>
        <div data-cta className={`${s.cta} interactive`}>
          <MagneticLink href={href} external={external} className={s.ctaLink}>
            <span>Discover LUVISCENT</span>
            <span className={s.ctaPlus} aria-hidden="true" />
          </MagneticLink>
        </div>
      </div>

      <div className={`t-label ${s.statement}`} data-statement>
        <span>Luna Trading creates the infrastructure.</span>
        <span>The brand creates its own world.</span>
      </div>
      <Link href="/brands" className="sr-only">
        All brands of Luna Trading
      </Link>
    </div>
  );
}
