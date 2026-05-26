/* PDF#48 (2026-05-26) — premature auto-close on offer-announcement turn.
 *
 * Real session: salary-negotiation for Senior Product Designer at
 * Flipkart. Candidate answered three data-collection questions:
 *   T1  AI: "what's your current CTC?"
 *   T1' user: "my current ctc is 24 LPA"
 *   T2  AI: "what's the base split?"
 *   T2' user: "20 LPA is base"
 *   T3  AI: "does your current CTC include ESOPs or RSUs?"
 *   T3' user: "no there is not equity"
 *   T4  AI: "Got it. So for this grade, the fitment we're able to
 *           offer is ₹30.4 LPA..." (FIRST anchor lands)
 *   T5  AI: "Let me recap... Sounds good? Congratulations and welcome
 *           to Flipkart. Locking the close at ₹30.4L total comp.
 *           Documents we'll need: Aadhaar, PAN, BGV partner reaches
 *           out in 48h, retention-counter warning, joining-date lock"
 *
 * The candidate never countered, never named a target, never got a
 * chance to react to the offer. The kernel auto-closed.
 *
 * Trigger: the candidate utterance answering the ESOPs question was
 * routed through the soft-accept proxy (3+ trailing non-counter turns)
 * AND through the planner-side verbalAcceptanceTurn stamping fast-path
 * that the PDF#36 A2 commit had introduced for "works for me" same-turn
 * acceptance. Combined, they fired close-acceptance on the same turn
 * the offer was first announced — structurally impossible to "accept"
 * an offer the candidate has not yet processed.
 *
 * Structural invariant locked here: when firstOfferAtTurn ===
 * turnIndex (the candidate is responding for the first time to a
 * just-announced offer) and the candidate has NOT named a counter or
 * target, soft-accept paths MUST be blocked. Strict explicit
 * acceptance ("I accept", "send the offer letter") still passes —
 * that's unambiguous consent and a legitimate same-turn close.
 */
import { describe, it, expect } from "vitest";
import {
  initState,
  applyAiMove,
  applyCandidateAnswer,
  canCloseSession,
  type NegotiationBand,
  type NegotiationState,
} from "../../server-handlers/_negotiation-kernel";
import { planNextAction } from "../../server-handlers/_next-action-planner";

const band: NegotiationBand = { initialOffer: 30, maxStretch: 35, walkAway: 25, hasEquity: true };

function stateWithFirstOfferThisTurn() {
  let s = initState({ sessionId: "pdf48", role: "design", company: "Flipkart", band });
  // Drop the min-turns-before-close floor for this suite — we're
  // testing the PDF#48 structural invariant (same-turn-as-offer), not
  // the orthogonal PDF#17 floor. With the default floor of 8, every
  // turn-3/4/5 fixture would be blocked by the floor regardless of
  // the new gate, which obscures what we're locking down.
  s = { ...s, minTurnsBeforeClose: 0 };
  // Three data-collection AI turns with non-counter candidate replies
  // (matching the PDF flow: CTC, base split, ESOPs).
  s = applyAiMove(s, { lever: "probe", newTotalLpa: null, rationale: "ctc" }, "What's your current CTC?");
  s = applyCandidateAnswer(s, "my current ctc is 24 LPA");
  s = applyAiMove(s, { lever: "probe", newTotalLpa: null, rationale: "base" }, "What's the base split?");
  s = applyCandidateAnswer(s, "20 LPA is base");
  s = applyAiMove(s, { lever: "probe", newTotalLpa: null, rationale: "esops" }, "Does your CTC include ESOPs?");
  s = applyCandidateAnswer(s, "no there is not equity");
  // FOURTH AI turn — the offer-anchor lands NOW.
  s = applyAiMove(s, { lever: "open-with-offer", newTotalLpa: 30.4, rationale: "anchor" }, "For this grade we can offer ₹30.4 LPA.");
  return s;
}

