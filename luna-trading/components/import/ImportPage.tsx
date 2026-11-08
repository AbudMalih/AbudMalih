"use client";

import RichText from "@/components/ui/RichText";
import Link from "next/link";
import { useRef } from "react";
import { useI18n } from "@/content/i18n/I18nProvider";
import { IMPORT_COPY } from "@/content/importPage";
import { PLATFORMS } from "@/content/platforms";
import { usePageMotion } from "@/components/services/usePageMotion";
import { FlagCN, FlagDE, FlagEU } from "./Flags";
import RouteCard from "./RouteCard";
import svc from "@/components/services/Services.module.css";
import s from "@/components/kit/Kit.module.css";
import { Cta } from "@/components/kit/Kit";
import { Globe } from "@/components/kit/Ambient";
import { STORY } from "@/content/story";

/**
 * IMPORT: the trade lane from China to Germany, made tangible.
 * Dark port hero with flags and a live route (a container travels the sea
 * lane), a moving band of typical lanes, the three transport modes, the six
 * steps, why Luna Trading, the sales channels and the call to action.
 * Only general facts: lanes are typical routes, times are ranges.
 */

const CHANNELS = ["amazon", "ebay", "otto", "shopify", "woocommerce"];

export default function ImportPage() {
  const { locale, href } = useI18n();
  const t = IMPORT_COPY[locale];
  const root = useRef<HTMLElement>(null);
  usePageMotion(root);
  const channels = PLATFORMS.filter((p) => CHANNELS.includes(p.id));

  return (
    <article ref={root} className={`${svc.page} ${s.page}`}>
      {/* ------------------------------------------------------------ HERO */}
      <section
        className={s.hero}
        data-tone="dark"
        data-hero
        aria-labelledby="imp-title"
      >
        <link
          rel="preload"
          as="image"
          href="/sky/port-1600.webp"
          media="(max-width: 1024px)"
          fetchPriority="high"
        />
        <link
          rel="preload"
          as="image"
          href="/sky/port-2560.webp"
          media="(min-width: 1025px)"
        />
        <div className={s.heroPhoto} aria-hidden="true" />
        <div className={`frame ${s.heroGrid}`}>
          <div className={s.heroCopy}>
            <p className={`t-label ${s.eyebrow}`} data-reveal>
              <span className={s.dot} />
              {t.eyebrow}
            </p>
            <h1
              id="imp-title"
              className={s.title}
              data-reveal
              style={{ ["--d" as string]: "80ms" }}
            >
              <span>{t.h1a}</span> <span className={s.titleRed}>{t.h1b}</span>
            </h1>
            <div
              className={s.flags}
              data-reveal
              style={{ ["--d" as string]: "160ms" }}
            >
              <span className={s.flagChip}>
                <FlagCN className={s.flag} />
                <span>
                  <small>{t.from}</small>
                  {locale === "de"
                    ? "China"
                    : locale === "en"
                      ? "China"
                      : "الصين"}
                </span>
              </span>
              <span className={s.flagArrow} aria-hidden="true" />
              <span className={s.flagChip}>
                <FlagDE className={s.flag} />
                <span>
                  <small>{t.to}</small>
                  {locale === "de"
                    ? "Deutschland"
                    : locale === "en"
                      ? "Germany"
                      : "ألمانيا"}
                </span>
              </span>
              <span className={s.flagChip}>
                <FlagEU className={s.flag} />
                <span>
                  <small>&nbsp;</small>
                  {locale === "ar" ? "الاتحاد الأوروبي" : "EU"}
                </span>
              </span>
            </div>
            <p
              className={`t-lead ${s.lead}`}
              data-reveal
              style={{ ["--d" as string]: "220ms" }}
            >
              {t.lead}
            </p>
            <div
              className={s.actions}
              data-reveal
              style={{ ["--d" as string]: "280ms" }}
            >
              <Link
                href={href("/quote")}
                className={s.btnRed}
                data-cursor="invert"
              >
                {t.ctaPrimary}
                <span className={s.badge} aria-hidden="true" />
              </Link>
              <a href="#ablauf" className={s.btnGhost} data-cursor="link">
                {t.ctaSecondary}
              </a>
            </div>
          </div>

          {/* the live route */}
          <RouteCard t={t} />
        </div>
      </section>

      {/* ----------------------------------------------------------- LANES */}
      <section className={s.lanes} data-tone="dark" aria-label={t.lanesTitle}>
        <p className={`t-label ${s.lanesTitle}`}>{t.lanesTitle}</p>
        <div className={s.marquee} dir="ltr">
          <div className={s.track}>
            {[...t.lanes, ...t.lanes].map((l, i) => (
              <span
                key={i}
                className={s.lane}
                aria-hidden={i >= t.lanes.length}
              >
                <i className={s.laneDot} />
                {l}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------------- MODES */}
      <section
        className={s.light}
        data-tone="light"
        aria-labelledby="imp-modes"
      >
        <div className="frame">
          <p className={`t-label ${s.tag}`} data-reveal>
            <span className={s.tagRule} /> {t.modesTag}
          </p>
          <h2 id="imp-modes" className={s.h2} data-reveal>
            {t.modesTitle}
          </h2>
          <div className={s.modes}>
            {t.modes.map((m, i) => (
              <div
                key={m.id}
                className={s.mode}
                data-reveal
                style={{ ["--d" as string]: `${i * 90}ms` }}
              >
                <ModeIcon id={m.id} />
                <h3 className={s.modeName}>{m.name}</h3>
                <p className={s.modeTime}>
                  <span>{m.time}</span>
                </p>
                <p className={s.modeBest}>{m.best}</p>
              </div>
            ))}
          </div>
          <p className={s.note} data-reveal>
            {t.modesNote} {t.carriers}
          </p>
        </div>
      </section>

      {/* ----------------------------------------------------------- STEPS */}
      <section
        id="ablauf"
        className={`${s.light} ${s.alt}`}
        data-tone="light"
        aria-labelledby="imp-steps"
      >
        <div className="frame">
          <p className={`t-label ${s.tag}`} data-reveal>
            <span className={s.tagRule} /> {t.stepsTag}
          </p>
          <h2 id="imp-steps" className={s.h2} data-reveal>
            {t.stepsTitle}
          </h2>
          <ol className={s.steps}>
            {t.steps.map((st, i) => (
              <li
                key={i}
                className={s.step}
                data-reveal
                style={{ ["--d" as string]: `${i * 70}ms` }}
              >
                <span className={s.stepNum}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className={s.stepTitle}>{st.title}</h3>
                <p className={s.stepText}>
                  <RichText text={st.text} />
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---------------------------------------------------------- VALUES */}
      <section className={s.dark} data-tone="dark" aria-labelledby="imp-values">
        <div className="frame">
          <p className={`t-label ${s.tag} ${s.tagDark}`} data-reveal>
            <span className={s.tagRule} /> {t.valuesTag}
          </p>
          <h2 id="imp-values" className={`${s.h2} ${s.h2Dark}`} data-reveal>
            {t.valuesTitle}
          </h2>
          <div className={s.values}>
            {t.values.map((v, i) => (
              <div
                key={i}
                className={s.value}
                data-reveal
                style={{ ["--d" as string]: `${i * 80}ms` }}
              >
                <span className={s.check} aria-hidden="true" />
                <h3 className={s.valueTitle}>{v.title}</h3>
                <p className={s.valueText}>
                  <RichText text={v.text} />
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------- CHANNELS */}
      <section
        className={s.light}
        data-tone="light"
        aria-labelledby="imp-channels"
      >
        <div className={`frame ${s.channelsGrid}`}>
          <div>
            <p className={`t-label ${s.tag}`} data-reveal>
              <span className={s.tagRule} /> {t.channelsTag}
            </p>
            <h2 id="imp-channels" className={s.h2} data-reveal>
              {t.channelsTitle}
            </h2>
            <p className={`t-lead ${s.channelsText}`} data-reveal>
              <RichText text={t.channelsText} />
            </p>
          </div>
          <div data-reveal>
            <ul className={s.channels}>
              {channels.map((c) => (
                <li key={c.id} className={s.channel}>
                  <span>{c.name}</span>
                </li>
              ))}
            </ul>
            <p className={s.note}>{t.channelsNote}</p>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- CTA */}
      <Cta
        id="imp-cta"
        title={t.ctaTitle}
        text={t.ctaText}
        button={t.ctaButton}
        href={href("/quote")}
        visual={<Globe label={STORY[locale].visual.globe} />}
      />
    </article>
  );
}

function ModeIcon({ id }: { id: "sea" | "rail" | "air" }) {
  return (
    <svg viewBox="0 0 120 64" className={s.modeIcon} aria-hidden="true">
      {id === "sea" && (
        <>
          <path d="M8 40h92l-10 14H20z" />
          <path d="M26 40V28h16v12M44 40V24h16v16M62 40V28h16v12" />
          <path d="M82 40V20h8v20" />
          <path
            d="M4 58c8 0 8-3 16-3s8 3 16 3 8-3 16-3 8 3 16 3 8-3 16-3 8 3 16 3"
            className="red"
          />
        </>
      )}
      {id === "rail" && (
        <>
          <path d="M10 18h30v24H10zM44 18h30v24H44zM78 18h30v24H78z" />
          <path d="M40 34h4M74 34h4" />
          <circle cx="18" cy="46" r="3" />
          <circle cx="32" cy="46" r="3" />
          <circle cx="52" cy="46" r="3" />
          <circle cx="66" cy="46" r="3" />
          <circle cx="86" cy="46" r="3" />
          <circle cx="100" cy="46" r="3" />
          <path d="M4 54h112" className="red" />
        </>
      )}
      {id === "air" && (
        <>
          <path d="M12 38l40-6 16-20h8l-6 18 34-4c6 0 6 8 0 8l-34 4 6 18h-8l-16-20-40-6z" />
          <path d="M8 56c20-6 44-8 104-8" className="red" />
        </>
      )}
    </svg>
  );
}
