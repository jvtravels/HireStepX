import { describe, it, expect } from "vitest";
import {
  availabilityOf,
  interviewScore,
  inTab,
  jobInsights,
  jobStatusPill,
  matchingSummary,
  parseNiceToHave,
  evidenceLabels,
  evidenceLinks,
  evidenceSources,
  matchesInsight,
  pipelineRows,
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

  it("files rejected candidates under Not a fit and everyone under All", () => {
    expect(inTab(list[3], "not_a_fit")).toBe(true);
    expect(inTab(list[0], "not_a_fit")).toBe(false);
    expect(list.every((c) => inTab(c, "all"))).toBe(true);
  });

  it("counts every tab and shows Hired only once someone is hired", () => {
    const counts = tabCounts(list);
    expect(counts).toEqual({ all: 5, interviewing: 1, hired: 1, not_a_fit: 1 });
    expect(visibleTabs(counts)).toContain("hired");
    expect(visibleTabs({ ...counts, hired: 0 })).toEqual(["all", "interviewing", "not_a_fit"]);
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
    expect(matchingSummary({ status: "ready", totalMatched: 4, candidates })).toEqual({ state: "complete", evaluated: 2, coverage: 50 });
    expect(matchingSummary({ status: "generating", totalMatched: 0, candidates: [] }).state).toBe("running");
  });

  it("only emits insights the data supports", () => {
    expect(jobInsights({ skills: ["Go"], portfolioRequired: false, candidates: [] })).toEqual([]);
    const ids = jobInsights({
      skills: ["Go"],
      portfolioRequired: false,
      candidates: [cand(80, "shortlisted", { skills: ["Go"] }), cand(20)],
    }).map((i) => i.id);
    expect(ids).toEqual(["all-must"]);
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

describe("pipelineRows", () => {
  it("maps each row to the tab it counts", () => {
    const counts = tabCounts([cand(80), cand(70), cand(60, "interview_invited"), cand(60, "interviewing"), cand(60, "hired"), cand(20, "rejected")]);
    expect(pipelineRows(counts).map((r) => [r.key, r.tab])).toEqual([
      ["evaluated", "all"],
      ["interviewing", "interviewing"],
      ["hired", "hired"],
      ["not_a_fit", "not_a_fit"],
    ]);
    expect(pipelineRows(counts).map((r) => r.count)).toEqual([counts.all, counts.interviewing, counts.hired, counts.not_a_fit]);
  });

  it("is all zeros for an empty list", () => {
    expect(pipelineRows(tabCounts([])).every((r) => r.count === 0)).toBe(true);
  });
});

describe("evidenceSources", () => {
  const base = { resume: undefined, sessionsCompleted: 0, portfolioLinks: undefined };

  it("is empty when nothing backs the profile", () => {
    expect(evidenceSources(base)).toEqual({ resume: false, interviews: 0, github: 0, web: 0, total: 0 });
  });

  it("counts the resume, interviews as one source, and each link by kind", () => {
    const out = evidenceSources({
      resume: {} as never,
      sessionsCompleted: 3,
      portfolioLinks: [
        { title: "Code", url: "https://github.com/asha" },
        { title: "Site", url: "https://asha.dev" },
      ],
    });
    expect(out).toEqual({ resume: true, interviews: 3, github: 1, web: 1, total: 4 });
  });

  it("does not mistake a lookalike host for GitHub", () => {
    expect(evidenceSources({ ...base, portfolioLinks: [{ title: "x", url: "https://notgithub.com.evil.io/a" }] }).github).toBe(0);
  });
});

describe("evidenceLabels", () => {
  it("names only the sources that exist", () => {
    expect(evidenceLabels({ resume: true, github: 2, web: 0 })).toEqual(["Resume", "GitHub"]);
    expect(evidenceLabels({ resume: false, github: 0, web: 1 })).toEqual(["Portfolio"]);
    expect(evidenceLabels({ resume: false, github: 0, web: 0 })).toEqual([]);
  });
});

describe("matchesInsight", () => {
  it("keeps candidates missing the named skill", () => {
    const a = cand(80, "shortlisted", { skills: ["Java"] });
    const b = cand(80, "shortlisted", { skills: ["Java", "React"] });
    expect(matchesInsight(a, { kind: "gap", skill: "react" })).toBe(true);
    expect(matchesInsight(b, { kind: "gap", skill: "react" })).toBe(false);
  });

  it("keeps candidates covering every must-have", () => {
    const f = { kind: "all-must" as const, skills: ["Java", "React"] };
    expect(matchesInsight(cand(80, "shortlisted", { skills: ["java", "react"] }), f)).toBe(true);
    expect(matchesInsight(cand(80, "shortlisted", { skills: ["java"] }), f)).toBe(false);
  });

  it("keeps candidates with portfolio links", () => {
    expect(matchesInsight(cand(80, "shortlisted", { portfolioLinks: [{ title: "Site", url: "https://x.dev" }] }), { kind: "portfolio" })).toBe(true);
    expect(matchesInsight(cand(80), { kind: "portfolio" })).toBe(false);
  });

  it("treats a candidate with no interviews as below the interview bar", () => {
    expect(matchesInsight(cand(80), { kind: "interview" })).toBe(false);
  });

  it("gives every insight a label and a filter that selects at least one candidate", () => {
    const list = [cand(90, "shortlisted", { skills: ["Java"], portfolioLinks: [{ title: "Site", url: "https://x.dev" }] })];
    const insights = jobInsights({ skills: ["Java", "React"], portfolioRequired: false, candidates: list });
    for (const i of insights) {
      expect(i.label.length).toBeGreaterThan(0);
      expect(list.some((c) => matchesInsight(c, i.filter))).toBe(true);
    }
  });
});

describe("evidenceLinks", () => {
  const link = (url: string) => ({ title: "x", url });
  it("picks the first GitHub link and the first other link", () => {
    expect(
      evidenceLinks({ portfolioLinks: [link("https://example.dev"), link("https://github.com/a"), link("https://github.com/b"), link("https://other.io")] }),
    ).toEqual({ github: "https://github.com/a", web: "https://example.dev" });
  });
  it("returns nothing for a locked match with no links", () => {
    expect(evidenceLinks({ portfolioLinks: [] })).toEqual({ github: null, web: null });
    expect(evidenceLinks({})).toEqual({ github: null, web: null });
  });
  it("ignores links that are not http(s)", () => {
    expect(evidenceLinks({ portfolioLinks: [link("javascript:alert(1)"), link("mailto:a@b.co")] })).toEqual({ github: null, web: null });
  });
});
