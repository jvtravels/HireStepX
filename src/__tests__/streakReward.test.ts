import { describe, it, expect } from "vitest";
import { computeStreakReward, getMilestoneHit } from "../../server-handlers/_streak-reward";

/** Consecutive-day ISO timestamps ending on `endDate` (IST calendar days),
    e.g. consecutiveDays("2026-08-07", 6) → the 6 days before Aug 7. */
function consecutiveDays(endDate: string, count: number): string[] {
  const end = new Date(`${endDate}T12:00:00Z`).getTime(); // midday IST, unambiguous
  return Array.from({ length: count }, (_, i) =>
    new Date(end - (count - i) * 86_400_000).toISOString()
  );
}

describe("computeStreakReward", () => {
  it("grants a bonus credit on a real 7-consecutive-day streak", () => {
    expect(computeStreakReward(consecutiveDays("2026-08-07", 6), "2026-08-07T12:00:00Z")).toBe(1);
  });

  it("grants a bonus credit on a real 14-consecutive-day streak", () => {
    expect(computeStreakReward(consecutiveDays("2026-08-14", 13), "2026-08-14T12:00:00Z")).toBe(1);
  });

  it("grants a bonus credit on a real 30-consecutive-day streak", () => {
    expect(computeStreakReward(consecutiveDays("2026-08-30", 29), "2026-08-30T12:00:00Z")).toBe(1);
  });

  it("grants nothing on a non-milestone streak length", () => {
    expect(computeStreakReward(consecutiveDays("2026-08-04", 3), "2026-08-04T12:00:00Z")).toBe(0);
  });

  it("does NOT grant a reward for 7 sessions scattered across months (no real streak)", () => {
    const scattered = [
      "2026-06-01T12:00:00Z", "2026-06-15T12:00:00Z", "2026-07-01T12:00:00Z",
      "2026-07-15T12:00:00Z", "2026-08-01T12:00:00Z", "2026-08-15T12:00:00Z",
    ];
    expect(computeStreakReward(scattered, "2026-08-30T12:00:00Z")).toBe(0);
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
