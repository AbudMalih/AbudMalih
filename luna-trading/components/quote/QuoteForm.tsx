"use client";

import { useRef, useState, type FormEvent } from "react";
import { CONTACT_EMAIL } from "@/content/site";
import type { QuoteCopy } from "@/content/quotePage";
import {
  MODES,
  CONTAINERS,
  INCOTERMS,
  SERVICES,
  normaliseQuote,
  validateQuote,
  type Quote,
  type QuoteErrors,
  type Service,
} from "@/lib/quote/schema";
import { FlagCN, FlagDE } from "@/components/import/Flags";
import s from "./Quote.module.css";

type Status = "idle" | "sending" | "ok" | "fail" | "rate";

const EMPTY: Quote = {
  mode: "sea_fcl",
  container: "c40hc",
  incoterm: "unknown",
  origin: "",
  destination: "",
  ready: "",
  goods: "",
  packages: "",
  weight: "",
  volume: "",
  dangerous: false,
  services: ["customs"],
  name: "",
  company: "",
  email: "",
  phone: "",
  note: "",
};

const ICON: Record<Quote["mode"], string> = {
  sea_fcl: "M3 15h18l-2 4H5z M6 15V9h4v6 M11 15V7h4v8 M16 15v-5h3v5",
  sea_lcl: "M3 15h18l-2 4H5z M6 15v-4h3v4 M10 15v-6h3v6 M14 15v-3h3v3",
  rail: "M5 5h14v9H5z M5 10h14 M8 17l-2 3 M16 17l2 3 M8 14v.01 M16 14v.01",
  air: "M3 13l7-1 4-6h2l-2 6 6-1c1 0 1 2 0 2l-6 1 2 6h-2l-4-6-7-1z",
  advice:
    "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M12 16v.01 M10 9a2 2 0 1 1 3 1.7c-.7.4-1 .9-1 1.8",
};

