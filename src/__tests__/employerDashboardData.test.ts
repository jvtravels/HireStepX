import { describe, it, expect } from "vitest";
import { buildInsights, buildRecommendedCards, experienceFit, experienceAsk, pipelineStage, isDashboardData, trendDelta, jobHealth, buildNextAction, type DashboardJobPipeline } from "../employer/dashboardData";
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

describe("trendDelta", () => {
  it("shows a percentage when the previous window had data", () => {
    expect(trendDelta({ series: [], current: 5, previous: 4 })).toEqual({ diff: 1, label: "+25%" });
    expect(trendDelta({ series: [], current: 1, previous: 4 }).label).toBe("-75%");
  });
  it("falls back to the raw difference with no previous data", () => {
    expect(trendDelta({ series: [], current: 3, previous: 0 })).toEqual({ diff: 3, label: "+3" });
  });
  it("reports no change", () => {
    expect(trendDelta({ series: [], current: 2, previous: 2 }).label).toBe("No change");
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
  it("flags a job with no strong matches", () => {
    expect(jobHealth(job("1"), undefined, NOW)?.label).toBe("No strong matches yet");
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
    const out = buildInsights([job("r1", {}, [cand("aaaaaa", [])]), job("r2")], pipeline, 2, NOW);
    expect(out.map((i) => i.id)).toEqual(["best-pipeline", "awaiting-review", "no-strong", "stale"]);
    expect(out[0].body).toContain("averaging 71% fit");
  });
  it("is empty for an account with nothing to say", () => {
    expect(buildInsights([], [], 0, NOW)).toEqual([]);
  });
});
