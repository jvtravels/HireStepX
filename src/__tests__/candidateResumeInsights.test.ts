import { describe, it, expect } from "vitest";
import { averageTenureMonths, buildEvidenceSummary, buildResumeInsights, buildRoleFit, cleanQuestionText, dedupeQuestions, describeDelivery, employerCapabilities, formatTenure, formatYears, matchedSkillCount, groupSkillsByDepth, noticeDays, skillChipLabel, sortFitRows, summarizeFit, summarizeQuestions } from "../../app/(employer)/employer/requirements/[id]/candidates/[candidateId]/_components/helpers";
import type { CandidateEvidence, EvidenceQuestion } from "../employer/EmployerDataContext";
import type { Candidate, Requirement } from "../employer/mockData";

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
    const out = buildResumeInsights(candidate({ targetRole: "Senior Product Designer" }), []);
    expect(out.snapshot.startsWith("Senior Product Designer with 7 years")).toBe(true);
    expect(out.snapshot).not.toContain("Senior Senior");
  });

  it("asks to validate missing skills without repeating the fit panel's skill lists", () => {
    const out = buildResumeInsights(candidate(), ["Python", "SQL"]);
    expect(out.validate).toContain("Hands-on examples of Python, SQL.");
    expect([...out.strengths, ...out.concerns].join(" ")).not.toMatch(/required skills|Not on the resume/);
  });

  it("leaves practice-interview facts to the Evidence tab", () => {
    for (const sessionsCompleted of [0, 3]) {
      const out = buildResumeInsights(candidate({ sessionsCompleted }), []);
      expect([...out.strengths, ...out.concerns].join(" ")).not.toMatch(/practice|mock interview/i);
    }
  });

  it("leaves self-reported notice and CTC to the header and caps each list at four", () => {
    const out = buildResumeInsights(candidate({}, { noticePeriod: "30 days", currentCtc: "32 LPA" }), ["Python"]);
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

  it("treats remote roles as a location match and still compares experience while locked", () => {
    const rows = buildRoleFit(candidate({ unlocked: false, city: "Delhi" }), req({ workMode: "remote" }), ["Figma"], null);
    expect(rows.map((r) => r.id)).toEqual(["skills", "experience", "location"]);
    expect(rows[2].status).toBe("meets");
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

describe("skill depth helpers", () => {
  it("labels years used, singular and plural, and omits them when unknown", () => {
    expect(skillChipLabel({ name: "SQL", yearsUsed: 1 })).toBe("SQL · 1 yr");
    expect(skillChipLabel({ name: "React", yearsUsed: 5 })).toBe("React · 5 yrs");
    expect(skillChipLabel({ name: "Go" })).toBe("Go");
  });

  it("groups core before working knowledge before exposure and drops empty groups", () => {
    const groups = groupSkillsByDepth([
      { name: "A", depth: "exposure" },
      { name: "B", depth: "primary" },
      { name: "C", depth: "primary" },
    ]);
    expect(groups.map((g) => [g.label, g.skills.map((s) => s.name)])).toEqual([["Core", ["B", "C"]], ["Exposure", ["A"]]]);
  });
});

describe("describeDelivery with too little speech", () => {
  it("never praises measurements taken from a near-silent sample", () => {
    const rows = describeDelivery({ paceWpm: 20, fillersPerMin: 0, pausePct: 0, responseSec: 0, hedgesPerMin: 0 });
    expect(rows.length).toBe(5);
    expect(rows.every((r) => r.tone === "neutral")).toBe(true);
  });

  it("treats an exact zero as not measured even at a normal pace", () => {
    const rows = describeDelivery({ paceWpm: 140, fillersPerMin: 2, pausePct: 5, responseSec: 0, hedgesPerMin: 1 });
    expect(rows.find((r) => r.id === "response")?.tone).toBe("neutral");
    expect(rows.find((r) => r.id === "pace")?.tone).toBe("success");
  });
});

describe("matchedSkillCount", () => {
  it("counts React against React.js and reads skillsDetailed and resume text", () => {
    const c = candidate({ skills: ["React.js"] }, { skillsDetailed: [{ name: "Node.js", depth: "primary" }], summary: "Ships TypeScript services." });
    expect(matchedSkillCount(["React", "Node", "TypeScript", "Go"], c)).toEqual(["React", "Node", "TypeScript"]);
  });
});

describe("buildRoleFit location and copy", () => {
  const req = { skills: [], workMode: "hybrid", locations: ["Bengaluru"], experienceMin: 2, experienceMax: 5, noticePeriodPref: null, minReadinessBand: null, minStarCompleteness: 60 } as unknown as Requirement;

  it("flags a hybrid role in another city as a gap", () => {
    expect(buildRoleFit(candidate(), req, [], null).find((r) => r.id === "location")?.status).toBe("gap");
  });

  it("writes experience in full words", () => {
    const row = buildRoleFit(candidate({}, { yearsExperience: 1 }), req, [], null).find((r) => r.id === "experience");
    expect(row?.has).toBe("1 year");
    expect(row?.asked).toBe("2 to 5 years");
    expect(formatYears(3)).toBe("3 years");
  });

  it("labels the average-coverage figure as coverage, not full answers", () => {
    const evidence = { starCompleteness: { pct: 40, questionsConsidered: 5 } } as unknown as CandidateEvidence;
    expect(buildRoleFit(candidate(), req, [], evidence).find((r) => r.id === "star")?.label).toBe("STAR coverage");
  });
});

describe("dedupeQuestions and employerCapabilities", () => {
  const q = (question: string) => ({ question, idx: 0, score: 50, verdict: "partial" }) as unknown as EvidenceQuestion;

  it("drops a re-asked near-identical question but keeps distinct ones", () => {
    const out = dedupeQuestions([q("Tell me about a time you led a team through conflict."), q("Tell me about a time you led a team through a conflict"), q("How do you prioritise a backlog?")]);
    expect(out.map((x) => x.question)).toEqual(["Tell me about a time you led a team through conflict.", "How do you prioritise a backlog?"]);
  });

  it("hides candidate-side salary negotiation from the employer's verified list", () => {
    expect(employerCapabilities([{ key: "communication" }, { key: "salary-negotiation" }])).toEqual([{ key: "communication" }]);
  });
});

describe("cleanQuestionText", () => {
  it("strips interviewer stage directions", () => {
    expect(cleanQuestionText("Tell me about a build. [pause] What went wrong?")).toBe("Tell me about a build. What went wrong?");
  });
});

describe("summarizeFit", () => {
  it("counts met criteria and names gaps and near misses", () => {
    const rows = [
      { id: "skills", label: "Required skills", asked: "3 listed", has: "3 of 3", status: "meets" as const, reason: "" },
      { id: "experience", label: "Experience", asked: "5+ years", has: "4 years", status: "partial" as const, reason: "" },
      { id: "location", label: "Location", asked: "Pune", has: "Delhi", status: "gap" as const, reason: "" },
    ];
    expect(summarizeFit(rows)).toEqual({ meets: 1, total: 3, gaps: ["Location"], close: ["Experience"] });
  });

  it("is empty when no criteria are set", () => {
    expect(summarizeFit([])).toEqual({ meets: 0, total: 0, gaps: [], close: [] });
  });
});

describe("displaySkillName", () => {
  it("lowercases the .Js and .Ts suffix and leaves other names alone", async () => {
    const { displaySkillName } = await import("../../app/(employer)/employer/requirements/[id]/candidates/[candidateId]/_components/helpers");
    expect(displaySkillName("React.Js")).toBe("React.js");
    expect(displaySkillName("Node.JS")).toBe("Node.js");
    expect(displaySkillName("Python")).toBe("Python");
    expect(displaySkillName("Asp.Net")).toBe("Asp.Net");
  });
});

describe("fit row reasons and order", () => {
  const req = { skills: ["Figma", "Python", "SQL", "R"], experienceMin: 4, experienceMax: 8, locations: ["Pune"], workMode: "onsite", noticePeriodPref: "Up to 30 days", minReadinessBand: null, minStarCompleteness: null } as unknown as Requirement;

  it("gives every row a plain sentence that names the facts", () => {
    const rows = buildRoleFit(candidate({ unlocked: true, city: "Delhi" }, { yearsExperience: 2, noticePeriod: "30 days" }), req, ["Figma", "Python"], null);
    const reason = Object.fromEntries(rows.map((r) => [r.id, r.reason]));
    expect(reason.skills).toBe("Has 2 of 4; missing SQL, R.");
    expect(reason.experience).toBe("2 years short of the 4 years asked.");
    expect(reason.location).toBe("Based in Delhi; the role is hiring in Pune.");
    expect(reason.notice).toBe("Can join within the notice asked.");
  });

  it("lists strengths before near-misses before gaps, keeping order within a group", () => {
    const rows = [
      { id: "a", label: "A", asked: "", has: "", status: "gap" as const, reason: "" },
      { id: "b", label: "B", asked: "", has: "", status: "meets" as const, reason: "" },
      { id: "c", label: "C", asked: "", has: "", status: "partial" as const, reason: "" },
      { id: "d", label: "D", asked: "", has: "", status: "meets" as const, reason: "" },
    ];
    expect(sortFitRows(rows).map((r) => r.id)).toEqual(["b", "d", "c", "a"]);
    expect(rows[0].id).toBe("a");
  });
});

describe("buildEvidenceSummary", () => {
  const req = { skills: ["Figma", "Python", "SQL", "R"] };

  it("joins only the facts the profile holds", () => {
    const c = candidate({ rosterScore: 78.4, sessionsCompleted: 3, city: "Delhi" }, { noticePeriod: "30 days" });
    expect(buildEvidenceSummary(c, req, ["Figma", "Python", "SQL"])).toBe("Interview score 78 across 3 practice interviews, 3 of 4 required skills, Delhi, 30-day notice.");
  });

  it("skips the interview clause without graded sessions and the city when unknown", () => {
    const c = candidate({ rosterScore: 50, sessionsCompleted: 0, city: "Not specified" }, { noticePeriod: "Immediate" });
    expect(buildEvidenceSummary(c, req, [])).toBe("0 of 4 required skills, Immediate joiner.");
  });

  it("uses singular wording and months for long notice", () => {
    const c = candidate({ rosterScore: 60, sessionsCompleted: 1, city: "Pune" }, { noticePeriod: "2 months" });
    expect(buildEvidenceSummary(c, { skills: [] }, [])).toBe("Interview score 60 across 1 practice interview, Pune, 2-month notice.");
  });

  it("is null when nothing is known", () => {
    expect(buildEvidenceSummary(candidate({ sessionsCompleted: 0, city: "Not specified" }, { noticePeriod: null }), { skills: [] }, [])).toBeNull();
  });
});
