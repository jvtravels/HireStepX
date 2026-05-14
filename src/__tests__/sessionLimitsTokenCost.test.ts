import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  estimateTokens,
  estimateCostInr,
  logTurnUsage,
  GROQ_INPUT_RATE_INR_PER_TOKEN,
  GROQ_OUTPUT_RATE_INR_PER_TOKEN,
} from "../../server-handlers/_session-limits";

describe("estimateTokens", () => {
  it("returns 0 for empty / null / undefined input", () => {
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens(null as unknown as string)).toBe(0);
    expect(estimateTokens(undefined as unknown as string)).toBe(0);
  });

  it("approximates ~4 chars per token", () => {
    expect(estimateTokens("abcd")).toBe(1);
    expect(estimateTokens("abcdefgh")).toBe(2);
    expect(estimateTokens("a".repeat(400))).toBe(100);
  });

  it("rounds up partial tokens", () => {
    expect(estimateTokens("abc")).toBe(1);
    expect(estimateTokens("abcde")).toBe(2);
  });
});

describe("estimateCostInr", () => {
  it("returns 0 for zero tokens", () => {
    expect(estimateCostInr(0, 0)).toBe(0);
  });

  it("uses Groq rate placeholders", () => {
    const c = estimateCostInr(1000, 1000);
    const expected =
      1000 * GROQ_INPUT_RATE_INR_PER_TOKEN + 1000 * GROQ_OUTPUT_RATE_INR_PER_TOKEN;
    expect(c).toBeCloseTo(expected, 9);
  });

  it("clamps negative / NaN to 0", () => {
    expect(estimateCostInr(-5, 10)).toBeCloseTo(10 * GROQ_OUTPUT_RATE_INR_PER_TOKEN, 9);
    expect(estimateCostInr(NaN, NaN)).toBe(0);
  });
});

describe("logTurnUsage — token + cost telemetry", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });
  afterEach(() => {
    logSpy.mockRestore();
  });

  function lastPayload(): Record<string, unknown> {
    const call = logSpy.mock.calls.at(-1);
    return JSON.parse(call?.[0] as string) as Record<string, unknown>;
  }

  it("emits a kernel_turn_usage record with token counts", () => {
    logTurnUsage({
      sessionId: "s1",
      inputChars: 400,
      inputText: "a".repeat(400),
      outputText: "b".repeat(200),
    });
    const p = lastPayload();
    expect(p.kind).toBe("kernel_turn_usage");
    expect(p.inputTokens).toBe(100);
    expect(p.outputTokens).toBe(50);
  });

  it("computes costInr from inputTokens + outputTokens", () => {
    logTurnUsage({
      sessionId: "s1",
      inputChars: 4,
      inputText: "abcd",
      outputText: "efgh",
    });
    const p = lastPayload();
    expect(p.costInr).toBeCloseTo(
      1 * GROQ_INPUT_RATE_INR_PER_TOKEN + 1 * GROQ_OUTPUT_RATE_INR_PER_TOKEN,
      12,
    );
  });

  it("surfaces injectionDetected flag", () => {
    logTurnUsage({
      sessionId: "s1",
      inputChars: 10,
      injectionDetected: true,
    });
    const p = lastPayload();
    expect(p.injectionDetected).toBe(true);
  });

  it("defaults injectionDetected to false when absent", () => {
    logTurnUsage({ sessionId: "s1", inputChars: 10 });
    const p = lastPayload();
    expect(p.injectionDetected).toBe(false);
  });

  it("accepts explicit inputTokens / outputTokens overrides", () => {
    logTurnUsage({
      sessionId: "s1",
      inputChars: 999,
      inputTokens: 42,
      outputTokens: 17,
    });
    const p = lastPayload();
    expect(p.inputTokens).toBe(42);
    expect(p.outputTokens).toBe(17);
  });

  it("never throws on bad input", () => {
    expect(() =>
      logTurnUsage({ sessionId: "s1", inputChars: -1 } as never),
    ).not.toThrow();
  });
});
