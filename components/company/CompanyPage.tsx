"use client";

import { useRef } from "react";
import { useI18n } from "@/content/i18n/I18nProvider";
import { usePageMotion } from "@/components/services/usePageMotion";
import { FlagDE, FlagEU } from "@/components/import/Flags";
import {
  PageHero,
  Band,
  Cta,
  Tag,
  RedButton,
  GhostButton,
  d,
  kit as s,
} from "@/components/kit/Kit";
import svc from "@/components/services/Services.module.css";
import { Globe } from "@/components/kit/Ambient";
import Story from "@/components/kit/Story";

/**
 * UNTERNEHMEN / COMPANY on the site kit. Only verified company facts.
 */
const num = (i: number) => String(i + 1).padStart(2, "0");

export default function CompanyPage() {
  const { dict, href } = useI18n();
  const t = dict.companyPage;
  const root = useRef<HTMLElement>(null);
  usePageMotion(root);

  return (
    <article ref={root} className={`${svc.page} ${s.page}`}>
      <PageHero
        id="co-title"
        eyebrow={t.hero.eyebrow}
        a={t.hero.h1a}
        b={t.hero.h1b}
        lead={t.hero.lead}
        actions={
          <>
            <RedButton href={href("/contact")}>{t.cta.button}</RedButton>
            <GhostButton href={href("/what-we-do")}>{t.cta.more}</GhostButton>
          </>
        }
        aside={<Globe label={t.hero.base} />}
      />

      <Band
        title={t.profile.areasTag}
        items={[...t.profile.areas, ...t.direction.lines]}
      />

      {/* profile */}
      <section
        className={s.light}
        data-tone="light"
        aria-labelledby="co-profile"
      >
        <div className={`frame ${s.split}`}>
          <div>
            <Tag>{t.profile.tag}</Tag>
            <h2 id="co-profile" className={s.h2} data-reveal>
              {t.profile.name}
            </h2>
            <div className={s.flags} data-reveal>
              <span
                className={s.flagChip}
                style={{
                  background: "#fff",
                  color: "#141518",
                  borderColor: "rgba(20,21,24,.1)",
                }}
              >
                <FlagDE className={s.flag} />
                <span>
                  <small>{t.profile.country}</small>
                  {t.profile.city}
                </span>
              </span>
            </div>
            <div
              className={s.bentoHero}
              style={{ minHeight: 300, marginTop: 28 }}
              data-reveal
              aria-hidden="true"
            >
              <span className={s.chipDark} style={{ alignSelf: "flex-start" }}>
                {t.hero.base}
              </span>
            </div>
          </div>
          <div className={s.card} data-reveal style={d(100)}>
            <p className={s.big}>{t.profile.statement}</p>
            <p className={s.text} style={{ marginTop: 16 }}>
              {t.profile.body}
            </p>
            <ul className={s.chips}>
              {t.profile.areas.map((a) => (
                <li key={a} className={s.chip}>
                  {a}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* the idea: before / now */}
      <section
        className={`${s.light} ${s.alt}`}
        data-tone="light"
        aria-labelledby="co-idea"
      >
        <div className="frame">
          <Tag>{t.idea.tag}</Tag>
          <h2 id="co-idea" className={s.h2} data-reveal>
            {t.idea.title1} <span className={s.titleRed}>{t.idea.title2}</span>
          </h2>
          <p className={s.body} data-reveal>
            {t.idea.body}
          </p>
          <div className={s.grid2}>
            <div className={s.card} data-reveal>
              <span className={s.numSoft} style={{ background: "#8a8b8f" }}>
                {t.idea.before}
              </span>
              <ol className={s.chips}>
                {t.idea.beforeSteps.map((x, i) => (
                  <li
                    key={x}
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    {i > 0 && (
                      <span
                        className={s.arrowSep}
                        style={{ background: "#8a8b8f" }}
                        aria-hidden="true"
                      />
                    )}
                    <span className={s.chip}>{x}</span>
                  </li>
                ))}
              </ol>
            </div>
            <div className={s.card} data-reveal style={d(100)}>
              <span
                className={s.numSoft}
                style={{ background: "var(--luna-red)" }}
              >
                {t.idea.now}
              </span>
              <ol className={s.chips}>
                {t.idea.nowSteps.map((x, i) => (
                  <li
                    key={x}
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    {i > 0 && (
                      <span className={s.arrowSep} aria-hidden="true" />
                    )}
                    <span className={s.chip}>{x}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
          <div className={s.grid4}>
            {t.idea.pairs.map(([a, b], i) => (
              <div key={a + b} className={s.card} data-reveal style={d(i * 70)}>
                <p className={s.h3} style={{ marginTop: 0 }}>
                  {a} <span className={s.titleRed}>+</span> {b}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* principles */}
      <section
        className={s.dark}
        data-tone="dark"
        aria-labelledby="co-principles"
      >
        <div className="frame">
          <Tag dark>{t.principles.tag}</Tag>
          <h2 id="co-principles" className={`${s.h2} ${s.h2Dark}`} data-reveal>
            {t.principles.title}
          </h2>
          <div className={s.values}>
            {t.principles.items.map((v, i) => (
              <div key={i} className={s.value} data-reveal style={d(i * 80)}>
                <span className={s.check} aria-hidden="true" />
                <h3 className={s.valueTitle}>{v.title}</h3>
                <p className={s.valueText}>{v.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* physical + digital */}
      <section className={s.light} data-tone="light" aria-labelledby="co-pd">
        <div className="frame">
          <Tag>{t.pd.tag}</Tag>
          <h2 id="co-pd" className={s.h2} data-reveal>
            {t.pd.title1} <span className={s.titleRed}>{t.pd.title2}</span>
          </h2>
          <p className={s.body} data-reveal>
            {t.pd.lead}
          </p>
          <div className={s.grid2}>
            <div className={s.card} data-reveal>
              <h3 className={s.h3} style={{ marginTop: 0 }}>
                {t.pd.physical.name}
              </h3>
              <ul className={s.chips}>
                {t.pd.physical.items.map((x) => (
                  <li key={x} className={s.chip}>
                    {x}
                  </li>
                ))}
              </ul>
            </div>
            <div
              className={s.cardDark}
              style={{ background: "#141518" }}
              data-reveal
            >
              <h3 className={s.h3} style={{ marginTop: 0 }}>
                {t.pd.digital.name}
              </h3>
              <ul className={s.chips}>
                {t.pd.digital.items.map((x) => (
                  <li key={x} className={s.chipDark}>
                    {x}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <p className={s.note} data-reveal>
            {t.pd.note}
          </p>
        </div>
      </section>

      {/* Cologne */}
      <section
        className={`${s.light} ${s.alt}`}
        data-tone="light"
        aria-labelledby="co-base"
      >
        <div className={`frame ${s.split}`}>
          <div>
            <Tag>{t.base.tag}</Tag>
            <h2 id="co-base" className={s.h2} data-reveal>
              {t.base.title1}{" "}
              <span className={s.titleRed}>{t.base.title2}</span>
            </h2>
            <p className={s.body} data-reveal>
              {t.base.body}
            </p>
          </div>
          <div className={s.heroSide}>
            {t.base.rings.map((r, i) => (
              <div
                key={r.name}
                className={s.card}
                data-reveal
                style={{
                  ...d(i * 90),
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                }}
              >
                {i === 0 ? (
                  <FlagDE className={s.flag} />
                ) : i === 1 ? (
                  <FlagEU className={s.flag} />
                ) : (
                  <span className={s.num}>{num(i)}</span>
                )}
                <div>
                  <h3 className={s.h3} style={{ marginTop: 0 }}>
                    {r.name}
                  </h3>
                  <p className={s.text} style={{ marginTop: 2 }}>
                    {r.note}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* standards */}
      <section
        className={s.light}
        data-tone="light"
        aria-labelledby="co-standards"
      >
        <div className={`frame ${s.split} ${s.splitTop}`}>
          <div>
            <Tag>{t.standards.tag}</Tag>
            <h2 id="co-standards" className={s.h2} data-reveal>
              {t.standards.title1}{" "}
              <span className={s.titleRed}>{t.standards.title2}</span>
            </h2>
            <p className={s.body} data-reveal>
              {t.standards.body}
            </p>
          </div>
          <div className={s.card} data-reveal style={d(100)}>
            <span className={s.numSoft}>{t.standards.doc}</span>
            <ol className={s.rows} style={{ marginTop: 12 }}>
              {t.standards.rows.map((r, i) => (
                <li key={r.name}>
                  <span className={s.num}>{num(i)}</span>
                  <div>
                    <strong>{r.name}</strong>
                    <p className={s.text} style={{ marginTop: 4 }}>
                      {r.line}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* own brand */}
      <section
        className={s.emerald}
        data-tone="dark"
        aria-labelledby="co-brand"
      >
        <div className={`frame ${s.split}`}>
          <div>
            <p className={`t-label ${s.tag} ${s.gold}`} data-reveal>
              <span className={s.tagRule} /> {t.brand.tag}
            </p>
            <h2 id="co-brand" className={`${s.h2} ${s.h2Dark}`} data-reveal>
              {t.brand.title}
            </h2>
            <p className={s.chips} data-reveal>
              <span className={s.chipDark}>{t.brand.chain[0]}</span>
              <span
                className={s.arrowSep}
                style={{ background: "#c9ccd2" }}
                aria-hidden="true"
              />
              <span className={s.chipDark}>{t.brand.chain[1]}</span>
            </p>
            <p className={s.bodyDark} data-reveal>
              {t.brand.body}
            </p>
            <div className={s.actions} data-reveal>
              <a href={href("/brands")} className={s.btnGold}>
                {t.brand.link}
                <span className={s.badge} aria-hidden="true" />
              </a>
            </div>
          </div>
          <figure className={s.media} data-reveal style={d(120)}>
            <img
              src="/brand/luviscent/diffuser-lamp.webp"
              alt="LUVISCENT"
              width={1185}
              height={1171}
              loading="lazy"
              style={{ maxHeight: 400 }}
            />
          </figure>
        </div>
      </section>

      <Story id="co-story" />

      {/* facts + bridges */}
      <section className={s.dark} data-tone="dark" aria-labelledby="co-facts">
        <div className={`frame ${s.split} ${s.splitTop}`}>
          <div className={s.glass} data-reveal>
            <Tag dark>{t.facts.tag}</Tag>
            <table className={s.table} id="co-facts">
              <tbody>
                {t.facts.rows.map((r) => (
                  <tr key={r.k}>
                    <th scope="row">{r.k}</th>
                    <td dir={/\d/.test(r.v) ? "ltr" : undefined}>{r.v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <a href={href("/impressum")} className={s.link}>
              {t.facts.legal}
            </a>
          </div>
          <div className={s.heroSide}>
            <p className={`t-label ${s.tagDark}`} data-reveal>
              {t.bridges.tag}
            </p>
            <a href={href("/what-we-do")} className={s.cardDark} data-reveal>
              <span className={`t-label ${s.tagDark}`}>
                {t.bridges.what.kicker}
              </span>
              <h3 className={s.h3}>{t.bridges.what.label}</h3>
            </a>
            <a
              href={href("/brands")}
              className={s.cardDark}
              data-reveal
              style={d(90)}
            >
              <span className={`t-label ${s.tagDark}`}>
                {t.bridges.build.kicker}
              </span>
              <h3 className={s.h3}>{t.bridges.build.label}</h3>
            </a>
          </div>
        </div>
      </section>

      {/* direction */}
      <section
        className={`${s.light} ${s.alt}`}
        data-tone="light"
        aria-labelledby="co-direction"
      >
        <div className="frame">
          <Tag>{t.direction.tag}</Tag>
          <h2 id="co-direction" className={s.h2} data-reveal>
            {t.direction.title1}{" "}
            <span className={s.titleRed}>{t.direction.title2}</span>
          </h2>
          <p className={s.body} data-reveal>
            {t.direction.body}
          </p>
          <div className={s.grid3}>
            {t.direction.lines.map((l, i) => (
              <div key={l} className={s.card} data-reveal style={d(i * 80)}>
                <span className={s.num}>+</span>
                <h3 className={s.h3}>{l}</h3>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Cta
        id="co-cta"
        title={`${t.cta.h1} ${t.cta.h2}`}
        text={t.cta.lead}
        button={t.cta.button}
        href={href("/contact")}
        more={{ label: t.cta.more, href: href("/what-we-do") }}
      />
    </article>
  );
}
