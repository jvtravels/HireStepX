import { describe, it, expect } from "vitest";
import { buildInsights, buildRecommendedCards, isDashboardData, jobStatusLabel, trendDelta, type DashboardJobPipeline } from "../employer/dashboardData";
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

describe("jobStatusLabel / trendDelta", () => {
  it("maps lifecycle states", () => {
    expect(jobStatusLabel("ready")).toBe("Active");
    expect(jobStatusLabel("zero")).toBe("Active");
    expect(jobStatusLabel("generating")).toBe("Matching");
    expect(jobStatusLabel("failed")).toBe("Needs retry");
  });
  it("formats the delta", () => {
    expect(trendDelta({ series: [], current: 5, previous: 2 })).toEqual({ diff: 3, label: "+3" });
    expect(trendDelta({ series: [], current: 1, previous: 4 }).label).toBe("-3");
    expect(trendDelta({ series: [], current: 2, previous: 2 }).label).toBe("No change");
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
  const jobs = [job("r1", {}, [cand("aaaaaa", ["react", "css"]), cand("bbbbbb", ["Node"])])];
  it("orders by the server's recency list and derives strengths and gaps", () => {
    const cards = buildRecommendedCards(jobs, [
      { matchId: "bbbbbb", requirementId: "r1", matchScore: 60, createdAt: "2026-10-14T00:00:00Z" },
      { matchId: "aaaaaa", requirementId: "r1", matchScore: 60, createdAt: "2026-10-10T00:00:00Z" },
      { matchId: "ghost", requirementId: "r1", matchScore: 60, createdAt: "2026-10-09T00:00:00Z" },
    ]);
    expect(cards.map((c) => c.matchId)).toEqual(["bbbbbb", "aaaaaa"]);
    expect(cards[1].strengths).toEqual(["react", "css"]);
    expect(cards[1].needsValidation).toEqual(["Node", "SQL"]);
  });
  it("falls back to the jobs list when the server list is missing", () => {
    expect(buildRecommendedCards(jobs, null)).toHaveLength(2);
    expect(buildRecommendedCards(jobs, null, 1)).toHaveLength(1);
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
