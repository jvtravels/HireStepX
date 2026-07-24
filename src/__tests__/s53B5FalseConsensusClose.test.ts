/* S53-B5 (2026-07-24) — False consensus close: recruiter says "We're in the same
 * range, then, let's lock it at ₹18.1L" after candidate has a known target of ₹24L
 * (33% gap from the offer).
 *
 * Root cause: detectTrialCloseResponse returned "accept" for "24 works for me"
 * (matches ACCEPT_PATTERNS via "works for me"), stamping candidateSignaledClose=true
 * AND verbalAcceptanceTurn after a trial-close ask. The planner then fired
 * close-confirmation at nearOfferCloseNumber = 18.1L (offer, since 24-18.1=5.9L >
 * near-offer gap) and emitted "We're in the same range, then, let's lock it at
 * ₹18.1L" — fabricated false consensus with a 33% gap between the two numbers.
 *
 * Fix: veto BOTH candidateSignaledClose stamp AND verbalAcceptanceTurn stamp when:
 *   (a) a fresh counter THIS turn is above the offer by > max(₹2L, 6%), OR
 *   (b) no fresh counter was named AND the candidate's known target is above
 *       the offer by > max(₹2L, 6%) — meaning the accept idiom refers to their
 *       price, not the recruiter's offer.
 *
 * "24 works for me" after a ₹18.1L offer → knownTarget=24, gap=5.9L > 2L → veto.
 * "18.5 LPA works for me" after ₹18.1L → freshCounter=18.5, gap=0.4L < 2L → NO veto.
 * "yes, that works for me" (no number) → freshCounter=null, knownTarget=20, 1.9<2 → NO veto. */

import { describe, it, expect } from "vitest";
import {
  initState,
  applyCandidateAnswer,
  lockAnchor,
  type NegotiationBand,
  type NegotiationState,
} from "../../server-handlers/_negotiation-kernel";
import { planNextAction } from "../../server-handlers/_next-action-planner";

const BAND: NegotiationBand = {
  initialOffer: 16,
  maxStretch: 26,
  walkAway: 12,
  hasEquity: false,
};

/* Trial-close text that actually matches detectTrialCloseAsked (pattern 1:
 * /\bif\s+we\s+(?:land|close|…)\s+at\s+₹[\d.,]+/i). */
const TRIAL_CLOSE_AT_18_1 =
  "If we land at ₹18.1L, would you accept this offer today?";

/* Build a state that represents: anchor made at 18.1L, candidateTarget=24 known
 * from earlier discovery turns, trial-close text as last AI utterance.
 * candidateTarget is injected directly because in real sessions it comes from
 * a separate discovery turn; in unit tests we replicate that by injecting it
 * directly onto the state object rather than relying on the discovery turn path. */
function makeTrialCloseState(params: {
  offerLpa: number;
  candidateTarget: number | null;
  trialCloseText?: string;
}): NegotiationState {
  const s0 = initState({ sessionId: "s53b5", role: "consultant", company: "mckinsey", band: BAND });
  return {
    ...lockAnchor(s0, params.offerLpa),
    highestOfferMade: params.offerLpa,
    candidateTarget: params.candidateTarget,
    lastAiText: params.trialCloseText ?? TRIAL_CLOSE_AT_18_1,
  } as NegotiationState;
}

describe("S53-B5 — false consensus close veto when counter is above near-offer gap", () => {
  it("candidateSignaledClose is NOT set when candidate's known target is 33% above offer", () => {
    /* candidateTarget=24, offer=18.1, gap=5.9L > 2L → veto fires, stamp blocked.
     * "24 LPA works for me" matches ACCEPT_PATTERNS "works for me" but the number
     * (24) is above the offer by far more than the near-offer gap. */
    const base = makeTrialCloseState({ offerLpa: 18.1, candidateTarget: 24 });
    const s = applyCandidateAnswer(base, "24 LPA works for me.");
    expect((s as NegotiationState & { candidateSignaledClose?: boolean }).candidateSignaledClose).not.toBe(true);
  });

  it("verbalAcceptanceTurn is NOT set when candidate's known target is 33% above offer", () => {
    /* Same scenario — verbalAcceptanceTurn must also be blocked so the planner
     * does not route to close-acceptance from that path either. */
    const base = makeTrialCloseState({ offerLpa: 18.1, candidateTarget: 24 });
    const s = applyCandidateAnswer(base, "24 LPA works for me.");
    /* verbalAcceptanceTurn starts null (not yet stamped). The veto should
     * prevent it from being set to s.turnIndex — verify it stays null/untouched. */
    expect(s.verbalAcceptanceTurn).toBeNull();
  });

  it("planner produces counter-offer (not close) after veto", () => {
    const base = makeTrialCloseState({ offerLpa: 18.1, candidateTarget: 24 });
    const s = applyCandidateAnswer(base, "24 LPA works for me.");
    const action = planNextAction(s);
    expect(action).not.toBeNull();
    /* Must NOT be a close-confirmation — that would be the fabricated false consensus. */
    expect(action?.kind).not.toBe("close");
    expect(action?.kind).not.toBe("auto-accept");
  });

  it("candidateSignaledClose IS set when counter is within near-offer gap", () => {
    /* "18.5 LPA works for me" after ₹18.1L offer.
     * freshCounter=18.5 (extracted this turn), gap=0.4L < max(2, 18.1*0.06=1.09)=2L.
     * Since freshCounter != null and gap is small, veto does NOT fire. */
    const base = makeTrialCloseState({ offerLpa: 18.1, candidateTarget: null });
    const s = applyCandidateAnswer(base, "18.5 LPA works for me, let's close.");
    expect((s as NegotiationState & { candidateSignaledClose?: boolean }).candidateSignaledClose).toBe(true);
  });

  it("candidateSignaledClose IS set when candidate responds with no number (pure accept)", () => {
    /* "yes, that works for me" — no counter number, freshCounter=null.
     * candidateTarget=20, gap=20-18.1=1.9L < 2L → veto does NOT fire. */
    const base = makeTrialCloseState({ offerLpa: 18.1, candidateTarget: 20 });
    const s = applyCandidateAnswer(base, "yes, that works for me");
    expect((s as NegotiationState & { candidateSignaledClose?: boolean }).candidateSignaledClose).toBe(true);
  });
});
