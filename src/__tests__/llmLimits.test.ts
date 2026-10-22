import { describe, it, expect } from "vitest";
import {
  parseLimit,
  geminiDailyLimit,
  cloudflareDailyLimit,
  geminiDayKey,
  cloudflareDayKey,
  groqMinuteKey,
  groqAvailableCompletion,
  groqReservation,
  groqMinuteWouldExceed,
  cloudflareNeuronsFor,
  cloudflareSpent,
  geminiSpent,
  DEFAULT_GEMINI_DAILY_CALLS,
  DEFAULT_CLOUDFLARE_DAILY_NEURONS,
  GROQ_TPM_CAP,
} from "../../server-handlers/_llm-limits";

describe("parseLimit", () => {
  it("falls back for empty, missing, negative and non-numeric values", () => {
    expect(parseLimit(undefined, 20)).toBe(20);
    expect(parseLimit("  ", 20)).toBe(20);
    expect(parseLimit("-3", 20)).toBe(20);
    expect(parseLimit("abc", 20)).toBe(20);
  });
  it("accepts 0 (disabled) and floors fractions", () => {
    expect(parseLimit("0", 20)).toBe(0);
    expect(parseLimit("25.9", 20)).toBe(25);
  });
  it("exposes env-driven limits with documented defaults", () => {
    expect(geminiDailyLimit("gemini-2.5-flash", undefined)).toBe(DEFAULT_GEMINI_DAILY_CALLS);
    expect(geminiDailyLimit(undefined, undefined)).toBe(DEFAULT_GEMINI_DAILY_CALLS);
    expect(geminiDailyLimit("gemini-3.5-flash-lite", undefined)).toBe(500);
    expect(geminiDailyLimit("gemini-3.1-flash-lite", undefined)).toBe(500);
    expect(geminiDailyLimit("gemini-3.5-flash-lite", "1500")).toBe(1500);
    expect(geminiDailyLimit("gemini-2.5-flash", "1500")).toBe(1500);
    expect(cloudflareDailyLimit(undefined)).toBe(DEFAULT_CLOUDFLARE_DAILY_NEURONS);
    expect(cloudflareDailyLimit("0")).toBe(0);
  });
});

describe("limit keys", () => {
  it("rolls the Gemini day at 08:00 UTC", () => {
    const before = Date.UTC(2026, 9, 13, 7, 59);
    const after = Date.UTC(2026, 9, 13, 8, 1);
    expect(geminiDayKey("m", before)).not.toBe(geminiDayKey("m", after));
    expect(geminiDayKey("m", after)).toBe(geminiDayKey("m", Date.UTC(2026, 9, 14, 7, 59)));
  });
  it("keys per model", () => {
    expect(geminiDayKey("a", 1e12)).not.toBe(geminiDayKey("b", 1e12));
  });
  it("rolls Cloudflare at UTC midnight and Groq every minute", () => {
    expect(cloudflareDayKey(Date.UTC(2026, 9, 13, 23, 59))).not.toBe(cloudflareDayKey(Date.UTC(2026, 9, 14, 0, 1)));
    expect(groqMinuteKey("m", 60_000)).not.toBe(groqMinuteKey("m", 120_000));
    expect(groqMinuteKey("m", 60_000)).toBe(groqMinuteKey("m", 60_500));
  });
});

describe("groq reservation", () => {
  it("leaves room for completion under the cap", () => {
    expect(groqAvailableCompletion(1000)).toBe(GROQ_TPM_CAP - 400 - 100 - 1000);
  });
  it("returns null when the prompt leaves less than the minimum completion", () => {
    expect(groqReservation(7500, 2000, 300)).toBeNull();
  });
  it("clamps maxTokens to what is available and reserves prompt + completion", () => {
    const r = groqReservation(5000, 4000, 300);
    expect(r).not.toBeNull();
    expect(r!.maxTokens).toBe(groqAvailableCompletion(5000));
    expect(r!.reserved).toBe(5000 + r!.maxTokens);
  });
  it("keeps the requested maxTokens when it fits", () => {
    expect(groqReservation(500, 800, 300)).toEqual({ maxTokens: 800, reserved: 1300 });
  });
  it("detects a minute that would overflow", () => {
    expect(groqMinuteWouldExceed(7000, 1500)).toBe(true);
    expect(groqMinuteWouldExceed(1000, 1500)).toBe(false);
    expect(groqMinuteWouldExceed(9000, 1500, 0)).toBe(false);
  });
});

describe("spent checks", () => {
  it("prefers reported neurons, else estimates from tokens", () => {
    expect(cloudflareNeuronsFor({ neurons: 12.2 })).toBe(13);
    expect(cloudflareNeuronsFor({ total_tokens: 1000 })).toBe(56);
    expect(cloudflareNeuronsFor(undefined)).toBe(0);
  });
  it("marks Cloudflare spent near the limit and never when disabled", () => {
    expect(cloudflareSpent(9_800, 10_000)).toBe(true);
    expect(cloudflareSpent(5_000, 10_000)).toBe(false);
    expect(cloudflareSpent(999_999, 0)).toBe(false);
  });
  it("marks Gemini spent at the limit and never when disabled", () => {
    expect(geminiSpent(20, 20)).toBe(true);
    expect(geminiSpent(19, 20)).toBe(false);
    expect(geminiSpent(500, 0)).toBe(false);
  });
});
