"use client";

import { useEffect, useRef, useState } from "react";
import { formMessages, type ResultCode } from "@/lib/forms/messages";
import type { Tone } from "@/lib/forms/schemas";

export type SubmitState =
  | { status: "idle" }
  | { status: "sending" }
  | { status: "success"; reference: string }
  | { status: "error"; code: ResultCode; message: string };

type ApiResponse = { ok: true; reference: string } | { ok: false; code: ResultCode; error?: string };

const newId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

/**
 * Sends fields + files as multipart/form-data and tracks the result.
 * - Ignores repeated clicks while a request is running.
 * - Sends a stable submission id so the server can drop duplicates
 *   (e.g. a retry after a lost response) – a new id is created only after success.
 * - Messages are chosen by result code and tone; server details are never shown.
 */
export function useSubmit(endpoint: string, tone: Tone) {
  const [state, setState] = useState<SubmitState>({ status: "idle" });
  const busy = useRef(false);
  const submissionId = useRef("");
  const openedAt = useRef(0);
  useEffect(() => {
    submissionId.current = newId();
    openedAt.current = Date.now();
  }, []);

  const submit = async (values: Record<string, unknown>, files: File[] = [], extra: Record<string, string> = {}) => {
    if (busy.current) return;
    busy.current = true;
    setState({ status: "sending" });
    const body = new FormData();
    for (const [k, v] of Object.entries({ ...values, ...extra })) {
      if (v === undefined || v === null) continue;
      if (Array.isArray(v)) v.forEach((x) => body.append(k, String(x)));
      else body.append(k, String(v));
    }
    body.append("submissionId", submissionId.current);
    body.append("elapsed", String(Date.now() - openedAt.current));
    files.forEach((f) => body.append("files", f));
    try {
      const res = await fetch(endpoint, { method: "POST", body, headers: { Accept: "application/json" } });
      const data = (await res.json().catch(() => ({ ok: false, code: "failed" }))) as ApiResponse;
      if (data.ok) {
        setState({ status: "success", reference: data.reference });
        submissionId.current = newId();
      } else {
        const showServerText = (data.code === "invalid" || data.code === "upload") && data.error;
        setState({ status: "error", code: data.code, message: showServerText ? data.error! : formMessages[tone][data.code] ?? formMessages[tone].failed });
      }
    } catch {
      setState({ status: "error", code: "network", message: formMessages[tone].network });
    } finally {
      busy.current = false;
    }
  };

  return { state, submit };
}
