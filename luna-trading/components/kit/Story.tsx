"use client";

import { useI18n } from "@/content/i18n/I18nProvider";
import { STORY } from "@/content/story";
import { Photo } from "./Ambient";
import { Tag, d } from "./Kit";
import s from "./Kit.module.css";
import a from "./Ambient.module.css";

/** "So arbeiten wir": people and hands at work, a short story, three steps. */
export default function Story({ id = "story" }: { id?: string }) {
  const { locale } = useI18n();
  const t = STORY[locale];
  return (
    <section className={s.dark} data-tone="dark" aria-labelledby={id}>
      <div className="frame">
        <div className={a.storyHead}>
          <div>
            <Tag dark>{t.tag}</Tag>
            <h2 id={id} className={`${s.h2} ${s.h2Dark}`} data-reveal>
              {t.title1} <span style={{ color: "#8d8e93" }}>{t.title2}</span>
            </h2>
            <p className={s.bodyDark} data-reveal>
              {t.lead}
            </p>
          </div>
          <blockquote className={a.quote} data-reveal style={d(120)}>
            <p>{t.quote}</p>
            <footer>{t.quoteBy}</footer>
          </blockquote>
        </div>
        <ol className={a.storyGrid}>
          {t.steps.map((st, i) => (
            <li
              key={st.img}
              className={a.storyItem}
              data-reveal
              style={d(i * 90)}
            >
              <Photo
                src={st.img}
                alt={st.alt}
                note={t.note}
                caption={
                  <span className={a.chip}>{`0${i + 1}  ${st.kicker}`}</span>
                }
              />
              <h3 className={a.storyTitle}>{st.title}</h3>
              <p className={a.storyBody}>{st.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
