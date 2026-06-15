import { describe, it, expect } from "vitest";
import {
  llmInr,
  ttsInr,
  sttInr,
  costBreakdown,
  kFactor,
  type CostRates,
} from "../../server-handlers/_cost-helpers";

// Fixed rates so assertions don't drift when DEFAULT_COST_RATES is re-tuned.
const RATES: CostRates = {
  llmUsdPerMToken: 1,
  llmFallbackUsdPerMToken: 2,
  ttsUsdPerMChar: 10,
  sttUsdPerCall: 0.01,
  usdToInr: 100,
};

describe("per-component cost", () => {
  it("prices LLM tokens at the primary rate", () => {
    // 1M tokens × $1/M × ₹100 = ₹100
    expect(llmInr(1_000_000, false, RATES)).toBe(100);
  });

  it("prices fallback tokens at the fallback rate", () => {
    expect(llmInr(1_000_000, true, RATES)).toBe(200);
  });

  it("prices TTS by characters", () => {
    // 1M chars × $10/M × ₹100 = ₹1000
    expect(ttsInr(1_000_000, RATES)).toBe(1000);
  });

  it("prices STT per call", () => {
    expect(sttInr(50, RATES)).toBe(50); // 50 × $0.01 × ₹100
  });

  it("clamps negative usage to zero", () => {
    expect(llmInr(-5, false, RATES)).toBe(0);
    expect(ttsInr(-5, RATES)).toBe(0);
    expect(sttInr(-5, RATES)).toBe(0);
  });
});

describe("costBreakdown", () => {
  it("sums components and divides by sessions", () => {
    const b = costBreakdown(
      { llmTokensPrimary: 1_000_000, llmTokensFallback: 0, ttsChars: 1_000_000, sttCalls: 50, sessions: 10 },
      RATES,
    );
    expect(b.llmInr).toBe(100);
    expect(b.ttsInr).toBe(1000);
    expect(b.sttInr).toBe(50);
    expect(b.totalInr).toBe(1150);
    expect(b.perSessionInr).toBe(115);
    expect(b.sessions).toBe(10);
  });

  it("returns perSession 0 (not Infinity) when no sessions", () => {
    const b = costBreakdown(
      { llmTokensPrimary: 1_000_000, llmTokensFallback: 0, ttsChars: 0, sttCalls: 0, sessions: 0 },
      RATES,
    );
    expect(b.totalInr).toBe(100);
    expect(b.perSessionInr).toBe(0);
  });

  it("floors fractional session counts", () => {
    const b = costBreakdown(
      { llmTokensPrimary: 0, llmTokensFallback: 0, ttsChars: 0, sttCalls: 0, sessions: 3.9 },
      RATES,
    );
    expect(b.sessions).toBe(3);
  });

  it("reflects the real-world shape: voice dominates, LLM is cheap", () => {
    // A representative ~12-min mock with default list rates.
    const b = costBreakdown({
      llmTokensPrimary: 18_000, // ~13k in + ~5k out across generate+evaluate+insights
      llmTokensFallback: 0,
      ttsChars: 2_500, // AI spoke ~2.5k chars
      sttCalls: 1,
      sessions: 1,
    });
    expect(b.llmInr).toBeLessThan(b.ttsInr + b.sttInr); // voice > LLM
    expect(b.perSessionInr).toBeGreaterThan(0);
    expect(b.perSessionInr).toBeLessThan(50); // sanity: within the ₹8–25-ish band, well under ₹50
  });
});

describe("kFactor", () => {
  it("is signups per active user", () => {
    expect(kFactor(3, 10)).toBe(0.3);
  });

  it("returns 0 (not Infinity) with no active users", () => {
    expect(kFactor(5, 0)).toBe(0);
  });

  it("clamps negative signups", () => {
    expect(kFactor(-2, 10)).toBe(0);
  });

  it("can exceed 1 for a self-sustaining loop", () => {
    expect(kFactor(15, 10)).toBe(1.5);
  });
});