describe("PDF#48 — premature-close guard on offer-announcement turn", () => {
  it("firstOfferAtTurn is stamped on the AI turn that first puts a number on the table", () => {
    const s = stateWithFirstOfferThisTurn();
    expect(s.firstOfferAtTurn).toBe(s.turnIndex);
    expect(s.highestOfferMade).toBe(30.4);
  });

  it("canCloseSession blocks soft-accept when firstOfferAtTurn === turnIndex and no counter named", () => {
    const s = stateWithFirstOfferThisTurn();
    expect(canCloseSession(s, "anything", "soft-accept")).toBe(false);
  });

  it("canCloseSession ALLOWS strict-accept on the same turn (unambiguous consent)", () => {
    // Even on the offer-announcement turn, an explicit "I accept" is
    // legitimate same-turn consent and must not be blocked.
    const s = stateWithFirstOfferThisTurn();
    expect(canCloseSession(s, "I accept the offer", "accept")).toBe(true);
  });

  it("canCloseSession ALLOWS soft-accept once at least one AI turn has elapsed after the first offer", () => {
    let s = stateWithFirstOfferThisTurn();
    // Candidate's empty/non-counter response, then AI fires a recap —
    // firstOfferAtTurn no longer equals turnIndex.
    s = applyCandidateAnswer(s, "ok");
    s = applyAiMove(s, { lever: "probe", newTotalLpa: null, rationale: "recap" }, "Let me recap: ₹30.4L total.");
    expect(canCloseSession(s, "ok", "soft-accept")).toBe(true);
  });

  it("applyCandidateAnswer does NOT stamp verbalAcceptanceTurn on the offer-announcement turn for a non-counter utterance", () => {
    const s = stateWithFirstOfferThisTurn();
    // The PDF#48 trigger utterance — answers an unrelated probe but
    // gets parsed by the soft-accept proxy as acceptance.
    const after = applyCandidateAnswer(s, "no there is not equity");
    // Even if signalsAcceptance trips, the planner-side stamp must
    // hold until the candidate has had a turn to react OR named a counter.
    expect(after.verbalAcceptanceTurn ?? null).toBe(null);
    // And the phase must NOT terminal.
    expect(after.phase).not.toBe("accepted");
  });

  it("applyCandidateAnswer DOES stamp / terminal on strict explicit acceptance same-turn", () => {
    const s = stateWithFirstOfferThisTurn();
    const after = applyCandidateAnswer(s, "I accept the offer, please send the letter");
    expect(after.phase).toBe("accepted");
  });

  it("planner: legacy session (no discoveryChecklist) at turn ≥2 with no candidate target routes to target-probe instead of open-with-offer", () => {
    /* The PDF#48 session reached the offer-anchor on turn 4 because
     * state.discoveryChecklist was null and the checklist gate at
     * planner:2226 exempted legacy sessions, falling through to
     * open-with-offer unconditionally. The belt-and-braces gate added
     * at planner:~2244 (post-checklist) now consults
     * canDiscloseSpecificNumber — when it returns false (no target
     * named, < 2 probe refusals), emit the target-probe instead. */
    const s0 = initState({ sessionId: "pdf48-planner", role: "design", company: "Flipkart", band });
    const s: NegotiationState = {
      ...s0,
      phase: "opening",
      turnIndex: 3,
      discoveryChecklist: undefined,
      probeRefusalCount: 0,
    };
    const action = planNextAction(s);
    expect(action.kind).toBe("discovery-probe");
    if (action.kind === "discovery-probe") {
      expect(action.item).toBe("targetAnswered");
    }
  });

  it("planner: turn-1 legacy session (the opener itself) is preserved — opens with offer", () => {
    /* The opener is rendered by canonical-prose as a currentCtc
     * probe, not as a band disclosure. Don't intercept it. */
    const s0 = initState({ sessionId: "pdf48-opener", role: "design", company: "Flipkart", band });
    const s: NegotiationState = {
      ...s0,
      phase: "opening",
      turnIndex: 1,
      discoveryChecklist: undefined,
    };
    const action = planNextAction(s);
    expect(action.kind).toBe("open-with-offer");
  });

  it("backward-compat: when firstOfferAtTurn is null (legacy fixtures), the guard does not fire", () => {
    // Mirrors how PDF#36 A2 tests construct state — direct
    // assignment of highestOfferMade without going through
    // applyAiMove. The guard must not block these legitimate paths.
    const s = {
      turnIndex: 10,
      highestOfferMade: 24,
      firstOfferAtTurn: null,
      minTurnsBeforeClose: 8,
      conversationLog: [],
    } as never;
    expect(canCloseSession(s, "works for me", "soft-accept")).toBe(true);
  });
});