export default function QuoteForm({
  t,
  locale,
  privacyHref,
}: {
  t: QuoteCopy["form"];
  locale: string;
  privacyHref: string;
}) {
  const [q, setQ] = useState<Quote>(EMPTY);
  const [errors, setErrors] = useState<QuoteErrors>({});
  const [status, setStatus] = useState<Status>("idle");
  const started = useRef(Date.now());
  const fax = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const set = <K extends keyof Quote>(k: K, v: Quote[K]) => {
    setQ((p) => ({ ...p, [k]: v }));
    // a corrected field stops showing its error
    setErrors((e) => {
      if (!e[k]) return e;
      const n = { ...e };
      delete n[k];
      return n;
    });
  };
  const toggle = (sv: Service) =>
    set(
      "services",
      q.services.includes(sv)
        ? q.services.filter((x) => x !== sv)
        : [...q.services, sv],
    );
  const err = (k: keyof Quote) =>
    errors[k] ? <span className={s.err}>{t.errors[errors[k]!]}</span> : null;

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    const norm = normaliseQuote(q as unknown as Record<string, unknown>);
    const e = validateQuote(norm);
    setErrors(e);
    if (Object.keys(e).length) {
      const first = formRef.current?.querySelector<HTMLElement>(
        `[name="${Object.keys(e)[0]}"]`,
      );
      first?.focus();
      return;
    }
    setStatus("sending");
    try {
      const res = await fetch("/api/quote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...norm,
          locale,
          fax: fax.current?.value ?? "",
          elapsed: Date.now() - started.current,
        }),
      });
      if (res.status === 200 || res.status === 202) setStatus("ok");
      else if (res.status === 429) setStatus("rate");
      else if (res.status === 422) {
        const data = await res.json().catch(() => ({}));
        setErrors(data.fields ?? {});
        setStatus("idle");
      } else setStatus("fail");
    } catch {
      setStatus("fail");
    }
  }

  // fallback while server delivery is unavailable: the visitor's own mail app,
  // addressed to the company inbox, with the complete request prefilled
  const mailto = () => {
    const n = normaliseQuote(q as unknown as Record<string, unknown>);
    const lines = [
      `${t.mode}: ${t.modes[n.mode].name}${n.mode === "sea_fcl" ? ` (${t.containers[n.container]})` : ""}`,
      `${t.origin}: ${n.origin}`,
      `${t.destination}: ${n.destination}`,
      `${t.incoterm}: ${t.incoterms[n.incoterm]}`,
      n.ready && `${t.ready}: ${n.ready}`,
      `${t.goods}: ${n.goods}`,
      n.packages && `${t.packages}: ${n.packages}`,
      n.weight && `${t.weight}: ${n.weight}`,
      n.volume && `${t.volume}: ${n.volume}`,
      n.dangerous && t.dangerous,
      n.services.length &&
        `${t.services}: ${n.services.map((x) => t.serviceNames[x]).join(", ")}`,
      " ",
      `${t.name}: ${n.name}`,
      n.company && `${t.company}: ${n.company}`,
      `${t.email}: ${n.email}`,
      n.phone && `${t.phone}: ${n.phone}`,
      n.note && `\n${n.note}`,
    ].filter(Boolean);
    const subject = `${t.modes[n.mode].name} · ${n.origin} → ${n.destination}`;
    return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join("\n"))}`;
  };

  if (status === "ok") {
    return (
      <div className={s.done} role="status">
        <span className={s.donePlus} aria-hidden="true" />
        <h3>{t.okTitle}</h3>
        <p>{t.okText}</p>
        <button
          type="button"
          className={s.ghost}
          onClick={() => (
            setQ(EMPTY),
            setStatus("idle"),
            (started.current = Date.now())
          )}
        >
          {t.again}
        </button>
      </div>
    );
  }

  const showSummary =
    q.origin || q.destination || q.goods || q.weight || q.volume;

  return (
    <div className={s.layout}>
      <form ref={formRef} className={s.form} onSubmit={submit} noValidate>
        {/* honeypot */}
        <div className={s.hp} aria-hidden="true">
          <label>
            Fax <input ref={fax} name="fax" tabIndex={-1} autoComplete="off" />
          </label>
        </div>

        {/* 01 shipment */}
        <fieldset className={s.group}>
          <legend className={s.legend}>
            <span className={s.step}>01</span>
            {t.s1}
          </legend>
          <p className={s.label}>{t.mode}</p>
          <div className={s.modes} role="radiogroup" aria-label={t.mode}>
            {MODES.map((m) => (
              <label
                key={m}
                className={`${s.mode} ${q.mode === m ? s.on : ""}`}
              >
                <input
                  type="radio"
                  name="mode"
                  value={m}
                  checked={q.mode === m}
                  onChange={() => set("mode", m)}
                />
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d={ICON[m]} />
                </svg>
                <span className={s.modeName}>{t.modes[m].name}</span>
                <span className={s.modeHint}>{t.modes[m].hint}</span>
              </label>
            ))}
          </div>
          {q.mode === "sea_fcl" && (
            <>
              <p className={s.label}>{t.container}</p>
              <div
                className={s.pills}
                role="radiogroup"
                aria-label={t.container}
              >
                {CONTAINERS.map((c) => (
                  <label
                    key={c}
                    className={`${s.pill} ${q.container === c ? s.on : ""}`}
                  >
                    <input
                      type="radio"
                      name="container"
                      value={c}
                      checked={q.container === c}
                      onChange={() => set("container", c)}
                    />
                    <span dir="ltr">{t.containers[c]}</span>
                  </label>
                ))}
              </div>
            </>
          )}
          <div className={s.row2}>
            <label className={s.field}>
              <span className={s.label}>
                <FlagCN className={s.miniFlag} /> {t.origin}
              </span>
              <input
                name="origin"
                value={q.origin}
                onChange={(e) => set("origin", e.target.value)}
                placeholder={t.originPh}
                aria-invalid={!!errors.origin}
                autoComplete="off"
              />
              {err("origin")}
            </label>
            <label className={s.field}>
              <span className={s.label}>
                <FlagDE className={s.miniFlag} /> {t.destination}
              </span>
              <input
                name="destination"
                value={q.destination}
                onChange={(e) => set("destination", e.target.value)}
                placeholder={t.destinationPh}
                aria-invalid={!!errors.destination}
                autoComplete="postal-code"
              />
              {err("destination")}
            </label>
          </div>
          <div className={s.row2}>
            <label className={s.field}>
              <span className={s.label}>{t.incoterm}</span>
              <select
                name="incoterm"
                value={q.incoterm}
                onChange={(e) =>
                  set("incoterm", e.target.value as Quote["incoterm"])
                }
              >
                {INCOTERMS.map((i) => (
                  <option key={i} value={i}>
                    {t.incoterms[i]}
                  </option>
                ))}
              </select>
            </label>
            <label className={s.field}>
              <span className={s.label}>
                {t.ready} <small>{t.optional}</small>
              </span>
              <input
                type="month"
                name="ready"
                value={q.ready}
                onChange={(e) => set("ready", e.target.value)}
              />
            </label>
          </div>
        </fieldset>

        {/* 02 goods */}
        <fieldset className={s.group}>
          <legend className={s.legend}>
            <span className={s.step}>02</span>
            {t.s2}
          </legend>
          <label className={s.field}>
            <span className={s.label}>{t.goods}</span>
            <input
              name="goods"
              value={q.goods}
              onChange={(e) => set("goods", e.target.value)}
              placeholder={t.goodsPh}
              aria-invalid={!!errors.goods}
            />
            {err("goods")}
          </label>
          <div className={s.row3}>
            {(["packages", "weight", "volume"] as const).map((k) => (
              <label key={k} className={s.field}>
                <span className={s.label}>
                  {t[k]} <small>{t.optional}</small>
                </span>
                <input
                  name={k}
                  inputMode="decimal"
                  value={q[k]}
                  onChange={(e) => set(k, e.target.value)}
                  aria-invalid={!!errors[k]}
                  dir="ltr"
                />
                {err(k)}
              </label>
            ))}
          </div>
          <label className={s.check}>
            <input
              type="checkbox"
              checked={q.dangerous}
              onChange={(e) => set("dangerous", e.target.checked)}
            />
            <span>{t.dangerous}</span>
          </label>
          <p className={s.label}>{t.services}</p>
          <div className={s.pills}>
            {SERVICES.map((sv) => (
              <label
                key={sv}
                className={`${s.pill} ${q.services.includes(sv) ? s.on : ""}`}
              >
                <input
                  type="checkbox"
                  checked={q.services.includes(sv)}
                  onChange={() => toggle(sv)}
                />
                <span>{t.serviceNames[sv]}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {/* 03 contact */}
        <fieldset className={s.group}>
          <legend className={s.legend}>
            <span className={s.step}>03</span>
            {t.s3}
          </legend>
          <div className={s.row2}>
            <label className={s.field}>
              <span className={s.label}>{t.name}</span>
              <input
                name="name"
                value={q.name}
                onChange={(e) => set("name", e.target.value)}
                autoComplete="name"
                aria-invalid={!!errors.name}
              />
              {err("name")}
            </label>
            <label className={s.field}>
              <span className={s.label}>
                {t.company} <small>{t.optional}</small>
              </span>
              <input
                name="company"
                value={q.company}
                onChange={(e) => set("company", e.target.value)}
                autoComplete="organization"
              />
            </label>
          </div>
          <div className={s.row2}>
            <label className={s.field}>
              <span className={s.label}>{t.email}</span>
              <input
                name="email"
                type="email"
                value={q.email}
                onChange={(e) => set("email", e.target.value)}
                autoComplete="email"
                aria-invalid={!!errors.email}
                dir="ltr"
              />
              {err("email")}
            </label>
            <label className={s.field}>
              <span className={s.label}>
                {t.phone} <small>{t.optional}</small>
              </span>
              <input
                name="phone"
                type="tel"
                value={q.phone}
                onChange={(e) => set("phone", e.target.value)}
                autoComplete="tel"
                aria-invalid={!!errors.phone}
                dir="ltr"
              />
              {err("phone")}
            </label>
          </div>
          <label className={s.field}>
            <span className={s.label}>
              {t.note} <small>{t.optional}</small>
            </span>
            <textarea
              name="note"
              rows={3}
              value={q.note}
              onChange={(e) => set("note", e.target.value)}
              placeholder={t.notePh}
            />
          </label>
        </fieldset>

        {Object.keys(errors).length > 0 && (
          <p className={s.summaryErr} role="alert">
            {t.errors.summary}
          </p>
        )}
        {(status === "fail" || status === "rate") && (
          <p className={s.summaryErr} role="alert">
            {status === "rate" ? (
              t.rate
            ) : (
              <>
                {t.failTitle} {t.mailHint}
                <a href={mailto()} className={s.mailBtn}>
                  {t.mailSend}
                  <span dir="ltr">{CONTACT_EMAIL}</span>
                </a>
              </>
            )}
          </p>
        )}
        <div className={s.submitRow}>
          <p className={s.privacy}>
            {t.privacy} <a href={privacyHref}>{t.privacyLink}</a>
          </p>
          <button
            type="submit"
            className={s.submit}
            disabled={status === "sending"}
          >
            {status === "sending" ? t.sending : t.submit}
            <span
              className={`${s.badge} ${status === "sending" ? s.spin : ""}`}
              aria-hidden="true"
            />
          </button>
        </div>
      </form>

      {/* live summary */}
      <aside className={s.summary} aria-live="polite">
        <p className={s.sumTag}>{t.summary}</p>
        <div className={s.sumRoute}>
          <span>
            <FlagCN className={s.miniFlag} />
            {q.origin || (locale === "ar" ? "الصين" : "China")}
          </span>
          <i aria-hidden="true" />
          <span>
            <FlagDE className={s.miniFlag} />
            {q.destination ||
              (locale === "de"
                ? "Deutschland"
                : locale === "en"
                  ? "Germany"
                  : "ألمانيا")}
          </span>
        </div>
        <dl className={s.sumList}>
          <div>
            <dt>{t.mode}</dt>
            <dd>
              {t.modes[q.mode].name}
              {q.mode === "sea_fcl" && q.container !== "unsure"
                ? ` · ${t.containers[q.container]}`
                : ""}
            </dd>
          </div>
          <div>
            <dt>{t.incoterm}</dt>
            <dd>{t.incoterms[q.incoterm]}</dd>
          </div>
          {showSummary ? (
            <>
              {q.goods && (
                <div>
                  <dt>{t.goods}</dt>
                  <dd>{q.goods}</dd>
                </div>
              )}
              {(q.weight || q.volume || q.packages) && (
                <div>
                  <dt>{t.s2}</dt>
                  <dd dir="ltr">
                    {[
                      q.packages && `${q.packages} ×`,
                      q.weight && `${q.weight} kg`,
                      q.volume && `${q.volume} m³`,
                    ]
                      .filter(Boolean)
                      .join("  ·  ")}
                  </dd>
                </div>
              )}
            </>
          ) : (
            <div>
              <dt>&nbsp;</dt>
              <dd className={s.muted}>{t.summaryEmpty}</dd>
            </div>
          )}
          <div>
            <dt>{t.services}</dt>
            <dd>
              {q.services.length
                ? q.services.map((x) => t.serviceNames[x]).join(", ")
                : "–"}
            </dd>
          </div>
          {q.dangerous && (
            <div>
              <dt>!</dt>
              <dd>{t.dangerous}</dd>
            </div>
          )}
        </dl>
      </aside>
    </div>
  );
}
