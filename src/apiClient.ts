/**
 * Authenticated API client for the app's own `/api/*` endpoints.
 *
 * Uses XMLHttpRequest instead of fetch for one specific reason: a material
 * fraction of real-world users run browser extensions (Loom Screen Recorder,
 * Jam.dev, Hotjar, session-replay tools, etc.) that install a wrapper around
 * window.fetch to capture every request for telemetry. Several of those
 * wrappers hang on authenticated POSTs above a small body-size threshold and
 * never resolve, which in turn stalls every user action built on `fetch`.
 * XHR is untouched by those extensions, so routing our mutations through it
 * is the most reliable transport we can offer without asking users to
 * uninstall extensions.
 *
 * This is the ONLY place in the app that does extension-avoidance; every
 * mutation endpoint goes through apiFetch so we have a single audit surface.
 */

import { authHeaders } from "./supabase";
import { getDistinctId, getSessionId } from "./posthogClient";

export interface ApiResponse<T> {
  ok: boolean;
  status: number;
  data: T | null;
  error: string | null;
  /**
   * The parsed JSON body on a non-2xx response, when the server returned one.
   * `data` is intentionally null on failure, but some callers need structured
   * error details (e.g. a 429's `retryAfter`). Null when the body was empty or
   * not JSON. Always check `ok` first.
   */
  errorData: unknown;
  headers: Record<string, string>;
}

/**
 * Typed rate-limit signal. The server emits 429 with a `retryAfter` field
 * (see `_shared.ts`); every consumer of an `/api/*` mutation should surface
 * THIS instead of re-checking `status === 429` inline, so the 429 branch lives
 * in one place. `retryAfter` is seconds until the caller may retry (undefined
 * when the server didn't include it).
 */
export class RateLimitError extends Error {
  readonly status = 429 as const;
  readonly retryAfter?: number;
  constructor(retryAfter?: number) {
    super(
      retryAfter
        ? `Too many requests. Please wait ${retryAfter} seconds and try again.`
        : "Too many requests. Please wait a moment and try again.",
    );
    this.name = "RateLimitError";
    this.retryAfter = retryAfter;
  }
}

/**
 * Central 429 gate for `/api/*` consumers. Given an `ApiResponse`, throws a
 * typed `RateLimitError` (reading `retryAfter` from the server's error body)
 * when the response is a rate-limit; otherwise a no-op. Call this right after
 * `apiFetch` so no caller has to re-implement the 429 check.
 */
export function throwIfRateLimited(res: ApiResponse<unknown>): void {
  if (res.status !== 429) return;
  const retryAfter = (res.errorData as { retryAfter?: number } | null)?.retryAfter;
  throw new RateLimitError(typeof retryAfter === "number" ? retryAfter : undefined);
}

/**
 * POST JSON to `/api/...` with the current user's bearer token attached.
 * Resolves on network failure — callers read `ok` / `status` to branch.
 */
export async function apiFetch<T = unknown>(
  path: string,
  body: unknown,
  opts: { signal?: AbortSignal; method?: "POST" | "PUT" | "PATCH" | "DELETE" } = {},
): Promise<ApiResponse<T>> {
  const headers = await authHeaders();
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    let settled = false;
    let abortListener: (() => void) | null = null;

    const settle = (response: ApiResponse<T>) => {
      if (settled) return;
      settled = true;
      if (abortListener && opts.signal) opts.signal.removeEventListener("abort", abortListener);
      resolve(response);
    };

    // If the caller passed an already-aborted signal we must resolve without
    // ever sending the request. xhr.abort() on an unsent XHR is a no-op and
    // won't fire onabort, which would leave the promise hanging.
    if (opts.signal?.aborted) {
      settle({ ok: false, status: 0, data: null, error: "aborted", errorData: null, headers: {} });
      return;
    }

    xhr.open(opts.method || "POST", path, true);
    xhr.responseType = "text";
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
    // Forward PostHog correlation ids so server-side events join the same person/session
    try {
      const did = getDistinctId();
      const sid = getSessionId();
      if (did) xhr.setRequestHeader("X-PostHog-Distinct-Id", did);
      if (sid) xhr.setRequestHeader("X-PostHog-Session-Id", sid);
    } catch { /* never break a request on telemetry header injection */ }

    xhr.onload = () => {
      const headerMap: Record<string, string> = {};
      const raw = xhr.getAllResponseHeaders() || "";
      raw.trim().split(/[\r\n]+/).forEach(line => {
        const idx = line.indexOf(":");
        if (idx > 0) headerMap[line.slice(0, idx).toLowerCase().trim()] = line.slice(idx + 1).trim();
      });
      const ok = xhr.status >= 200 && xhr.status < 300;
      const rawText = xhr.responseText || "";
      let parsed: unknown = null;
      let parseFailed = false;
      if (rawText) {
        try { parsed = JSON.parse(rawText); } catch { parseFailed = true; }
      }
      const errBody = (parsed && typeof parsed === "object" ? parsed : {}) as Record<string, unknown>;
      settle({
        ok,
        status: xhr.status,
        // If body isn't JSON (e.g. 502 HTML error page) but the status is 2xx,
        // expose the raw text so callers can see what they actually got.
        data: ok ? (parseFailed ? (rawText as unknown as T) : (parsed as T)) : null,
        error: ok
          ? null
          : (typeof errBody.error === "string"
              ? errBody.error
              : (parseFailed && rawText ? rawText.slice(0, 200) : `HTTP ${xhr.status}`)),
        errorData: ok ? null : (parseFailed ? null : parsed),
        headers: headerMap,
      });
    };
    xhr.onerror = () => settle({ ok: false, status: 0, data: null, error: "Network error", errorData: null, headers: {} });
    xhr.onabort = () => settle({ ok: false, status: 0, data: null, error: "aborted", errorData: null, headers: {} });

    if (opts.signal) {
      abortListener = () => xhr.abort();
      opts.signal.addEventListener("abort", abortListener, { once: true });
    }

    xhr.send(body == null ? null : typeof body === "string" ? body : JSON.stringify(body));
  });
}
