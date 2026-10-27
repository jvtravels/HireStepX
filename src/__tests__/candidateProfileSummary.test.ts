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
  it("composes resume, skills, hiring and gap facts without company names or the candidate's own text", () => {
    const out = buildProfileSummary(candidate({}, { noticePeriod: "30 days", expectedCtc: "24 LPA", workModePref: "hybrid", openToRelocate: true }), req, ["Node"], null)!;
    expect(out).toContain("Senior candidate with 6 years of experience across Fintech, based in Pune, most recently Backend Engineer.");
    expect(out).toContain("Covers 1 of 3 skills this role asks for (Node); missing SQL, Go.");
    expect(out).toContain("Deepest in");
    expect(out).toContain("30-day notice, expects 24 LPA");
    expect(out).toContain("prefers hybrid work");
    expect(out).toContain("Not yet shared: current CTC.");
    expect(out).toContain("Has not completed a graded practice interview yet.");
    expect(out).not.toMatch(/Acme|Beta|rockstar/);
  });

  it("states practice results only when graded sessions exist", () => {
    const evidence = { skills: [{ name: "System design", score: 82 }, { name: "SQL", score: 55 }], readiness: { band: "hire", confidence: "high" } } as unknown as CandidateEvidence;
    const out = buildProfileSummary(candidate({ sessionsCompleted: 3, rosterScore: 70 }), req, [], evidence)!;
    expect(out).toMatch(/Scored 70 across 3 graded practice interviews, rated .*; strongest on System design \(82\), weakest on SQL \(55\)\./);
    expect(out).not.toContain("Has not completed");
  });

  it("returns only what exists for a sparse profile", () => {
    const out = buildProfileSummary(candidate({ city: "Not specified" }, { seniorityLevel: null, yearsExperience: null, industries: [], experience: [], skillsDetailed: [] }), { title: "X", skills: [] }, [], null)!;
    expect(out).toBe("Has not completed a graded practice interview yet. Not yet shared: notice period, current CTC, expected CTC.");
  });

  it("still reports practice status when the resume is absent", () => {
    expect(buildProfileSummary(candidate({ resume: undefined }), { title: "X", skills: [] }, [], null)).not.toBeNull();
  });
});
