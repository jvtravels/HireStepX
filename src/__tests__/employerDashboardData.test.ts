import { describe, it, expect } from "vitest";
import { buildFunnel, sortJobs, buildInsights, buildRecommendedCards, experienceFit, experienceAsk, pipelineStage, isDashboardData, jobHealth, jobsNeedingAttentionFirst, buildNextAction, type DashboardJobPipeline, type EmployerDashboardData } from "../employer/dashboardData";
import type { RequirementSummary } from "../employer/mockData";

const NOW = Date.parse("2026-10-15T12:00:00Z");
const DAY = 86_400_000;

function job(id: string, over: Partial<RequirementSummary> = {}, strong: RequirementSummary["aiScreening"]["strongMatches"] = []): RequirementSummary {
  return {
    id, title: `Job ${id}`, status: "ready", skills: ["React", "Node", "SQL"], createdAt: "2026-09-01T00:00:00Z",
    aiScreening: { evaluated: 10, totalMatched: 10, scoreLow: 10, scoreHigh: 80, topMatches: strong.length, strongAvgScore: strong.length ? 71.4 : null, strongMatchInitials: [], strongMatchExtra: 0, strongMatches: strong },
    ...over,
  } as RequirementSummary;
}

const cand = (id: string, skills: string[]) => ({ id, name: `Candidate #${id}`, initials: id.slice(0, 2).toUpperCase(), yearsExperience: 3, skills });

describe("buildFunnel", () => {
  const data = {
    range: 30, jobs: [], upcomingInterviews: [], recommended: [], activity: [],
    totals: { interviewsScheduled: 2, hired: 1, awaitingReview: 4 },
    trends: {
      jobs: { series: [], current: 0, previous: 0 }, recommended: { series: [], current: 6, previous: 1 },
      interviews: { series: [], current: 0, previous: 0 }, hired: { series: [], current: 1, previous: 0 },
    },
  } as unknown as EmployerDashboardData;
  it("sizes each step against the first and carries the in-window counts", () => {
    const steps = buildFunnel(data, 10);
    expect(steps.map((x) => [x.key, x.value, x.added, x.filled])).toEqual([
      ["recommended", 10, 6, 10], ["interviewing", 2, 0, 2], ["hired", 1, 1, 1],
    ]);
  });
  it("keeps a non-zero step visible and an empty one empty", () => {
    expect(buildFunnel(data, 100)[2].filled).toBe(1);
    expect(buildFunnel(null, 0).map((x) => x.filled)).toEqual([0, 0, 0]);
    expect(buildFunnel(null, 5)[1].added).toBeNull();
  });
});

describe("sortJobs", () => {
  const jobs = [job("a", { title: "Beta" }, [cand("aaaaaa", [])]), job("b", { title: "alpha" }), job("c", { title: "Gamma" }, [cand("bbbbbb", []), cand("cccccc", [])])];
  const pipe: DashboardJobPipeline[] = [
    { requirementId: "a", interviewing: 3, hired: 0, lastUpdatedAt: null },
    { requirementId: "b", interviewing: 1, hired: 2, lastUpdatedAt: null },
  ];
  it("returns the original order with no key", () => {
    expect(sortJobs(jobs, pipe, null, "desc")).toBe(jobs);
  });
  it("sorts titles case-insensitively", () => {
    expect(sortJobs(jobs, pipe, "title", "asc").map((j) => j.id)).toEqual(["b", "a", "c"]);
  });
  it("sorts by recommended, interviewing and hired, treating missing pipeline as zero", () => {
    expect(sortJobs(jobs, pipe, "recommended", "desc").map((j) => j.id)).toEqual(["c", "a", "b"]);
    expect(sortJobs(jobs, pipe, "interviewing", "desc").map((j) => j.id)).toEqual(["a", "b", "c"]);
    expect(sortJobs(jobs, pipe, "hired", "asc").map((j) => j.id)).toEqual(["a", "c", "b"]);
  });
  it("does not mutate the input", () => {
    const before = jobs.map((j) => j.id);
    sortJobs(jobs, pipe, "title", "desc");
    expect(jobs.map((j) => j.id)).toEqual(before);
  });
});

