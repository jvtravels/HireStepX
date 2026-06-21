import { describe, it, expect } from "vitest";
import { computeStreakReward, getMilestoneHit } from "../../server-handlers/_streak-reward";

/* These helpers gate the streak-milestone bonus credit granted from
   save-session.ts. The contract: a reward fires only when appending the
   current session lands the user *exactly* on a 7 / 14 / 30 milestone. */

describe("computeStreakReward", () => {
  it("grants one credit when the new total hits a milestone", () => {
    // 6 prior + this one = 7 → milestone.
    expect(computeStreakReward(Array(6).fill("2026-01-01"), "2026-01-02")).toBe(1);
    expect(computeStreakReward(Array(13).fill("x"), "y")).toBe(1); // → 14
    expect(computeStreakReward(Array(29).fill("x"), "y")).toBe(1); // → 30
  });

  it("grants nothing between milestones", () => {
    expect(computeStreakReward(Array(0).fill("x"), "y")).toBe(0);  // → 1
    expect(computeStreakReward(Array(6).fill("x"), "y")).toBe(1);  // → 7 (sanity)
    expect(computeStreakReward(Array(7).fill("x"), "y")).toBe(0);  // → 8
    expect(computeStreakReward(Array(14).fill("x"), "y")).toBe(0); // → 15
  });

  it("does not re-grant past the highest milestone", () => {
    // Each append increments by one, so a milestone count is only ever hit once.
    expect(computeStreakReward(Array(30).fill("x"), "y")).toBe(0); // → 31
    expect(computeStreakReward(Array(99).fill("x"), "y")).toBe(0);
  });
});

describe("getMilestoneHit", () => {
  it("returns the milestone number on an exact match", () => {
    expect(getMilestoneHit(7)).toBe(7);
    expect(getMilestoneHit(14)).toBe(14);
    expect(getMilestoneHit(30)).toBe(30);
  });

  it("returns null off-milestone", () => {
    expect(getMilestoneHit(0)).toBeNull();
    expect(getMilestoneHit(6)).toBeNull();
    expect(getMilestoneHit(8)).toBeNull();
    expect(getMilestoneHit(31)).toBeNull();
  });
});
