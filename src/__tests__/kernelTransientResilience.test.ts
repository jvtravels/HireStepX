import { describe, it, expect } from "vitest";
import { isRetryableKernelStatus } from "../interviewAPI";

/* Pre-launch audit BLOCKER #1 (2026-06-25) — negotiate-turn transient
 * resilience. A 429 (rate-limit) or 5xx (server/LLM transient) or network drop
 * must be classified RETRYABLE so postKernel backs off + retries internally
 * instead of collapsing to the engine's silent salvage-close. A permanent 4xx
 * (bad request, auth) must NOT be retried — retrying it just wastes time before
 * the same failure. */

describe("isRetryableKernelStatus", () => {
  it("treats rate-limit (429) as retryable — the core blocker", () => {
    expect(isRetryableKernelStatus(429)).toBe(true);
  });

  it("treats server/LLM 5xx as retryable", () => {
    expect(isRetryableKernelStatus(500)).toBe(true);
    expect(isRetryableKernelStatus(502)).toBe(true);
    expect(isRetryableKernelStatus(503)).toBe(true);
  });

  it("treats network error / abort (status 0) as retryable", () => {
    expect(isRetryableKernelStatus(0)).toBe(true);
  });

  it("does NOT retry permanent 4xx (bad request / auth / forbidden / not-found)", () => {
    expect(isRetryableKernelStatus(400)).toBe(false);
    expect(isRetryableKernelStatus(401)).toBe(false);
    expect(isRetryableKernelStatus(403)).toBe(false);
    expect(isRetryableKernelStatus(404)).toBe(false);
  });
});
