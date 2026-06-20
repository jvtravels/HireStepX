import { describe, it, expect } from "vitest";
import { isQuotaExhausted, isTransientLLMError } from "../../server-handlers/_llm";

/* The retry path on each LLM provider does one short-backoff retry for
   transient errors before failing over. A 429 from a per-second rate limit is
   transient (retry helps); a 429 from daily/billing quota exhaustion is
   permanent (retry only adds latency before the inevitable failover). These
   tests pin that distinction — the live Gemini "exceeded your current quota"
   429 must NOT be retried. */

describe("isQuotaExhausted", () => {
  it("flags Gemini billing/quota 429 bodies as permanent", () => {
    expect(isQuotaExhausted('Gemini error 429: { "error": { "code": 429, "message": "You exceeded your current quota, please check your plan and billing details."')).toBe(true);
    expect(isQuotaExhausted("RESOURCE_EXHAUSTED")).toBe(true);
    expect(isQuotaExhausted("quota exceeded for this project")).toBe(true);
  });

  it("does NOT flag a plain per-second rate limit as quota exhaustion", () => {
    expect(isQuotaExhausted("Groq error 429: rate limit reached, retry in 1s")).toBe(false);
    expect(isQuotaExhausted("model is currently experiencing high traffic")).toBe(false);
  });
});

describe("isTransientLLMError", () => {
  it("retries plain rate-limit and gateway/overload errors", () => {
    expect(isTransientLLMError("Groq error 429: rate limit reached")).toBe(true);
    expect(isTransientLLMError("Gemini error 503: model is overloaded")).toBe(true);
    expect(isTransientLLMError("error 502 bad gateway")).toBe(true);
    expect(isTransientLLMError("temporary failure")).toBe(true);
  });

  it("does NOT retry quota-exhaustion 429s (fails over immediately)", () => {
    expect(isTransientLLMError('Gemini error 429: { "message": "You exceeded your current quota, please check your plan and billing details."')).toBe(false);
    expect(isTransientLLMError("Gemini error 429: RESOURCE_EXHAUSTED")).toBe(false);
  });

  it("does NOT retry hard client errors (400/401/403)", () => {
    expect(isTransientLLMError("Groq error 400: invalid request")).toBe(false);
    expect(isTransientLLMError("Gemini error 403: API key invalid")).toBe(false);
  });
});
