"use client";

import type { ReactNode } from "react";
import { Slashes } from "@/components/brand/Slashes";
import type { SubmitState } from "./submit";

/** Error banner shown above the submit button. */
export function FormError({ state, fallback }: { state: SubmitState; fallback?: ReactNode }) {
  if (state.status !== "error") return null;
  return (
    <div role="alert" className="border-l-2 border-red-ink bg-white p-4 text-sm leading-relaxed text-ink">
      <p className="font-semibold">{state.message}</p>
      {state.code === "not_configured" && fallback && <div className="mt-2 text-graphite-700">{fallback}</div>}
    </div>
  );
}

/** Confirmation panel after a successful submission. */
export function FormSuccess({ title, reference, children }: { title: string; reference: string; children?: ReactNode }) {
  return (
    <div role="status" className="bg-ink p-8 text-white sm:p-10" tabIndex={-1} ref={(el) => el?.focus()}>
      <Slashes className="h-6 w-auto text-red" />
      <h3 className="mt-6 text-3xl font-extrabold uppercase tracking-[-0.03em]">{title}</h3>
      <p className="mt-3 font-mono text-xs uppercase tracking-[0.14em] text-steel-400">Referenz {reference}</p>
      {children && <div className="mt-6 max-w-xl leading-relaxed text-steel-300">{children}</div>}
    </div>
  );
}
