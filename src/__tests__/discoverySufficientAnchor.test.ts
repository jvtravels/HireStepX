/* Discovery-sufficient anchor — terse / fixed-scoped-target close
 * (2026-06-18, live-staging adversarial battery).
 *
 * Live symptom: a candidate who disclosed CURRENT comp and a FIXED-scoped
 * target ("Mujhe 32 LPA fixed chahiye" → candidateTargetFixed=32,
 * candidateTarget=null) but phrased notice as "60 din" (unparsed) and
 * value-proof conversationally (unparsed) never completed discovery. The
 * planner's anchor bridges were gated on isDiscoveryComplete AND
 * candidateTarget != null — BOTH false here — so the bot re-probed for
 * discovery items forever and read as a stall (hom stayed 0).
 *
 * Structural fix (server-handlers/_discovery-stage.ts +
 * _next-action-planner.ts): anchor once discovery is *sufficient* (both
 * essentials known) and honor a fixed-scoped target as an expressed
 * expectation. These tests lock the predicate and the end-to-end behavior:
 *   1. isDiscoverySufficientToAnchor returns true on current+target alone,
 *      stays strictly weaker than isDiscoveryComplete (false without both).
 *   2. A normal-band fixed-target transcript anchors promptly (hom>0 by an
 *      early turn) and reaches phase "accepted" — a real close.
 */
import { describe, it, expect } from "vitest";
import {
  isDiscoverySufficientToAnchor,
  isDiscoveryComplete,
  type DiscoveryChecklist,
} from "../../server-handlers/_discovery-stage";
import {
  applyCandidateAnswer,
  applyAiMove,
  pickAiMove,
  initState,
  type NegotiationState,
} from "../../server-handlers/_negotiation-kernel";
import { planNextAction } from "../../server-handlers/_next-action-planner";
import { renderCanonicalProse } from "../../server-handlers/_canonical-prose";

function mkChecklist(over: Partial<DiscoveryChecklist>): DiscoveryChecklist {
  return {
    currentCtcAnswered: false,
    fixedVariableSplitAnswered: false,
    noticePeriodAnswered: false,
    targetAnswered: false,
    valueProofAnswered: false,
    ...over,
  } as DiscoveryChecklist;
}

describe("isDiscoverySufficientToAnchor", () => {
  it("is true once current + target are known, even with notice/value-proof unanswered", () => {
    const cl = mkChecklist({
      currentCtcAnswered: true,
      targetAnswered: true,
    });
    // engineering requires valueProof for full completion...
    expect(isDiscoveryComplete(cl, "engineering")).toBe(false);
    // ...but the two essentials are enough to anchor.
    expect(isDiscoverySufficientToAnchor(cl, "engineering")).toBe(true);
  });

  it("is strictly weaker than isDiscoveryComplete — never fires without both essentials", () => {
    expect(
      isDiscoverySufficientToAnchor(
        mkChecklist({ currentCtcAnswered: true }),
        "engineering",
      ),
    ).toBe(false);
    expect(
      isDiscoverySufficientToAnchor(
        mkChecklist({ targetAnswered: true }),
        "engineering",
      ),
    ).toBe(false);
  });

  it("every complete checklist is also sufficient (weaker, never stricter)", () => {
    const complete = mkChecklist({
      currentCtcAnswered: true,
      fixedVariableSplitAnswered: true,
      noticePeriodAnswered: true,
      targetAnswered: true,
      valueProofAnswered: true,
    });
    expect(isDiscoveryComplete(complete, "engineering")).toBe(true);
    expect(isDiscoverySufficientToAnchor(complete, "engineering")).toBe(true);
  });
});

describe("fixed-scoped target with incomplete discovery anchors promptly and closes", () => {
  function aiTurn(s: NegotiationState): NegotiationState {
    const action = planNextAction(s);
    const move = pickAiMove(s);
    return applyAiMove(s, move, renderCanonicalProse(action, s));
  }

  it("anchors a concrete number early (hom>0) and reaches phase 'accepted' — no stall", () => {
    let s: NegotiationState = initState({
      sessionId: "s-disc-sufficient",
      role: "Software Engineer",
      company: "Acme",
      // Normal band that comfortably clears the disclosed CTC of 24, so a
      // real anchor (not an honest-defer) lands.
      band: { initialOffer: 26, maxStretch: 34, walkAway: 20, hasEquity: true },
    });
    const answers = [
      "Abhi main 24 LPA pe hoon, fixed 20 variable 4.",
      "Notice 60 din, buyout ho sakta hai.", // unparsed notice — discovery stays incomplete
      "Maine payments system rebuild kiya, 40% latency kam ki.", // conversational value-proof
      "Mujhe 32 LPA fixed chahiye.", // fixed-scoped target → candidateTargetFixed
      "Theek hai, accept karta hoon.",
    ];
    let anchoredBy = -1;
    answers.forEach((a, i) => {
      s = applyCandidateAnswer(s, a);
      s = aiTurn(s);
      if (anchoredBy === -1 && s.highestOfferMade > 0) anchoredBy = i;
    });

    // Fixed-scoped target bound; raw candidateTarget stays null.
    expect(s.candidateTargetFixed).toBe(32);
    expect(s.candidateCurrentCtc).toBe(24);
    // Discovery never fully completed (notice/value-proof unparsed)...
    expect(s.discoveryChecklist?.noticePeriodAnswered).toBe(false);
    // ...yet a concrete number anchored early and the deal closed.
    expect(s.highestOfferMade).toBeGreaterThan(0);
    expect(anchoredBy).toBeGreaterThanOrEqual(0);
    expect(anchoredBy).toBeLessThanOrEqual(4);
    expect(s.phase).toBe("accepted");
  });
});
