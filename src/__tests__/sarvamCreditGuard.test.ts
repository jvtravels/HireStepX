import { describe, it, expect, vi, beforeEach } from "vitest";

const redisIncrByWithExpiry = vi.fn();
const redisGet = vi.fn();

vi.mock("../../server-handlers/_shared", () => ({
  redisIncrByWithExpiry: (...args: unknown[]) => redisIncrByWithExpiry(...args),
  redisGet: (...args: unknown[]) => redisGet(...args),
}));

import {
  recordTtsSpendAndCheckCap,
  recordSttSpendAndCheckCap,
  getSarvamMonthlySpend,
} from "../../server-handlers/_sarvam-credit-guard";

beforeEach(() => {
  redisIncrByWithExpiry.mockReset();
  redisGet.mockReset();
});

describe("recordTtsSpendAndCheckCap", () => {
  it("does not trip the cap when usage is low", async () => {
    redisIncrByWithExpiry.mockResolvedValue(100);
    expect(await recordTtsSpendAndCheckCap(1000)).toBe(false);
  });

  it("trips the cap once usage crosses the 90% buffer", async () => {
    redisIncrByWithExpiry.mockResolvedValue(25_000 * 100 * 0.95);
    expect(await recordTtsSpendAndCheckCap(1000)).toBe(true);
  });

  it("fails open (no cap trip) on a Redis outage", async () => {
    redisIncrByWithExpiry.mockResolvedValue(null);
    expect(await recordTtsSpendAndCheckCap(1000)).toBe(false);
  });
});

describe("recordSttSpendAndCheckCap", () => {
  it("records one STT session's spend", async () => {
    redisIncrByWithExpiry.mockResolvedValue(50);
    expect(await recordSttSpendAndCheckCap()).toBe(false);
  });
});

describe("getSarvamMonthlySpend", () => {
  it("reports zero spend when nothing has been recorded", async () => {
    redisGet.mockResolvedValue(null);
    expect(await getSarvamMonthlySpend()).toEqual({ usedCredits: 0, capCredits: 25_000 });
  });

  it("converts stored paise back into credits", async () => {
    redisGet.mockResolvedValue("500000");
    const spend = await getSarvamMonthlySpend();
    expect(spend.usedCredits).toBe(5000);
  });
});
