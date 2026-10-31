import { describe, it, expect } from "vitest";
import {
  scoreCandidateMatch,
  requiredSkillsCoverage,
  STRONG_MATCH_THRESHOLD,
  type CandidatePoolRow,
  type RequirementInput,
} from "../../server-handlers/_requirement-match-helpers";

const req: RequirementInput = {
  title: "Product Designer",
  location: "Pune",
  description: "",
  skills: ["Figma", "Prototyping", "User Research", "Design Systems"],
};

function pool(over: Partial<CandidatePoolRow>): CandidatePoolRow {
  return {
    id: "c",
    target_role: "Product Designer",
    resume_data: { skills: ["Figma", "Prototyping", "User Research", "Design Systems"] },
    avg_score: null,
    sessions_completed: 0,
    last_active_days_ago: 2,
    years_experience: null,
    ...over,
  } as CandidatePoolRow;
}

describe("score follows the skill coverage the employer is shown", () => {
  it("a candidate covering every listed skill is a strong match, not 39 Fair", () => {
    const c = pool({});
    expect(requiredSkillsCoverage(c, req.skills)).toEqual({ met: 4, total: 4 });
    expect(scoreCandidateMatch(c, req).matchScore).toBeGreaterThanOrEqual(STRONG_MATCH_THRESHOLD);
  });

  it("score falls as fewer listed skills are covered", () => {
    const all = scoreCandidateMatch(pool({}), req).matchScore;
    const half = scoreCandidateMatch(pool({ resume_data: { skills: ["Figma", "Prototyping"] } }), req).matchScore;
    const none = scoreCandidateMatch(pool({ resume_data: { skills: ["Excel"] } }), req).matchScore;
    expect(all).toBeGreaterThan(half);
    expect(half).toBeGreaterThan(none);
  });
});
