import { describe, it, expect } from "vitest";
import {
  scoreCandidateMatch,
  classifyRequirementStatus,
  rankAndCap,
  hasMatchSignal,
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

  it("credits skill overlap against the requirement's structured skills, not just title/description prose", () => {
    const skillsReq = { title: "Sales Executive", location: "Mumbai", description: "Drive new business for our team.", skills: ["B2B Sales", "CRM", "Negotiation"] };
    const matchingSkills = scoreCandidateMatch(
      candidate({ target_role: "Sales Executive", resume_data: { skills: ["B2B Sales", "CRM"], location: "Mumbai" } }),
      skillsReq,
    );
    const noSkillsField = scoreCandidateMatch(
      candidate({ target_role: "Sales Executive", resume_data: { skills: ["B2B Sales", "CRM"], location: "Mumbai" } }),
      { ...skillsReq, skills: undefined },
    );
    expect(matchingSkills.matchScore).toBeGreaterThan(noSkillsField.matchScore);
  });

  it("gates roster/activity credit behind a minimum fit floor so an irrelevant candidate can't score well on activity alone", () => {
    const irrelevant = scoreCandidateMatch(
      candidate({
        target_role: "Product Manager",
        resume_data: { skills: ["Roadmapping", "Stakeholder Management"] },
        avg_score: 95,
        sessions_completed: 10,
      }),
      req,
    );
    expect(irrelevant.matchScore).toBeLessThan(30);
  });

  it("does not gate roster/activity credit for a candidate who clears the fit floor", () => {
    const relevant = scoreCandidateMatch(candidate({ avg_score: 95, sessions_completed: 10 }), req);
    const sameButNoRoster = scoreCandidateMatch(candidate({ avg_score: 50, sessions_completed: 0 }), req);
    expect(relevant.matchScore).toBeGreaterThan(sameButNoRoster.matchScore);
  });

  it("gives no roster credit to a candidate with zero completed sessions, even past the relevance floor", () => {
    // Regression for a 2026-10-04 production report: a candidate with zero
    // practice sessions (avg_score null, falling back to a "neutral" 50)
    // outranked candidates with real, lower-scoring practice history purely
    // because the neutral default was credited as if it were evidence.
    const noEvidence = scoreCandidateMatch(candidate({ avg_score: null, sessions_completed: 0 }), req);
    const withWeakEvidence = scoreCandidateMatch(candidate({ avg_score: 40, sessions_completed: 1 }), req);
    expect(withWeakEvidence.matchScore).toBeGreaterThan(noEvidence.matchScore);
  });

  it("ranks a candidate with real (even modest) practice evidence above a same-fit candidate with none", () => {
    const salesReq = {
      title: "Sales Executive",
      location: "Mumbai",
      description: "Drive new business across SMB and mid-market accounts, manage a CRM pipeline.",
    };
    // Mirrors the production case: neither candidate has a strong role/skill
    // match (weak, generic overlap only), but one has actually practiced.
    const zeroEvidenceCandidate = scoreCandidateMatch(
      candidate({ target_role: "", resume_data: { skills: ["Business Transformation", "Growth"] }, avg_score: null, sessions_completed: 0 }),
      salesReq,
    );
    const realEvidenceCandidate = scoreCandidateMatch(
      candidate({ target_role: "Customer Support Executive", resume_data: { skills: ["Customer Service", "Marketing"] }, avg_score: 92, sessions_completed: 1 }),
      salesReq,
    );
    expect(realEvidenceCandidate.matchScore).toBeGreaterThan(zeroEvidenceCandidate.matchScore);
  });

  it("does not mark a candidate relevant on a location match alone", () => {
    const salesReq = {
      title: "Sales Executive",
      location: "Mumbai",
      description: "Drive new business across SMB and mid-market accounts, manage a CRM pipeline.",
    };
    const sameCityDesignEngineer = scoreCandidateMatch(
      candidate({ target_role: "Design Engineer", resume_data: { skills: ["Figma", "Canva"], location: "Mumbai" } }),
      salesReq,
    );
    expect(sameCityDesignEngineer.hasRelevance).toBe(false);
  });

  it("does not mark a candidate relevant on one generic token diluted among unrelated skills", () => {
    const salesReq = {
      title: "Sales Executive",
      location: "Mumbai",
      description: "Drive new business across SMB and mid-market accounts, manage a CRM pipeline.",
      skills: ["B2B Sales", "CRM", "Negotiation", "Lead Generation"],
    };
    const backendEngineer = scoreCandidateMatch(
      candidate({
        target_role: "Senior Software Engineer",
        resume_data: {
          skills: ["Java", "Spring Boot", "MongoDB", "REST APIs", "Microservices", "B2B Partner Integrations"],
          location: "Mumbai",
        },
      }),
      salesReq,
    );
    expect(backendEngineer.hasRelevance).toBe(false);

    const dataAnalyst = scoreCandidateMatch(
      candidate({
        target_role: "Data Analytics Professional",
        resume_data: { skills: ["SQL", "Power BI", "Advanced Excel", "MIS Reporting", "Business Intelligence"], location: "Mumbai" },
      }),
      salesReq,
    );
    expect(dataAnalyst.hasRelevance).toBe(false);

    const salesIntern = scoreCandidateMatch(
      candidate({ target_role: "Sales Assistant Intern", resume_data: { skills: ["Communication", "Customer Service"], location: "Mumbai" } }),
      salesReq,
    );
    expect(salesIntern.hasRelevance).toBe(true);
  });

  it("applies a soft penalty when a candidate's experience is well outside the requirement's band", () => {
    const bandedReq = { ...req, experienceMin: 5, experienceMax: 8 };
    const junior = scoreCandidateMatch(candidate({ years_experience: 0 }), bandedReq);
    const inBand = scoreCandidateMatch(candidate({ years_experience: 6 }), bandedReq);
    expect(junior.matchScore).toBeLessThan(inBand.matchScore);
  });

  it("does not penalize unknown experience against an experience band", () => {
    const bandedReq = { ...req, experienceMin: 5, experienceMax: 8 };
    const unknown = scoreCandidateMatch(candidate({ years_experience: null }), bandedReq);
    const inBand = scoreCandidateMatch(candidate({ years_experience: 6 }), bandedReq);
    expect(unknown.matchScore).toBe(inBand.matchScore);
  });

  it("tolerates small overshoots at the edge of the experience band without penalty", () => {
    const bandedReq = { ...req, experienceMin: 2, experienceMax: 5 };
    const justOver = scoreCandidateMatch(candidate({ years_experience: 6 }), bandedReq);
    const inBand = scoreCandidateMatch(candidate({ years_experience: 5 }), bandedReq);
    expect(justOver.matchScore).toBe(inBand.matchScore);
  });

  it("matches plural/gerund skill variants via stemming (e.g. prototyping vs prototypes)", () => {
    const designReq = { title: "Product Designer", location: "Bengaluru", description: "Own prototyping and design systems work.", skills: ["Prototyping", "Design Systems"] };
    const result = scoreCandidateMatch(
      candidate({ target_role: "Product Designer", resume_data: { skills: ["Prototypes", "Design System"], location: "Bengaluru" } }),
      designReq,
    );
    expect(result.matchScore).toBeGreaterThanOrEqual(60);
  });

  it("does not corrupt words ending in 'ss' via the plural-stripping stem (e.g. business)", () => {
    const bizReq = { title: "Business Analyst", location: "Remote", description: "Own core business processes." };
    const result = scoreCandidateMatch(candidate({ target_role: "Business Analyst", resume_data: {} }), bizReq);
    expect(result.matchScore).toBeGreaterThan(0);
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
  it("sorts descending", () => {
    const scored = [
      { candidateId: "a", matchScore: 30, rosterScore: 50, hasRelevance: true },
      { candidateId: "b", matchScore: 90, rosterScore: 50, hasRelevance: true },
      { candidateId: "c", matchScore: 55, rosterScore: 50, hasRelevance: true },
    ];
    expect(rankAndCap(scored).map((s) => s.candidateId)).toEqual(["b", "c", "a"]);
  });

  it("caps the result at the given size", () => {
    const scored = Array.from({ length: 30 }, (_, i) => ({ candidateId: String(i), matchScore: 80, rosterScore: 50, hasRelevance: true }));
    expect(rankAndCap(scored, 5)).toHaveLength(5);
  });

  it("filters out candidates with no real relevance, even under the cap", () => {
    const scored = [
      { candidateId: "relevant", matchScore: 45, rosterScore: 50, hasRelevance: true },
      { candidateId: "noise-1", matchScore: 25, rosterScore: 90, hasRelevance: false },
      { candidateId: "noise-2", matchScore: 6, rosterScore: 50, hasRelevance: false },
    ];
    expect(rankAndCap(scored, 20).map((s) => s.candidateId)).toEqual(["relevant"]);
  });

  it("can legitimately return fewer than cap, including zero, when nothing is relevant", () => {
    const scored = [
      { candidateId: "noise-1", matchScore: 10, rosterScore: 50, hasRelevance: false },
      { candidateId: "noise-2", matchScore: 6, rosterScore: 50, hasRelevance: false },
    ];
    expect(rankAndCap(scored, 20)).toEqual([]);
  });
});

describe("hasMatchSignal", () => {
  it("is true when only target_role is set", () => {
    expect(hasMatchSignal(candidate({ target_role: "Backend Engineer", resume_data: null }))).toBe(true);
  });

  it("is true when only resume_data is set", () => {
    expect(hasMatchSignal(candidate({ target_role: null, resume_data: { skills: ["Go"] } }))).toBe(true);
  });

  it("is false when neither target_role nor resume_data is set", () => {
    expect(hasMatchSignal(candidate({ target_role: null, resume_data: null }))).toBe(false);
  });

  it("is false when target_role is whitespace-only and resume_data is unset", () => {
    expect(hasMatchSignal(candidate({ target_role: "   ", resume_data: null }))).toBe(false);
  });

  it("is true when both are set", () => {
    expect(hasMatchSignal(candidate())).toBe(true);
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
