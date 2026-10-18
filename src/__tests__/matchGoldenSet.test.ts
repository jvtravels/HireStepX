import { describe, it, expect } from "vitest";
import {
  scoreCandidateMatch,
  rankAndCap,
  STRONG_MATCH_THRESHOLD,
  type CandidatePoolRow,
  type RequirementInput,
} from "../../server-handlers/_requirement-match-helpers";

/* A small hand-labelled set of synthetic requirements and candidates. It pins
 * the behaviour employers rely on: the people a recruiter would call strong
 * rank above everyone else, an unrelated profile is never surfaced, and a
 * candidate who shares the job title but none of the listed skills never
 * reaches the strong tier. If a scoring change moves a label here, that is a
 * product decision to make deliberately, not a side effect. */

type Label = "strong" | "weak" | "not";

interface Fixture {
  name: string;
  label: Label;
  candidate: CandidatePoolRow;
}

const cand = (id: string, over: Partial<CandidatePoolRow>): CandidatePoolRow => ({
  id, name: id, target_role: null, industry: null, resume_data: {}, avg_score: null,
  sessions_completed: 0, last_active_days_ago: 5, years_experience: null, ...over,
});

const FRONTEND: RequirementInput = {
  title: "Frontend Developer",
  location: "Bengaluru",
  description: "Build accessible React interfaces.",
  skills: ["React", "TypeScript", "CSS"],
};

const DATA_ANALYST: RequirementInput = {
  title: "Data Analyst",
  location: "Mumbai",
  description: "Report on product metrics.",
  skills: ["SQL", "Excel", "Tableau"],
  experienceMin: 2,
  experienceMax: 5,
};

const frontendSet: Fixture[] = [
  { name: "exact role, all skills, graded sessions", label: "strong", candidate: cand("f1", { target_role: "Frontend Developer", resume_data: { skills: ["React", "TypeScript", "CSS", "Redux"], location: "Bengaluru" }, sessions_completed: 5, avg_score: 78 }) },
  { name: "exact role, two of three skills", label: "strong", candidate: cand("f2", { target_role: "Frontend Developer", resume_data: { skills: ["React", "TypeScript"], location: "Bengaluru" }, sessions_completed: 2, avg_score: 70 }) },
  { name: "adjacent role, all skills, other city", label: "strong", candidate: cand("f3", { target_role: "Frontend Engineer", resume_data: { skills: ["React", "TypeScript", "CSS"], location: "Pune" }, sessions_completed: 3, avg_score: 74 }) },
  { name: "loose role, one skill", label: "weak", candidate: cand("f4", { target_role: "Developer", resume_data: { skills: ["React"] } }) },
  { name: "exact role, no listed skills", label: "weak", candidate: cand("f5", { target_role: "Frontend Developer", resume_data: { skills: ["Figma", "Sketch"] } }) },
  { name: "unrelated field", label: "not", candidate: cand("f6", { target_role: "Chef", resume_data: { skills: ["Baking", "Menu planning"], location: "Bengaluru" }, sessions_completed: 4, avg_score: 85 }) },
  { name: "unrelated field, matching city only", label: "not", candidate: cand("f7", { target_role: "Accountant", resume_data: { skills: ["Tally", "GST"], location: "Bengaluru" } }) },
  { name: "no profile content at all", label: "not", candidate: cand("f8", { target_role: "Frontend Developer", resume_data: {} }) },
];

const analystSet: Fixture[] = [
  { name: "exact role, all skills, in band", label: "strong", candidate: cand("a1", { target_role: "Data Analyst", resume_data: { skills: ["SQL", "Excel", "Tableau", "Python"], location: "Mumbai" }, sessions_completed: 4, avg_score: 76, years_experience: 3 }) },
  { name: "business analyst with two skills", label: "strong", candidate: cand("a2", { target_role: "Business Analyst", resume_data: { skills: ["SQL", "Excel"], location: "Mumbai" }, sessions_completed: 3, avg_score: 72, years_experience: 4 }) },
  { name: "exact role, no listed skills", label: "weak", candidate: cand("a3", { target_role: "Data Analyst", resume_data: { skills: ["Photoshop"] } }) },
  { name: "unrelated field with graded sessions", label: "not", candidate: cand("a4", { target_role: "Graphic Designer", resume_data: { skills: ["Photoshop", "Illustrator"] }, sessions_completed: 6, avg_score: 90 }) },
  { name: "unrelated field, one stray shared word", label: "not", candidate: cand("a5", { target_role: "Sales Executive", resume_data: { skills: ["Negotiation", "CRM"], location: "Mumbai" } }) },
];

