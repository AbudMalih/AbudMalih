"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import s from "./Kit.module.css";

export type ShowcaseItem = {
  key: string;
  label: string;
  title: string;
  statement: string;
  body: ReactNode;
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
export default function Showcase({
  items,
  label,
}: {
  items: ShowcaseItem[];
  label: string;
}) {
  const [i, setI] = useState(0);
  const uid = useId();
  // deep links (#ecommerce …) open the matching tab
  useEffect(() => {
    const pick = () => {
      const n = items.findIndex((x) => `#${x.key}` === window.location.hash);
      if (n >= 0) setI(n);
    };
    pick();
    window.addEventListener("hashchange", pick);
    return () => window.removeEventListener("hashchange", pick);
  }, [items]);
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
      {items.map((x) => (
        <span key={x.key} id={x.key} className={s.anchor} aria-hidden="true" />
      ))}
      <div
        className={s.tabs}
        role="tablist"
        aria-label={label}
        onKeyDown={onKey}
      >
        {items.map((x, n) => (
          <button
            key={x.key}
            id={`${uid}-tab-${n}`}
            role="tab"
            type="button"
            aria-selected={n === i}
            aria-controls={`${uid}-panel-${n}`}
            tabIndex={n === i ? 0 : -1}
            className={s.tab}
            onClick={() => setI(n)}
          >
            <span className={s.tabNum}>{String(n + 1).padStart(2, "0")}</span>
            {x.label}
          </button>
        ))}
      </div>
      {/* every panel is in the HTML (crawlable, linkable); only the selected one is shown */}
      {items.map((x, n) => (
        <div
          key={x.key}
          id={`${uid}-panel-${n}`}
          role="tabpanel"
          aria-labelledby={`${uid}-tab-${n}`}
          className={s.panel}
          hidden={n !== i}
        >
          <div className={s.panelText}>
            <span className={s.panelNum} aria-hidden="true">
              {String(n + 1).padStart(2, "0")}
            </span>
            <p className={`t-label ${s.tagDark}`}>{x.title}</p>
            <h3 className={s.panelTitle}>{x.statement}</h3>
            <p className={s.bodyDark}>{x.body}</p>
            <ul className={s.chips}>
              {x.chips.map((c) => (
                <li key={c} className={s.chipDark}>
                  {c}
                </li>
              ))}
            </ul>
            {x.extra}
          </div>
          <div
            className={s.panelMedia}
            style={{ backgroundPosition: x.pos }}
            aria-hidden="true"
          >
            <div className={s.panelArt}>{x.art}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
