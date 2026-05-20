/* PDF#41 Architectural Fix Pass — Flipkart Senior Product Designer
 * session (2026-05-21). Four bugs surfaced in one session.
 *
 *   Live transcript (Flipkart Senior PD, band ~30–50, CTC=26):
 *     T1  AI:   "what's your current CTC?"
 *     T2  Cand: "yes"                            ← BUG-A: UI froze
 *     T7  AI:   "...fitment we're able to offer is ₹32 LPA..."  [anchor]
 *     T9  Cand: "can you provide the breakdown of base vs variable?"
 *     T10 AI:   "Unfortunately, the breakdown of base vs variable
 *                isn't something I can provide at this moment."  ← BUG-B
 *     T11 Cand: "why?"
 *     T12 AI:   (verbatim repeat of T10)         ← BUG-C
 *     Enter:    session terminated abruptly      ← BUG-D
 *
 *   Architectural fixes:
 *     BUG-A: kernel's "noise" stamp now fires on bare "yes" replies to
 *            number-seeking probes too (previously only substantive
 *            yes/no probes). Bare "yes" to "what's your CTC?" answers
 *            nothing — the askedTopics tail rewinds and the planner
 *            re-asks instead of falling into a verbatim-stub loop.
 *     BUG-B: detectInfoIntents extended to match "base vs variable",
 *            "breakdown of base", "base split" — so the planner's
 *            wantsBreakdown short-circuit picks the canonical
 *            breakdown lever instead of routing to the LLM answer path
 *            (which had been freelancing refusals).
 *     BUG-C: CLARIFICATION_REQUEST_RE extended to include "why", "why
 *            not", "how come" — routes to clarify-prior-question
 *            instead of the LLM re-emitting the prior refusal.
 *     BUG-D: stuck-progress stalemate cap (L801) now also requires
 *            highestOfferMade === 0. Once an anchor is on the table,
 *            we are past discovery — premature stalemate truncates the
 *            candidate's response to the offer.
 */
import { describe, it, expect } from "vitest";
import {
  initState,
  applyCandidateAnswer,
  type NegotiationBand,
  type NegotiationState,
} from "../../../server-handlers/_negotiation-kernel";
import { planNextAction } from "../../../server-handlers/_next-action-planner";

const FLIPKART_SR_PD_BAND: NegotiationBand = {
  initialOffer: 32,
  maxStretch: 45,
  walkAway: 28,
  hasEquity: true,
  baseFloor: 24,
  baseStretch: 35,
  variableMax: 6,
};

function newState(overrides: Partial<NegotiationState> = {}): NegotiationState {
  const base = initState({
    sessionId: "pdf41-flipkart-sr-pd",
    role: "Senior Product Designer",
    company: "Flipkart",
    band: FLIPKART_SR_PD_BAND,
    recruiterSectorPersona: "indian-unicorn",
    multiRoundEnabled: false,
    candidateName: "Karthik Nair",
  });
  return { ...base, ...overrides };
}

describe("PDF#41 — Flipkart Senior PD deflect-loop / discovery pass", () => {
  it("BUG-A — bare 'yes' to a number-seeking probe stamps lastAnswerNoiseAtTurn", () => {
    /* Seed the bot's prior turn so the noise gate has something to
     * read. The text mirrors the live PDF#41 opening probe. */
    let s = newState({ lastAiText: "what's your current CTC — total annual?" });
    s = applyCandidateAnswer(s, "yes");

    expect(s.lastAnswerNoiseAtTurn).not.toBeNull();
    expect(s.candidateCurrentCtc).toBeNull();
  });

  it("BUG-B — 'breakdown of base vs variable' routes to fixed-vs-variable intent", () => {
    let s = newState({ lastAiText: "the fitment we're able to offer is ₹32 LPA total." });
    s = applyCandidateAnswer(s, "can you provide the breakdown of base vs variable?");

    expect(s.infoAsked).toContain("fixed-vs-variable");
  });

  it("BUG-B/2 — 'base split' phrasing also routes to fixed-vs-variable intent", () => {
    let s = newState({ lastAiText: "the fitment we're able to offer is ₹32 LPA total." });
    s = applyCandidateAnswer(s, "what's the base split looking like?");

    expect(s.infoAsked).toContain("fixed-vs-variable");
  });

  it("BUG-C — bare 'why?' stamps lastAnswerClarificationAtTurn", () => {
    let s = newState({ lastAiText: "the breakdown isn't something I can share at this moment." });
    s = applyCandidateAnswer(s, "why?");

    expect(s.lastAnswerClarificationAtTurn).toBe(s.turnIndex);
  });

  it("BUG-C/2 — 'how come' also routes to clarification", () => {
    let s = newState({ lastAiText: "the breakdown isn't something I can share at this moment." });
    s = applyCandidateAnswer(s, "how come");

    expect(s.lastAnswerClarificationAtTurn).toBe(s.turnIndex);
  });

  it("BUG-D — stuck-progress stalemate cap does NOT fire when an anchor is on the table", () => {
    /* Compose the exact precondition tuple the PDF#41 BUG-D cap had:
     * turnIndex >= 8, no candidateCurrentCtc/Target, ack-recover fired
     * — but WITH an anchor on the table (highestOfferMade > 0). After
     * the fix, we must NOT shortcut to close-stalemate; an offer is in
     * play and the candidate deserves engagement turns. */
    const s: NegotiationState = {
      ...newState(),
      turnIndex: 10,
      candidateCurrentCtc: null,
      candidateTarget: null,
      highestOfferMade: 32,
      lockedAnchorLpa: 32,
      anchorLocked: true,
      leversUsed: ["acknowledge-and-recover"],
      phase: "offer-presented",
    };

    const action = planNextAction(s);
    expect(action.kind).not.toBe("close");
  });
});
