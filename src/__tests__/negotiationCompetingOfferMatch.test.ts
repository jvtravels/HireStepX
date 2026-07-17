/* Competing-offer acknowledge + match (live-staging 2026-06-19, #92).
 *
 * Real Razorpay PM session: after the AI anchored ₹35L, the candidate
 * disclosed a rival offer — "I have an offer from Zomato at 38, can you
 * match it?" The bot IGNORED the leverage: it neither bound the rival
 * number nor moved toward it, replying with a generic split-toward-target
 * that landed at ₹36.6L — below the candidate's stated competing ₹38L.
 *
 * Two structural fixes converge here and are locked by this suite:
 *   1. The number-role classifier binds a rival-company-named competing
 *      amount ("offer from Zomato at 38") to state.competingOffer even
 *      when the company sits BETWEEN "offer" and the number and the number
 *      is bare (no LPA unit). Before, only adjacent "offer of/at N" bound,
 *      so the rival number attached to no role and the bot ignored it.
 *   2. The counter-offer planner raises its concession floor to a credible,
 *      in-band, NAMED competing offer that sits above the standing offer
 *      and below the candidate's own aspiration — so the counter genuinely
 *      MATCHES the rival number rather than under-cutting it. Vague
 *      (unnamed) offers are still routed to the credibility probe, and a
 *      competing number above the band ceiling is never auto-matched.
 */
import { describe, it, expect } from "vitest";
import {
  initState,
  applyAiMove,
  applyCandidateAnswer,
  type NegotiationBand,
  type NegotiationState,
} from "../../server-handlers/_negotiation-kernel";
import { planNextAction, actionToLever } from "../../server-handlers/_next-action-planner";

const band: NegotiationBand = { initialOffer: 35, maxStretch: 42, walkAway: 30, hasEquity: false };

function anchoredAt35(): NegotiationState {
  let s = initState({ sessionId: "co92", role: "product", company: "Razorpay", band });
  s = { ...s, minTurnsBeforeClose: 0 };
  s = applyAiMove(s, { lever: "probe", newTotalLpa: null, rationale: "ctc" }, "What's your current CTC?");
  s = applyCandidateAnswer(s, "my current ctc is 30 LPA");
  s = applyAiMove(s, { lever: "probe", newTotalLpa: null, rationale: "target" }, "What are you targeting?");
  s = applyCandidateAnswer(s, "I'm targeting 41 LPA");
  s = applyAiMove(s, { lever: "open-with-offer", newTotalLpa: 35, rationale: "anchor" }, "For this grade we can do ₹35 LPA.");
  s = applyCandidateAnswer(s, "let me think about it");
  s = applyAiMove(s, { lever: "probe", newTotalLpa: null, rationale: "x" }, "Sure — what's on your mind?");
  return s;
}

describe("#92 — competing-offer acknowledge + match", () => {
  it("binds a rival-company-named competing amount ('offer from Zomato at 38')", () => {
    let s = anchoredAt35();
    s = applyCandidateAnswer(s, "I have an offer from Zomato at 38, can you match it?");
    expect(s.competingOffer).toBe(38);
    expect(s.lastTurnDelta?.disclosedCompetingOffer).toBe(true);
  });

  it("counters AT or ABOVE the named, in-band competing number (genuine match, not under-cut)", () => {
    let s = anchoredAt35();
    s = applyCandidateAnswer(s, "I have an offer from Zomato at 38, can you match it?");
    const action = planNextAction(s);
    expect(action.kind).toBe("counter-offer");
    const move = actionToLever(action, s);
    expect(move.lever).toBe("counter-base");
    // Must meet the rival ₹38L, not the legacy generic ~₹36.6L under-cut.
    expect(move.newTotalLpa).not.toBeNull();
    expect(move.newTotalLpa as number).toBeGreaterThanOrEqual(38);
    // ...and never breach the band ceiling.
    expect(move.newTotalLpa as number).toBeLessThanOrEqual(42);
  });

  it("never matches a competing number ABOVE the band ceiling (no auto-overpay)", () => {
    let s = anchoredAt35();
    // 48 is above the ceiling of 42 — must not anchor the counter to 48.
    s = applyCandidateAnswer(s, "I have an offer from Flipkart at 48, can you match it?");
    const action = planNextAction(s);
    const move = actionToLever(action, s);
    if (move.newTotalLpa != null) {
      expect(move.newTotalLpa).toBeLessThanOrEqual(42);
    }
  });

  it("a VAGUE (unnamed) competing number is probed for credibility, not silently matched", () => {
    let s = anchoredAt35();
    s = applyCandidateAnswer(s, "I have another offer at 39, can you match it?");
    const action = planNextAction(s);
    // No named company → credibility probe path, not a competing-match counter.
    expect(action.kind).toBe("reactive-followup");
  });
});

describe("OA-B65 — competing-offer revocation clears the scalar leverage", () => {
  it("a revoked offer clears state.competingOffer (was monotone-sticky)", () => {
    let s = anchoredAt35();
    s = applyCandidateAnswer(s, "I have an offer from Zomato at 38, can you match it?");
    expect(s.competingOffer).toBe(38);
    // Candidate later concedes the rival offer collapsed — leverage gone.
    s = applyCandidateAnswer(s, "actually that Zomato offer fell through");
    expect(s.competingOffer).toBeNull();
    expect(s.competingOfferDetail?.amount ?? null).toBeNull();
    expect(s.competingOfferDetail?.onHold).toBe(true);
    expect(s.userClaims?.competingOffer).toBeUndefined();
  });

  it("on-hold (delayed but real) does NOT clear the scalar — distinct from revoked", () => {
    let s = anchoredAt35();
    s = applyCandidateAnswer(s, "I have an offer from Zomato at 38, can you match it?");
    expect(s.competingOffer).toBe(38);
    s = applyCandidateAnswer(s, "the Zomato offer is on hold for a couple of weeks");
    expect(s.competingOffer).toBe(38);
  });

  it("revocation with no offer on record is a harmless no-op", () => {
    let s = anchoredAt35();
    s = applyCandidateAnswer(s, "the offer fell through");
    // Never had a competing offer → nothing to clear, scalar stays null.
    expect(s.competingOffer ?? null).toBeNull();
  });
});
