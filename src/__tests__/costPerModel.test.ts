import { describe, it, expect } from "vitest";
import { llmCallInr, istDate, llmInr } from "../../server-handlers/_cost-helpers";

describe("llmCallInr", () => {
  it("prices a known model by input/output tokens", () => {
    // gemini-3.5-flash-lite: $0.30 in / $2.50 out per M, ₹84/$
    const inr = llmCallInr({ model: "gemini-3.5-flash-lite", promptTokens: 1_000_000, completionTokens: 1_000_000, totalTokens: 2_000_000, isFallback: false });
    expect(inr).toBeCloseTo((0.3 + 2.5) * 84, 4);
  });
  it("matches the more specific gpt-oss model", () => {
    const inr = llmCallInr({ model: "openai/gpt-oss-20b", promptTokens: 1_000_000, completionTokens: 0, totalTokens: 1_000_000, isFallback: false });
    expect(inr).toBeCloseTo(0.075 * 84, 4);
  });
  it("falls back to the blended rate for unknown models", () => {
    const inr = llmCallInr({ model: "mystery", promptTokens: 0, completionTokens: 0, totalTokens: 1_000_000, isFallback: false });
    expect(inr).toBeCloseTo(llmInr(1_000_000, false), 6);
  });
  it("prices failed calls (0 tokens) at zero", () => {
    expect(llmCallInr({ model: "gemini-3.5-flash-lite", promptTokens: 0, completionTokens: 0, totalTokens: 0, isFallback: false })).toBe(0);
  });
});

describe("istDate", () => {
  it("rolls UTC evening into the next IST day", () => {
    expect(istDate("2026-10-17T19:00:00Z")).toBe("2026-10-18");
    expect(istDate("2026-10-17T10:00:00Z")).toBe("2026-10-17");
  });
});
