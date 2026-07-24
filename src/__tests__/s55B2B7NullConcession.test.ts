/* S55-B2 / S55-B7 (2026-07-24) — Null concession: recruiter pivots to tax
 * structuring / comp-structure explanation instead of responding to counter.
 *
 * Two root causes fixed:
 *
 * S55-B7: "can you move the base to ₹65L?" — Q_LEAD_RE matched "can you"
 * prefix → detectCandidateAskedQuestion returned asked:true → pipeline routed
 * to generateAnswerToCandidate → LLM explained comp structure. Fix: suppress
 * question detection for "can you move/raise/increase to N" counter-ask phrases
 * via COUNTER_ASK_RE pre-filter in detectCandidateAskedQuestion.
 *
 * S55-B2: Candidate countered ₹70L AND mentioned tax (HRA/NPS/LTA) in same
 * utterance → mentionedTaxImplication=true → wired-profile tax-implication
 * reactive fired BEFORE counter-offer engine. Fix: when lastCandidateCounterLpa
 * != null (fresh counter), bypass reactive/wired followup block so counter-offer
 * engine owns the turn. */
import { describe, it, expect } from "vitest";
import { detectCandidateAskedQuestion } from "../../server-handlers/_fact-pack";
import {
  initState,
  applyCandidateAnswer,
  lockAnchor,
  type NegotiationBand,
  type NegotiationState,
} from "../../server-handlers/_negotiation-kernel";
import { planNextAction } from "../../server-handlers/_next-action-planner";

/* ── S55-B7: detectCandidateAskedQuestion suppresses counter-ask phrasings ── */

describe("S55-B7 — detectCandidateAskedQuestion suppresses counter-ask phrases", () => {
  it("'can you move the base to ₹65L?' is NOT detected as a question", () => {
    const r = detectCandidateAskedQuestion("can you move the base to ₹65L?");
    expect(r.asked).toBe(false);
  });

  it("'can you go to 70?' is NOT detected as a question", () => {
    const r = detectCandidateAskedQuestion("can you go to 70?");
    expect(r.asked).toBe(false);
  });

  it("'can you raise it to 75 LPA?' is NOT detected as a question", () => {
    const r = detectCandidateAskedQuestion("can you raise it to 75 LPA?");
    expect(r.asked).toBe(false);
  });

  it("'can you increase the base by 5?' is NOT detected as a question", () => {
    const r = detectCandidateAskedQuestion("can you increase the base by 5?");
    expect(r.asked).toBe(false);
  });

  it("'can you do 68 LPA?' is NOT detected as a question", () => {
    const r = detectCandidateAskedQuestion("can you do 68 LPA?");
    expect(r.asked).toBe(false);
  });

  it("genuine factual questions are still detected (regression)", () => {
    expect(detectCandidateAskedQuestion("what is the WFH policy?").asked).toBe(true);
    expect(detectCandidateAskedQuestion("how big is the team?").asked).toBe(true);
    expect(detectCandidateAskedQuestion("when would I join?").asked).toBe(true);
  });
});

/* ── S55-B2: planner bypasses reactive/wired when fresh counter present ── */

const BAND: NegotiationBand = {
  initialOffer: 58,
  maxStretch: 75,
  walkAway: 45,
  hasEquity: false,
};

function makeStateWithCounterAndTaxFlag(counterLpa: number): NegotiationState {
  const s0 = initState({
    sessionId: "s-s55b2",
    role: "swe",
    company: "swiggy",
    band: BAND,
  });
  /* Establish CTC so discovery is sufficient. */
  const s1 = applyCandidateAnswer(s0, "My current CTC is ₹45L and I am targeting ₹70L.");
  /* Inject offer-on-table state. lockAnchor sets anchorLocked but NOT
   * highestOfferMade; set both so the planner sees a live offer. Also
   * inject lastCandidateCounterLpa directly — re-stating the same ₹70L
   * target from applyCandidateAnswer doesn't count as a "fresh" counter
   * (the kernel guards against re-assertions), so we inject it at the
   * state layer to simulate a DIFFERENT counter value arriving this turn. */
  return {
    ...lockAnchor(s1, 58),
    highestOfferMade: 58,
    lastCandidateCounterLpa: counterLpa,    /* injected — fresh counter */
    candidateProfile: {
      ...(s1.candidateProfile ?? {}),
      mentionedTaxImplication: true,        /* wired tax probe should NOT win */
    },
  } as NegotiationState;
}

describe("S55-B2 — planner bypasses reactive/wired when fresh counter present", () => {
  it("next action is counter-offer (not reactive tax-implication) when candidate countered", () => {
    const state = makeStateWithCounterAndTaxFlag(70);
    /* Sanity: lastCandidateCounterLpa must be set for the bypass to fire. */
    expect(state.lastCandidateCounterLpa).not.toBeNull();
    /* mentionedTaxImplication must be true so the wired probe WOULD fire
     * if the bypass weren't present. */
    expect(state.candidateProfile?.mentionedTaxImplication).toBe(true);
    const action = planNextAction(state);
    expect(action).not.toBeNull();
    /* Must NOT be a reactive-followup tax-implication (the counter engine owns this turn). */
    const isTaxReactive =
      action?.kind === "reactive-followup" &&
      (action as { topic?: string }).topic === "tax-implication";
    expect(isTaxReactive).toBe(false);
  });

  it("reactive-followup CAN fire when there is NO fresh counter (regression guard)", () => {
    /* Without a fresh counter, mentionedTaxImplication should still allow
     * the reactive/wired path to fire normally. */
    const s0 = initState({ sessionId: "s-s55b2-reg", role: "swe", company: "swiggy", band: BAND });
    const s1 = applyCandidateAnswer(s0, "My current CTC is ₹45L and I am targeting ₹70L.");
    const s2 = lockAnchor(s1, 58);
    /* No counter this turn — candidate just mentions tax. */
    const s3 = applyCandidateAnswer(s2, "Also what is the tax structure here?");
    const stateWithTax = {
      ...s3,
      lastCandidateCounterLpa: null, /* no fresh counter */
      candidateProfile: {
        ...(s3.candidateProfile ?? {}),
        mentionedTaxImplication: true,
      },
    } as NegotiationState;
    /* In this case the reactive/wired path is allowed (and tax-implication may fire). */
    const action = planNextAction(stateWithTax);
    /* Just verify the planner returns something valid — it's not restricted. */
    expect(action).not.toBeNull();
  });
});
