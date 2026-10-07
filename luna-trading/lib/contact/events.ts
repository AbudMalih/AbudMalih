/**
 * Form lifecycle events, prepared for analytics at launch. Nothing is
 * tracked or sent: the event is only dispatched on window as
 * "luna:form" so a consent-aware integration can subscribe later.
 */
export type FormEvent = "form_start" | "form_submit" | "form_success" | "form_error";

export function emitFormEvent(name: FormEvent, detail: Record<string, string> = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("luna:form", { detail: { name, ...detail } }));
}
