import { describe, expect, it } from "vitest";
import type { Candidate } from "@/employer/mockData";
import { filterCandidates, isLowMatch } from "../../app/(employer)/employer/requirements/[id]/_components/candidateTableModel";

function cand(over: Partial<Candidate>): Candidate {
  return { id: "c1", unlocked: false, candidateStatus: "shortlisted", matchScore: 45, requiredSkillsMet: 2, city: "Pune", targetRole: "Engineer", skills: [], ...over } as Candidate;
}
const base = { search: "", contact: "all" as const, location: "all", tab: "all" as const, insight: null };

describe("low match bar", () => {
  it("flags scores under 20", () => {
    expect(isLowMatch(cand({ matchScore: 19 }), true)).toBe(true);
    expect(isLowMatch(cand({ matchScore: 20 }), true)).toBe(false);
  });

  it("flags zero required skills only when the job lists skills", () => {
    expect(isLowMatch(cand({ requiredSkillsMet: 0 }), true)).toBe(true);
    expect(isLowMatch(cand({ requiredSkillsMet: 0 }), false)).toBe(false);
    expect(isLowMatch(cand({ requiredSkillsMet: null }), true)).toBe(false);
  });

  it("never hides an unlocked or already-moved candidate", () => {
    expect(isLowMatch(cand({ matchScore: 5, unlocked: true }), true)).toBe(false);
    expect(isLowMatch(cand({ matchScore: 5, candidateStatus: "interview_invited" }), true)).toBe(false);
  });

  it("hides weak fits by default and shows them on request", () => {
    const list = [cand({ id: "a" }), cand({ id: "b", matchScore: 10 }), cand({ id: "c", requiredSkillsMet: 0 })];
    expect(filterCandidates(list, { ...base, jobHasSkills: true }).map((c) => c.id)).toEqual(["a"]);
    expect(filterCandidates(list, { ...base, jobHasSkills: true, showLow: true }).map((c) => c.id)).toEqual(["a", "b", "c"]);
  });

  it("narrows to strong matches and to candidates with every required skill", () => {
    const list = [
      cand({ id: "a", matchScore: 70, requiredSkillsMet: 3, requiredSkillsTotal: 3 }),
      cand({ id: "b", matchScore: 30, requiredSkillsMet: 3, requiredSkillsTotal: 3 }),
      cand({ id: "c", matchScore: 60, requiredSkillsMet: 2, requiredSkillsTotal: 3 }),
    ];
    expect(filterCandidates(list, { ...base, jobHasSkills: true, strongOnly: true }).map((c) => c.id)).toEqual(["a", "c"]);
    expect(filterCandidates(list, { ...base, jobHasSkills: true, allSkills: true }).map((c) => c.id)).toEqual(["a", "b"]);
    expect(filterCandidates(list, { ...base, jobHasSkills: true, strongOnly: true, allSkills: true }).map((c) => c.id)).toEqual(["a"]);
  });
});
