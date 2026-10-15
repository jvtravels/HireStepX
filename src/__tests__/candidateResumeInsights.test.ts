import { describe, it, expect } from "vitest";
import { averageTenureMonths, buildResumeInsights, buildRoleFit, describeDelivery, formatTenure, noticeDays, summarizeQuestions } from "../../app/(employer)/employer/requirements/[id]/candidates/[candidateId]/_components/helpers";
import type { CandidateEvidence, EvidenceQuestion } from "../employer/EmployerDataContext";
import type { Candidate, Requirement } from "../employer/mockData";

const requirement = { skills: ["Figma", "Python", "SQL"] } as unknown as Requirement;

function candidate(over: Partial<Candidate> = {}, resume: Partial<NonNullable<Candidate["resume"]>> = {}): Candidate {
  return {
    id: "m-1",
    name: "A B",
    targetRole: "Product Designer",
    city: "Pune",
    sessionsCompleted: 2,
    resume: { summary: "", headline: "", seniorityLevel: "Senior", yearsExperience: 7, keyAchievements: [], industries: [], experience: [], education: [], certifications: [], ...resume },
    ...over,
  } as unknown as Candidate;
}

describe("buildResumeInsights", () => {
  it("does not repeat seniority already present in the target role", () => {
    const out = buildResumeInsights(candidate({ targetRole: "Senior Product Designer" }), requirement, [], []);
    expect(out.snapshot.startsWith("Senior Product Designer with 7 years")).toBe(true);
    expect(out.snapshot).not.toContain("Senior Senior");
  });

  it("flags unmatched required skills as a concern and something to validate", () => {
    const out = buildResumeInsights(candidate(), requirement, ["Figma"], ["Python", "SQL"]);
    expect(out.strengths[0]).toContain("Lists 1 of 3 required skills");
    expect(out.concerns).toContain("Not on the resume: Python, SQL.");
    expect(out.validate).toContain("Hands-on examples of Python, SQL.");
  });

  it("leaves practice-interview facts to the Evidence tab", () => {
    for (const sessionsCompleted of [0, 3]) {
      const out = buildResumeInsights(candidate({ sessionsCompleted }), requirement, [], []);
      expect([...out.strengths, ...out.concerns].join(" ")).not.toMatch(/practice|mock interview/i);
    }
  });

  it("leaves self-reported notice and CTC to the header and caps each list at four", () => {
    const out = buildResumeInsights(candidate({}, { noticePeriod: "30 days", currentCtc: "32 LPA" }), requirement, [], ["Python"]);
    expect(out.validate.join(" ")).not.toMatch(/Notice period|Current CTC/);
    expect(out.strengths.length).toBeLessThanOrEqual(4);
    expect(out.concerns.length).toBeLessThanOrEqual(4);
    expect(out.validate.length).toBeLessThanOrEqual(4);
  });
});

describe("buildRoleFit", () => {
  const req = (over: Partial<Requirement> = {}) =>
    ({ skills: ["Figma", "Python", "SQL", "R"], experienceMin: 4, experienceMax: 8, locations: ["Pune"], workMode: "onsite", noticePeriodPref: "Up to 30 days", minReadinessBand: null, minStarCompleteness: null, ...over }) as unknown as Requirement;

  it("grades each criterion against the posting", () => {
    const rows = buildRoleFit(candidate({ unlocked: true }, { yearsExperience: 7, noticePeriod: "30 days" }), req(), ["Figma", "Python"], null);
    const by = Object.fromEntries(rows.map((r) => [r.id, r.status]));
    expect(by).toEqual({ skills: "partial", experience: "meets", location: "meets", notice: "meets" });
  });

  it("flags experience, location and notice gaps", () => {
    const rows = buildRoleFit(candidate({ unlocked: true, city: "Delhi" }, { yearsExperience: 1, noticePeriod: "3 months" }), req(), [], null);
    const by = Object.fromEntries(rows.map((r) => [r.id, r.status]));
    expect(by).toEqual({ skills: "gap", experience: "gap", location: "gap", notice: "gap" });
  });

  it("treats remote roles as a location match and hides resume rows while locked", () => {
    const rows = buildRoleFit(candidate({ unlocked: false, city: "Delhi" }), req({ workMode: "remote" }), ["Figma"], null);
    expect(rows.map((r) => r.id)).toEqual(["skills", "location"]);
    expect(rows[1].status).toBe("meets");
  });

  it("compares readiness and STAR to the posting's floor only when both sides exist", () => {
    const ev = { readiness: { band: "hire", confidence: "high" }, starCompleteness: { pct: 50, questionsConsidered: 4 }, skills: [] } as unknown as CandidateEvidence;
    const rows = buildRoleFit(candidate({ unlocked: true }), req({ minReadinessBand: "strongHire", minStarCompleteness: 60 }), [], ev);
    expect(rows.find((r) => r.id === "readiness")?.status).toBe("partial");
    expect(rows.find((r) => r.id === "star")?.status).toBe("partial");
    expect(buildRoleFit(candidate({ unlocked: true }), req({ minReadinessBand: "hire" }), [], null).some((r) => r.id === "readiness")).toBe(false);
  });

  it("parses free-text notice periods", () => {
    expect(noticeDays("Immediate joiner")).toBe(0);
    expect(noticeDays("2 months")).toBe(60);
    expect(noticeDays("4 weeks")).toBe(28);
    expect(noticeDays("negotiable")).toBeNull();
  });
});

