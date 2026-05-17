/* Phase 3 missing-lever set (2026-05-17) — integration invariants.
 *
 * Locks the three behavioural invariants for the new Indian-HR levers:
 *
 *   1. Candidate complains "that's only X% hike" while in counter-offer
 *      → planner emits `anchor-defense-hike-strong` exactly ONCE, prose
 *      contains the computed hikePct and references peer benchmark.
 *   2. counterRound >= 2 + fresh candidate push → planner emits
 *      `panel-approval-stall` BEFORE `internal-equity-defense`; single-
 *      fire via `panelApprovalStallFiredAtTurn`.
 *   3. Stall signal + no competing offer + non-flexible posture +
 *      counterRound >= 1 → planner emits `polite-walkaway` which stamps
 *      both `politeWalkawayFiredAtTurn` and `walkedAwayAtTurn`.
 */
import { describe, it, expect } from "vitest";
import {
  initState,
  type NegotiationBand,
  type NegotiationState,
} from "../../../server-handlers/_negotiation-kernel";
import { planNextAction } from "../../../server-handlers/_next-action-planner";
import { renderCanonicalProse } from "../../../server-handlers/_canonical-prose";

const BAND: NegotiationBand = {
  initialOffer: 22,
  maxStretch: 30,
  walkAway: 18,
  hasEquity: false,
};

const mk = (overrides: Partial<NegotiationState> = {}): NegotiationState => ({
  ...initState({
    sessionId: "phase3-missing-levers",
    role: "Backend Engineer",
    company: "Flipkart",
    band: BAND,
  }),
  ...overrides,
});

describe("Phase 3 missing-lever set — anchor-defense-hike-strong", () => {
  it("hike% complaint in counter-offer → anchor-defense-hike-strong fires once with computed hikePct", () => {
    const offer = 22;
    const ctc = 20;
    const s = mk({
      phase: "counter-offer",
      counterRound: 1,
      turnIndex: 4,
      highestOfferMade: offer,
      candidateCurrentCtc: ctc,
      candidateStance: {
        flexibilityPosture: null,
        marketReferenceVague: false,
        salaryOnlyFactor: false,
        badmouthsCurrent: false,
        confidentialOvershare: false,
        soundsDesperate: false,
        treatsEquityAsCash: false,
        avoidsAnchor: false,
        personalExpenseJustification: false,
        offerShoppingDemand: false,
        dismissesVariableRisk: false,
        overpromisesJoining: false,
        complainedAboutHikePercent: true,
        stallSignal: null,
        hasAny: true,
      },
    });
    const action = planNextAction(s);
    expect(action.kind).toBe("anchor-defense-hike-strong");
    if (action.kind !== "anchor-defense-hike-strong") return;
    const expectedHike = Math.round(((offer - ctc) / ctc) * 100); // 10
    expect(action.hikePct).toBe(expectedHike);
    expect(action.currentCtc).toBe(ctc);
    expect(action.offer).toBe(offer);
    const prose = renderCanonicalProse(action, s);
    expect(prose).toContain(`${expectedHike}%`);
    expect(prose).toMatch(/peers/i);
    expect(prose).toContain(`${offer}`);
    expect(prose).toContain(`${ctc}`);

    /* Single-fire: simulate the kernel stamping `hikeStrongDefenseFiredAtTurn`
     * via applyAiMove. The planner must NOT re-emit the same lever. */
    const next: NegotiationState = { ...s, hikeStrongDefenseFiredAtTurn: s.turnIndex };
    const again = planNextAction(next);
    expect(again.kind).not.toBe("anchor-defense-hike-strong");
  });
});

describe("Phase 3 missing-lever set — panel-approval-stall", () => {
  it("counterRound >= 2 + fresh candidate push → panel-approval-stall before internal-equity-defense", () => {
    const s = mk({
      phase: "counter-offer",
      counterRound: 2,
      turnIndex: 5,
      highestOfferMade: 24,
      candidateCurrentCtc: 18,
      lastCandidateCounterLpa: 28,
      reactiveFollowupsFired: ["comparative-anchoring"],
    });
    const action = planNextAction(s);
    expect(action.kind).toBe("panel-approval-stall");
    const prose = renderCanonicalProse(action, s);
    expect(prose).toMatch(/panel|leadership/i);
    expect(prose).toMatch(/EOD|end of day/i);

    /* Single-fire stamp + re-plan should now route to internal-equity-defense
     * (or another counter-offer branch) — NOT panel-approval-stall again. */
    const next: NegotiationState = {
      ...s,
      panelApprovalStallFiredAtTurn: s.turnIndex,
    };
    const again = planNextAction(next);
    expect(again.kind).not.toBe("panel-approval-stall");
  });
});

