import { describe, it, expect } from "vitest";
import { buildProfileSummary } from "../../app/(employer)/employer/requirements/[id]/candidates/[candidateId]/_components/helpers";
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
  it("says who the candidate is, without scores, skill counts, hiring terms or the candidate's own text", () => {
    const out = buildProfileSummary(candidate({ sessionsCompleted: 3, rosterScore: 70 }, { noticePeriod: "30 days", expectedCtc: "24 LPA" }), req, ["Node"], null)!;
    expect(out).toContain("Senior candidate with 4 years of experience across Fintech, based in Pune, most recently Backend Engineer.");
    expect(out).toContain("Deepest in");
    expect(out).not.toMatch(/Covers|Scored|notice|CTC|Not yet shared|graded|Acme|Beta|rockstar/);
  });

  it("returns null for a sparse profile and when the resume is absent", () => {
    const sparse = candidate({ city: "Not specified" }, { seniorityLevel: null, yearsExperience: null, industries: [], experience: [], skillsDetailed: [] });
    expect(buildProfileSummary(sparse, { title: "X", skills: [] }, [], null)).toBeNull();
    expect(buildProfileSummary(candidate({ resume: undefined }), { title: "X", skills: [] }, [], null)).toBeNull();
  });
});
