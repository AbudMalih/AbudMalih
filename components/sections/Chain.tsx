"use client";

import Chapter from "@/components/stage/Chapter";
import ChapterTag from "@/components/ui/ChapterTag";
import { CHAIN, COMMERCE_STEP } from "@/content/ecosystem";
import { useI18n } from "@/content/i18n/I18nProvider";
import ChainArt from "./ChainArt";
import s from "./Chain.module.css";

/**
 * 05 · THE OPERATING MODEL (warm ivory brand light, ink type)
 * A still composition, no animation: all six disciplines at once, joined by
 * one red line, each with its technical drawing, number, name and line.
 */
export default function Chain() {
  return (
    <Chapter id="chain">
      <Content />
    </Chapter>
  );
}

function Content() {
  const { dict } = useI18n();
  const t = dict.chain;

  return (
    <div className={s.wrap}>
      <div className={s.head}>
        <ChapterTag index="05" label={t.tag} className={s.tag} />
        <h2 className={`t-headline ${s.title}`}>
          <span>{t.h1}</span> <span className={s.titleDim}>{t.h2}</span>
        </h2>
      </div>

      <ol className={s.grid}>
        {CHAIN.map((id, i) => (
          <li key={id} className={`${s.step} ${i === COMMERCE_STEP ? s.key : ""}`}>
            <span className={s.node} aria-hidden="true" />
            <span className={`t-label t-mono ${s.num}`}>{String(i + 1).padStart(2, "0")}</span>
            <ChainArt id={id} className={s.art} redClass={s.artRed} />
            <h3 className={s.name}>{t.steps[id].label}</h3>
            <p className={s.line}>{t.steps[id].line}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
