import { describe, it, expect } from "vitest";
import {
  initState,
  type NegotiationBand,
  type NegotiationState,
} from "../../server-handlers/_negotiation-kernel";
import { EMPTY_CANDIDATE_PROFILE } from "../../server-handlers/_candidate-profile";
import { extractCandidateStance } from "../../server-handlers/_candidate-stance";
import { recommendFollowups } from "../../server-handlers/_followup-router";

const BAND: NegotiationBand = { initialOffer: 20, maxStretch: 28, walkAway: 16, hasEquity: true };
const baseState = (overrides: Partial<NegotiationState> = {}): NegotiationState => ({
  ...initState({ sessionId: "s1", role: "swe", company: "acme", band: BAND }),
  ...overrides,
});
const emptyStance = extractCandidateStance("");

function categories(state: NegotiationState, stance = emptyStance): string[] {
  return recommendFollowups({ state, stance }).map((f) => f.category);
}

describe("recommendFollowups — fixed-vs-variable", () => {
  it("fires when CTC magnitude known but no breakdown", () => {
    const state = baseState({ candidateCurrentCtc: 18 });
    expect(categories(state)).toContain("ctc-fixed-vs-variable");
  });

  it("does NOT fire when breakdown is known", () => {
    const state = baseState({
      candidateCurrentCtc: 18,
      candidateComponentBreakdown: { base: 14, variable: 4, equity: null, hasAny: true },
    });
    expect(categories(state)).not.toContain("ctc-fixed-vs-variable");
  });
});

describe("recommendFollowups — hike-justification", () => {
  it("fires when hike > 40% and no rationale", () => {
    const state = baseState({ hikePercent: 60, rationale: null });
    expect(categories(state)).toContain("hike-justification");
  });

  it("suppresses when rationale is present", () => {
    const state = baseState({
      hikePercent: 60,
      rationale: { kind: "skill", evidence: "ML specialisation" } as never,
    });
    expect(categories(state)).not.toContain("hike-justification");
  });
});

describe("recommendFollowups — market-reference-probe", () => {
  it("fires when stance is marketReferenceVague", () => {
    const state = baseState();
    const stance = extractCandidateStance("I want as per market");
    expect(categories(state, stance)).toContain("market-reference-probe");
  });
});

describe("recommendFollowups — min-comfortable-range", () => {
  it("fires when stance flexible and no floor stated", () => {
    const state = baseState();
    const stance = extractCandidateStance("I'm flexible on the number");
    expect(categories(state, stance)).toContain("min-comfortable-range");
  });

  it("suppresses when candidate has stated a floor", () => {
    const state = baseState({
      miscSignals: { candidateFloor: 22, salaryReviewMonths: null, proofOfCtcShareable: null, internalCounterRisk: null, hasAny: true },
    });
    const stance = extractCandidateStance("I'm flexible");
    expect(categories(state, stance)).not.toContain("min-comfortable-range");
  });
});

describe("recommendFollowups — non-comp-priorities", () => {
  it("fires when stance rigid", () => {
    const stance = extractCandidateStance("non-negotiable");
    expect(categories(baseState(), stance)).toContain("non-comp-priorities");
  });

  it("fires when stance salaryOnlyFactor", () => {
    const stance = extractCandidateStance("salary is the only thing");
    expect(categories(baseState(), stance)).toContain("non-comp-priorities");
  });
});

describe("recommendFollowups — competing-offer-criteria", () => {
  it("fires when competing-offer magnitude known but deadline + stage missing", () => {
    const state = baseState({ competingOffer: 30 });
    expect(categories(state)).toContain("competing-offer-criteria");
  });

  it("suppresses when both deadline and stage known", () => {
    const state = baseState({
      competingOffer: 30,
      decisionDeadline: { deadlineDays: 5, deadlineExplicit: true, conditionalAcceptance: false, conditionalEvidence: null, hasAny: true },
      competingOfferDetail: { company: "X", status: "letter", stage: "offered", letterShareOffered: true, onHold: false, proofRequestedAtTurn: null, proofProvided: false, hasAny: true },
    });
    expect(categories(state)).not.toContain("competing-offer-criteria");
  });
});

describe("recommendFollowups — notice-and-counter", () => {
  it("fires when notice signalled but LWD + counter-risk missing", () => {
    const state = baseState({
      noticeJoining: { noticePeriodDays: 60, buyoutRequested: false, joiningBonusAsk: null, earlyJoinPreferred: false, joiningBonusClawbackDiscussed: false, lastWorkingDayText: null, hasAny: true },
    });
    expect(categories(state)).toContain("notice-and-counter");
  });
});

describe("recommendFollowups — esop-literacy", () => {
  it("fires when equity-pref but novice familiarity", () => {
    const state = baseState({
      equityVesting: { vestingYears: null, cliffMonths: null, preference: "equity-pref", familiarity: "novice", strikePriceDiscussed: false, valuationDiscussed: false, liquidityDiscussed: false, equityExists: null, hasAny: true },
    });
    expect(categories(state)).toContain("esop-literacy");
  });

  it("fires high-priority when stance treatsEquityAsCash", () => {
    const stance = extractCandidateStance("I'm counting the ESOP as cash");
    const recs = recommendFollowups({ state: baseState(), stance });
    const esop = recs.find((r) => r.category === "esop-literacy");
    expect(esop).toBeDefined();
    expect(esop?.priority).toBe(1);
  });
});

describe("recommendFollowups — gap-readiness", () => {
  it("fires when gap >= 3 months and activity is not upskill/study", () => {
    const state = baseState({
      candidateProfile: { ...EMPTY_CANDIDATE_PROFILE, careerGapMonths: 8, careerGapActivity: "family", hasAny: true },
    });
    expect(categories(state)).toContain("gap-readiness");
  });

  it("suppresses when activity is upskill", () => {
    const state = baseState({
      candidateProfile: { ...EMPTY_CANDIDATE_PROFILE, careerGapMonths: 8, careerGapActivity: "upskill", hasAny: true },
    });
    expect(categories(state)).not.toContain("gap-readiness");
  });
});

describe("recommendFollowups — relocation-support", () => {
  it("fires when relocationRequested and not refused", () => {
    const state = baseState({
      locationMode: { workMode: null, locationCity: null, relocationRequested: true, relocationRefused: false, hasAny: true },
    });
    expect(categories(state)).toContain("relocation-support");
  });
});

describe("recommendFollowups — ordering", () => {
  it("sorts by ascending priority", () => {
    const state = baseState({
      hikePercent: 60, // priority 1 (hike-justification)
      candidateCurrentCtc: 18, // priority 2 (ctc-fixed-vs-variable)
    });
    const stance = extractCandidateStance("non-negotiable"); // priority 3 (non-comp-priorities)
    const recs = recommendFollowups({ state, stance });
    expect(recs.map((r) => r.priority)).toEqual([...recs.map((r) => r.priority)].sort((a, b) => a - b));
  });
});
