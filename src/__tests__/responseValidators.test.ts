/* Response-validator tests — architectural bug-prevention (2026-05-15).
 *
 * NUMBER DISCIPLINE + BUDGET DISCIPLINE moved from prompt-only rules to
 * post-generation validators. These tests exercise the validators
 * directly with hand-crafted state shapes — the integration is wired in
 * negotiate-turn.ts's reroll path.
 */
import { describe, it, expect } from "vitest";
import {
  validateNumberDiscipline,
  validateBudgetDiscipline,
} from "../../server-handlers/_response-validators";
import type {
  NegotiationState,
  NegotiationBand,
} from "../../server-handlers/_negotiation-kernel";

const BAND: NegotiationBand = {
  initialOffer: 18,
  maxStretch: 24,
  walkAway: 14,
  hasEquity: false,
};

/** Minimal state stub — only the fields the validators read. The
 *  validators are deliberately narrow so we don't depend on the full
 *  kernel state shape here. */
function mkState(overrides: Partial<NegotiationState> = {}): NegotiationState {
  return {
    sessionId: "test",
    role: "Software Engineer",
    company: "infosys",
    band: BAND,
    phase: "counter-offer",
    turnIndex: 2,
    maxTurns: 8,
    candidateTarget: 22,
    lastCandidateCounterLpa: null,
    firstAnchoredTarget: 22,
    candidateCurrentCtc: 12,
    competingOffer: null,
    candidateComponentBreakdown: {} as never,
    candidateAskedAsRange: false,
    highestOfferMade: 18,
    leversUsed: [],
    lastAiText: "",
    lastJoiningBonusOffered: null,
    conversationLog: [],
    finalOfferAssertedCount: 0,
    vossTacticsUsed: [],
    infoAsked: [],
    verbalAcceptanceTurn: null,
    postVerbalRenegotiationCount: 0,
    recentRecoveryActive: false,
    walkAwayReturned: false,
    hardBandCap: false,
    marketMode: "neutral",
    recruiterPersona: "consultative",
    acceptedAtTurn: null,
    walkedAwayAtTurn: null,
    hikePercent: null,
    rationale: null,
    noticeJoining: {} as never,
    equityVesting: {} as never,
    locationMode: {} as never,
    competingOfferDetail: {} as never,
    decisionDeadline: {} as never,
    candidateProfile: {} as never,
    miscSignals: {} as never,
    candidateStance: {} as never,
    salesOTE: {} as never,
    contractRate: {} as never,
    retentionCounter: {} as never,
    candidateTotalYoe: null,
    candidateApplicableYoe: null,
    candidatePrimaryDomain: null,
    freshGradDisclosed: false,
    recruiterFactsAlreadySaid: [],
    anchorLocked: true,
    lockedAnchorLpa: 18,
    ...overrides,
  } as NegotiationState;
}

describe("validateNumberDiscipline", () => {
  it("emits number consistent with locked anchor → ok", () => {
    const r = validateNumberDiscipline("We can offer ₹18L for the role.", mkState());
    expect(r.ok).toBe(true);
  });

  it("emits number 20% below locked anchor → reject", () => {
    const r = validateNumberDiscipline("Looking at ₹14L on the table.", mkState());
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toMatch(/below locked anchor/);
    }
  });

  it("emits number above band ceiling → reject", () => {
    const r = validateNumberDiscipline("We can stretch to ₹26L.", mkState());
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toMatch(/band ceiling/);
    }
  });

  it("no numbers in reply → ok (nothing to validate)", () => {
    const r = validateNumberDiscipline("Let me check with the team and get back to you.", mkState());
    expect(r.ok).toBe(true);
  });

  it("locked anchor undefined → ok (nothing to check against)", () => {
    const r = validateNumberDiscipline(
      "₹14L is what we can do today.",
      mkState({ anchorLocked: false, lockedAnchorLpa: null }),
    );
    /* Still below band-walkAway-floor but no anchor lock means the
     * anchor-deviation check is silent. Number ₹14L is within band
     * (walkAway=14, ceiling=24) so band check also passes. */
    expect(r.ok).toBe(true);
  });
});

describe("validateBudgetDiscipline", () => {
  it("emits number above hike-cap → reject (budget)", () => {
    /* Infosys hike cap = 30%; currentCtc = 12 → budget ceiling = 15.6L.
     * Emitting ₹18L blows past that. */
    const r = validateBudgetDiscipline("₹18L total for you.", mkState());
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toMatch(/hike-cap/);
    }
  });

  it("emits number within hike-cap → ok", () => {
    /* Infosys hike cap = 30%; currentCtc = 12 → budget ceiling = 15.6L.
     * ₹15L stays under. */
    const r = validateBudgetDiscipline("₹15L is our number.", mkState());
    expect(r.ok).toBe(true);
  });

  it("no current CTC known → ok (cannot evaluate budget)", () => {
    const r = validateBudgetDiscipline("₹50L is on offer.", mkState({ candidateCurrentCtc: null }));
    expect(r.ok).toBe(true);
  });
});
