/* Near-offer accepted-number close (live-staging 2026-06-19, #93).
 *
 * Real Razorpay PM session: after the AI anchored ₹35L, the candidate
 * closed AT a concrete number a hair above the offer — "36 and I'll sign
 * today." The legacy planner fired the "Post-anchor acceptance" gate,
 * which closed at the standing offer (₹35L) and DISCARDED the ₹36 the
 * candidate had just offered to sign at. Closing below the number the
 * candidate named is the forbidden under-close — it reads as a
 * bait-and-switch and is exactly the kind of complaint we must never
 * ship.
 *
 * Structural fix locked here: a single source of truth,
 * `nearOfferCloseNumber(state)`, sourcing the bound counter / sticky
 * candidate target, honored only when it sits above the offer, under the
 * band ceiling, and within a trivial gap (max ₹2L or 6%). Both the
 * "Post-anchor acceptance" gate and the close-confirmation gate consult
 * it, so a near-offer accepted number closes AT that number — while a
 * far-above-offer or over-ceiling number never drags the close up.
 */
import { describe, it, expect } from "vitest";
import {
  initState,
  applyAiMove,
  applyCandidateAnswer,
  type NegotiationBand,
  type NegotiationState,
} from "../../server-handlers/_negotiation-kernel";
import {
  planNextAction,
  actionToLever,
  nearOfferCloseNumber,
} from "../../server-handlers/_next-action-planner";

const band: NegotiationBand = { initialOffer: 35, maxStretch: 40, walkAway: 30, hasEquity: false };

function anchoredAt35(): NegotiationState {
  let s = initState({ sessionId: "near93", role: "product", company: "Razorpay", band });
  s = { ...s, minTurnsBeforeClose: 0 };
  s = applyAiMove(s, { lever: "probe", newTotalLpa: null, rationale: "ctc" }, "What's your current CTC?");
  s = applyCandidateAnswer(s, "my current ctc is 30 LPA");
  s = applyAiMove(s, { lever: "probe", newTotalLpa: null, rationale: "target" }, "What are you targeting?");
  s = applyCandidateAnswer(s, "I'm targeting 36 LPA");
  s = applyAiMove(s, { lever: "open-with-offer", newTotalLpa: 35, rationale: "anchor" }, "For this grade we can do ₹35 LPA.");
  s = applyCandidateAnswer(s, "let me think about it");
  s = applyAiMove(s, { lever: "probe", newTotalLpa: null, rationale: "x" }, "Sure — what's on your mind?");
  return s;
}

describe("#93 — near-offer accepted number closes AT that number", () => {
  it("nearOfferCloseNumber honors a near-offer target above the offer", () => {
    const s = anchoredAt35();
    // candidateTarget sticky at 36, offer 35, gap ≤ max(2, 2.1) → honor 36.
    expect(nearOfferCloseNumber(s)).toBe(36);
  });

  it("nearOfferCloseNumber never raises beyond the band ceiling or a trivial gap", () => {
    let s = anchoredAt35();
    // Force a far-above target: a bound counter at 48 (over ceiling 40).
    s = applyCandidateAnswer(s, "actually I want 48");
    expect(nearOfferCloseNumber(s)).toBe(35);
  });

  it("closes AT ₹36 when the candidate accepts at a near-offer number, not the standing ₹35", () => {
    let s = anchoredAt35();
    s = applyCandidateAnswer(s, "36 and I'll sign today");
    const action = planNextAction(s);
    expect(action.kind === "close" || action.kind === "auto-accept").toBe(true);
    const move = actionToLever(action, s);
    expect(move.lever).toBe("close-acceptance");
    expect(move.newTotalLpa).toBe(36);
  });
});
