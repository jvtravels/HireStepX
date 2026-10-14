import { describe, it, expect } from "vitest";
import {
  availabilityOf,
  interviewScore,
  inTab,
  jobInsights,
  jobStatusPill,
  matchingSummary,
  parseNiceToHave,
  pipelineSteps,
  scoreTone,
  skillFit,
  skillKey,
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
    expect(t.other).toEqual(["Figma"]);
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

describe("skillKey", () => {
  it("treats common spellings of one skill as the same skill", () => {
    expect(skillKey("ReactJS")).toBe(skillKey("react"));
    expect(skillKey("Node.js")).toBe(skillKey("nodejs"));
    expect(skillKey("JS")).toBe(skillKey("JavaScript"));
    expect(skillKey("Microservices")).toBe(skillKey("microservice"));
    expect(skillKey("Golang")).toBe(skillKey("Go"));
    expect(skillKey("Java")).not.toBe(skillKey("JavaScript"));
  });

  it("does not report a false gap for an aliased skill", () => {
    expect(skillFit(["React.js", "node"], ["ReactJS", "Node.js", "Kafka"])).toEqual({ matched: ["ReactJS", "Node.js"], gaps: ["Kafka"] });
  });
});

describe("interview score", () => {
  it("ignores the server default for someone who never practised", () => {
    expect(interviewScore({ rosterScore: 50, sessionsCompleted: 0 })).toBeNull();
    expect(interviewScore({ rosterScore: 71.6, sessionsCompleted: 3 })).toBe(72);
  });

  it("uses the same tone cut-offs as the evidence report", () => {
    expect(scoreTone(70)).toBe("success");
    expect(scoreTone(69)).toBe("warning");
    expect(scoreTone(50)).toBe("warning");
    expect(scoreTone(49)).toBe("error");
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
    expect(visibleTabs({ ...counts, hired: 0 }, "hired")).toContain("hired");
  });
});

describe("job summaries", () => {
  it("maps job status to a pill", () => {
    expect(jobStatusPill("ready").label).toBe("Active");
    expect(jobStatusPill("closed").tone).toBe("neutral");
  });

  it("summarises matching", () => {
    const candidates = [cand(80), cand(20)];
    expect(matchingSummary({ status: "ready", totalMatched: 4, candidates })).toEqual({ state: "complete", evaluated: 2, recommended: 1, coverage: 50 });
    expect(matchingSummary({ status: "generating", totalMatched: 0, candidates: [] }).state).toBe("running");
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

  it("reports interview-proven candidates only when someone has practised", () => {
    const proven = jobInsights({
      skills: [],
      portfolioRequired: false,
      candidates: [cand(80, "shortlisted", { rosterScore: 82, sessionsCompleted: 4 }), cand(60, "shortlisted", { rosterScore: 90, sessionsCompleted: 0 })],
    });
    expect(proven.find((i) => i.id === "interview")?.text).toBe("1 candidate scores 70 or higher in HireStepX mock interviews.");
  });
});

describe("pipelineSteps", () => {
  it("counts current statuses in funnel order and points each step at its tab", () => {
    const steps = pipelineSteps([cand(80), cand(70), cand(60, "interview_invited"), cand(60, "interviewing"), cand(60, "hired"), cand(20, "rejected")]);
    expect(steps.map((s) => [s.key, s.count, s.tab])).toEqual([
      ["matched", 6, "all"],
      ["shortlisted", 2, "all"],
      ["invited", 1, "interviewing"],
      ["interviewing", 1, "interviewing"],
      ["hired", 1, "hired"],
    ]);
  });

  it("is all zeros for an empty list", () => {
    expect(pipelineSteps([]).every((s) => s.count === 0)).toBe(true);
  });
});
