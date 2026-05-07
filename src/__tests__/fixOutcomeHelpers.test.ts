import { describe, it, expect } from "vitest";
import { computeOutcome, countFlagInWindow, primaryFlagFor } from "../../server-handlers/_fix-outcome-helpers";

describe("computeOutcome", () => {
  it("returns insufficient_data when fewer than 7 days have passed", () => {
    const r = computeOutcome({
      before: { totalSessions: 10, flaggedSessions: 5 },
      after: { totalSessions: 10, flaggedSessions: 1 },
      daysSinceResolution: 3,
    });
    expect(r.verdict).toBe("insufficient_data");
  });

  it("returns insufficient_data when before-window has too few examples", () => {
    const r = computeOutcome({
      before: { totalSessions: 5, flaggedSessions: 2 },
      after: { totalSessions: 4, flaggedSessions: 0 },
      daysSinceResolution: 8,
    });
    expect(r.verdict).toBe("insufficient_data");
  });

  it("returns verified when flag rate dropped more than 50%", () => {
    const r = computeOutcome({
      before: { totalSessions: 20, flaggedSessions: 10 }, // 50%
      after: { totalSessions: 20, flaggedSessions: 2 },   // 10%
      daysSinceResolution: 8,
    });
    expect(r.verdict).toBe("verified");
    expect(r.delta).toBeCloseTo(0.4, 5);
  });

  it("returns partial when flag rate dropped 20-50%", () => {
    const r = computeOutcome({
      before: { totalSessions: 20, flaggedSessions: 10 }, // 50%
      after: { totalSessions: 20, flaggedSessions: 7 },   // 35%
      daysSinceResolution: 8,
    });
    expect(r.verdict).toBe("partial");
  });

  it("returns no_change when rates stay similar", () => {
    const r = computeOutcome({
      before: { totalSessions: 20, flaggedSessions: 10 }, // 50%
      after: { totalSessions: 20, flaggedSessions: 9 },   // 45%
      daysSinceResolution: 8,
    });
    expect(r.verdict).toBe("no_change");
  });

  it("returns regressed when rate increased meaningfully", () => {
    const r = computeOutcome({
      before: { totalSessions: 20, flaggedSessions: 4 }, // 20%
      after: { totalSessions: 20, flaggedSessions: 12 }, // 60%
      daysSinceResolution: 8,
    });
    expect(r.verdict).toBe("regressed");
  });
});

describe("countFlagInWindow", () => {
  it("counts only rows whose analyzed_at falls inside the window", () => {
    const rows = [
      { flags: ["a", "b"], analyzed_at: "2026-05-01T12:00:00Z" },
      { flags: ["a"], analyzed_at: "2026-05-03T12:00:00Z" },
      { flags: ["c"], analyzed_at: "2026-05-05T12:00:00Z" },
      { flags: ["a"], analyzed_at: "2026-05-09T12:00:00Z" }, // outside
    ];
    const c = countFlagInWindow(rows, "a", "2026-05-01T00:00:00Z", "2026-05-08T00:00:00Z");
    expect(c.totalSessions).toBe(3);
    expect(c.flaggedSessions).toBe(2);
  });

  it("treats null flags arrays as empty", () => {
    const rows = [{ flags: null, analyzed_at: "2026-05-03T12:00:00Z" }];
    const c = countFlagInWindow(rows, "a", "2026-05-01T00:00:00Z", "2026-05-08T00:00:00Z");
    expect(c.totalSessions).toBe(1);
    expect(c.flaggedSessions).toBe(0);
  });
});

describe("primaryFlagFor", () => {
  it("prefers hallucination-class flags", () => {
    expect(primaryFlagFor(["weak_star_structure", "implausible_salary_claim", "duplicate_question"])).toBe("implausible_salary_claim");
  });

  it("falls back to evaluator-drift class when no hallucination", () => {
    expect(primaryFlagFor(["weak_star_structure", "ai_accepted_without_pushback"])).toBe("ai_accepted_without_pushback");
  });

  it("returns null for empty list", () => {
    expect(primaryFlagFor([])).toBeNull();
  });

  it("ranks system flags last", () => {
    expect(primaryFlagFor(["analyzer_error", "weak_star_structure"])).toBe("weak_star_structure");
  });
});