const SETS: Array<{ name: string; req: RequirementInput; fixtures: Fixture[] }> = [
  { name: "Frontend Developer", req: FRONTEND, fixtures: frontendSet },
  { name: "Data Analyst", req: DATA_ANALYST, fixtures: analystSet },
];

function classify(req: RequirementInput, f: Fixture): Label {
  const s = scoreCandidateMatch(f.candidate, req);
  const { ranked } = rankAndCap([s]);
  if (ranked.length === 0) return "not";
  const score = ranked[0].matchScore;
  return score >= STRONG_MATCH_THRESHOLD && ranked[0].skillsSupportStrong !== false ? "strong" : "weak";
}

describe("golden set shape", () => {
  it("has at least 12 labelled fixtures covering every class", () => {
    const all = SETS.flatMap((s) => s.fixtures);
    expect(all.length).toBeGreaterThanOrEqual(12);
    for (const l of ["strong", "weak", "not"] as Label[]) expect(all.some((f) => f.label === l)).toBe(true);
  });
});

describe.each(SETS)("golden set: $name", ({ req, fixtures }) => {
  it.each(fixtures.map((f) => [f.name, f] as const))("classifies: %s", (_n, f) => {
    expect(classify(req, f)).toBe(f.label);
  });

  it("precision@k is 1 where k is the number of strong candidates", () => {
    const strongIds = new Set(fixtures.filter((f) => f.label === "strong").map((f) => f.candidate.id));
    const { ranked } = rankAndCap(fixtures.map((f) => scoreCandidateMatch(f.candidate, req)));
    const k = strongIds.size;
    const topK = ranked.slice(0, k).map((r) => r.candidateId);
    const hits = topK.filter((id) => strongIds.has(id)).length;
    expect(hits / k).toBe(1);
  });

  it("recall: every strong candidate is surfaced", () => {
    const { ranked } = rankAndCap(fixtures.map((f) => scoreCandidateMatch(f.candidate, req)));
    const surfaced = new Set(ranked.map((r) => r.candidateId));
    for (const f of fixtures.filter((x) => x.label === "strong")) expect(surfaced.has(f.candidate.id)).toBe(true);
  });

  it("never surfaces an unrelated profile, however good its practice record", () => {
    const { ranked } = rankAndCap(fixtures.map((f) => scoreCandidateMatch(f.candidate, req)));
    const surfaced = new Set(ranked.map((r) => r.candidateId));
    for (const f of fixtures.filter((x) => x.label === "not")) expect(surfaced.has(f.candidate.id)).toBe(false);
  });
});

describe("skill gate", () => {
  it("a candidate with the right title but no listed skill is never strong, even with a perfect practice record and location", () => {
    const c = cand("gate", {
      target_role: "Frontend Developer",
      resume_data: { skills: ["Figma"], location: "Bengaluru" },
      sessions_completed: 10, avg_score: 95, last_active_days_ago: 0,
    });
    const s = scoreCandidateMatch(c, FRONTEND);
    expect(s.skillsSupportStrong).toBe(false);
    const { ranked } = rankAndCap([s]);
    for (const r of ranked) expect(r.skillsSupportStrong).toBe(false);
    expect(classify(FRONTEND, { name: "gate", label: "weak", candidate: c })).not.toBe("strong");
  });

  it("a perfect model opinion cannot lift an unsupported candidate into the strong tier", async () => {
    const { blendDeterministicWithLlm, capUnsupportedStrong } = await import("../../server-handlers/_requirement-match-helpers");
    const c = cand("gate2", { target_role: "Frontend Developer", resume_data: { skills: ["Figma"] } });
    const s = scoreCandidateMatch(c, FRONTEND);
    const finalScore = capUnsupportedStrong(blendDeterministicWithLlm(s.matchScore, 100), s.skillsSupportStrong);
    expect(finalScore).toBeLessThan(STRONG_MATCH_THRESHOLD);
  });

  it("covering the listed skills is what separates the strong candidate from the weak one at the same title", () => {
    const withSkills = scoreCandidateMatch(frontendSet[1].candidate, FRONTEND);
    const without = scoreCandidateMatch(frontendSet[4].candidate, FRONTEND);
    expect(withSkills.skillsSupportStrong).toBe(true);
    expect(without.skillsSupportStrong).toBe(false);
    expect(withSkills.matchScore).toBeGreaterThan(without.matchScore);
  });
});
