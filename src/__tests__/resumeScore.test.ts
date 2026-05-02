import { describe, it, expect } from "vitest";
import { computeScoreBreakdown } from "../../server-handlers/_resume-score";

describe("computeScoreBreakdown", () => {
  it("sums the canonical rubric to 100 at perfect subscores", () => {
    const out = computeScoreBreakdown({
      scoreBreakdown: {
        quantifiedAchievements: 20,
        relevantSkills: 20,
        formattingStructure: 15,
        experienceProgression: 20,
        educationCerts: 10,
        summaryClarity: 15,
      },
    });
    expect(out?.total).toBe(100);
  });

  it("sums the canonical rubric to a known mid-range total", () => {
    const out = computeScoreBreakdown({
      scoreBreakdown: {
        quantifiedAchievements: 12,
        relevantSkills: 16,
        formattingStructure: 11,
        experienceProgression: 14,
        educationCerts: 7,
        summaryClarity: 10,
      },
    });
    // 12 + 16 + 11 + 14 + 7 + 10 = 70
    expect(out?.total).toBe(70);
  });

  it("clamps subscores above their per-criterion ceiling", () => {
    const out = computeScoreBreakdown({
      scoreBreakdown: {
        quantifiedAchievements: 999, // > 20 → 20
        relevantSkills: 20,
        formattingStructure: 15,
        experienceProgression: 20,
        educationCerts: 10,
        summaryClarity: 15,
      },
    });
    expect(out?.quantifiedAchievements).toBe(20);
    expect(out?.total).toBe(100);
  });

  it("clamps negative subscores to 0", () => {
    const out = computeScoreBreakdown({
      scoreBreakdown: {
        quantifiedAchievements: -5,
        relevantSkills: 10,
        formattingStructure: 0,
        experienceProgression: 0,
        educationCerts: 0,
        summaryClarity: 0,
      },
    });
    expect(out?.quantifiedAchievements).toBe(0);
    expect(out?.total).toBe(10);
  });

  it("rounds float subscores (LLMs sometimes emit decimals)", () => {
    const out = computeScoreBreakdown({
      scoreBreakdown: {
        quantifiedAchievements: 12.4, // → 12
        relevantSkills: 12.6,         // → 13
        formattingStructure: 0,
        experienceProgression: 0,
        educationCerts: 0,
        summaryClarity: 0,
      },
    });
    expect(out?.quantifiedAchievements).toBe(12);
    expect(out?.relevantSkills).toBe(13);
    expect(out?.total).toBe(25);
  });

  it("returns null when scoreBreakdown is missing entirely", () => {
    expect(computeScoreBreakdown({})).toBeNull();
    expect(computeScoreBreakdown({ scoreBreakdown: null })).toBeNull();
    expect(
      computeScoreBreakdown({ scoreBreakdown: "not an object" }),
    ).toBeNull();
  });

  it("returns null when scoreBreakdown has no valid numeric subscores", () => {
    expect(
      computeScoreBreakdown({
        scoreBreakdown: { quantifiedAchievements: "20", relevantSkills: null },
      }),
    ).toBeNull();
  });

  it("treats missing subscores as 0 but still returns a result", () => {
    const out = computeScoreBreakdown({
      scoreBreakdown: { quantifiedAchievements: 18 },
    });
    expect(out).not.toBeNull();
    expect(out?.quantifiedAchievements).toBe(18);
    expect(out?.relevantSkills).toBe(0);
    expect(out?.total).toBe(18);
  });

  it("identical subscores produce identical totals (determinism)", () => {
    const sub = {
      quantifiedAchievements: 14,
      relevantSkills: 13,
      formattingStructure: 11,
      experienceProgression: 15,
      educationCerts: 6,
      summaryClarity: 12,
    };
    const a = computeScoreBreakdown({ scoreBreakdown: { ...sub } });
    const b = computeScoreBreakdown({ scoreBreakdown: { ...sub } });
    expect(a?.total).toBe(b?.total);
    expect(a?.total).toBe(71);
  });
});
