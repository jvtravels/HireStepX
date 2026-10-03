import { describe, it, expect } from "vitest";
import {
  scoreCandidateMatch,
  classifyRequirementStatus,
  rankAndCap,
  extractResumeLocation,
  extractSkills,
  describeMatch,
  type CandidatePoolRow,
} from "../../server-handlers/_requirement-match-helpers";

function candidate(overrides: Partial<CandidatePoolRow> = {}): CandidatePoolRow {
  return {
    id: "c1",
    name: "Test Candidate",
    target_role: "Senior Frontend Engineer",
    industry: "Tech",
    resume_data: { skills: ["React", "TypeScript"], location: "Bengaluru" },
    avg_score: 80,
    sessions_completed: 8,
    last_active_days_ago: 2,
    ...overrides,
  };
}

const req = { title: "Senior Frontend Engineer", location: "Bengaluru (hybrid)", description: "React and TypeScript" };

describe("scoreCandidateMatch", () => {
  it("scores a strong role+skill+location match highly", () => {
    const result = scoreCandidateMatch(candidate(), req);
    expect(result.matchScore).toBeGreaterThanOrEqual(60);
    expect(result.candidateId).toBe("c1");
  });

  it("scores an unrelated role low", () => {
    const result = scoreCandidateMatch(candidate({ target_role: "Product Designer", resume_data: { skills: ["Figma"], location: "Mumbai" } }), req);
    expect(result.matchScore).toBeLessThan(50);
  });

  it("treats remote requirements as location-neutral regardless of candidate city", () => {
    const remoteReq = { ...req, location: "Remote" };
    const far = scoreCandidateMatch(candidate({ resume_data: { skills: ["React", "TypeScript"], location: "Chennai" } }), remoteReq);
    const near = scoreCandidateMatch(candidate({ resume_data: { skills: ["React", "TypeScript"], location: "Bengaluru" } }), remoteReq);
    expect(far.matchScore).toBe(near.matchScore);
  });

  it("falls back to neutral location fit when candidate location is unknown", () => {
    const result = scoreCandidateMatch(candidate({ resume_data: { skills: ["React", "TypeScript"] } }), req);
    expect(result.matchScore).toBeGreaterThan(0);
  });

  it("clamps roster score into 0-100 even with malformed avg_score", () => {
    const result = scoreCandidateMatch(candidate({ avg_score: 500 }), req);
    expect(result.rosterScore).toBe(100);
  });

  it("defaults roster score to 50 when the candidate has no scored sessions", () => {
    const result = scoreCandidateMatch(candidate({ avg_score: null }), req);
    expect(result.rosterScore).toBe(50);
  });

  it("penalizes candidates inactive for over 30 days", () => {
    const fresh = scoreCandidateMatch(candidate({ last_active_days_ago: 2 }), req);
    const stale = scoreCandidateMatch(candidate({ last_active_days_ago: 90 }), req);
    expect(stale.matchScore).toBeLessThan(fresh.matchScore);
  });

  it("reads skills from an AI-parsed resume's topSkills, not just a flat skills array", () => {
    const flat = scoreCandidateMatch(candidate({ resume_data: { skills: ["React", "TypeScript"], location: "Bengaluru" } }), req);
    const ai = scoreCandidateMatch(candidate({ resume_data: { topSkills: ["React", "TypeScript"], location: "Bengaluru" } }), req);
    expect(ai.matchScore).toBe(flat.matchScore);
  });

  it("prefers a flat skills array over topSkills when both are present", () => {
    const result = scoreCandidateMatch(
      candidate({ resume_data: { skills: ["React", "TypeScript"], topSkills: ["Unrelated"], location: "Bengaluru" } }),
      req,
    );
    expect(result.matchScore).toBeGreaterThanOrEqual(60);
  });
});

