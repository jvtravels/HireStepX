import { describe, it, expect } from "vitest";
import { buildProfileSummary } from "../../app/(employer)/employer/requirements/[id]/candidates/[candidateId]/_components/helpers";
import type { CandidateEvidence } from "../employer/EmployerDataContext";
import type { Candidate } from "../employer/mockData";

function candidate(over: Partial<Candidate> = {}, resume: Partial<NonNullable<Candidate["resume"]>> = {}): Candidate {
  return {
    id: "m-1",
    name: "A B",
    targetRole: "Backend Engineer",
    city: "Pune",
    rosterScore: 0,
    sessionsCompleted: 0,
    resume: { summary: "I am a rockstar", headline: null, seniorityLevel: "Senior", yearsExperience: 6, keyAchievements: [], industries: ["Fintech"], experience: [{ title: "Backend Engineer", company: "Acme Corp", period: "Jan 2020 - Jan 2022" }, { title: "SDE", company: "Beta Ltd", period: "Jan 2022 - Jan 2024" }], education: [], certifications: [], skillsDetailed: [{ name: "node", depth: "primary" }], noticePeriod: null, currentCtc: null, ...resume },
    ...over,
  } as unknown as Candidate;
}
const req = { title: "Backend Engineer", skills: ["Node", "SQL", "Go"] };

describe("buildProfileSummary", () => {
  it("gives three plain lines: who, skill fit, practice", () => {
    const evidence = { skills: [], questions: [{ question: "Q", score: 75 }], readiness: { band: "hire", confidence: "high" } } as unknown as CandidateEvidence;
    const out = buildProfileSummary(candidate({ sessionsCompleted: 2, rosterScore: 63 }), req, ["Node"], evidence)!;
    expect(out).toHaveLength(3);
    expect(out[0]).toBe("Senior-level, 4 years of experience, in Pune, strongest in node.");
    expect(out[1]).toBe("Has 1 of 3 skills this job asks for; missing SQL, Go.");
    expect(out[2]).toMatch(/^Did 2 graded practice interviews/);
    expect(out.join(" ")).not.toMatch(/Acme|Beta|rockstar|CTC|notice/);
  });

  it("says plainly when there is no practice and skips lines without data", () => {
    const sparse = candidate({ city: "Not specified" }, { seniorityLevel: null, yearsExperience: null, industries: [], experience: [], skillsDetailed: [] });
    expect(buildProfileSummary(sparse, { title: "X", skills: [] }, [], null)).toEqual(["No graded practice interview yet."]);
    expect(buildProfileSummary(candidate({ resume: undefined }), req, [], null)).toBeNull();
  });
});
