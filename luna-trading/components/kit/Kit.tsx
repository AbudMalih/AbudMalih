"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import s from "./Kit.module.css";
import a from "./Ambient.module.css";
import { Globe } from "./Ambient";

/** Shared building blocks of the site kit (see Kit.module.css). */

export const d = (ms: number) => ({ ["--d" as string]: `${ms}ms` });

export function Tag({
  children,
  dark,
}: {
  children: ReactNode;
  dark?: boolean;
}) {
  return (
    <p className={`t-label ${s.tag} ${dark ? s.tagDark : ""}`} data-reveal>
      <span className={s.tagRule} /> {children}
    </p>
  );
}

export function RedButton({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  const ext = href.startsWith("http") || href.startsWith("mailto:");
  const inner = (
    <>
      {children}
      <span className={s.badge} aria-hidden="true" />
    </>
  );
  return ext ? (
    <a
      href={href}
      className={s.btnRed}
      {...(href.startsWith("http")
        ? { target: "_blank", rel: "noopener" }
        : {})}
      data-cursor="invert"
    >
      {inner}
    </a>
  ) : (
    <Link href={href} className={s.btnRed} data-cursor="invert">
      {inner}
    </Link>
  );
}

export function GhostButton({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return href.startsWith("#") ? (
    <a href={href} className={s.btnGhost} data-cursor="link">
      {children}
    </a>
  ) : (
    <Link href={href} className={s.btnGhost} data-cursor="link">
      {children}
    </Link>
  );
}

/** Dark photographic page hero: eyebrow pill, two-line title, lead, actions, an aside. */
export function PageHero(props: {
  id: string;
  eyebrow: string;
  a: string;
  b: string;
  lead: string;
  actions: ReactNode;
  aside?: ReactNode;
  short?: boolean;
}) {
  return (
    <section
      className={`${s.hero} ${props.short ? s.heroShort : ""}`}
      data-tone="dark"
      aria-labelledby={props.id}
    >
      <div className={s.heroPhoto} aria-hidden="true" />
      <div className={`frame ${s.heroGrid}`}>
        <div>
          <p className={`t-label ${s.eyebrow}`} data-reveal>
            <span className={s.dot} />
            {props.eyebrow}
          </p>
          <h1 id={props.id} className={s.title} data-reveal style={d(80)}>
            <span>{props.a}</span>
            <span className={s.titleRed}>{props.b}</span>
          </h1>
          <p className={`t-lead ${s.lead}`} data-reveal style={d(200)}>
            {props.lead}
          </p>
          <div className={s.actions} data-reveal style={d(280)}>
            {props.actions}
          </div>
        </div>
        {props.aside && (
          <div data-reveal style={d(200)}>
            {props.aside}
          </div>
        )}
      </div>
    </section>
  );
}

/** A moving band of pills. */
export function Band({ title, items }: { title: string; items: string[] }) {
  return (
    <section className={s.lanes} data-tone="dark" aria-label={title}>
      <p className={`t-label ${s.lanesTitle}`}>{title}</p>
      <div className={s.marquee}>
        <div className={s.track}>
          {[...items, ...items].map((l, i) => (
            <span key={i} className={s.lane} aria-hidden={i >= items.length}>
              <i className={s.laneDot} />
              {l}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/** The closing call to action over the port. */
export function Cta({
  id,
  title,
  text,
  button,
  href,
  more,
  visual,
}: {
  id: string;
  title: string;
  text: string;
  button: string;
  href: string;
  more?: { label: string; href: string };
  visual?: ReactNode;
}) {
  return (
    <section className={s.cta} data-tone="dark" aria-labelledby={id}>
      <div className={s.heroPhoto} aria-hidden="true" />
      <div className={`frame ${a.sideGrid}`}>
        <div className={s.ctaInner}>
          <h2 id={id} className={s.ctaTitle} data-reveal>
            {title}
          </h2>
          <p className={`t-lead ${s.ctaText}`} data-reveal>
            {text}
          </p>
          <div className={s.actions} data-reveal>
            <RedButton href={href}>{button}</RedButton>
            {more && <GhostButton href={more.href}>{more.label}</GhostButton>}
          </div>
        </div>
        <div className={a.sideVisual} data-reveal style={d(160)}>
          {visual ?? <Globe />}
        </div>
      </div>
    </section>
  );
}

export { s as kit };
