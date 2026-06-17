import { describe, it, expect } from "vitest";
import {
  initState,
  applyCandidateAnswer,
  parseCandidateAnswer,
  computeTurnDelta,
  type NegotiationBand,
  type NegotiationState,
} from "../../server-handlers/_negotiation-kernel";
import { planNextAction } from "../../server-handlers/_next-action-planner";

/**
 * Kernel + planner regression for the FOURTH completion sink (live-staging
 * finding, 2026-06-17).
 *
 * The bug: a candidate CLOSING on OUR offer ("happy to accept and move ahead
 * with the offer letter") deflected instead of closing. Root cause: the
 * context-free competing-offer extractor matches a bare "offer letter" as a
 * competing-offer `status: "letter"` — but in a close context "the offer
 * letter" refers to OUR letter, not a competitor's. That set
 * `delta.disclosedCompetingOffer`, and the `competing-credibility` reactive
 * rule pre-empted the post-anchor acceptance close, so the recruiter probed a
 * phantom competing offer forever instead of closing like a real HR.
 *
 * Fix (kernel computeTurnDelta): a competingOfferDetail whose ONLY signal is a
 * format/state `status` (letter/email/verbal/signed) does NOT count as a
 * competing disclosure on a turn that also accepts our offer. Concrete
 * competing context (company / stage / amount / letter-share / on-hold) still
 * fires unconditionally.
 */

const BAND: NegotiationBand = {
  initialOffer: 22.4,
  maxStretch: 31.4,
  walkAway: 16.8,
  hasEquity: true,
};

/** A post-anchor state mirroring the live Session-2 scenario: the recruiter
 *  has already counter-offered to ₹24.5L total and the candidate is about to
 *  accept. */
function postAnchorState(): NegotiationState {
  return {
    ...initState({ sessionId: "accept-not-competing", role: "Senior Product Designer", company: "Razorpay", band: BAND }),
    phase: "counter-offer",
    turnIndex: 6,
    highestOfferMade: 24.5,
    firstOfferAtTurn: 2,
    offerAskedAtTurn: 1,
    phaseEnteredAtTurn: 4,
    candidateTargetFixed: 28,
  };
}

const ACCEPTANCE =
  "That structure works for me. The revised fitment at 24.5 total plus the stronger ESOP grant closes the gap — I'm happy to accept and move ahead with the offer letter.";

describe('negotiation — "offer letter" in an acceptance is OUR offer, not a competing disclosure', () => {
  it('the acceptance utterance still trips the extractor\'s status="letter" (the trap)', () => {
    const parsed = parseCandidateAnswer(ACCEPTANCE, "", "counter-offer", true, 6);
    // This is the exact trap: the context-free extractor sees "offer letter".
    expect(parsed.competingOfferDetail.status).toBe("letter");
  });

  it("computeTurnDelta does NOT flag a competing disclosure on the acceptance turn", () => {
    const pre = postAnchorState();
    const parsed = parseCandidateAnswer(ACCEPTANCE, "", "counter-offer", true, 6);
    const delta = computeTurnDelta(pre, pre, parsed, ACCEPTANCE);
    expect(delta.disclosedCompetingOffer).toBe(false);
  });

  it("a status-only competing detail still fires when the candidate is NOT accepting", () => {
    const pre = postAnchorState();
    const utter = "I already have the offer letter in hand, just so you know.";
    const parsed = parseCandidateAnswer(utter, "", "counter-offer", true, 6);
    expect(parsed.competingOfferDetail.status).toBe("letter");
    const delta = computeTurnDelta(pre, pre, parsed, utter);
    // Not an acceptance → the competing format-status remains a real signal.
    expect(delta.disclosedCompetingOffer).toBe(true);
  });

  it("a competing disclosure with a named company still fires even alongside acceptance language", () => {
    const pre = postAnchorState();
    const utter = "Sounds good, though I do have the offer letter from Google as well.";
    const parsed = parseCandidateAnswer(utter, "", "counter-offer", true, 6);
    const delta = computeTurnDelta(pre, pre, parsed, utter);
    // Company name is concrete competing context — unconditional trigger.
    expect(delta.disclosedCompetingOffer).toBe(true);
  });

  it("the planner closes on the acceptance — never deflects to a competing-offer probe", () => {
    const pre = postAnchorState();
    const next = applyCandidateAnswer(pre, ACCEPTANCE);
    const action = planNextAction(next);

    // The whole point: a real-HR close, not a phantom competing-offer probe.
    expect(action.kind).not.toBe("reactive-followup");
    expect(action.kind).toBe("close");
  });
});