describe("jobHealth", () => {
  const strong = [{ id: "a1", name: "A", initials: "A", yearsExperience: 3, skills: [] }];
  it("flags a failed job", () => {
    expect(jobHealth(job("1", { status: "failed" }), undefined, NOW)?.tone).toBe("error");
  });
  it("stays quiet while matching is running", () => {
    expect(jobHealth(job("1", { status: "generating" }), undefined, NOW)).toBeNull();
  });
  it("shows the best score against the strong bar when nobody reached it", () => {
    const j = job("1");
    j.aiScreening.scoreHigh = 38.6;
    expect(jobHealth(j, undefined, NOW)?.label).toBe("Best score 39. Strong starts at 40");
  });
  it("still explains the bar when no score range is available", () => {
    const j = job("1");
    j.aiScreening.scoreHigh = null;
    expect(jobHealth(j, undefined, NOW)?.label).toBe("Strong starts at 40");
  });
  it("says no candidates yet, not weak, when nobody was evaluated", () => {
    const j = job("1");
    j.aiScreening.evaluated = 0;
    expect(jobHealth(j, undefined, NOW)?.label).toBe("No candidates yet");
  });
  it("stays quiet while the stored stage is still AI matching", () => {
    expect(jobHealth(job("1", { stage: "ai_matching" }), undefined, NOW)).toBeNull();
  });
  it("flags a job idle for over 14 days", () => {
    const p: DashboardJobPipeline = { requirementId: "1", interviewing: 0, hired: 0, lastUpdatedAt: new Date(NOW - 20 * DAY).toISOString() };
    expect(jobHealth(job("1", {}, strong), p, NOW)?.label).toBe("Quiet for 20 days");
  });
  it("returns null for a healthy job", () => {
    const p: DashboardJobPipeline = { requirementId: "1", interviewing: 0, hired: 0, lastUpdatedAt: new Date(NOW - DAY).toISOString() };
    expect(jobHealth(job("1", {}, strong), p, NOW)).toBeNull();
  });
});

describe("buildNextAction", () => {
  const strong = [{ id: "a1", name: "A", initials: "A", yearsExperience: 3, skills: [] }];
  const soon = { matchId: "m1", requirementId: "r1", roleTitle: "Dev", candidateName: "Priya", initials: "P", scheduledAt: new Date(NOW + 3_600_000).toISOString() };
  it("puts a near interview first", () => {
    expect(buildNextAction([job("1", {}, strong)], [soon], 4, NOW, true)?.title).toContain("Priya");
  });
  it("ignores interviews more than 48h away", () => {
    const far = { ...soon, scheduledAt: new Date(NOW + 5 * DAY).toISOString() };
    expect(buildNextAction([job("1", {}, strong)], [far], 2, NOW, true)?.title).toContain("2 candidates are waiting");
  });
  it("uses singular wording for one waiting candidate", () => {
    expect(buildNextAction([job("1", {}, strong)], [], 1, NOW, true)?.title).toContain("1 candidate is waiting");
  });
  it("points a failed job at its edit page", () => {
    expect(buildNextAction([job("9", { status: "failed" })], [], 0, NOW, true)?.href).toBe("/employer/requirements/9/edit");
  });
  it("suggests posting a job only when the account can create one", () => {
    expect(buildNextAction([], [], 0, NOW, true)?.href).toBe("/employer/requirements/new");
    expect(buildNextAction([], [], 0, NOW, false)).toBeNull();
  });
  it("deep-links to the top candidate when one is known", () => {
    const a = buildNextAction([job("1", {}, strong)], [], 2, NOW, true, { requirementId: "r9", matchId: "m9" });
    expect(a?.href).toBe("/employer/requirements/r9/candidates/m9");
    expect(a?.cta).toBe("Review top candidate");
  });
  it("does not call a still-matching job weak", () => {
    expect(buildNextAction([job("1", { stage: "ai_matching" })], [], 0, NOW, true)).toBeNull();
  });
  it("returns null when nothing needs doing", () => {
    expect(buildNextAction([job("1", {}, strong)], [], 0, NOW, true)).toBeNull();
  });
});

describe("isDashboardData", () => {
  it("requires the arrays and trend objects", () => {
    const trend = { series: [], current: 0, previous: 0 };
    const ok = { jobs: [], upcomingInterviews: [], recommended: [], activity: [], totals: {}, trends: { jobs: trend, recommended: trend, interviews: trend, hired: trend } };
    expect(isDashboardData(ok)).toBe(true);
    expect(isDashboardData({ ...ok, activity: null })).toBe(false);
    expect(isDashboardData({ ...ok, trends: { jobs: trend } })).toBe(false);
    expect(isDashboardData(null)).toBe(false);
  });
});

describe("buildRecommendedCards", () => {
  const jobs = [job("r1", { experienceMin: 4, experienceMax: 8 }, [cand("aaaaaa", ["react", "css"]), cand("bbbbbb", ["Node"])])];
  const refs = [
    { matchId: "bbbbbb", requirementId: "r1", matchScore: 90, createdAt: new Date(NOW - 5 * DAY).toISOString() },
    { matchId: "aaaaaa", requirementId: "r1", matchScore: 60, createdAt: new Date(NOW - 2 * 3600_000).toISOString() },
    { matchId: "ghost", requirementId: "r1", matchScore: 60, createdAt: new Date(NOW).toISOString() },
  ];
  it("keeps the server's ranking and explains the fit against the job's required skills", () => {
    const cards = buildRecommendedCards(jobs, refs, NOW);
    expect(cards.map((c) => c.matchId)).toEqual(["bbbbbb", "aaaaaa"]);
    expect(cards[1].matchedSkills).toEqual(["React"]);
    expect(cards[1].missingSkills).toEqual(["Node", "SQL"]);
    expect(cards[1].requiredCount).toBe(3);
    expect(cards[0].waitingDays).toBe(5);
    expect(cards[1].waitingDays).toBe(0);
  });
  it("reports experience against the job's range", () => {
    const [c] = buildRecommendedCards(jobs, refs, NOW);
    expect(c.yearsExperience).toBe(3);
    expect(c.experienceFit).toBe("below");
    expect(c.experienceAsk).toBe("4 to 8 yrs");
  });
  it("shows the candidate's own skills when the job lists none", () => {
    const [c] = buildRecommendedCards([job("r1", { skills: [] }, [cand("aaaaaa", ["react", "css"])])], null, NOW);
    expect(c.matchedSkills).toEqual(["react", "css"]);
    expect(c.requiredCount).toBe(0);
  });
  it("carries traits through, defaulting to none", () => {
    const withTraits = job("r1", {}, [{ ...cand("aaaaaa", []), traits: ["Senior", "Fintech"] }, cand("bbbbbb", [])]);
    const cards = buildRecommendedCards([withTraits], null, NOW);
    expect(cards.map((c) => c.traits)).toEqual([["Senior", "Fintech"], []]);
  });
  it("falls back to the jobs list when the server list is missing", () => {
    expect(buildRecommendedCards(jobs, null, NOW)).toHaveLength(2);
    expect(buildRecommendedCards(jobs, null, NOW, 1)).toHaveLength(1);
    expect(buildRecommendedCards(jobs, null, NOW)[0].waitingDays).toBeNull();
  });
});

