import { describe, it, expect } from "vitest";
import { interviewOverdue, jobInsights, matchesInsight } from "../employer/_jobDetailHelpers";
import { buildRoleFit, FIT_SOURCE_LABEL } from "../../app/(employer)/employer/requirements/[id]/candidates/[candidateId]/_components/helpers";
import type { Candidate } from "../employer/mockData";
import type { Requirement } from "../employer/EmployerDataContext";

const NOW = new Date("2026-10-17T10:00:00Z").getTime();
const DAY = 86_400_000;

function candidate(over: Partial<Candidate> = {}): Candidate {
  return { id: "m", name: "A", targetRole: "Dev", city: "Pune", matchScore: 70, rosterScore: 0, sessionsCompleted: 0, lastActiveDaysAgo: 30, skills: [], unlocked: true, candidateStatus: "shortlisted", candidateStatusNote: null, interviewScheduledAt: null, ...over } as Candidate;
}

describe("interviewOverdue", () => {
  it("flags a passed interview date at an interview stage", () => {
    const past = new Date(NOW - 2 * DAY).toISOString();
    expect(interviewOverdue(candidate({ candidateStatus: "interview_invited", interviewScheduledAt: past }), NOW)).toBe(true);
    expect(interviewOverdue(candidate({ candidateStatus: "interviewing", interviewScheduledAt: past }), NOW)).toBe(true);
  });

  it("ignores future dates, missing dates, bad dates and finished stages", () => {
    const future = new Date(NOW + DAY).toISOString();
    const past = new Date(NOW - DAY).toISOString();
    expect(interviewOverdue(candidate({ candidateStatus: "interview_invited", interviewScheduledAt: future }), NOW)).toBe(false);
    expect(interviewOverdue(candidate({ candidateStatus: "interview_invited" }), NOW)).toBe(false);
    expect(interviewOverdue(candidate({ candidateStatus: "interview_invited", interviewScheduledAt: "not a date" }), NOW)).toBe(false);
    expect(interviewOverdue(candidate({ candidateStatus: "hired", interviewScheduledAt: past }), NOW)).toBe(false);
    expect(interviewOverdue(candidate({ candidateStatus: "rejected", interviewScheduledAt: past }), NOW)).toBe(false);
  });
});

describe("follow-up insights", () => {
  const past = new Date(NOW - DAY).toISOString();
  const list = [
    candidate({ id: "a", candidateStatus: "interview_invited", interviewScheduledAt: past }),
    candidate({ id: "b", candidateStatus: "shortlisted", lastActiveDaysAgo: 1 }),
    candidate({ id: "c", candidateStatus: "shortlisted", lastActiveDaysAgo: 9 }),
    candidate({ id: "d", candidateStatus: "interviewing", lastActiveDaysAgo: 0 }),
  ];

  it("puts the overdue interview first and counts it", () => {
    const insights = jobInsights({ skills: [], portfolioRequired: false, candidates: list }, NOW);
    expect(insights[0]).toMatchObject({ id: "overdue", text: "1 interview is past the scheduled date. Record the outcome." });
    expect(list.filter((c) => matchesInsight(c, insights[0].filter, NOW)).map((c) => c.id)).toEqual(["a"]);
  });

  it("counts only candidates still in review who practiced recently", () => {
    const insights = jobInsights({ skills: [], portfolioRequired: false, candidates: list }, NOW);
    const recent = insights.find((i) => i.id === "recent");
    expect(recent?.text).toBe("1 candidate to review practiced in the last 3 days.");
    expect(list.filter((c) => matchesInsight(c, recent!.filter, NOW)).map((c) => c.id)).toEqual(["b"]);
  });

  it("stays quiet when nothing is owed", () => {
    const ids = jobInsights({ skills: [], portfolioRequired: false, candidates: [candidate({ lastActiveDaysAgo: 40 })] }, NOW).map((i) => i.id);
    expect(ids).not.toContain("overdue");
    expect(ids).not.toContain("recent");
  });
});

describe("fit row sources", () => {
  const requirement = { skills: ["React"], experienceMin: 2, experienceMax: 5, workMode: "remote", locations: [], noticePeriodPref: "Any", minReadinessBand: "hire", minStarCompleteness: 60 } as unknown as Requirement;

  it("labels resume, profile and practice facts separately", () => {
    const c = candidate({ resume: { yearsExperience: 3, noticePeriod: "30 days" } as Candidate["resume"] });
    const evidence = { readiness: { band: "hire" }, starCompleteness: { pct: 70 } } as unknown as Parameters<typeof buildRoleFit>[3];
    const rows = buildRoleFit(c, requirement, ["React"], evidence);
    const bySource = Object.fromEntries(rows.map((r) => [r.id, r.source]));
    expect(bySource).toEqual({ skills: "resume", experience: "resume", location: "profile", readiness: "practice", star: "practice" });
    expect(FIT_SOURCE_LABEL.practice).toBe("From graded practice interviews");
  });
});
