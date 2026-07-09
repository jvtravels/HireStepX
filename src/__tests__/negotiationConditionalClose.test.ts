/* Near-offer conditional close-engagement (live-staging 2026-06-19, #94).
 *
 * Real Razorpay PM session: after the AI anchored ₹35L, the candidate
 * said "if you can do 36 with a 3 lakh joining bonus, that works for me"
 * — an unambiguous conditional acceptance 1L above the offer. The legacy
 * planner diverted to interrogating the joining-bonus clawback rationale
 * instead of meeting the ₹36 and closing. That is the forbidden
 * "divert/stall on a near-offer close" failure mode.
 *
 * Two structural fixes converge here and are locked by this suite:
 *   1. The classifier binds the conditional-close verbs ("do"/"match")
 *      AND excludes the JB amount ("3 lakh joining bonus") from binding
 *      as a target — so the kernel's bound counter is 36, never 3.
 *   2. The planner consults `decisionDeadline.conditionalAcceptance` and,
 *      when the conditional number sits within a small gap above the
 *      offer and under the band ceiling, emits a converging close at that
 *      number rather than any probe/lever/ceiling path.
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

const band: NegotiationBand = { initialOffer: 35, maxStretch: 40, walkAway: 30, hasEquity: false };

function anchoredAt35(): NegotiationState {
  let s = initState({ sessionId: "cond94", role: "product", company: "Razorpay", band });
  s = { ...s, minTurnsBeforeClose: 0 };
  s = applyAiMove(s, { lever: "probe", newTotalLpa: null, rationale: "ctc" }, "What's your current CTC?");
  s = applyCandidateAnswer(s, "my current ctc is 30 LPA");
  s = applyAiMove(s, { lever: "probe", newTotalLpa: null, rationale: "target" }, "What are you targeting?");
  s = applyCandidateAnswer(s, "I'm targeting 40 LPA");
  // AI anchors ₹35L.
  s = applyAiMove(s, { lever: "open-with-offer", newTotalLpa: 35, rationale: "anchor" }, "For this grade we can do ₹35 LPA.");
  // One elapsed turn so the close isn't blocked by the offer-announcement guard.
  s = applyCandidateAnswer(s, "let me think about the structure");
  s = applyAiMove(s, { lever: "probe", newTotalLpa: null, rationale: "structure" }, "Sure — what specifically?");
  return s;
}

describe("#94 — near-offer conditional close-engagement", () => {
  it("binds the conditional number to 36, NOT the joining-bonus amount", () => {
    let s = anchoredAt35();
    s = applyCandidateAnswer(s, "if you can do 36 with a 3 lakh joining bonus, that works for me");
    expect(s.decisionDeadline.conditionalAcceptance).toBe(true);
    // The 36 is the counter; the "3 lakh joining bonus" must NOT have
    // bound as the candidate's target/counter.
    expect(s.lastCandidateCounterLpa).toBe(36);
    expect(s.candidateTarget).not.toBe(3);
  });

  it("planner converges to a close at ₹36L instead of diverting to a JB probe", () => {
    let s = anchoredAt35();
    s = applyCandidateAnswer(s, "if you can do 36 with a 3 lakh joining bonus, that works for me");
    const action = planNextAction(s);
    expect(action.kind === "close" || action.kind === "auto-accept").toBe(true);
    const move = actionToLever(action, s);
    expect(move.lever).toBe("close-acceptance");
    expect(move.newTotalLpa).toBe(36);
  });

  it("a non-cash conditional ('once you confirm the band, that's acceptable') closes at the standing offer", () => {
    let s = anchoredAt35();
    s = applyCandidateAnswer(s, "once you confirm the band in writing, that's acceptable");
    expect(s.decisionDeadline.conditionalAcceptance).toBe(true);
    const action = planNextAction(s);
    expect(action.kind === "close" || action.kind === "auto-accept").toBe(true);
    expect(actionToLever(action, s).newTotalLpa).toBe(35);
  });

  it("does NOT fire when the conditional number is far above the offer (live negotiation continues)", () => {
    let s = anchoredAt35();
    // 48 against a 35 offer / 40 ceiling — beyond both gap and ceiling.
    s = applyCandidateAnswer(s, "if you can do 48, I'll sign today");
    const action = planNextAction(s);
    // Must NOT close at 48 (above ceiling) — falls through to normal handling.
    if (action.kind === "close" || action.kind === "auto-accept") {
      expect(actionToLever(action, s).newTotalLpa).not.toBe(48);
    }
  });

  /* Batch-5 regression (2026-07-09). The bare-fallback branch closed at the
   * standing offer whenever the LOCAL numeric resolvers (totalScopedCounter,
   * resolveFixedCloseAsk, acceptanceUtteranceFigure, resolveConditionalCashTarget
   * / parseCashIncreaseIntent) could not quantify the demand — but those parsers
   * miss a crore-scale figure with a prepositionless landing verb. "…hits 1.2
   * crore" left every resolver null and the gate false-closed at the un-bumped
   * offer, silently dropping a ₹120L condition. The fix routes the fall-through
   * through the canonical analyzeDemand (the same extractor both acceptance
   * gates use): an unmet CASH demand it flags now vetoes the close-at-offer. */
  it("does NOT false-close at the offer on an unparsed crore-scale conditional demand", () => {
    let s = anchoredAt35();
    s = applyCandidateAnswer(s, "I'll take it if the package hits 1.2 crore");
    const action = planNextAction(s);
    if (action.kind === "close" || action.kind === "auto-accept") {
      // If it somehow closes, it must NOT be at the un-bumped ₹35L offer.
      expect(actionToLever(action, s).newTotalLpa).not.toBe(35);
    }
  });

  /* Beat-the-figure false-close (2026-07-09, offline hostile battery). A
   * conditional accept quoting a COMPETING figure to beat ("if you can beat the
   * 39 I already have") is a demand for strictly MORE than that figure — never
   * an agreement to it. But acceptanceUtteranceFigure is demand-blind: it just
   * corroborates any nearby number against the sticky target (40 here, so 39 is
   * within 6%) and the planner closed AT 39. The fix flags "beat the 39" in the
   * canonical analyzeDemand (new beat-figure core) and gates the
   * acceptanceUtteranceFigure close path with that same unmet-cash veto, so the
   * turn routes to a live counter instead of a false-close. */
  it("does NOT false-close at a bare competing figure the candidate wants beaten", () => {
    let s = anchoredAt35();
    s = applyCandidateAnswer(s, "Deal, if you can beat the 39 I already have");
    const action = planNextAction(s);
    if (action.kind === "close" || action.kind === "auto-accept") {
      expect(actionToLever(action, s).newTotalLpa).not.toBe(39);
    }
  });
});
