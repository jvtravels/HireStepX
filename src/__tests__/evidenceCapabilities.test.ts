import { describe, it, expect } from "vitest";
import { computeEvidenceCapabilities, type RealSession } from "../dashboardData";

function session(overrides: Partial<RealSession>): RealSession {
  return {
    id: Math.random().toString(36),
    date: "2026-01-01T00:00:00.000Z",
    type: "behavioral",
    difficulty: "medium",
    focus: "communication",
    duration: 900,
    score: 80,
    questions: 5,
    skill_scores: null,
    ...overrides,
  };
}

describe("computeEvidenceCapabilities", () => {
  it("returns all four capabilities unverified when there are no sessions", () => {
    const result = computeEvidenceCapabilities([]);
    expect(result).toHaveLength(4);
    expect(result.every(c => !c.verified && c.verifiedDateLabel === null)).toBe(true);
  });

  it("requires 2+ qualifying sessions for a skill-based capability, not 1", () => {
    const oneHit = [session({ skill_scores: { communication: 85 } })];
    expect(computeEvidenceCapabilities(oneHit).find(c => c.key === "communication")?.verified).toBe(false);

    const twoHits = [
      session({ skill_scores: { communication: 85 } }),
      session({ skill_scores: { communication: 72 } }),
    ];
    expect(computeEvidenceCapabilities(twoHits).find(c => c.key === "communication")?.verified).toBe(true);
  });

  it("applies the same 2-session bar to Salary Negotiation as the other rows (no special-casing)", () => {
    const oneHit = [session({ focus: "salary-negotiation", score: 90 })];
    expect(computeEvidenceCapabilities(oneHit).find(c => c.key === "salary-negotiation")?.verified).toBe(false);

    const twoHits = [
      session({ focus: "salary-negotiation", score: 90 }),
      session({ focus: "salary-negotiation", score: 75 }),
    ];
    expect(computeEvidenceCapabilities(twoHits).find(c => c.key === "salary-negotiation")?.verified).toBe(true);
  });

  it("labels the problem-solving capability honestly instead of as 'Decision Making'", () => {
    const sessions = [
      session({ skill_scores: { problemSolving: 85 } }),
      session({ skill_scores: { problemSolving: 72 } }),
    ];
    const capability = computeEvidenceCapabilities(sessions).find(c => c.key === "problemSolving");
    expect(capability?.label).toBe("Problem Solving");
    expect(capability?.verified).toBe(true);
  });

  it("ignores sessions scoring below the 70 threshold", () => {
    const sessions = [
      session({ skill_scores: { leadership: 65 } }),
      session({ skill_scores: { leadership: 69 } }),
    ];
    expect(computeEvidenceCapabilities(sessions).find(c => c.key === "leadership")?.verified).toBe(false);
  });

  it("surfaces the most recent qualifying session's date", () => {
    const sessions = [
      session({ date: "2026-06-21T00:00:00.000Z", skill_scores: { leadership: 80 } }),
      session({ date: "2026-07-22T00:00:00.000Z", skill_scores: { leadership: 75 } }),
    ];
    const capability = computeEvidenceCapabilities(sessions).find(c => c.key === "leadership");
    expect(capability?.verifiedDateLabel).toBe("22 Jul");
  });
});
