/* Audit fix 2026-05-21 — CTC-inflation anchor lever (Product Lie #3).
 *
 * The simulator now teaches candidates to ALWAYS ask for the in-hand
 * breakdown by allowing the recruiter to weaponise CTC-vs-in-hand
 * confusion once per session. The numbers are accurate; the lie is
 * the framing. When the candidate asks for the breakdown, the same
 * underlying numbers ship with truthful framing.
 *
 * Tests pin: (a) the lever exists in the NegotiationLever union and
 * passes validateState, (b) the breakdown shape sums to the headline
 * CTC and reflects the documented 60/18/12/5/5 mix, (c) the canonical-
 * prose anchor produces a CTC-inflated quote with all five components,
 * and (d) the truth render reuses the same numbers but reframes them. */
import { describe, it, expect } from "vitest";
import {
  buildCtcInflationBreakdown,
  renderCtcInflationAnchor,
  renderCtcInflationTruth,
  CTC_INFLATION_MIX,
} from "../../../server-handlers/_ctc-inflation";
import {
  shouldFireCtcInflationAnchor,
  planCtcInflationAnchor,
  detectInHandFollowupAfterInflation,
  planCtcInflationTruth,
} from "../../../server-handlers/_next-action-planner";
import type { NegotiationState, NegotiationLever } from "../../../server-handlers/_negotiation-kernel";

