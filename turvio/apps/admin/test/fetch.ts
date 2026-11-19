import { vi } from "vitest";

export interface Call {
  method: string;
  url: string;
  body: unknown;
}

type Handler = (call: Call) => { status?: number; body?: unknown } | undefined;

/** Replaces fetch: records every call and answers with the handler's response (JSON). */
export function mockFetch(handler: Handler) {
  const calls: Call[] = [];
  const fn = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
    const call = { method, url, body };
    calls.push(call);
    const r = handler(call) ?? { status: 404, body: { error: { code: "not_found", message: "Unknown" } } };
    const status = r.status ?? 200;
    return new Response(status === 204 ? null : JSON.stringify(r.body ?? {}), { status, headers: { "content-type": "application/json" } });
  });
  vi.stubGlobal("fetch", fn);
  return calls;
}

/** Path and query of a proxied call (`/api/turvio/v1/...` → `/v1/...`). */
export const path = (c: Call) => c.url.replace(/^\/api\/turvio/, "");