describe("experience helpers", () => {
  it("classifies years against the range", () => {
    expect(experienceFit(6, 4, 8)).toBe("within");
    expect(experienceFit(2, 4, 8)).toBe("below");
    expect(experienceFit(12, 4, 8)).toBe("above");
    expect(experienceFit(5, 4, null)).toBe("within");
    expect(experienceFit(null, 4, 8)).toBeNull();
    expect(experienceFit(5, null, null)).toBeNull();
  });
  it("labels what the job asks for", () => {
    expect(experienceAsk(4, 8)).toBe("4 to 8 yrs");
    expect(experienceAsk(3, 3)).toBe("3 yrs");
    expect(experienceAsk(2, null)).toBe("2+ yrs");
    expect(experienceAsk(null, 5)).toBe("up to 5 yrs");
    expect(experienceAsk(null, null)).toBeNull();
  });
});

describe("pipelineStage", () => {
  const p = (interviewing: number, hired: number): DashboardJobPipeline => ({ requirementId: "r1", interviewing, hired, lastUpdatedAt: null });
  it("moves a job past the stored stage once candidates are interviewing or hired", () => {
    expect(pipelineStage(job("r1", { stage: "ready_for_review" }), p(0, 0))).toBe("ready_for_review");
    expect(pipelineStage(job("r1", { stage: "ready_for_review" }), p(2, 0))).toBe("interviewing");
    expect(pipelineStage(job("r1", { stage: "ready_for_review", openPositions: 2 }), p(1, 1))).toBe("interviewing");
    expect(pipelineStage(job("r1", { stage: "ready_for_review", openPositions: 1 }), p(0, 1))).toBe("hired");
  });
  it("leaves a job that is still matching alone", () => {
    expect(pipelineStage(job("r1", { stage: "ai_matching" }), p(3, 1))).toBe("ai_matching");
  });
});

describe("buildInsights", () => {
  const pipeline: DashboardJobPipeline[] = [
    { requirementId: "r1", interviewing: 0, hired: 0, lastUpdatedAt: new Date(NOW - 2 * DAY).toISOString() },
    { requirementId: "r2", interviewing: 0, hired: 0, lastUpdatedAt: new Date(NOW - 30 * DAY).toISOString() },
  ];
  it("emits only observations that are true", () => {
    const out = buildInsights([job("r1", {}, [cand("aaaaaa", [])]), job("r2")], pipeline, NOW);
    expect(out.map((i) => i.id)).toEqual(["best-pipeline", "no-strong", "stale"]);
    expect(out[0].body).toContain("averaging 71% fit");
    expect(out.map((i) => i.tone)).toEqual(["positive", "attention", "neutral"]);
    expect(out.every((i) => i.cta.length > 0)).toBe(true);
  });
  it("is empty for an account with nothing to say", () => {
    expect(buildInsights([], [], NOW)).toEqual([]);
  });
});

describe("jobsNeedingAttentionFirst", () => {
  it("puts jobs with strong matches first without mutating the input", () => {
    const a = job("a"), b = job("b", {}, [cand("x1", []), cand("x2", [])]), c = job("c", {}, [cand("y1", [])]);
    const jobs = [a, b, c];
    expect(jobsNeedingAttentionFirst(jobs).map((j) => j.id)).toEqual(["b", "c", "a"]);
    expect(jobs.map((j) => j.id)).toEqual(["a", "b", "c"]);
  });
});

describe("buildRecommendedCards skill matching", () => {
  it("treats spelling variants of a skill as the same skill", () => {
    const j = job("r1", { skills: ["React.js", "Postgres", "Go"] }, [cand("aaaaaa", ["React.Js", "PostgreSQL"])]);
    const [card] = buildRecommendedCards([j], null, NOW);
    expect(card.matchedSkills).toEqual(["React.js", "Postgres"]);
    expect(card.missingSkills).toEqual(["Go"]);
  });
});
