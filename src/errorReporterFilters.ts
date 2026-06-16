/* Pure classification helpers for the error reporter, split out so they can be
 * unit-tested without importing errorReporter.ts (which pulls an optional
 * dynamic `@sentry/browser` import that the test bundler can't resolve). */

/**
 * Whether an unhandledrejection is worth reporting.
 *
 * Suppress only GENUINE user-initiated aborts (navigating away mid-request, an
 * AbortController firing) — those are expected noise. We deliberately DO report
 * network failures ("Failed to fetch" / "NetworkError" / "Load failed"): for an
 * India-4G audience a dropped request is the single most important real-world
 * failure mode to have visibility into, and the old substring filter
 * blackholed exactly that signal. The caller's MAX_ERRORS_PER_SESSION cap keeps
 * a flaky connection from flooding the endpoint, so reporting is safe.
 */
export function shouldReportRejection(reason: unknown): boolean {
  if (reason instanceof Error) {
    if (reason.name === "AbortError") return false;
  }
  const message = reason instanceof Error ? reason.message : String(reason);
  // Non-Error rejections that are still just aborts.
  if (/\bAbortError\b/.test(message)) return false;
  if (message.includes("The user aborted a request")) return false;
  return true;
}
