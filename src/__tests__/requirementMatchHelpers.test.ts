import { describe, it, expect } from "vitest";
import {
  scoreCandidateMatch,
  classifyRequirementStatus,
  rankAndCap,
  extractResumeLocation,
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
});

describe("classifyRequirementStatus", () => {
  it("returns zero for no candidates", () => {
    expect(classifyRequirementStatus([])).toBe("zero");
  });

  it("returns partial for 1-2 strong matches", () => {
    expect(classifyRequirementStatus([{ matchScore: 70 }, { matchScore: 20 }])).toBe("partial");
  });

  it("returns ready for 3+ strong matches", () => {
    expect(classifyRequirementStatus([{ matchScore: 70 }, { matchScore: 65 }, { matchScore: 90 }])).toBe("ready");
  });

  it("does not count sub-60 scores as strong", () => {
    expect(classifyRequirementStatus([{ matchScore: 59 }, { matchScore: 10 }])).toBe("zero");
  });
});

describe("rankAndCap", () => {
  it("filters out candidates below the floor and sorts descending", () => {
    const scored = [
      { candidateId: "a", matchScore: 30, rosterScore: 50 },
      { candidateId: "b", matchScore: 90, rosterScore: 50 },
      { candidateId: "c", matchScore: 55, rosterScore: 50 },
    ];
    expect(rankAndCap(scored).map((s) => s.candidateId)).toEqual(["b", "c"]);
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