describe("Phase 3 missing-lever set — fake-leverage-challenge", () => {
  const baseFakeLeverageState = (overrides: Partial<NegotiationState> = {}): NegotiationState =>
    mk({
      phase: "counter-offer",
      counterRound: 1,
      turnIndex: 7,
      highestOfferMade: 24,
      candidateCurrentCtc: 18,
      competingOffer: 30,
      competingOfferDetail: {
        company: "razorpay",
        status: "verbal",
        stage: "offered",
        letterShareOffered: false,
        onHold: false,
        proofRequestedAtTurn: null,
        proofProvided: false,
        hasAny: true,
      },
      ...overrides,
    });

  it("fires when candidate disclosed competing offer with no proof + counterRound>=1", () => {
    const s = baseFakeLeverageState();
    const action = planNextAction(s);
    expect(action.kind).toBe("fake-leverage-challenge");
    if (action.kind !== "fake-leverage-challenge") return;
    expect(action.competingCompany).toBe("razorpay");
    const prose = renderCanonicalProse(action, s);
    expect(prose).toMatch(/offer letter|redacted/i);
    expect(prose).toContain("razorpay");
  });

  it("does NOT re-fire once fakeLeverageChallengeFiredAtTurn is stamped", () => {
    const s = baseFakeLeverageState({
      fakeLeverageChallengeFiredAtTurn: 7,
      competingOfferDetail: {
        company: "razorpay",
        status: "verbal",
        stage: "offered",
        letterShareOffered: false,
        onHold: false,
        proofRequestedAtTurn: 7,
        proofProvided: false,
        hasAny: true,
      },
      turnIndex: 9,
    });
    const action = planNextAction(s);
    expect(action.kind).not.toBe("fake-leverage-challenge");
  });

  it("does NOT fire when proofProvided is already true", () => {
    const s = baseFakeLeverageState({
      competingOfferDetail: {
        company: "razorpay",
        status: "letter",
        stage: "offered",
        letterShareOffered: false,
        onHold: false,
        proofRequestedAtTurn: null,
        proofProvided: true,
        hasAny: true,
      },
    });
    const action = planNextAction(s);
    expect(action.kind).not.toBe("fake-leverage-challenge");
  });

  it("does NOT fire pre-emptively at counterRound===0", () => {
    const s = baseFakeLeverageState({ counterRound: 0 });
    const action = planNextAction(s);
    expect(action.kind).not.toBe("fake-leverage-challenge");
  });

  it("parser detects proofProvided=true on offer-share utterance", async () => {
    const { extractCompetingOfferDetail } = await import(
      "../../../server-handlers/_competing-offer-detail"
    );
    const detail = extractCompetingOfferDetail(
      "sure, I'll share the redacted offer PDF with you shortly",
    );
    expect(detail.proofProvided).toBe(true);
  });
});

describe("Phase 3 missing-lever set — polite-walkaway", () => {
  it("stall signal + no leverage + counterRound >= 1 + non-flexible → polite-walkaway fires & stamps walkedAwayAtTurn", () => {
    const s = mk({
      phase: "counter-offer",
      counterRound: 1,
      turnIndex: 6,
      highestOfferMade: 24,
      candidateCurrentCtc: 18,
      competingOffer: null,
      candidateStance: {
        flexibilityPosture: "rigid",
        marketReferenceVague: false,
        salaryOnlyFactor: false,
        badmouthsCurrent: false,
        confidentialOvershare: false,
        soundsDesperate: false,
        treatsEquityAsCash: false,
        avoidsAnchor: false,
        personalExpenseJustification: false,
        offerShoppingDemand: false,
        dismissesVariableRisk: false,
        overpromisesJoining: false,
        complainedAboutHikePercent: false,
        stallSignal: { kind: "thinking", statedAt: 5 },
        hasAny: true,
      },
    });
    const action = planNextAction(s);
    expect(action.kind).toBe("polite-walkaway");
    const prose = renderCanonicalProse(action, s);
    expect(prose).toMatch(/\bhonest(?:ly)?\b/i);
    expect(prose).toMatch(/other candidates|move forward/i);

    /* Simulate applyAiMove stamping both single-fire fields. The kernel
     * additionally stamps `walkedAwayAtTurn` when polite-walkaway fires. */
    const next: NegotiationState = {
      ...s,
      politeWalkawayFiredAtTurn: s.turnIndex,
      walkedAwayAtTurn: s.turnIndex,
    };
    const again = planNextAction(next);
    expect(again.kind).not.toBe("polite-walkaway");
  });
});
