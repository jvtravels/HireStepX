import { describe, it, expect } from "vitest";
import { metricLeaders, sameAcross, summarizeComparison } from "../../app/(employer)/employer/requirements/[id]/_components/compareInsights";
import type { Candidate } from "../employer/mockData";

const REQ = ["React", "TypeScript"];
function cand(id: string, over: Partial<Candidate> = {}): Candidate {
  return {
    id, name: `Candidate #${id}`, initials: "C", unlocked: false, skills: ["React"], matchScore: 50, sessionsCompleted: 0, rosterScore: 0,
    lastActiveDaysAgo: 1, targetRole: "Engineer", city: "Pune", ...over,
  } as unknown as Candidate;
}

describe("metricLeaders", () => {
  it("marks a clear leader and nobody on a near tie", () => {
    expect([...metricLeaders([cand("a", { matchScore: 56 }), cand("b", { matchScore: 49 })], REQ, "match")]).toEqual(["a"]);
    expect(metricLeaders([cand("a", { matchScore: 52 }), cand("b", { matchScore: 50 })], REQ, "match").size).toBe(0);
  });
  it("ignores candidates with no graded interviews and needs two scores to lead", () => {
    const a = cand("a", { sessionsCompleted: 3, rosterScore: 63 });
    const b = cand("b", { sessionsCompleted: 0 });
    expect(metricLeaders([a, b], REQ, "interview").size).toBe(0);
    expect([...metricLeaders([a, cand("c", { sessionsCompleted: 2, rosterScore: 33 })], REQ, "interview")]).toEqual(["a"]);
  });
});

describe("summarizeComparison", () => {
  const a = cand("a", { matchScore: 56, sessionsCompleted: 1, rosterScore: 33 });
  const b = cand("b", { matchScore: 49, sessionsCompleted: 4, rosterScore: 63 });
  it("describes the split without naming a winner", () => {
    const s = summarizeComparison([a, b], REQ);
    const text = s.differences.map((d) => `${d.title} ${d.body}`).join(" ");
    expect(text).toContain("They split");
    expect(text).toContain("Neither lists TypeScript");
    expect(s.leads.get("a")).toBe(1);
    expect(s.leads.get("b")).toBe(2);
    expect(text).not.toMatch(/best|winner|hire (him|her|them)/i);
  });
  it("suggests questions for missing skills and weak interview scores, capped at three", () => {
    const s = summarizeComparison([a, b, cand("c", { rosterScore: 20, sessionsCompleted: 2 })], REQ);
    expect(s.questions.length).toBeLessThanOrEqual(3);
    expect(s.questions[0].title).toContain("TypeScript");
  });
  it("says so when candidates are close", () => {
    expect(summarizeComparison([cand("a"), cand("b")], []).differences).toEqual([]);
  });
});

describe("sameAcross", () => {
  it("is true only when every candidate has the same value", () => {
    expect(sameAcross([cand("a"), cand("b")], (c) => c.city)).toBe(true);
    expect(sameAcross([cand("a"), cand("b", { city: "Delhi" })], (c) => c.city)).toBe(false);
  });
});