describe("tenure helpers", () => {
  it("formats months as years and months", () => {
    expect(formatTenure(7)).toBe("7 mo");
    expect(formatTenure(12)).toBe("1 yr");
    expect(formatTenure(16)).toBe("1 yr 4 mo");
    expect(formatTenure(36)).toBe("3 yrs");
  });

  it("averages only the periods it can read", () => {
    expect(averageTenureMonths([{ period: "Jan 2020 - Jan 2022" }, { period: "Jan 2022 - Jan 2023" }, { period: "sometime" }])).toBe(18);
    expect(averageTenureMonths([{ period: "unknown" }])).toBeNull();
    expect(averageTenureMonths([])).toBeNull();
  });
});

describe("describeDelivery", () => {
  it("returns nothing when no delivery was measured", () => {
    expect(describeDelivery(null)).toEqual([]);
    expect(describeDelivery({ paceWpm: null, fillersPerMin: null, pausePct: null, responseSec: null, hedgesPerMin: null })).toEqual([]);
  });

  it("labels each reading in plain language", () => {
    const rows = describeDelivery({ paceWpm: 140, fillersPerMin: 1.5, pausePct: 5, responseSec: 2, hedgesPerMin: 1 });
    expect(rows.map((r) => [r.id, r.note, r.tone])).toEqual([
      ["pace", "Easy to follow", "success"],
      ["fillers", "Low", "success"],
      ["response", "Quick", "success"],
      ["pauses", "Steady", "success"],
      ["hedges", "Confident", "success"],
    ]);
  });

  it("flags the awkward ends of each scale", () => {
    const rows = describeDelivery({ paceWpm: 200, fillersPerMin: 9, pausePct: 40, responseSec: 8, hedgesPerMin: 7 });
    expect(rows.map((r) => r.tone)).toEqual(["warning", "error", "warning", "error", "error"]);
    expect(describeDelivery({ paceWpm: 80, fillersPerMin: null, pausePct: null, responseSec: null, hedgesPerMin: null })[0]).toMatchObject({ note: "Slow", tone: "warning" });
  });
});

describe("summarizeQuestions", () => {
  const q = (over: Partial<EvidenceQuestion>): EvidenceQuestion => ({ idx: 0, question: "Q", score: 70, verdict: "complete", difficulty: null, star: null, length: null, ...over });
  const full = { S: true, T: true, A: true, R: true };

  it("ignores skipped questions and counts verdicts and full STAR answers", () => {
    const out = summarizeQuestions([q({ score: 90, verdict: "strong", star: full }), q({ score: 50, verdict: "weak", star: { ...full, R: false } }), q({ score: 0, verdict: "skipped" }), q({ score: 70 })]);
    expect(out).toEqual({ count: 3, avg: 70, strong: 2, weak: 1, fullStar: 1, starCounted: 2 });
  });

  it("is null when nothing was answered", () => {
    expect(summarizeQuestions([])).toBeNull();
    expect(summarizeQuestions([q({ verdict: "skipped" })])).toBeNull();
  });
});
