import { describe, it, expect, vi, beforeEach } from "vitest";

const redisIncrByWithExpiry = vi.fn();
const redisGet = vi.fn();

vi.mock("../../server-handlers/_shared", () => ({
  redisIncrByWithExpiry: (...args: unknown[]) => redisIncrByWithExpiry(...args),
  redisGet: (...args: unknown[]) => redisGet(...args),
}));

import {
  recordDeepgramSpendAndCheckCap,
  getDeepgramMonthlySpend,
} from "../../server-handlers/_deepgram-credit-guard";

beforeEach(() => {
  redisIncrByWithExpiry.mockReset();
  redisGet.mockReset();
});

describe("recordDeepgramSpendAndCheckCap", () => {
  it("does not trip the cap when usage is low", async () => {
    redisIncrByWithExpiry.mockResolvedValue(100);
    expect(await recordDeepgramSpendAndCheckCap()).toBe(false);
  });

  it("trips the cap once usage crosses the 90% buffer", async () => {
    redisIncrByWithExpiry.mockResolvedValue(200 * 100 * 0.95);
    expect(await recordDeepgramSpendAndCheckCap()).toBe(true);
  });

  it("fails open (no cap trip) on a Redis outage", async () => {
    redisIncrByWithExpiry.mockResolvedValue(null);
    expect(await recordDeepgramSpendAndCheckCap()).toBe(false);
  });
});

describe("getDeepgramMonthlySpend", () => {
  it("reports zero spend when nothing has been recorded", async () => {
    redisGet.mockResolvedValue(null);
    expect(await getDeepgramMonthlySpend()).toEqual({ usedUsd: 0, capUsd: 200 });
  });

  it("converts stored cents back into dollars", async () => {
    redisGet.mockResolvedValue("5000");
    const spend = await getDeepgramMonthlySpend();
    expect(spend.usedUsd).toBe(50);
  });
});
