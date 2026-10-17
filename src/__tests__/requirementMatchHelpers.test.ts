import { describe, it, expect } from "vitest";
import {
  scoreCandidateMatch,
  classifyRequirementStatus,
  rankAndCap,
  hasMatchSignal,
  extractResumeLocation,
  extractSkills,
  describeMatch,
  MIN_MATCH_SCORE_FLOOR,
  STRONG_MATCH_THRESHOLD,
  skillsSupportStrong,
  countRequiredSkillsCovered,
  capUnsupportedStrong,
  hasStrongEvidence,
  hasResumeContent,
  explainMatch,
  matchBandLabel,
  CUSTOM_SKILL_BOOST_MAX,
  FAIR_MATCH_SCORE,
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

  it("credits skill overlap against the requirement's structured skills, not just title prose", () => {
    // Scoring now measures coverage of what the employer asked for, so the
    // comparison is between a candidate who covers the listed skills and one
    // with the same role who covers none of them.
    const skillsReq = { title: "Sales Executive", location: "Mumbai", description: "Drive new business for our team.", skills: ["B2B Sales", "CRM", "Negotiation"] };
    const covers = scoreCandidateMatch(
      candidate({ target_role: "Sales Executive", resume_data: { skills: ["B2B Sales", "CRM"], location: "Mumbai" } }),
      skillsReq,
    );
    const coversNone = scoreCandidateMatch(
      candidate({ target_role: "Sales Executive", resume_data: { skills: ["Photoshop", "Illustration"], location: "Mumbai" } }),
      skillsReq,
    );
    expect(covers.matchScore).toBeGreaterThan(coversNone.matchScore);
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
    // The JD description no longer feeds scoring, so the overlap both
    // candidates are weighed on has to live in the structured skill list.
    const salesReq = {
      title: "Sales Executive",
      location: "Mumbai",
      description: "Drive new business across SMB and mid-market accounts, manage a CRM pipeline.",
      skills: ["Customer Service", "CRM"],
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

  it("marks hasEvidence true when the candidate has a resume with content, even with zero sessions", () => {
    const result = scoreCandidateMatch(candidate({ resume_data: { skills: ["React"] }, sessions_completed: 0 }), req);
    expect(result.hasEvidence).toBe(true);
  });

  it("does not count a bare or empty resume object as evidence", () => {
    // Previously any non-null resume_data counted, so a parse that produced
    // nothing still lifted a candidate into the "has evidence" bucket.
    expect(scoreCandidateMatch(candidate({ resume_data: {}, sessions_completed: 0 }), req).hasEvidence).toBe(false);
    expect(scoreCandidateMatch(candidate({ resume_data: { skills: [] }, sessions_completed: 0 }), req).hasEvidence).toBe(false);
  });

  it("marks hasEvidence true when the candidate has completed sessions, even with no resume", () => {
    const result = scoreCandidateMatch(candidate({ resume_data: null, sessions_completed: 1 }), req);
    expect(result.hasEvidence).toBe(true);
  });

  it("marks hasEvidence false when the candidate has neither a resume nor any completed sessions", () => {
    const result = scoreCandidateMatch(candidate({ resume_data: null, sessions_completed: 0 }), req);
    expect(result.hasEvidence).toBe(false);
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
      { candidateId: "a", matchScore: 30, rosterScore: 50, hasRelevance: true, hasEvidence: true },
      { candidateId: "b", matchScore: 90, rosterScore: 50, hasRelevance: true, hasEvidence: true },
      { candidateId: "c", matchScore: 55, rosterScore: 50, hasRelevance: true, hasEvidence: true },
    ];
    expect(rankAndCap(scored).ranked.map((s) => s.candidateId)).toEqual(["b", "c", "a"]);
  });

  it("caps the result at the given size, but reports the true pre-cap pool size", () => {
    const scored = Array.from({ length: 30 }, (_, i) => ({ candidateId: String(i), matchScore: 80, rosterScore: 50, hasRelevance: true, hasEvidence: true }));
    const { ranked, totalMatched } = rankAndCap(scored, 5);
    expect(ranked).toHaveLength(5);
    expect(totalMatched).toBe(30);
  });

  it("filters out candidates with no real relevance, even under the cap", () => {
    const scored = [
      { candidateId: "relevant", matchScore: 45, rosterScore: 50, hasRelevance: true, hasEvidence: true },
      { candidateId: "noise-1", matchScore: 25, rosterScore: 90, hasRelevance: false, hasEvidence: true },
      { candidateId: "noise-2", matchScore: 6, rosterScore: 50, hasRelevance: false, hasEvidence: true },
    ];
    const { ranked, totalMatched } = rankAndCap(scored, 20);
    expect(ranked.map((s) => s.candidateId)).toEqual(["relevant"]);
    expect(totalMatched).toBe(1);
  });

  it("can legitimately return fewer than cap, including zero, when nothing is relevant", () => {
    const scored = [
      { candidateId: "noise-1", matchScore: 10, rosterScore: 50, hasRelevance: false, hasEvidence: true },
      { candidateId: "noise-2", matchScore: 6, rosterScore: 50, hasRelevance: false, hasEvidence: true },
    ];
    const { ranked, totalMatched } = rankAndCap(scored, 20);
    expect(ranked).toEqual([]);
    expect(totalMatched).toBe(0);
  });

  it("drops a candidate below MIN_MATCH_SCORE_FLOOR even when structurally relevant and evidenced", () => {
    // Regression for a 2026-10-07 production report: a "Top 20 of 27"
    // shortlist included scores as low as 13% — real per hasRelevance/
    // hasEvidence, but not a match worth presenting to an employer.
    const scored = [
      { candidateId: "real", matchScore: 45, rosterScore: 50, hasRelevance: true, hasEvidence: true },
      { candidateId: "below-floor", matchScore: MIN_MATCH_SCORE_FLOOR - 1, rosterScore: 50, hasRelevance: true, hasEvidence: true },
      { candidateId: "at-floor", matchScore: MIN_MATCH_SCORE_FLOOR, rosterScore: 50, hasRelevance: true, hasEvidence: true },
    ];
    const { ranked, totalMatched } = rankAndCap(scored, 20);
    expect(ranked.map((s) => s.candidateId)).toEqual(["real", "at-floor"]);
    expect(totalMatched).toBe(2);
  });

  it("filters out relevant candidates with no real evidence (no resume, no sessions)", () => {
    // Regression for the user-reported case: a candidate with "Not
    // specified" everywhere and a score of 12 showed up in the shortlist
    // because they cleared the relevance floor on a loose target_role
    // token alone, despite having nothing an employer could actually
    // review behind the profile.
    const scored = [
      { candidateId: "real", matchScore: 45, rosterScore: 50, hasRelevance: true, hasEvidence: true },
      { candidateId: "zero-evidence", matchScore: 12, rosterScore: 50, hasRelevance: true, hasEvidence: false },
    ];
    expect(rankAndCap(scored, 20).ranked.map((s) => s.candidateId)).toEqual(["real"]);
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

  it("reduces a location polluted by a neighbouring line to the known city", () => {
    expect(extractResumeLocation({ location: "Full Stack Developer Vikaspuri, New Delhi" })).toBe("New Delhi");
    expect(extractResumeLocation({ location: "Mumbai, Maharashtra" })).toBe("Mumbai");
    expect(extractResumeLocation({ location: "Navi Mumbai" })).toBe("Navi Mumbai");
  });

  it("does not match a city name inside a longer word", () => {
    expect(extractResumeLocation({ location: "Punekar Lane" })).toBe("Punekar Lane");
  });

  it("drops long free text that names no known city", () => {
    expect(extractResumeLocation({ location: "Senior Software Engineer at a fast growing fintech startup" })).toBe("");
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

describe("skills-overlap gate for the Strong tier", () => {
  const four = ["React", "TypeScript", "GraphQL", "Node.js"];

  it("counts a multi-word skill when at least half its tokens are present", () => {
    const c = candidate({ target_role: "Designer", resume_data: { skills: ["Sales"] } });
    expect(countRequiredSkillsCovered(c, ["B2B Sales"])).toBe(1);
    expect(countRequiredSkillsCovered(c, ["B2B Marketing Automation"])).toBe(0);
  });

  it("rejects a candidate covering 1 of 4 listed skills", () => {
    const c = candidate({ target_role: "Designer", resume_data: { skills: ["React"] } });
    expect(skillsSupportStrong(c, four)).toBe(false);
  });

  it("accepts 2 covered skills, or half of a short list", () => {
    const two = candidate({ target_role: "Designer", resume_data: { skills: ["React", "TypeScript"] } });
    expect(skillsSupportStrong(two, four)).toBe(true);
    const half = candidate({ target_role: "Designer", resume_data: { skills: ["React"] } });
    expect(skillsSupportStrong(half, ["React", "Figma"])).toBe(true);
  });

  it("applies the gate to short lists too: 0 or 1 listed skill no longer skips it", () => {
    const empty = candidate({ target_role: "Frontend Engineer", resume_data: { skills: [] } });
    // One listed skill must actually be covered.
    expect(skillsSupportStrong(empty, ["React"])).toBe(false);
    const react = candidate({ target_role: "Designer", resume_data: { skills: ["React"] } });
    expect(skillsSupportStrong(react, ["React"])).toBe(true);
    // No listed skills: the title's content words stand in for the list.
    expect(skillsSupportStrong(empty, undefined, "Frontend Engineer")).toBe(true);
    const unrelated = candidate({ target_role: "Product Designer", resume_data: { skills: ["Figma"] } });
    expect(skillsSupportStrong(unrelated, undefined, "Backend Engineer")).toBe(false);
    // Nothing to check against at all: never strong.
    expect(skillsSupportStrong(empty, undefined)).toBe(false);
  });

  it("caps an unsupported score just under Strong and leaves others alone", () => {
    expect(capUnsupportedStrong(80, false)).toBe(STRONG_MATCH_THRESHOLD - 1);
    expect(capUnsupportedStrong(30, false)).toBe(30);
    expect(capUnsupportedStrong(80, true)).toBe(80);
    expect(capUnsupportedStrong(80, undefined)).toBe(80);
  });

  it("keeps a role-perfect but 1-of-4-skills candidate out of Strong", () => {
    const wide = { ...req, skills: four };
    const thin = scoreCandidateMatch(candidate({ resume_data: { skills: ["React"], location: "Bengaluru" } }), wide);
    expect(thin.skillsSupportStrong).toBe(false);
    expect(thin.matchScore).toBeLessThan(STRONG_MATCH_THRESHOLD);
    const full = scoreCandidateMatch(candidate({ resume_data: { skills: ["React", "TypeScript", "GraphQL"], location: "Bengaluru" } }), wide);
    expect(full.skillsSupportStrong).toBe(true);
    expect(full.matchScore).toBeGreaterThanOrEqual(STRONG_MATCH_THRESHOLD);
  });
});

describe("strong match needs more than self-declared data", () => {
  const strongReq = { title: "Senior Frontend Engineer", location: "Bengaluru", description: "", skills: ["React", "TypeScript"] };

  it("a title-echoing target_role with no sessions and no resume skills is not Strong", () => {
    const echo = scoreCandidateMatch(
      candidate({ sessions_completed: 0, avg_score: null, resume_data: { location: "Bengaluru" } }),
      strongReq,
    );
    expect(echo.matchScore).toBeLessThan(STRONG_MATCH_THRESHOLD);
  });

  it("the same candidate becomes Strong once a graded session backs the role up", () => {
    const base = { avg_score: 80, resume_data: { skills: ["React", "TypeScript"], location: "Bengaluru" } };
    const without = scoreCandidateMatch(candidate({ ...base, sessions_completed: 0 }), strongReq);
    const withSession = scoreCandidateMatch(candidate({ ...base, sessions_completed: 3 }), strongReq);
    expect(withSession.matchScore).toBeGreaterThanOrEqual(STRONG_MATCH_THRESHOLD);
    expect(withSession.matchScore).toBeGreaterThanOrEqual(without.matchScore);
  });

  it("hasStrongEvidence accepts graded sessions or resume-skill overlap, never target_role alone", () => {
    expect(hasStrongEvidence({ resume_data: null, sessions_completed: 1 }, ["React"], "Frontend Engineer")).toBe(true);
    expect(hasStrongEvidence({ resume_data: { skills: ["React"] }, sessions_completed: 0 }, ["React"], "Frontend Engineer")).toBe(true);
    expect(hasStrongEvidence({ resume_data: { skills: ["Excel"] }, sessions_completed: 0 }, ["React"], "Frontend Engineer")).toBe(false);
    expect(hasStrongEvidence({ resume_data: null, sessions_completed: 0 }, ["React"], "Frontend Engineer")).toBe(false);
  });

  it("a one-skill requirement still needs that skill covered to support Strong", () => {
    expect(skillsSupportStrong({ target_role: "Designer", resume_data: { skills: ["Figma"] } }, ["React"], "Frontend Engineer")).toBe(false);
    expect(skillsSupportStrong({ target_role: "Designer", resume_data: { skills: ["React"] } }, ["React"], "Frontend Engineer")).toBe(true);
  });

  it("with no skills and a filler-only title nobody can be Strong", () => {
    expect(skillsSupportStrong({ target_role: "Engineer", resume_data: { skills: ["React"] } }, [], "The Role")).toBe(false);
  });
});

describe("requirement tokens and ratio normalisation", () => {
  it("a long pasted JD does not change the score (description is not a token source)", () => {
    const short = scoreCandidateMatch(candidate(), { title: "Senior Frontend Engineer", location: "Bengaluru", description: "", skills: ["React"] });
    const long = scoreCandidateMatch(candidate(), {
      title: "Senior Frontend Engineer", location: "Bengaluru", skills: ["React"],
      description: "We are a fast growing company with business impact, ownership, communication, teamwork and culture ".repeat(20),
    });
    expect(long.matchScore).toBe(short.matchScore);
  });

  it("a single coincidental token is not enough to clear the relevance floor", () => {
    const r = scoreCandidateMatch(
      candidate({ target_role: "Accountant", resume_data: { skills: ["Business"], location: "Bengaluru" }, sessions_completed: 0 }),
      { title: "Business Development Manager", location: "Bengaluru", description: "", skills: ["Negotiation", "CRM", "Lead generation", "B2B Sales"] },
    );
    expect(r.matchScore).toBeLessThan(MIN_MATCH_SCORE_FLOOR);
  });
});

describe("Other skills boost", () => {
  const baseReq = { title: "Senior Frontend Engineer", location: "Bengaluru", description: "", skills: ["React", "TypeScript"] };

  it("adds at most CUSTOM_SKILL_BOOST_MAX points to a relevant candidate", () => {
    const c = candidate({ resume_data: { skills: ["React", "TypeScript", "GraphQL", "Storybook", "Jest", "Webpack"], location: "Bengaluru" }, sessions_completed: 1, avg_score: 40 });
    const plain = scoreCandidateMatch(c, baseReq);
    const boosted = scoreCandidateMatch(c, { ...baseReq, customSkills: ["GraphQL", "Storybook", "Jest", "Webpack"] });
    expect(boosted.matchScore - plain.matchScore).toBeLessThanOrEqual(CUSTOM_SKILL_BOOST_MAX);
    expect(boosted.matchScore).toBeGreaterThanOrEqual(plain.matchScore);
  });

  it("does not lift an irrelevant candidate", () => {
    const c = candidate({ target_role: "Chef", resume_data: { skills: ["GraphQL"], location: "Bengaluru" }, sessions_completed: 0 });
    const plain = scoreCandidateMatch(c, baseReq);
    const boosted = scoreCandidateMatch(c, { ...baseReq, customSkills: ["GraphQL"] });
    expect(boosted.matchScore).toBe(plain.matchScore);
  });
});

describe("remote work mode", () => {
  it("workMode=remote makes location neutral even when the location text names a city", () => {
    const rq = { title: "Senior Frontend Engineer", location: "Pune", description: "", skills: ["React"], workMode: "remote" };
    const far = scoreCandidateMatch(candidate({ resume_data: { skills: ["React"], location: "Chennai" } }), rq);
    const near = scoreCandidateMatch(candidate({ resume_data: { skills: ["React"], location: "Pune" } }), rq);
    expect(far.matchScore).toBe(near.matchScore);
  });
});

describe("explainMatch signals", () => {
  const rq = { title: "Senior Frontend Engineer", location: "Bengaluru", description: "", skills: ["React"], experienceMin: 3, experienceMax: 6 };

  it("omits experience and sessions when the caller gives no signals", () => {
    const b = explainMatch(candidate(), rq);
    expect(b.experienceMatch).toBeUndefined();
    expect(b.verifiedSessions).toBeUndefined();
  });

  it("scores experience inside the band at 100 and outside at 60", () => {
    expect(explainMatch(candidate(), rq, { yearsExperience: 4 }).experienceMatch).toBe(100);
    expect(explainMatch(candidate(), rq, { yearsExperience: 15 }).experienceMatch).toBe(60);
  });

  it("reports null when experience is unreadable or no band is set, and passes sessions through", () => {
    expect(explainMatch(candidate(), rq, { yearsExperience: null }).experienceMatch).toBeNull();
    expect(explainMatch(candidate(), { ...rq, experienceMin: null, experienceMax: null }, { yearsExperience: 4 }).experienceMatch).toBeNull();
    expect(explainMatch(candidate(), rq, { verifiedSessions: 3 }).verifiedSessions).toBe(3);
  });
});

describe("matchBandLabel / hasResumeContent", () => {
  it("labels by the shared thresholds", () => {
    expect(matchBandLabel(STRONG_MATCH_THRESHOLD)).toBe("Strong");
    expect(matchBandLabel(STRONG_MATCH_THRESHOLD - 1)).toBe("Good");
    expect(matchBandLabel(FAIR_MATCH_SCORE)).toBe("Good");
    expect(matchBandLabel(FAIR_MATCH_SCORE - 1)).toBe("Possible");
  });

  it("treats an empty parse as no content", () => {
    expect(hasResumeContent({})).toBe(false);
    expect(hasResumeContent(null)).toBe(false);
    expect(hasResumeContent({ summary: "  " })).toBe(false);
    expect(hasResumeContent({ summary: "Ten years in sales" })).toBe(true);
    expect(hasResumeContent({ experience: [{ title: "x" }] })).toBe(true);
    expect(hasResumeContent({ yearsExperience: 4 })).toBe(true);
  });
});
