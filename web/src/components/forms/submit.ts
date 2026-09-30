"use client";

import { useState } from "react";

export type SubmitState =
  | { status: "idle" }
  | { status: "sending" }
  | { status: "success"; reference: string }
  | { status: "error"; code: string; message: string };

type ApiResponse = { ok: true; reference: string } | { ok: false; code: string; error: string };

/** Sends fields + files as multipart/form-data and tracks the result. */
export function useSubmit(endpoint: string) {
  const [state, setState] = useState<SubmitState>({ status: "idle" });

  const submit = async (values: Record<string, unknown>, files: File[] = [], extra: Record<string, string> = {}) => {
    setState({ status: "sending" });
    const body = new FormData();
    for (const [k, v] of Object.entries({ ...values, ...extra })) {
      if (v === undefined || v === null) continue;
      if (Array.isArray(v)) v.forEach((x) => body.append(k, String(x)));
      else body.append(k, String(v));
    }
    files.forEach((f) => body.append("files", f));
    try {
      const res = await fetch(endpoint, { method: "POST", body });
      const data = (await res.json()) as ApiResponse;
      if (data.ok) setState({ status: "success", reference: data.reference });
      else setState({ status: "error", code: data.code, message: data.error });
    } catch {
      setState({ status: "error", code: "network", message: "Keine Verbindung. Bitte prüfen Sie Ihre Internetverbindung und versuchen Sie es erneut." });
    }
  };

  return { state, submit, reset: () => setState({ status: "idle" }) };
}