describe("CTC-inflation anchor (audit fix #3)", () => {
  describe("the lever exists in the kernel union", () => {
    it("typecheck: 'ctc-inflation-anchor' is assignable to NegotiationLever", () => {
      const lever: NegotiationLever = "ctc-inflation-anchor";
      expect(lever).toBe("ctc-inflation-anchor");
    });
  });

  describe("buildCtcInflationBreakdown", () => {
    it("returns the documented 60/18/12/5/5 mix that sums to the headline CTC", () => {
      const br = buildCtcInflationBreakdown(40);
      expect(br.ctcLpa).toBe(40);
      expect(br.fixedLpa).toBeCloseTo(24, 1); // 60%
      expect(br.variableLpa).toBeCloseTo(7.2, 1); // 18%
      expect(br.esopPaperLpa).toBeCloseTo(4.8, 1); // 12%
      expect(br.joiningBonusLpa).toBeCloseTo(2, 1); // 5%
      expect(br.benefitsLpa).toBeCloseTo(2, 1); // 5%
      const sum =
        br.fixedLpa + br.variableLpa + br.esopPaperLpa + br.joiningBonusLpa + br.benefitsLpa;
      expect(sum).toBeCloseTo(40, 0); // within rounding
      expect(
        CTC_INFLATION_MIX.fixedPct +
          CTC_INFLATION_MIX.variablePct +
          CTC_INFLATION_MIX.esopPaperPct +
          CTC_INFLATION_MIX.joiningBonusPct +
          CTC_INFLATION_MIX.benefitsPct,
      ).toBe(100);
    });

    it("safely handles non-finite or non-positive input", () => {
      expect(buildCtcInflationBreakdown(0).ctcLpa).toBe(0);
      expect(buildCtcInflationBreakdown(-5).fixedLpa).toBe(0);
      expect(buildCtcInflationBreakdown(NaN).fixedLpa).toBe(0);
    });
  });

  describe("renderCtcInflationAnchor (the inflated framing)", () => {
    it("produces a CTC-inflated quote naming all five components", () => {
      const br = buildCtcInflationBreakdown(40);
      const prose = renderCtcInflationAnchor(br);
      // Headline + all five components + the buzzwords.
      expect(prose).toMatch(/₹40L total package/);
      expect(prose).toMatch(/fixed/);
      expect(prose).toMatch(/variable/);
      expect(prose).toMatch(/ESOPs?/);
      expect(prose).toMatch(/joining bonus/i);
      expect(prose).toMatch(/benefits/i);
      expect(prose).toMatch(/fair-market-value|FMV/i);
    });
  });

  describe("renderCtcInflationTruth (the honest follow-up)", () => {
    it("reuses the SAME underlying numbers but reframes them honestly", () => {
      const br = buildCtcInflationBreakdown(40);
      const truth = renderCtcInflationTruth(br);
      // Same five rupee figures appear.
      expect(truth).toMatch(/₹24L fixed/); // 60% of 40
      expect(truth).toMatch(/₹7\.2L variable/);
      expect(truth).toMatch(/₹4\.8L ESOPs/);
      // Honest-framing markers.
      expect(truth).toMatch(/guaranteed cash/i);
      expect(truth).toMatch(/at-risk/i);
      expect(truth).toMatch(/paper value/i);
      expect(truth).toMatch(/one-time/i);
      expect(truth).toMatch(/non-cash/i);
    });
  });

  describe("planner gating", () => {
    function baseState(overrides: Partial<NegotiationState> = {}): NegotiationState {
      return {
        sessionId: "test",
        role: "se",
        company: "Razorpay",
        band: { initialOffer: 20, maxStretch: 30, walkAway: 15, hasEquity: true },
        /* Audit revision 2026-05-21 — lever is now a SUBSEQUENT-counter
         * wrap (not pre-empting the first counter). Base state reflects
         * a session that has already shipped one counter-base. */
        phase: "counter-offer",
        turnIndex: 4,
        maxTurns: 20,
        candidateTarget: 40,
        candidateCurrentCtc: 18,
        competingOffer: null,
        highestOfferMade: 22,
        leversUsed: ["counter-base"] as NegotiationLever[],
        lastAiText: "",
        lastJoiningBonusOffered: null,
        acceptedAtTurn: null,
        walkedAwayAtTurn: null,
        infoAsked: [],
        infoAskedInitiated: [],
        askedTopics: [],
        ...overrides,
      } as unknown as NegotiationState;
    }

    it("fires when candidate over-anchors and has not asked for the breakdown", () => {
      const s = baseState();
      expect(shouldFireCtcInflationAnchor(s)).toBe(true);
    });

    it("does NOT fire when candidate has already asked for the in-hand breakdown", () => {
      const s = baseState({ infoAsked: ["in-hand-monthly"] } as Partial<NegotiationState>);
      expect(shouldFireCtcInflationAnchor(s)).toBe(false);
    });

    it("does NOT fire when candidate has not anchored above the initial offer", () => {
      const s = baseState({ candidateTarget: 22 });
      expect(shouldFireCtcInflationAnchor(s)).toBe(false);
    });

    it("does NOT fire twice in the same session (single-fire)", () => {
      const s = baseState({
        leversUsed: ["counter-base", "ctc-inflation-anchor"] as NegotiationLever[],
      });
      expect(shouldFireCtcInflationAnchor(s)).toBe(false);
    });

    it("does NOT fire pre-emptively on the FIRST counter (no counter-base yet)", () => {
      const s = baseState({ leversUsed: [] as NegotiationLever[] });
      expect(shouldFireCtcInflationAnchor(s)).toBe(false);
    });

    it("does NOT fire outside counter-offer / closing-push phases", () => {
      const s = baseState({ phase: "offer-presented" } as Partial<NegotiationState>);
      expect(shouldFireCtcInflationAnchor(s)).toBe(false);
    });

    it("also fires in closing-push phase after a counter-base", () => {
      const s = baseState({ phase: "closing-push" } as Partial<NegotiationState>);
      expect(shouldFireCtcInflationAnchor(s)).toBe(true);
    });

    it("planCtcInflationAnchor produces a fully-typed action with all five components", () => {
      const s = baseState();
      const action = planCtcInflationAnchor(s);
      expect(action).not.toBeNull();
      expect(action?.kind).toBe("ctc-inflation-anchor");
      expect(action?._move.lever).toBe("ctc-inflation-anchor");
      if (action?.kind === "ctc-inflation-anchor") {
        expect(action.ctcLpa).toBe(40);
        expect(action.fixedLpa).toBeCloseTo(24, 1);
      }
    });
  });

  describe("truth-on-followup detection", () => {
    function stateAfterAnchor(): NegotiationState {
      return {
        sessionId: "test",
        leversUsed: ["ctc-inflation-anchor"] as NegotiationLever[],
      } as unknown as NegotiationState;
    }

    it("detects when the candidate asks for the breakdown", () => {
      const s = stateAfterAnchor();
      expect(detectInHandFollowupAfterInflation(s, "what's the in-hand on that?")).toBe(true);
      expect(detectInHandFollowupAfterInflation(s, "can you give me the breakdown?")).toBe(true);
      expect(detectInHandFollowupAfterInflation(s, "what's my take-home monthly?")).toBe(true);
      expect(detectInHandFollowupAfterInflation(s, "what's the guaranteed cash?")).toBe(true);
    });

    it("returns false if the inflation lever has not fired this session", () => {
      const s = { ...stateAfterAnchor(), leversUsed: [] } as NegotiationState;
      expect(detectInHandFollowupAfterInflation(s, "in-hand?")).toBe(false);
    });

    it("planCtcInflationTruth ships the same numbers as the original anchor", () => {
      const truth = planCtcInflationTruth(40);
      expect(truth).not.toBeNull();
      expect(truth?.kind).toBe("ctc-inflation-truth");
      if (truth?.kind === "ctc-inflation-truth") {
        expect(truth.fixedLpa).toBeCloseTo(24, 1); // identical math
        expect(truth.variableLpa).toBeCloseTo(7.2, 1);
      }
    });
  });
});
