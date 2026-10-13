import { describe, it, expect, beforeEach } from "vitest";
import { isQuotaExhausted, isDailyQuotaExhausted, msUntilDailyQuotaReset, isTransientLLMError, markProviderQuotaExhausted, isProviderCoolingDown, resetProviderCooldowns, isDeterministicLLMFailure, isNonRetryableChainFailure, LLMChainError, recordProviderFailure, recordProviderSuccess, isTokenGated } from "../../server-handlers/_llm";

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

describe("provider quota cooldown", () => {
  beforeEach(() => resetProviderCooldowns());

  it("is off until a provider is marked exhausted", () => {
    expect(isProviderCoolingDown("gemini")).toBe(false);
  });

  it("skips only the exhausted provider, and only within the cooldown window", () => {
    const t0 = 1_000_000;
    markProviderQuotaExhausted("gemini", t0);
    expect(isProviderCoolingDown("gemini", t0 + 1000)).toBe(true);
    expect(isProviderCoolingDown("groq", t0 + 1000)).toBe(false);
    expect(isProviderCoolingDown("gemini", t0 + 5 * 60_000 + 1)).toBe(false);
  });
});

describe("deterministic chain failures", () => {
  it("flags 413/400/quota/skipped as non-retryable", () => {
    expect(isDeterministicLLMFailure("Groq error 413: Request too large")).toBe(true);
    expect(isDeterministicLLMFailure("Gemini error 400: INVALID_ARGUMENT")).toBe(true);
    expect(isDeterministicLLMFailure("Gemini error 429: RESOURCE_EXHAUSTED")).toBe(true);
    expect(isDeterministicLLMFailure("Groq skipped — prompt (~7000 tokens) leaves ~0")).toBe(true);
    expect(isDeterministicLLMFailure("gemini skipped — total LLM budget exhausted")).toBe(false);
    expect(isDeterministicLLMFailure("Groq error 503: overloaded")).toBe(false);
    expect(isDeterministicLLMFailure("timeout")).toBe(false);
  });

  it("only gives up when every provider failed deterministically", () => {
    expect(isNonRetryableChainFailure(new LLMChainError("x", ["Groq error 413", "Gemini error 400"]))).toBe(true);
    expect(isNonRetryableChainFailure(new LLMChainError("x", ["Groq error 413", "Gemini error 503"]))).toBe(false);
    expect(isNonRetryableChainFailure(new Error("plain"))).toBe(false);
  });
});

describe("provider circuit breaker", () => {
  beforeEach(() => resetProviderCooldowns());

  it("opens after 3 consecutive health failures and closes after 30s", () => {
    const t0 = 5_000_000;
    recordProviderFailure("groq", "Groq error 503", false, t0);
    recordProviderFailure("groq", "aborted", true, t0);
    expect(isProviderCoolingDown("groq", t0)).toBe(false);
    recordProviderFailure("groq", "Groq error 502", false, t0);
    expect(isProviderCoolingDown("groq", t0 + 1000)).toBe(true);
    expect(isProviderCoolingDown("groq", t0 + 30_001)).toBe(false);
  });

  it("a success resets the streak, and request-specific errors never count", () => {
    recordProviderFailure("groq", "Groq error 503", false);
    recordProviderFailure("groq", "Groq error 503", false);
    recordProviderSuccess("groq");
    recordProviderFailure("groq", "Groq error 503", false);
    expect(isProviderCoolingDown("groq")).toBe(false);
    for (let i = 0; i < 5; i++) recordProviderFailure("gemini", "Gemini error 400: INVALID_ARGUMENT", false);
    for (let i = 0; i < 5; i++) recordProviderFailure("gemini", "Groq error 413: too large", false);
    expect(isProviderCoolingDown("gemini")).toBe(false);
  });
});

describe("token gate scope", () => {
  it("gates enhancement endpoints but never the core interview loop", () => {
    expect(isTokenGated("insights")).toBe(true);
    expect(isTokenGated("requirement-match-llm")).toBe(true);
    expect(isTokenGated("generate")).toBe(false);
    expect(isTokenGated("follow-up")).toBe(false);
    expect(isTokenGated("follow-up-dedup-retry")).toBe(false);
    expect(isTokenGated("evaluate-session-fast")).toBe(false);
    expect(isTokenGated(undefined)).toBe(false);
  });
});

describe("daily quota detection", () => {
  it("flags per-day Gemini caps and the tagged form", () => {
    expect(isDailyQuotaExhausted("Gemini error 429 [daily quota]: You exceeded your current quota")).toBe(true);
    expect(isDailyQuotaExhausted("exceeded your current quota ... GenerateRequestsPerDayPerProjectPerModel-FreeTier")).toBe(true);
  });

  it("treats Cloudflare's daily neuron allocation as a daily cap", () => {
    const msg = "Cloudflare error 429: you have used up your daily free allocation of 10,000 neurons";
    expect(isQuotaExhausted(msg)).toBe(true);
    expect(isDailyQuotaExhausted(msg)).toBe(true);
  });

  it("does not treat a per-minute quota as a daily cap", () => {
    expect(isDailyQuotaExhausted("Gemini error 429: exceeded your current quota, retry in 12s")).toBe(false);
    expect(isDailyQuotaExhausted("Groq error 429: rate limit reached")).toBe(false);
  });

  it("benches until the next 08:00 UTC, capped at 12h", () => {
    const at = (iso: string) => Date.parse(iso);
    expect(msUntilDailyQuotaReset(at("2026-10-13T03:00:00Z"))).toBe(5 * 3_600_000);
    expect(msUntilDailyQuotaReset(at("2026-10-13T09:00:00Z"))).toBe(12 * 3_600_000);
    expect(msUntilDailyQuotaReset(at("2026-10-13T20:00:00Z"))).toBe(12 * 3_600_000);
  });
});
