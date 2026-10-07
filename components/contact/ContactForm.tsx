"use client";

import Link from "next/link";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent as ReactFormEvent,
} from "react";
import type { ContactCopy } from "@/content/i18n/contact/types";
import { CONTACT_EMAIL } from "@/content/site";
import {
  INQUIRY_TYPES,
  normalise,
  validate,
  type Errors,
  type Inquiry,
  type InquiryType,
} from "@/lib/contact/schema";
import { emitFormEvent } from "@/lib/contact/events";
import svc from "@/components/services/Services.module.css";
import s from "./Contact.module.css";

type Status = "idle" | "sending" | "success" | "failure" | "rate";

const EMPTY: Inquiry = {
  name: "",
  company: "",
  email: "",
  type: "general",
  message: "",
};

/**
 * The structured inquiry. Native inputs and radios, real labels, errors next
 * to their field (aria-invalid + aria-describedby), nothing erased on error.
 * Success is shown ONLY when the server confirms delivery (HTTP 200); any
 * other answer keeps the entries and offers the direct e-mail address.
 */
export default function ContactForm({
  copy,
  locale,
  privacyHref,
}: {
  copy: ContactCopy;
  locale: string;
  privacyHref: string;
}) {
  const uid = useId();
  const id = (k: string) => `${uid}-${k}`;
  const [v, setV] = useState<Inquiry>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<Status>("idle");
  const started = useRef(false);
  const shownAt = useRef(0);
  const formRef = useRef<HTMLFormElement>(null);
  const successRef = useRef<HTMLDivElement>(null);
  const summaryRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    shownAt.current = Date.now();
  }, []);
  useEffect(() => {
    if (status === "success") successRef.current?.focus();
  }, [status]);

  const set = (k: keyof Inquiry, value: string) => {
    if (!started.current) {
      started.current = true;
      emitFormEvent("form_start");
    }
    setV((p) => ({ ...p, [k]: value }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const message = (k: keyof Inquiry): string | null => {
    const e = errors[k];
    if (!e) return null;
    if (e === "required")
      return k === "name"
        ? copy.errors.nameRequired
        : k === "email"
          ? copy.errors.emailRequired
          : k === "message"
            ? copy.errors.messageRequired
            : copy.errors.required;
    return copy.errors[e];
  };

  async function submit(ev: ReactFormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (status === "sending") return;
    const data = normalise(v);
    const found = validate(data);
    setErrors(found);
    const first = (["name", "email", "message", "company"] as const).find(
      (k) => found[k],
    );
    if (first) {
      emitFormEvent("form_error", { reason: "validation" });
      requestAnimationFrame(() => document.getElementById(id(first))?.focus());
      return;
    }
    emitFormEvent("form_submit", { type: data.type });
    setStatus("sending");
    const fax =
      (formRef.current?.elements.namedItem("fax") as HTMLInputElement | null)
        ?.value ?? "";
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          locale,
          fax,
          elapsed: Date.now() - shownAt.current,
        }),
      });
      if (res.status === 200) {
        setStatus("success");
        emitFormEvent("form_success", { type: data.type });
        return;
      }
      if (res.status === 422) {
        const j = (await res.json().catch(() => ({}))) as { fields?: Errors };
        setErrors(j.fields ?? {});
        setStatus("idle");
        emitFormEvent("form_error", { reason: "invalid" });
        return;
      }
      setStatus(res.status === 429 ? "rate" : "failure");
      emitFormEvent("form_error", { reason: String(res.status) });
    } catch {
      setStatus("failure");
      emitFormEvent("form_error", { reason: "network" });
    }
  }

  if (status === "success") {
    return (
      <div
        ref={successRef}
        className={s.success}
        tabIndex={-1}
        role="status"
        aria-live="polite"
      >
        <span className={s.successLine} aria-hidden="true" />
        <span className={s.successPlus} aria-hidden="true" />
        <p className={`t-label ${s.successTag}`}>{copy.success.tag}</p>
        <p className={s.successTitle}>
          {copy.success.h1}
          <br />
          <span className={s.dim}>{copy.success.h2}</span>
        </p>
        <p className={s.successText}>{copy.success.text}</p>
        <button
          type="button"
          className={s.textButton}
          onClick={() => {
            setV(EMPTY);
            setErrors({});
            setStatus("idle");
            started.current = false;
            shownAt.current = Date.now();
          }}
        >
          {copy.success.again} <span aria-hidden="true">+</span>
        </button>
      </div>
    );
  }

  const hasErrors = Object.values(errors).some(Boolean);
  const field = (
    k: "name" | "company" | "email",
    type: string,
    auto: string,
    required: boolean,
  ) => {
    const err = message(k);
    return (
      <div className={`${s.field} ${err ? s.fieldError : ""}`}>
        <label htmlFor={id(k)} className={s.label}>
          {copy.fields[k]}
          {required ? (
            <span className={s.req}>
              <span aria-hidden="true">*</span>
              <span className="sr-only"> ({copy.fields.required})</span>
            </span>
          ) : (
            <span className={s.opt}>{copy.fields.optional}</span>
          )}
        </label>
        <input
          id={id(k)}
          name={k}
          type={type}
          autoComplete={auto}
          dir={k === "email" ? "ltr" : undefined}
          inputMode={k === "email" ? "email" : undefined}
          value={v[k]}
          onChange={(e) => set(k, e.target.value)}
          required={required}
          aria-required={required || undefined}
          aria-invalid={err ? true : undefined}
          aria-describedby={err ? id(`${k}-err`) : undefined}
          className={s.input}
        />
        <span className={s.rule} aria-hidden="true" />
        {err && (
          <p id={id(`${k}-err`)} className={s.error}>
            <span className={s.errorMark} aria-hidden="true" />
            {err}
          </p>
        )}
      </div>
    );
  };

  const msgErr = message("message");

  return (
    <form
      ref={formRef}
      className={s.form}
      onSubmit={submit}
      noValidate
      aria-describedby={hasErrors ? id("summary") : undefined}
    >
      <div className={s.formLead}>
        <h2 className={s.inquiryTitle}>{copy.inquiry.title}</h2>

        {/* inquiry type: context, not qualification */}
        <fieldset className={s.types}>
          <legend className="sr-only">{copy.inquiry.typeLegend}</legend>
          {INQUIRY_TYPES.map((tp: InquiryType) => (
            <label
              key={tp}
              className={`${s.type} ${v.type === tp ? s.typeOn : ""}`}
            >
              <input
                type="radio"
                name="type"
                value={tp}
                checked={v.type === tp}
                onChange={() => set("type", tp)}
                className={s.typeInput}
              />
              <span className={s.typePlus} aria-hidden="true" />
              <span className={s.typeName}>{copy.inquiry.types[tp]}</span>
            </label>
          ))}
        </fieldset>
      </div>

      <div className={s.formBody}>
        <div className={s.fields}>
          <div className={s.pair}>
            {field("name", "text", "name", true)}
            {field("company", "text", "organization", false)}
          </div>
          {field("email", "email", "email", true)}

          <div
            className={`${s.field} ${s.fieldMessage} ${msgErr ? s.fieldError : ""}`}
          >
            <label htmlFor={id("message")} className={s.label}>
              {copy.fields.message}
              <span className={s.req}>
                <span aria-hidden="true">*</span>
                <span className="sr-only"> ({copy.fields.required})</span>
              </span>
            </label>
            <textarea
              id={id("message")}
              name="message"
              rows={3}
              value={v.message}
              onChange={(e) => set("message", e.target.value)}
              required
              aria-required
              aria-invalid={msgErr ? true : undefined}
              aria-describedby={msgErr ? id("message-err") : undefined}
              className={`${s.input} ${s.textarea}`}
            />
            <span className={s.rule} aria-hidden="true" />
            {msgErr && (
              <p id={id("message-err")} className={s.error}>
                <span className={s.errorMark} aria-hidden="true" />
                {msgErr}
              </p>
            )}
          </div>

          {/* honeypot: invisible to people and assistive tech, tempting to bots */}
          <div className={s.hp} aria-hidden="true">
            <label htmlFor={id("fax")}>Fax</label>
            <input
              id={id("fax")}
              name="fax"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              defaultValue=""
            />
          </div>
        </div>

        <div className={s.submitRow}>
          {hasErrors && (
            <p
              id={id("summary")}
              ref={summaryRef}
              className={s.summary}
              role="alert"
            >
              <span className={s.errorMark} aria-hidden="true" />
              {copy.errors.summary}
            </p>
          )}
          {(status === "failure" || status === "rate") && (
            <div className={s.failure} role="alert">
              <p className={s.failureTitle}>
                {status === "rate" ? copy.failure.rate : copy.failure.title}
              </p>
              {status === "failure" && (
                <p className={s.failureText}>
                  {copy.failure.text}{" "}
                  <a
                    href={`mailto:${CONTACT_EMAIL}`}
                    dir="ltr"
                    className={s.inlineMail}
                  >
                    {CONTACT_EMAIL}
                  </a>
                </p>
              )}
            </div>
          )}
          <p className={s.privacy}>
            {copy.privacy.text}{" "}
            <Link href={privacyHref} className={s.privacyLink}>
              {copy.privacy.link}
            </Link>
          </p>
          <button
            type="submit"
            className={`${svc.ctaButton} ${s.submit}`}
            disabled={status === "sending"}
            aria-busy={status === "sending" || undefined}
            data-cursor="invert"
          >
            <span className={svc.ctaLabel}>
              {status === "sending"
                ? copy.submit.sending
                : status === "failure"
                  ? copy.failure.retry
                  : copy.submit.idle}
            </span>
            <span
              className={`${svc.ctaPlus} ${status === "sending" ? s.plusBusy : ""}`}
              aria-hidden="true"
            />
          </button>
        </div>
      </div>
    </form>
  );
}
