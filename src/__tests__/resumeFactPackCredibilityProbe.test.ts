import { describe, it, expect } from "vitest";
import { initState, applyCandidateAnswer } from "../../server-handlers/_negotiation-kernel";
import { planNextAction } from "../../server-handlers/_next-action-planner";
import { detectStatedCurrentCompany, type ResumeFactPack } from "../../server-handlers/_resume-fact-pack";

function baseInit(extra: Record<string, unknown> = {}) {
  return {
    sessionId: "test-session",
    role: "Software Engineer",
    company: "Acme",
    band: { initialOffer: 20, maxStretch: 28, walkAway: 16, displayLabel: "", hasEquity: false },
    ...extra,
  } as Parameters<typeof initState>[0];
}

function makePack(latestCompany: string): ResumeFactPack {
  return {
    priorCompanies: [{ name: latestCompany, tier: "unicorn", tenureMonths: 24 }],
    stackTags: ["react"],
    tenurePattern: "stable",
    mbaTier: null,
    leadershipClaimed: false,
    gapMonths: null,
    topAchievement: null,
    latestRole: { title: "SDE-2", companyName: latestCompany, companyTier: "unicorn" },
  };
}

describe("detectStatedCurrentCompany", () => {
  it("parses 'I'm at Flipkart'", () => {
    expect(detectStatedCurrentCompany("I'm at Flipkart, working on payments.")).toBe("Flipkart");
  });
  it("parses 'I work at Google'", () => {
    expect(detectStatedCurrentCompany("I work at Google in Hyderabad.")).toBe("Google");
  });
  it("parses 'currently at Cognizant'", () => {
    expect(detectStatedCurrentCompany("Yeah, currently at Cognizant.")).toBe("Cognizant");
  });
  it("returns null when no statement", () => {
    expect(detectStatedCurrentCompany("My target is 35 LPA.")).toBeNull();
  });
});

describe("credibility-probe lever — planner", () => {
  it("fires when stated company conflicts with resume", () => {
    const s0 = initState(baseInit({ resumeFactPack: makePack("Cognizant") }));
    const s1 = applyCandidateAnswer(s0, "I'm at Google now, looking for a switch.");
    expect(s1.candidateStatedCurrentCompany).toBe("Google");
    const action = planNextAction(s1);
    expect(action.kind).toBe("credibility-probe");
    if (action.kind === "credibility-probe") {
      expect(action.resumeCompany).toBe("Cognizant");
      expect(action.statedCompany).toBe("Google");
    }
  });

  it("does NOT fire when resume confirms the affiliation", () => {
    const s0 = initState(baseInit({ resumeFactPack: makePack("Flipkart Pvt Ltd") }));
    const s1 = applyCandidateAnswer(s0, "I'm at Flipkart, hoping for a hike.");
    expect(s1.candidateStatedCurrentCompany).toBe("Flipkart");
    expect(s1.credibilityProbeAvoidedAt).not.toBeNull();
    const action = planNextAction(s1);
    expect(action.kind).not.toBe("credibility-probe");
  });

  it("does NOT fire when no resume pack is present", () => {
    const s0 = initState(baseInit());
    const s1 = applyCandidateAnswer(s0, "I'm at Google now.");
    const action = planNextAction(s1);
    expect(action.kind).not.toBe("credibility-probe");
  });
});
