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

  /* Vague decade-band / negative-floor false-close (2026-07-09, offline hostile
   * battery). "if it lands in the mid-forties" carries NO literal digit, so
   * every digit-anchored resolver returned null and the gate closed at the
   * un-bumped offer, silently dropping the ~45 band. Likewise "nothing under 46"
   * (a floor stated as a prohibition) close-recap'd at the offer. Both are now
   * caught by analyzeDemand (decade-band core + extended floor-target) and the
   * shared unmet-cash veto routes them to a live counter. */
  it("does NOT false-close at the offer on a vague decade-band demand", () => {
    let s = anchoredAt35();
    s = applyCandidateAnswer(s, "I'll take it if it lands in the mid-forties");
    const action = planNextAction(s);
    if (action.kind === "close" || action.kind === "auto-accept") {
      expect(actionToLever(action, s).newTotalLpa).not.toBe(35);
    }
  });

  it("does NOT false-close at the offer on a negative-floor demand", () => {
    let s = anchoredAt35();
    s = applyCandidateAnswer(s, "I'm in, but nothing under 46");
    const action = planNextAction(s);
    if (action.kind === "close" || action.kind === "auto-accept") {
      expect(actionToLever(action, s).newTotalLpa).not.toBe(35);
    }
  });

  /* Preposition/verb floor + fractional-crore false-close (2026-07-09, offline
   * hostile battery). Floor idioms that pin a figure via a bare preposition
   * ("anything over 45", "above 44") or a floor VERB ("it tops 46", "clears
   * 48"), and word-form crore targets ("half a crore" = 50L), carried no
   * floor-target-recognized phrase / no lakh digit — so the gate close-recap'd
   * at the un-bumped offer. All three are now caught by analyzeDemand (extended
   * floor-target + crore-fraction core) and routed to a live counter. */
  it("does NOT false-close at the offer on a preposition/verb floor demand", () => {
    for (const utter of [
      "I'll take it at anything over 45",
      "I'll sign for anything above 44",
      "Deal, provided it tops 46",
      "I'm in as long as the total clears 48",
    ]) {
      let s = anchoredAt35();
      s = applyCandidateAnswer(s, utter);
      const action = planNextAction(s);
      if (action.kind === "close" || action.kind === "auto-accept") {
        expect(actionToLever(action, s).newTotalLpa).not.toBe(35);
      }
    }
  });

  it("does NOT false-close at the offer on a word-form fractional-crore demand", () => {
    let s = anchoredAt35();
    s = applyCandidateAnswer(s, "I'm in if the package is half a crore");
    const action = planNextAction(s);
    if (action.kind === "close" || action.kind === "auto-accept") {
      expect(actionToLever(action, s).newTotalLpa).not.toBe(35);
    }
  });

  /* Multiplier-of-current + component-floor false-close (2026-07-09, offline
   * hostile battery). A target expressed as a multiple of the candidate's
   * current figure ("double my current 38" = 76, "1.5x my current 38" = 57) or
   * pinned to a named component via a bare copula ("the fixed alone is 46")
   * carried no literal target digit, so the gate close-recap'd at the un-bumped
   * offer. Both are now caught by analyzeDemand (multiplier-current +
   * component-floor cores) and routed to a live counter. */
  it("does NOT false-close at the offer on a multiplier-of-current demand", () => {
    for (const utter of [
      "I'll sign if you double my current 38",
      "I'm in at twice my current 38",
      "Deal if you do 1.5x my current 38",
    ]) {
      let s = anchoredAt35();
      s = applyCandidateAnswer(s, utter);
      const action = planNextAction(s);
      if (action.kind === "close" || action.kind === "auto-accept") {
        expect(actionToLever(action, s).newTotalLpa).not.toBe(35);
      }
    }
  });

  it("does NOT false-close at the offer on a component-specific floor demand", () => {
    let s = anchoredAt35();
    s = applyCandidateAnswer(s, "I'm in if the fixed alone is 46");
    const action = planNextAction(s);
    if (action.kind === "close" || action.kind === "auto-accept") {
      expect(actionToLever(action, s).newTotalLpa).not.toBe(35);
    }
  });

  /* Digit-handle false-close (2026-07-09, offline hostile battery batch-10).
   * A demand that names only the LEADING digit of the wanted CTC — "get me to a
   * 5 in front", "once it starts with a 5", "a 5 handle" — carries no absolute
   * figure, so every digit-anchored resolver returned null and the gate
   * close-recap'd at the un-bumped ₹35 offer, silently dropping a ~50L floor.
   * Now caught by analyzeDemand (digit-handle core: derives the decade floor,
   * digit × 10) and routed to a live counter. Deferred from batch-9 as
   * high-over-block-risk; the "in front"/"handle"/"starts with" anchors keep it
   * off ordinary numerals. */
  it("does NOT false-close at the offer on a digit-handle demand", () => {
    for (const utter of [
      "I'll sign once you get me to a 5 in front",
      "I'll accept once it starts with a 5",
      "Deal, as long as it's got a 5 handle",
    ]) {
      let s = anchoredAt35();
      s = applyCandidateAnswer(s, utter);
      const action = planNextAction(s);
      if (action.kind === "close" || action.kind === "auto-accept") {
        expect(actionToLever(action, s).newTotalLpa).not.toBe(35);
      }
    }
  });

  /* Comparative-floor / decade-plural / "-ish" false-close (2026-07-09, offline
   * hostile battery batch-11). "a bit more than 45", "somewhere in the 50s" and
   * "45-ish" each demand a raise above the ₹35 offer but carried no exact-figure
   * form, so the gate close-recap'd at the un-bumped offer. Now caught by
   * analyzeDemand (floor-target "more than" arm + decade-plural + ish-approx
   * cores) and routed to a live counter. */
  it("does NOT false-close at the offer on comparative/decade-plural/ish demands", () => {
    for (const utter of [
      "Deal if it's a bit more than 45",
      "I'll sign if it's somewhere in the 50s",
      "45-ish and I'm in",
    ]) {
      let s = anchoredAt35();
      s = applyCandidateAnswer(s, utter);
      const action = planNextAction(s);
      if (action.kind === "close" || action.kind === "auto-accept") {
        expect(actionToLever(action, s).newTotalLpa).not.toBe(35);
      }
    }
  });
});
