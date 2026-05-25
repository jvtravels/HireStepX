/* PDF#42 Architectural Fix Pass — Flipkart Senior Product Designer
 * session (2026-05-21). Four bugs surfaced in one closing session.
 *
 *   Live transcript (Flipkart SPD, band ~30-50, CTC=32):
 *     T9  AI:   "...the fitment we're able to offer is ₹35 LPA..."   [anchor]
 *     T17 AI:   "...other opportunity — is the offer letter in hand..." [fake-leverage]
 *     T18 Cand: "I have an another offer of 42 LPA CTC in hand"      [proof]
 *     T19 AI:   "Thanks for that — what else can we add to the
 *                fitment?"                                            ← BUG-A
 *     T20 Cand: "Can you increase the base salary?"
 *     T21 AI:   "Base salary is a fixed component, and we don't
 *                negotiate it separately from the CTC..."             ← BUG-B
 *     T23 AI:   "We're discussing base salary in the context of your
 *                current CTC and expected CTC range..."
 *     T24 Cand: "what is your final offer?"
 *     T25 AI:   (T23 verbatim)                                        ← BUG-C
 *     session terminated abruptly                                     ← BUG-D
 *
 *   Architectural fixes:
 *     BUG-A: new `competitor-match` NextAction kind fires before the
 *            lever-explore fallback when the candidate has substantiated
 *            a higher competing offer (proofProvided OR letterShareOffered).
 *            Recruiter commits to a panel re-check instead of asking the
 *            candidate to propose enhancements. Single-fire via
 *            state.competitorMatchFiredAtTurn.
 *     BUG-B: response pipeline now reads action.topic and short-circuits
 *            the LLM answer-from-factPack path when the planner has
 *            already routed to a wired-profile-followup (wants-higher-base
 *            / wants-joining-bonus / wants-relocation-allowance / etc.).
 *            The wired canonical prose ships through the restyle path
 *            instead of the LLM freelancing a refusal.
 *     BUG-C: every defer return in generateAnswerToCandidate now routes
 *            through shipDefer which runs isVerbatimRepeat / leading-ack-
 *            rotation checks against state.lastAiText. Previously only
 *            the LLM-answer happy path was guarded; the validation /
 *            fact-gap / llm-throw defer paths shipped byte-identical
 *            text twice in a row when consecutive turns rejected for
 *            the same reason.
 *     BUG-D: OFFER_ASK_RE extended to match "final offer", "last offer",
 *            "best (and) final", "what's your final/last number". The
 *            candidate's "what is your final offer?" now stamps
 *            offerAskedAtTurn so the planner routes to a closing-push
 *            restate instead of the question-intent classifier's
 *            generic budget-deflection (which masked the ask and
 *            trickled into the abrupt-termination chain).
 */
import { describe, it, expect } from "vitest";
import {
  initState,
  applyCandidateAnswer,
  isVerbatimRepeat,
  type NegotiationBand,
  type NegotiationState,
} from "../../../server-handlers/_negotiation-kernel";
import { planNextAction } from "../../../server-handlers/_next-action-planner";
import { renderCanonicalProse } from "../../../server-handlers/_canonical-prose";
import { EMPTY_CANDIDATE_PROFILE } from "../../../server-handlers/_candidate-profile";

const FLIPKART_SR_PD_BAND: NegotiationBand = {
  initialOffer: 35,
  maxStretch: 50,
  walkAway: 30,
  hasEquity: true,
  baseFloor: 24,
  baseStretch: 38,
  variableMax: 7,
};

function newState(overrides: Partial<NegotiationState> = {}): NegotiationState {
  const base = initState({
    sessionId: "pdf42-flipkart-sr-pd",
    role: "Senior Product Designer",
    company: "Flipkart",
    band: FLIPKART_SR_PD_BAND,
    recruiterSectorPersona: "indian-unicorn",
    multiRoundEnabled: false,
    candidateName: "Karthik Nair",
  });
  return { ...base, ...overrides };
}

