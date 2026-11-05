/** Browser-side calls to the TURVIO API through the app's session proxy. */

export class ApiCallError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const FRIENDLY: Record<string, string> = {
  api_unavailable: "The TURVIO service is not reachable. Check your connection and try again.",
  version_conflict: "Someone else changed this tour in the meantime. The view was refreshed – please repeat your change.",
  optimizer_unavailable: "The route optimizer is not reachable right now. Your tour was not changed.",
};

export async function api<T = unknown>(method: "GET" | "POST" | "PATCH" | "DELETE", path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api/turvio${path}`, {
      method,
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    throw new ApiCallError(0, "network", "No connection to TURVIO. Check your network and try again.");
  }
  if (res.status === 401) {
    window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname)}`);
    throw new ApiCallError(401, "unauthenticated", "Your session ended. Please sign in again.");
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = (data as { error?: { code?: string; message?: string } }).error ?? {};
    const code = err.code ?? "error";
    throw new ApiCallError(res.status, code, FRIENDLY[code] ?? err.message ?? `Request failed (HTTP ${res.status})`);
  }
  return data as T;
}

export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));
