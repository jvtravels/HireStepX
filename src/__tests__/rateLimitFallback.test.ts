import { describe, it, expect } from "vitest";
import { isFailClosedBucket, isRateLimited } from "../../server-handlers/_shared";

describe("isFailClosedBucket", () => {
  it("is false when unset or empty", () => {
    expect(isFailClosedBucket("create-order", undefined)).toBe(false);
    expect(isFailClosedBucket("create-order", "")).toBe(false);
  });

  it("matches listed buckets exactly, tolerating whitespace", () => {
    const env = "create-order, verify-payment ,evaluate";
    expect(isFailClosedBucket("create-order", env)).toBe(true);
    expect(isFailClosedBucket("verify-payment", env)).toBe(true);
    expect(isFailClosedBucket("evaluate", env)).toBe(true);
    expect(isFailClosedBucket("create", env)).toBe(false);
    expect(isFailClosedBucket("tts-token", env)).toBe(false);
  });
});

describe("in-memory limiter", () => {
  it("limits after the threshold within a window", async () => {
    const ip = `t-${Math.random()}`;
    expect(await isRateLimited(ip, "rl-test", 2, 60_000)).toBe(false);
    expect(await isRateLimited(ip, "rl-test", 2, 60_000)).toBe(false);
    expect(await isRateLimited(ip, "rl-test", 2, 60_000)).toBe(true);
  });

  it("stays bounded when many distinct IPs arrive", async () => {
    for (let i = 0; i < 5_200; i++) await isRateLimited(`flood-${i}`, "rl-flood", 5, 60_000);
    expect(await isRateLimited("flood-fresh", "rl-flood", 5, 60_000)).toBe(false);
  });
});
