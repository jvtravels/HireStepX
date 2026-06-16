import { describe, it, expect } from "vitest";
import { EvaluateSessionError } from "../dashboardData";
import { isTransientReportError } from "../sessionReport/SessionReport";

/* These pin the contract the report-generation retry loop relies on: a 429
 * carries the server's Retry-After (in ms) so the loop backs off for as long
 * as the server actually asked instead of hammering on a fixed schedule, and
 * the resulting message is still classified transient so it falls through to
 * the graceful preliminary report. */
describe("EvaluateSessionError", () => {
  it("is an Error with status and retryAfterMs from a 429 retryAfter", () => {
    const err = new EvaluateSessionError("Too many requests. Please wait 30 seconds.", {
      status: 429,
      retryAfterMs: 30_000,
      retryable: true,
    });
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("EvaluateSessionError");
    expect(err.status).toBe(429);
    expect(err.retryAfterMs).toBe(30_000);
    expect(err.retryable).toBe(true);
  });

  it("defaults retryAfterMs to null and retryable to false", () => {
    const err = new EvaluateSessionError("Session expired", { status: 401 });
    expect(err.retryAfterMs).toBeNull();
    expect(err.retryable).toBe(false);
  });

  it("429 message is classified transient (falls back to preliminary report)", () => {
    const err = new EvaluateSessionError("Too many requests. Please wait a moment.", {
      status: 429,
      retryable: true,
    });
    expect(isTransientReportError(err.message)).toBe(true);
  });

  it("401 expiry message is NOT transient (fails fast)", () => {
    const err = new EvaluateSessionError("Session expired — please refresh and sign in again.", {
      status: 401,
    });
    expect(isTransientReportError(err.message)).toBe(false);
  });

  it("a server retryAfter longer than the loop's 6s budget can be detected by the caller", () => {
    // The loop bails to the preliminary report when retryAfterMs exceeds its
    // MAX_BACKOFF_MS (6000) rather than firing a doomed retry.
    const err = new EvaluateSessionError("Too many requests. Please wait 30 seconds.", {
      status: 429,
      retryAfterMs: 30_000,
      retryable: true,
    });
    expect(err.retryAfterMs! > 6000).toBe(true);
  });
});
