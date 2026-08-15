import { describe, it, expect } from "vitest";
import { computeStreakReward, getMilestoneHit } from "../../server-handlers/_streak-reward";

describe("computeStreakReward", () => {
  it("grants a bonus credit on a 7-day streak", () => {
    expect(computeStreakReward(Array(6).fill("2026-08-01"), "2026-08-07")).toBe(1);
  });

  it("grants a bonus credit on a 14-day streak", () => {
    expect(computeStreakReward(Array(13).fill("2026-08-01"), "2026-08-14")).toBe(1);
  });

  it("grants a bonus credit on a 30-day streak", () => {
    expect(computeStreakReward(Array(29).fill("2026-08-01"), "2026-08-30")).toBe(1);
  });

  it("grants nothing on a non-milestone day", () => {
    expect(computeStreakReward(Array(3).fill("2026-08-01"), "2026-08-04")).toBe(0);
  });
});

describe("getMilestoneHit", () => {
  it("returns the milestone for 7/14/30", () => {
    expect(getMilestoneHit(7)).toBe(7);
    expect(getMilestoneHit(14)).toBe(14);
    expect(getMilestoneHit(30)).toBe(30);
  });

  it("returns null for a non-milestone length", () => {
    expect(getMilestoneHit(10)).toBeNull();
  });
});
