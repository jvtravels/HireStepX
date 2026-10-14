import { describe, it, expect } from "vitest";
import {
  availabilityOf,
  evidenceSources,
  inTab,
  jobInsights,
  jobStatusPill,
  matchingSummary,
  parseNiceToHave,
  pipelineRows,
  skillFit,
  skillTiers,
  tabCounts,
  visibleTabs,
} from "../employer/_jobDetailHelpers";
import type { Candidate, CandidateStatus } from "../employer/mockData";

const cand = (matchScore: number, candidateStatus: CandidateStatus = "shortlisted", extra: Partial<Candidate> = {}) =>
  ({ matchScore, candidateStatus, skills: [], portfolioLinks: [], sessionsCompleted: 0, resume: null, ...extra }) as unknown as Candidate;

describe("skillTiers", () => {
  it("keeps the tiers disjoint and ignores case and blanks", () => {
    const t = skillTiers({ skills: ["React", " react ", ""], customSkillSets: ["react", "Figma"], niceToHave: "Figma, GraphQL, Jest" });
    expect(t.mustHave).toEqual(["React"]);
    expect(t.important).toEqual(["Figma"]);
    expect(t.niceToHave).toEqual(["GraphQL", "Jest"]);
  });

  it("does not turn a sentence into chips", () => {
    expect(parseNiceToHave("Experience mentoring junior engineers across several distributed teams.")).toEqual([]);
    expect(parseNiceToHave("")).toEqual([]);
  });
});

describe("skillFit", () => {
  it("splits required skills into matched and gaps case-insensitively", () => {
    expect(skillFit(["react", "Node"], ["React", "Go", "node"])).toEqual({ matched: ["React", "node"], gaps: ["Go"] });
  });
});

describe("availabilityOf", () => {
  it("reads notice periods and never guesses", () => {
    expect(availabilityOf("Immediate")).toEqual({ label: "Immediate", tone: "good" });
    expect(availabilityOf("Currently serving notice, 30 days")).toEqual({ label: "Available in 30 days", tone: "soon" });
    expect(availabilityOf("2 weeks")).toEqual({ label: "Available in 14 days", tone: "good" });
    expect(availabilityOf("3 months")).toEqual({ label: "Available in 3 months", tone: "soon" });
    expect(availabilityOf("Negotiable")).toEqual({ label: "Negotiable", tone: "unknown" });
    expect(availabilityOf(null)).toEqual({ label: "Not stated", tone: "unknown" });
  });
});

describe("evidenceSources", () => {
  it("counts resume, links and practice and tells GitHub from other links", () => {
    const c = cand(50, "shortlisted", {
      resume: { linkedin: "https://linkedin.com/in/x" } as Candidate["resume"],
      portfolioLinks: [{ url: "https://github.com/x" }, { url: "https://x.dev" }] as Candidate["portfolioLinks"],
      sessionsCompleted: 2,
    });
    expect(evidenceSources(c)).toEqual({ count: 5, kinds: ["resume", "web", "github", "practice"] });
    expect(evidenceSources(cand(10))).toEqual({ count: 0, kinds: [] });
  });
});

describe("tabs", () => {
  const list = [cand(80), cand(30), cand(90, "interviewing"), cand(95, "rejected"), cand(70, "hired")];

  it("puts a candidate under Recommended only when strong and not rejected", () => {
    expect(inTab(list[0], "recommended")).toBe(true);
    expect(inTab(list[1], "recommended")).toBe(false);
    expect(inTab(list[3], "recommended")).toBe(false);
    expect(inTab(list[3], "not_a_fit")).toBe(true);
  });

  it("counts every tab and shows Hired only once someone is hired", () => {
    const counts = tabCounts(list);
    expect(counts).toEqual({ recommended: 3, all: 5, interviewing: 1, hired: 1, not_a_fit: 1 });
    expect(visibleTabs(counts)).toContain("hired");
    expect(visibleTabs({ ...counts, hired: 0 })).toEqual(["recommended", "all", "interviewing", "not_a_fit"]);
  });
});

describe("right rail summaries", () => {
  it("maps job status to a pill", () => {
    expect(jobStatusPill("ready").label).toBe("Active");
    expect(jobStatusPill("closed").tone).toBe("neutral");
  });

  it("summarises matching and hides Hired from the pipeline when nobody is hired", () => {
    const candidates = [cand(80), cand(20)];
    expect(matchingSummary({ status: "ready", totalMatched: 4, candidates })).toEqual({ state: "complete", evaluated: 2, recommended: 1, coverage: 50 });
    expect(matchingSummary({ status: "generating", totalMatched: 0, candidates: [] }).state).toBe("running");
    const rows = pipelineRows(tabCounts(candidates));
    expect(rows.find((r) => r.highlight)?.label).toBe("Recommended");
  });

  it("only emits insights the data supports", () => {
    expect(jobInsights({ skills: ["Go"], portfolioRequired: false, candidates: [] })).toEqual([]);
    const ids = jobInsights({
      skills: ["Go"],
      portfolioRequired: false,
      candidates: [cand(80, "shortlisted", { skills: ["Go"] }), cand(20)],
    }).map((i) => i.id);
    expect(ids).toEqual(["strong", "all-must"]);
  });
});
