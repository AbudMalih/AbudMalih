"use client";

import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import type { FieldError, UseFormRegisterReturn } from "react-hook-form";

/** Shared form primitives – large tap targets, 16px text (no iOS zoom), accessible errors. */

const control =
  "block w-full min-h-[3.25rem] border border-ink/20 bg-white px-4 text-base text-ink placeholder:text-steel-500 transition-colors hover:border-ink/40 focus:border-ink focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-red aria-[invalid=true]:border-red-ink";

type BaseProps = { label: string; hint?: string; error?: FieldError; required?: boolean; className?: string };

export function Field({ label, hint, error, required, className = "", children, id }: BaseProps & { id: string; children: ReactNode }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-2 block text-sm font-semibold text-ink">
        {label}
        {required ? <span className="text-red-ink"> *</span> : <span className="font-normal text-steel-600"> (optional)</span>}
      </label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1.5 text-sm text-steel-600">
          {hint}
        </p>
      )}
      <ErrorText id={`${id}-error`} error={error} />
    </div>
  );
}

export function ErrorText({ id, error }: { id: string; error?: { message?: string } }) {
  if (!error?.message) return null;
  return (
    <p id={id} role="alert" className="mt-1.5 flex items-start gap-2 text-sm font-medium text-red-ink">
      <span aria-hidden="true" className="mt-[0.4em] inline-block h-2 w-3 shrink-0 bg-red-ink [transform:skewX(-28deg)]" />
      {error.message}
    </p>
  );
}

function describedBy(id: string, error?: FieldError, hint?: string) {
  return error ? `${id}-error` : hint ? `${id}-hint` : undefined;
}

export function TextField({
  reg,
  label,
  hint,
  error,
  required,
  className,
  ...rest
}: BaseProps & { reg: UseFormRegisterReturn } & Omit<InputHTMLAttributes<HTMLInputElement>, "name">) {
  const id = useId();
  return (
    <Field id={id} label={label} hint={hint} error={error} required={required} className={className}>
      <input id={id} className={control} aria-invalid={!!error} aria-required={required} aria-describedby={describedBy(id, error, hint)} {...rest} {...reg} />
    </Field>
  );
}

export function TextArea({
  reg,
  label,
  hint,
  error,
  required,
  className,
  ...rest
}: BaseProps & { reg: UseFormRegisterReturn } & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "name">) {
  const id = useId();
  return (
    <Field id={id} label={label} hint={hint} error={error} required={required} className={className}>
      <textarea
        id={id}
        rows={4}
        className={`${control} py-3 leading-relaxed`}
        aria-invalid={!!error}
        aria-required={required}
        aria-describedby={describedBy(id, error, hint)}
        {...rest}
        {...reg}
      />
    </Field>
  );
}

export function SelectField({
  reg,
  label,
  hint,
  error,
  required,
  className,
  options,
  placeholder = "Bitte wählen",
  ...rest
}: BaseProps & { reg: UseFormRegisterReturn; options: { value: string; label: string }[]; placeholder?: string } & Omit<
    SelectHTMLAttributes<HTMLSelectElement>,
    "name"
  >) {
  const id = useId();
  return (
    <Field id={id} label={label} hint={hint} error={error} required={required} className={className}>
      <div className="relative">
        <select
          id={id}
          className={`${control} appearance-none pr-12`}
          aria-invalid={!!error}
          aria-required={required}
          aria-describedby={describedBy(id, error, hint)}
          defaultValue=""
          {...rest}
          {...reg}
        >
          <option value="" disabled>
            {placeholder}
          </option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <svg aria-hidden="true" viewBox="0 0 12 8" className="pointer-events-none absolute right-4 top-1/2 h-2 w-3 -translate-y-1/2 text-ink">
          <path d="M1 1l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      </div>
    </Field>
  );
}

/** Segmented Ja / Nein control built from native radios. */
export function YesNo({ reg, label, error, required = true, className = "" }: BaseProps & { reg: UseFormRegisterReturn }) {
  const id = useId();
  return (
    <fieldset className={className} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined}>
      <legend className="mb-2 text-sm font-semibold text-ink">
        {label}
        {required && <span className="text-red-ink"> *</span>}
      </legend>
      <div className="grid grid-cols-2 gap-2">
        {(["ja", "nein"] as const).map((v) => (
          <label
            key={v}
            className="flex min-h-[3.25rem] cursor-pointer items-center justify-center border border-ink/20 bg-white text-base font-semibold text-ink transition-colors hover:border-ink/40 has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:text-white has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-red"
          >
            <input type="radio" value={v} className="sr-only" {...reg} />
            {v === "ja" ? "Ja" : "Nein"}
          </label>
        ))}
      </div>
      <ErrorText id={`${id}-error`} error={error} />
    </fieldset>
  );
}

export function CheckboxGroup({
  reg,
  label,
  options,
  error,
  required,
  hint,
  columns = 2,
}: BaseProps & { reg: UseFormRegisterReturn; options: readonly string[]; columns?: 2 | 3 | 4 }) {
  const id = useId();
  const cols = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-3", 4: "grid-cols-2 sm:grid-cols-4" }[columns];
  return (
    <fieldset aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}>
      <legend className="mb-2 text-sm font-semibold text-ink">
        {label}
        {required ? <span className="text-red-ink"> *</span> : <span className="font-normal text-steel-600"> (optional)</span>}
      </legend>
      {hint && (
        <p id={`${id}-hint`} className="-mt-1 mb-2 text-sm text-steel-600">
          {hint}
        </p>
      )}
      <div className={`grid gap-2 ${cols}`}>
        {options.map((o) => (
          <label
            key={o}
            className="flex min-h-12 cursor-pointer items-center gap-3 border border-ink/20 bg-white px-4 text-base text-ink transition-colors hover:border-ink/40 has-[:checked]:border-ink has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-red"
          >
            <input type="checkbox" value={o} className="size-5 shrink-0 accent-[#c8060c]" {...reg} />
            {o}
          </label>
        ))}
      </div>
      <ErrorText id={`${id}-error`} error={error} />
    </fieldset>
  );
}

export function Consent({ reg, error, children }: { reg: UseFormRegisterReturn; error?: FieldError; children: ReactNode }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="flex cursor-pointer items-start gap-4 border border-ink/20 bg-white p-4 text-sm leading-relaxed text-graphite-700">
        <input
          id={id}
          type="checkbox"
          className="mt-0.5 size-6 shrink-0 accent-[#c8060c]"
          aria-invalid={!!error}
          aria-required
          aria-describedby={error ? `${id}-error` : undefined}
          {...reg}
        />
        <span>
          {children} <span className="text-red-ink">*</span>
        </span>
      </label>
      <ErrorText id={`${id}-error`} error={error} />
    </div>
  );
}

/** Invisible honeypot field for bots. */
export function Honeypot({ reg }: { reg: UseFormRegisterReturn }) {
  return (
    <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
      <label>
        Website
        <input type="text" tabIndex={-1} autoComplete="off" {...reg} />
      </label>
    </div>
  );
}