describe("classifyRequirementStatus", () => {
  it("returns zero for no candidates", () => {
    expect(classifyRequirementStatus([])).toBe("zero");
  });

  it("returns partial for 1-2 strong matches", () => {
    expect(classifyRequirementStatus([{ matchScore: 90 }, { matchScore: 20 }])).toBe("partial");
  });

  it("returns ready for 3+ strong matches", () => {
    expect(classifyRequirementStatus([{ matchScore: 88 }, { matchScore: 92 }, { matchScore: 90 }])).toBe("ready");
  });

  it("returns partial, not zero, when matches exist but none are strong", () => {
    expect(classifyRequirementStatus([{ matchScore: 84 }, { matchScore: 55 }])).toBe("partial");
  });
});

describe("rankAndCap", () => {
  it("sorts descending without a minimum-score floor", () => {
    const scored = [
      { candidateId: "a", matchScore: 30, rosterScore: 50 },
      { candidateId: "b", matchScore: 90, rosterScore: 50 },
      { candidateId: "c", matchScore: 55, rosterScore: 50 },
    ];
    expect(rankAndCap(scored).map((s) => s.candidateId)).toEqual(["b", "c", "a"]);
  });

  it("caps the result at the given size", () => {
    const scored = Array.from({ length: 30 }, (_, i) => ({ candidateId: String(i), matchScore: 80, rosterScore: 50 }));
    expect(rankAndCap(scored, 5)).toHaveLength(5);
  });
});

describe("extractResumeLocation", () => {
  it("reads the location field from resume_data when present", () => {
    expect(extractResumeLocation({ location: "Pune" })).toBe("Pune");
  });

  it("returns empty string for missing or malformed resume_data", () => {
    expect(extractResumeLocation(null)).toBe("");
    expect(extractResumeLocation("not-an-object")).toBe("");
    expect(extractResumeLocation({})).toBe("");
  });
});

describe("extractSkills", () => {
  it("reads a flat skills array", () => {
    expect(extractSkills({ skills: ["React", "SQL"] })).toEqual(["React", "SQL"]);
  });

  it("falls back to topSkills for ai-parsed resumes", () => {
    expect(extractSkills({ topSkills: ["Go"] })).toEqual(["Go"]);
  });

  it("returns an empty array for malformed resume_data", () => {
    expect(extractSkills(null)).toEqual([]);
    expect(extractSkills("nope")).toEqual([]);
    expect(extractSkills({ skills: "not-an-array" })).toEqual([]);
  });
});

describe("describeMatch", () => {
  it("names the specific overlapping skills when role and skills both line up", () => {
    const candidate = { target_role: "Senior Frontend Engineer", resume_data: { skills: ["React", "TypeScript", "Figma"], location: "Bengaluru" } };
    const sentence = describeMatch(candidate, req, ["React", "TypeScript", "GraphQL"]);
    expect(sentence).toContain("your target role matches this opening");
    expect(sentence).toContain("React");
    expect(sentence).toContain("TypeScript");
    expect(sentence).not.toContain("GraphQL");
  });

  it("mentions location fit only when the requirement is remote or the city matches", () => {
    const candidate = { target_role: "Senior Frontend Engineer", resume_data: { skills: ["React"], location: "Bengaluru" } };
    const remoteReq = { title: "Senior Frontend Engineer", location: "Remote", description: "" };
    expect(describeMatch(candidate, remoteReq, ["React"])).toContain("it fits your location");
  });

  it("falls back to a generic sentence when nothing overlaps", () => {
    const candidate = { target_role: "Product Designer", resume_data: { skills: ["Figma"], location: "Mumbai" } };
    const sentence = describeMatch(candidate, req, ["React", "TypeScript"]);
    expect(sentence).toBe("Matched on your overall profile and practice history.");
  });

  it("never invents a skill the candidate's resume doesn't list", () => {
    const candidate = { target_role: "Senior Frontend Engineer", resume_data: { skills: ["React"], location: "Bengaluru" } };
    const sentence = describeMatch(candidate, req, ["React", "Kubernetes"]);
    expect(sentence).not.toContain("Kubernetes");
  });
});
