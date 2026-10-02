"use client";

import Link from "next/link";
import { useRef } from "react";
import Chapter, { useChapterTimeline } from "@/components/stage/Chapter";
import { LuviscentLogo } from "@/components/brand/Logos";
import BrandMediaSlot from "@/components/ui/BrandMediaSlot";
import MagneticLink from "@/components/ui/MagneticLink";
import { BRANDS } from "@/content/site";
import { useI18n } from "@/content/i18n/I18nProvider";
import s from "./Luviscent.module.css";

/**
 * 06 · LUVISCENT®: entering an owned brand universe.
 * The chain's line arrives already warmed to champagne and settles as a
 * horizon. Warm light rises before the mark appears. Luna Trading is
 * present only as the owner, never merged with the mark.
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

  useChapterTimeline(
    scope,
    (tl, q) => {
      tl.fromTo(scope.current, { "--shift": 0 }, { "--shift": 1, duration: 0.2, ease: "power2.inOut" }, 0.02)
        .fromTo(q("[data-glow]"), { opacity: 0, scaleX: 0.3 }, { opacity: 1, scaleX: 1, duration: 0.2, ease: "power2.out" }, 0)
        .fromTo(q("[data-media-slot]"), { clipPath: "inset(100% 0 0 0)" }, { clipPath: "inset(0% 0 0 0)", duration: 0.22, ease: "power2.out" }, 0.12)
        .fromTo(q("[data-key]"), { yPercent: 30, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.3 }, 0.14)
        .fromTo(q("[data-mist]"), { xPercent: -8 }, { xPercent: 10, duration: 0.8 }, 0.1)
        .fromTo(q("[data-mist2]"), { xPercent: 8 }, { xPercent: -12, duration: 0.8 }, 0.1)
        .fromTo(q("[data-owner]"), { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.06 }, 0.2)
        .fromTo(q("[data-logo]"), { clipPath: "inset(0 50% 0 50%)", opacity: 0.4 }, { clipPath: "inset(0 0% 0 0%)", opacity: 1, duration: 0.16, ease: "power2.inOut" }, 0.22)
        .fromTo(q("[data-claim]"), { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.08 }, 0.34)
        .fromTo(q("[data-body], [data-cta]"), { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.07, stagger: 0.03 }, 0.4)
        // exit: the world recedes, the horizon cools back to Luna red
        .to(q("[data-owner], [data-logo], [data-claim], [data-body], [data-cta]"), { opacity: 0, duration: 0.07 }, 0.72)
        .to(q("[data-media-slot]"), { clipPath: "inset(100% 0 0 0)", duration: 0.1, ease: "power2.in" }, 0.72)
        .to(q("[data-glow]"), { opacity: 0, duration: 0.08 }, 0.76)
        .to(scope.current, { "--shift": 0, duration: 0.12, ease: "power2.inOut" }, 0.78)
        .fromTo(q("[data-red]"), { opacity: 0 }, { opacity: 1, duration: 0.08 }, 0.84)
        .fromTo(q("[data-horizon]"), { opacity: 1 }, { opacity: 0, duration: 0.06 }, 0.92);
    },
    [locale]
  );

  return (
    <div ref={scope} className={s.wrap}>
      <div className={s.horizon} data-horizon aria-hidden="true">
        <span className={s.gold} />
        <span className={s.glow} data-glow />
        <span className={s.red} data-red />
      </div>

      <BrandMediaSlot className={s.arch} />

      <div className={s.copy}>
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