describe("PDF#42 — Flipkart Senior PD competitor-match / closing-pass bugs", () => {
  it("BUG-A — substantiated higher competing offer routes to competitor-match (not lever-explore)", () => {
    /* Reconstruct the live T19 precondition: anchor at 35 already on the
     * table, fake-leverage-challenge already fired (proof was requested),
     * candidate just substantiated a 42 LPA competing offer. The legacy
     * planner cascaded into pickLeverExploreMove here, which the LLM
     * restyled into "what else can we add to the fitment?". After the
     * fix, planner must return competitor-match with a panel-commitment
     * canonical surface. */
    const s = newState({
      phase: "counter-offer",
      counterRound: 1,
      turnIndex: 9,
      highestOfferMade: 35,
      candidateCurrentCtc: 32,
      competingOffer: 42,
      fakeLeverageChallengeFiredAtTurn: 8,
      competingOfferDetail: {
        company: "swiggy",
        status: "letter",
        stage: "offered",
        amount: 42,
        letterShareOffered: true,
        onHold: false,
        proofRequestedAtTurn: 8,
        proofProvided: true,
        hasAny: true,
      },
    });

    const action = planNextAction(s);
    expect(action.kind).toBe("competitor-match");
    if (action.kind !== "competitor-match") return;
    expect(action.competingOffer).toBe(42);
    expect(action.competingCompany).toBe("swiggy");

    const prose = renderCanonicalProse(action, s);
    expect(prose).toMatch(/panel|leadership/i);
    expect(prose).toMatch(/EOD|revert/i);
    expect(prose).toContain("42");
    /* Anti-regression: must NOT route control to the candidate. The
     * banned BUG-A surface was "what else can we add". */
    expect(prose).not.toMatch(/what else can we add/i);
  });

  it("BUG-A/2 — competitor-match is single-fire via competitorMatchFiredAtTurn", () => {
    const s = newState({
      phase: "counter-offer",
      counterRound: 1,
      turnIndex: 11,
      highestOfferMade: 35,
      candidateCurrentCtc: 32,
      competingOffer: 42,
      fakeLeverageChallengeFiredAtTurn: 8,
      competitorMatchFiredAtTurn: 9,
      competingOfferDetail: {
        company: "swiggy",
        status: "letter",
        stage: "offered",
        amount: 42,
        letterShareOffered: true,
        onHold: false,
        proofRequestedAtTurn: 8,
        proofProvided: true,
        hasAny: true,
      },
    });

    const action = planNextAction(s);
    expect(action.kind).not.toBe("competitor-match");
  });

  it("BUG-A/3 — does NOT fire when competing offer is below standing offer (no leverage to match)", () => {
    const s = newState({
      phase: "counter-offer",
      counterRound: 1,
      turnIndex: 9,
      highestOfferMade: 35,
      candidateCurrentCtc: 32,
      competingOffer: 30, // below highestOfferMade
      fakeLeverageChallengeFiredAtTurn: 8,
      competingOfferDetail: {
        company: "swiggy",
        status: "letter",
        stage: "offered",
        amount: 30,
        letterShareOffered: true,
        onHold: false,
        proofRequestedAtTurn: 8,
        proofProvided: true,
        hasAny: true,
      },
    });
    const action = planNextAction(s);
    expect(action.kind).not.toBe("competitor-match");
  });

  it("BUG-B — candidateProfile.wantsHigherBase routes planner to wants-higher-base wired followup", () => {
    /* The PDF#42 BUG-B fix has two layers: (1) planner must produce a
     * wired-profile-followup with topic "wants-higher-base" when the
     * candidate signalled wantsHigherBase; (2) pipeline must NOT pre-empt
     * with the LLM answer path when the action is a wired-profile topic
     * (the pipeline gate is unit-tested separately via WIRED_PROFILE_TOPICS).
     * This test locks layer (1) — the planner-side architectural
     * contract that the LLM-freelanced refusal can no longer reach. */
    const s = newState({
      phase: "counter-offer",
      counterRound: 1,
      turnIndex: 11,
      highestOfferMade: 35,
      candidateCurrentCtc: 32,
      candidateProfile: {
        ...EMPTY_CANDIDATE_PROFILE,
        wantsHigherBase: true,
        hasAny: true,
      },
    });
    const action = planNextAction(s);
    expect(action.kind).toBe("reactive-followup");
    if (action.kind !== "reactive-followup") return;
    expect(action.topic).toBe("wants-higher-base");

    const prose = renderCanonicalProse(action, s);
    /* The wired canonical for wants-higher-base must engage with the
     * fixed/base preference and probe motivation — NEVER the freelanced
     * refusal that shipped in production ("base salary is a fixed
     * component"). PDF#45 (2026-05-25) replaced the EMI/appraisal
     * framing with neutral in-hand-now vs base-anchor probe; widened
     * assertion accordingly. */
    expect(prose).toMatch(/higher fixed|fixed weight|appraisal|EMI|in[-\s]?hand|stronger base|next cycle/i);
    expect(prose).not.toMatch(/we don'?t negotiate it separately/i);
  });

  it("BUG-C — isVerbatimRepeat catches the T23/T25 byte-identical deflection across conversationLog", () => {
    /* Live BUG-C: T23 and T25 shipped the SAME text. Both were on the
     * answer path, but T25 reached a defer early-return that did NOT
     * run isVerbatimRepeat. After the fix, the defer-side shipDefer
     * helper consults isVerbatimRepeat against the conversationLog,
     * so we re-assert the underlying detection works for the exact
     * live strings. */
    const t23 =
      "We're discussing base salary in the context of your current CTC and expected CTC range. " +
      "The fitment is typically structured around the CTC band, which we've discussed earlier.";
    const t25 =
      "We're discussing base salary in the context of your current CTC and expected CTC range. " +
      "The fitment is typically structured around the CTC band, which we've discussed earlier.";
    const state: NegotiationState = {
      ...newState(),
      turnIndex: 25,
      lastAiText: t23,
      conversationLog: [
        { speaker: "ai", text: t23 },
        { speaker: "candidate", text: "what is your final offer?" },
      ],
    };
    expect(isVerbatimRepeat(t25, state)).toBe(true);
  });

  it("BUG-D — 'what is your final offer?' stamps offerAskedAtTurn (kernel OFFER_ASK_RE widened)", () => {
    /* Pre-fix: OFFER_ASK_RE missed "final offer", so the kernel never
     * stamped offerAskedAtTurn on T24. The candidate's ask was routed
     * only through the question-intent classifier (budget-disclosure
     * deflection) and the planner couldn't pivot to a closing-push
     * restate — feeding the abrupt-termination chain. */
    let s = newState({ lastAiText: "the fitment we're able to offer is ₹35 LPA total." });
    s = applyCandidateAnswer(s, "what is your final offer?");
    expect(s.offerAskedAtTurn).toBe(s.turnIndex);
  });

  it("BUG-D/2 — 'best and final' variant also stamps offerAskedAtTurn", () => {
    let s = newState({ lastAiText: "the fitment we're able to offer is ₹35 LPA total." });
    s = applyCandidateAnswer(s, "what's your best and final?");
    expect(s.offerAskedAtTurn).toBe(s.turnIndex);
  });

  it("BUG-D/3 — 'what's your last number' variant also stamps offerAskedAtTurn", () => {
    let s = newState({ lastAiText: "the fitment we're able to offer is ₹35 LPA total." });
    s = applyCandidateAnswer(s, "what's your last number on this?");
    expect(s.offerAskedAtTurn).toBe(s.turnIndex);
  });
});
