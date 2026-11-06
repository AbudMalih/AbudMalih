"use client";

import { useId, useState, type ReactNode } from "react";
import s from "./Kit.module.css";

export type ShowcaseItem = {
  key: string;
  label: string;
  title: string;
  statement: string;
  body: string;
  chips: string[];
  art: ReactNode;
  /** background-position of the port photograph for this item */
  pos: string;
  extra?: ReactNode;
};

/**
 * One large panel, six disciplines: pill tabs switch the content (no
 * autoplay; text never moves while it is read). Each item shows its own
 * crop of the port photograph under its technical drawing.
 */
export default function Showcase({ items, label }: { items: ShowcaseItem[]; label: string }) {
  const [i, setI] = useState(0);
  const uid = useId();
  const it = items[i];
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const rtl = document.documentElement.dir === "rtl";
    const step = (e.key === "ArrowRight") !== rtl ? 1 : -1;
    const n = (i + step + items.length) % items.length;
    setI(n);
    document.getElementById(`${uid}-tab-${n}`)?.focus();
  };
  return (
    <div className={s.show}>
      <div className={s.tabs} role="tablist" aria-label={label} onKeyDown={onKey}>
        {items.map((x, n) => (
          <button
            key={x.key}
            id={`${uid}-tab-${n}`}
            role="tab"
            type="button"
            aria-selected={n === i}
            aria-controls={`${uid}-panel`}
            tabIndex={n === i ? 0 : -1}
            className={s.tab}
            onClick={() => setI(n)}
          >
            <span className={s.tabNum}>{String(n + 1).padStart(2, "0")}</span>
            {x.label}
          </button>
        ))}
      </div>
      <div id={`${uid}-panel`} role="tabpanel" aria-labelledby={`${uid}-tab-${i}`} className={s.panel} key={it.key}>
        <div className={s.panelText}>
          <span className={s.panelNum} aria-hidden="true">
            {String(i + 1).padStart(2, "0")}
          </span>
          <p className={`t-label ${s.tagDark}`}>{it.title}</p>
          <h3 className={s.panelTitle}>{it.statement}</h3>
          <p className={s.bodyDark}>{it.body}</p>
          <ul className={s.chips}>
            {it.chips.map((c) => (
              <li key={c} className={s.chipDark}>
                {c}
              </li>
            ))}
          </ul>
          {it.extra}
        </div>
        <div className={s.panelMedia} style={{ backgroundPosition: it.pos }} aria-hidden="true">
          <div className={s.panelArt}>{it.art}</div>
        </div>
      </div>
    </div>
  );
}
