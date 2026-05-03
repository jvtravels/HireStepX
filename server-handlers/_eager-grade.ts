/* HireStepX — Eager session grading

   When save-session writes a row, kick off the LLM grading
   asynchronously so the report is already cached by the time the user
   navigates to it. Eliminates the 30s wait at the most fragile point
   in the funnel (the "did I just complete this for nothing?" moment
   between session-end and the report rendering).

   Implementation notes:

   • Fire-and-forget. We DO NOT await the response. save-session must
     return as fast as ever; the user's UX is "session saved, now go
     to dashboard". Grading happens in the background; a network blip
     or LLM outage does NOT block save-session.

   • Same auth context. We forward the user's bearer token so
     evaluate-session sees the same userId. Without this, the grading
     call lands as anonymous and rate-limits incorrectly.

   • Idempotent at the handler level. evaluate-session checks
     `report_json` cache before calling the LLM, so this can race the
     user's actual report-view request without producing two LLM calls
     — whichever lands first writes the cache, the second hits the
     cache. Belt-and-suspenders for the post-LLM "second cache check"
     pattern we use in analyze-resume.

   • Failures are silent (logged, never thrown). The response from
     this helper is intentionally void — callers can't accidentally
     await it. Errors get a `console.warn` so ops review can spot
     systemic failures, but a single failure is invisible to users. */

declare const process: { env: Record<string, string | undefined> };

export interface EagerGradeInput {
  /** Absolute base URL — the request that triggered this. Used to
      construct the evaluate-session URL on the same deployment.
      Pass the request URL or APP_URL. */
  baseUrl: string;
  /** Bearer token from the original save-session request. Forwarded
      so evaluate-session sees the same authenticated user. */
  authorization: string;
  sessionId: string;
  transcript: Array<{ role: string; text: string }>;
  meta?: {
    type?: string;
    focus?: string;
    role?: string;
    targetCompany?: string;
    duration?: number;
    roleFamily?: string;
  };
  /** Override fetch for tests. */
  fetchImpl?: typeof fetch;
}

/** Fire-and-forget eager grading. Returns void synchronously; the
    actual fetch resolves in the background. Never throws. */
export function kickoffEagerGrade(input: EagerGradeInput): void {
  // Defensive guards — silently no-op on bad input rather than
  // throwing inside a fire-and-forget caller.
  if (!input.sessionId || !input.transcript || input.transcript.length === 0) {
    return;
  }
  if (!input.authorization || !input.baseUrl) {
    return;
  }

  let evaluateUrl: string;
  try {
    evaluateUrl = new URL("/api/evaluate-session", input.baseUrl).toString();
  } catch {
    // Bad baseUrl — drop the request rather than crash.
    return;
  }

  const f = input.fetchImpl || fetch;
  const body = JSON.stringify({
    sessionId: input.sessionId,
    transcript: input.transcript,
    meta: input.meta || {},
  });

  // The actual request. Don't await — we want the caller to return
  // immediately. The .catch() prevents an unhandled-rejection from
  // crashing the Edge runtime if the fetch fails.
  void f(evaluateUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: input.authorization,
      // Mark this as an eager (internal) call so observability can
      // distinguish it from a real user-initiated grade. Doesn't
      // affect handler logic — both paths produce the same report.
      "X-Eager-Grade": "1",
    },
    body,
  })
    .then((res) => {
      if (!res.ok) {
        // Don't log the body — it may contain LLM output. Status alone
        // is enough for ops review.
        console.warn(
          `[eager-grade] evaluate-session returned ${res.status} for session=${input.sessionId.slice(0, 8)}`,
        );
      }
    })
    .catch((err: unknown) => {
      console.warn(
        `[eager-grade] kickoff failed for session=${input.sessionId.slice(0, 8)}: ${err instanceof Error ? err.message : String(err)}`,
      );
    });
}

/** Resolve the base URL to use when calling sibling handlers. Tries:
 *    1. APP_URL env var (production-correct)
 *    2. The original request URL (works in dev/preview/prod uniformly)
 *    3. null (caller should skip the eager call) */
export function resolveBaseUrl(reqUrl: string | undefined | null): string | null {
  const env = (process.env.APP_URL || "").replace(/\/$/, "").trim();
  if (env) return env;
  if (typeof reqUrl !== "string" || !reqUrl) return null;
  try {
    const u = new URL(reqUrl);
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}
