/* #33 / §9c — a WORD-MAGNITUDE conditional cash bump ("push the base up by a
 * couple of lakhs", "another few lakh") must resolve to a real delta and honor
 * or decline it — never soft-false-close at the UN-BUMPED offer (offline hostile
 * close battery, 2026-07-08; reproduced LIVE on staging).
 *
 * The defect: resolveConditionalCashTarget only parsed DIGITS ("by 2L"). A cash
 * demand stated in words ("by a couple of lakhs") matched no numeric branch and
 * returned null; the near-offer close gate read that null as "no cash condition"
 * and closed at the standing offer — silently dropping the candidate's condition.
 * Confirmed live: "I'll sign today if you can push the base up by a couple of
 * lakhs" closed at the un-bumped ₹45.4L with 0% gap closed and 0% movement.
 *
 * Fix (single source): map the common quantifiers (couple→2, few→3, several→4)
 * inside resolveConditionalCashTarget, gated on the SAME increase intent as the
 * numeric path and welded to a cash noun. The demand then flows through the
 * unchanged deliverability gate — a deliverable in-gap bump closes at the BUMPED
 * figure; an undeliverable one declines (counter). "a couple of days" / "a few
 * weeks" carry no cash noun and never register as a bump.
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
import { classifyAcceptance } from "../../server-handlers/_acceptance-classifier";

const band: NegotiationBand = {
  initialOffer: 40,
  maxStretch: 52,
  walkAway: 34,
  hasEquity: true,
  variableMax: 8,
};

function offeredAt(offer: number): NegotiationState {
  let s = initState({ sessionId: "pri33", role: "engineering", company: "Flipkart", band });
  s = { ...s, minTurnsBeforeClose: 0 };
  s = applyAiMove(s, { lever: "probe", newTotalLpa: null, rationale: "ctc" }, "Current CTC?");
  s = applyCandidateAnswer(s, "my current ctc is 38 LPA");
  s = applyAiMove(s, { lever: "probe", newTotalLpa: null, rationale: "target" }, "Target?");
  s = applyCandidateAnswer(s, "I'm targeting 50 LPA");
  s = applyAiMove(
    s,
    { lever: "open-with-offer", newTotalLpa: offer, rationale: "anchor" },
    `We can do ₹${offer} LPA.`,
  );
  s = applyCandidateAnswer(s, "let me think");
  s = applyAiMove(s, { lever: "probe", newTotalLpa: null, rationale: "x" }, "What's on your mind?");
  return s;
}

function closeFigure(utter: string): number | null {
  const s = applyCandidateAnswer(offeredAt(40), utter);
  const action = planNextAction(s);
  if (action.kind !== "close" && action.kind !== "auto-accept") return null;
  return actionToLever(action, s).newTotalLpa;
}

describe("#33 — word-magnitude conditional cash bump never soft-false-closes at the un-bumped offer", () => {
  it("resolves 'push the base up by a couple of lakhs' to a +2L BUMP, not the un-bumped ₹40L", () => {
    // The exact live-staging repro shape. Correct outcome: honor the deliverable
    // in-gap bump and close at ₹42L — NOT close at the standing ₹40L.
    const at = closeFigure("I'll sign today if you can push the base up by a couple of lakhs.");
    expect(at).not.toBeNull();
    expect(at).toBe(42);
  });

  it("resolves 'another few lakh' to a +3L bump (couple/few/several map)", () => {
    // +3L → ₹43L; gap = max(2, 40*0.06=2.4) = 2.4 < 3, so this is NOT an
    // instant-close bump — it must DECLINE (fall through to counter), never
    // close at the un-bumped ₹40L.
    expect(closeFigure("I'm in if you can add another few lakh to the base.")).toBeNull();
  });

  it("does NOT treat non-cash word magnitudes as a bump ('a couple of days')", () => {
    // No cash noun after the quantifier → no bump; a bare non-cash condition
    // closes at the standing offer, unchanged.
    expect(closeFigure("Give me a couple of days to think and I'll sign.")).toBe(40);
  });

  it("PRESERVES the numeric delta path: 'add another 2 lakh' still closes at ₹42L", () => {
    expect(closeFigure("I'll sign if you can add another 2 lakh.")).toBe(42);
  });
});

/* #33b — article/fraction-quantified lakh deltas ("a lakh more", "half a lakh")
 * must NOT be swallowed as an unconditional accept and finalized at the un-bumped
 * offer. Two defects, one class ("[verbal-quantity] more + close idiom"):
 *
 *  1. Acceptance-classifier miss. "Just a lakh more and I'll sign." — the digit-
 *     based RELATIVE_DEMAND_THEN_CLOSE veto keyed on \d, so the word/article
 *     magnitude slipped through and the close idiom classified an UNCONDITIONAL
 *     accept → finalized at ₹40 while the candidate demanded a raise. Fix (single
 *     source): WORD_DEMAND_THEN_CLOSE_PATTERN in the shared FALSE_CLOSE_VETO_PATTERNS.
 *  2. Planner resolution miss. "if you bump the base by a lakh" — the conditional
 *     path reached resolveConditionalCashTarget but its digit-only parser dropped
 *     "a lakh". Fix (single source): article/half handling in that function.
 *
 * Net: a bare verbal-quantity demand routes to a counter (never a false-close);
 * the explicit conditional form meets-and-closes at the deliverable bump.
 */
describe("#33b — article/half-lakh verbal cash demand never false-closes at the un-bumped offer", () => {
  it("does NOT finalize 'Just a lakh more and I'll sign' at the un-bumped ₹40L", () => {
    // Vetoed as an accept → routes to a counter (kind !== close) rather than
    // closing at the standing ₹40L with the +1L demand silently dropped.
    expect(closeFigure("Just a lakh more and I'll sign.")).toBeNull();
  });

  it("does NOT finalize 'Add half a lakh more and I'm in' at the un-bumped ₹40L", () => {
    expect(closeFigure("Add half a lakh more and I'm in.")).toBeNull();
  });

  it("MEETS an explicit conditional 'if you bump the base by a lakh' at ₹41L", () => {
    expect(closeFigure("I'll sign if you can bump the base by a lakh.")).toBe(41);
  });

  it("MEETS an explicit conditional 'half a lakh' bump at ₹40.5L", () => {
    expect(closeFigure("I'll sign if you can bump the base by half a lakh.")).toBe(40.5);
  });

  it("spares gratitude: 'a lakh more than I hoped, deal' does not fire the false-close veto", () => {
    // "more than" is a comparison, not a demand — the (?!than) guard keeps the
    // WORD_DEMAND_THEN_CLOSE veto off. Proven at the classifier: the demand veto
    // is never among the reasons for this gratitude phrasing.
    const r = classifyAcceptance("This is a lakh more than I hoped for, deal.");
    expect(r.reasons).not.toContain("false-close-veto");
  });
});

/* #35 — percentage-axis conditional cash bump. A cash increase stated as a
 * PERCENT must resolve to a real lakh delta and honor-or-decline it — never
 * soft-false-close at the un-bumped offer (offline hostile close battery,
 * 2026-07-08). Two defects, one class ("[increase] N percent + close idiom"):
 *
 *  1. Planner resolution miss. "if you can bump it a couple of percent" reached
 *     resolveConditionalCashTarget, but every branch keyed on a lakh noun — "%"
 *     parsed nowhere — so it returned null and the near-offer close gate
 *     finalized at the un-bumped offer. Fix (single source): percent resolution
 *     (offer × pct/100) in that function, checked before the lakh-delta parse.
 *  2. Acceptance-classifier miss. "Bump it 5% and I'll sign" / "Push the base up
 *     by a few percent and we have a deal" — the increase intent is in the VERB,
 *     so the three trailing-token demand vetoes all missed and the close idiom
 *     classified an UNCONDITIONAL accept at the un-bumped offer. Fix (single
 *     source): VERB_MAGNITUDE_THEN_CLOSE_PATTERN in FALSE_CLOSE_VETO_PATTERNS.
 *
 * Control: "I'm 100 percent in" is a full-acceptance idiom, not a demand — it
 * carries no increase cue and must still finalize cleanly at the standing offer.
 */
/** True across ALL close-family levers (close, auto-accept, close-recap-formal):
 *  did the turn FINALIZE at the standing, un-bumped ₹40L? A demand that
 *  finalizes here has had its raise silently dropped — the soft-false-close. */
function finalizesAtUnbumped40(utter: string): boolean {
  const s = applyCandidateAnswer(offeredAt(40), utter);
  const action = planNextAction(s);
  const isClose =
    action.kind === "close" ||
    action.kind === "auto-accept" ||
    action.kind === "close-recap-formal";
  return isClose && actionToLever(action, s).newTotalLpa === 40;
}

describe("#35 — percentage-axis conditional cash bump never soft-false-closes at the un-bumped offer", () => {
  it("resolves an explicit conditional 'bump it a couple of percent' to a +2% BUMP (₹40.8L)", () => {
    // a couple = 2% of 40 = 0.8 → ₹40.8L; gap = max(2, 2.4) = 2.4 > 0.8, so this
    // is a deliverable in-gap bump — meet-and-close at the bumped figure, not ₹40L.
    const at = closeFigure("I'll sign today if you can bump it a couple of percent.");
    expect(at).not.toBeNull();
    expect(at).toBeCloseTo(40.8, 5);
  });

  it("resolves an explicit numeric '5%' conditional bump to ₹42L (5% of 40 = 2, in-gap)", () => {
    const at = closeFigure("I'll sign if you can bump it 5%.");
    expect(at).not.toBeNull();
    expect(at).toBeCloseTo(42, 5);
  });

  it("VETOES and never finalizes the verb-fronted 'Bump it 5% and I'll sign' at ₹40L", () => {
    // The increase intent is in the VERB (bump), so the trailing-token demand
    // vetoes miss it — VERB_MAGNITUDE_THEN_CLOSE catches it. Vetoed → routed to a
    // counter, never a close at the un-bumped ₹40L with the +5% dropped.
    expect(classifyAcceptance("Bump it 5% and I'll sign.").reasons).toContain("false-close-veto");
    expect(finalizesAtUnbumped40("Bump it 5% and I'll sign.")).toBe(false);
  });

  it("VETOES and never finalizes 'Push the base up by a few percent and we have a deal' at ₹40L", () => {
    expect(
      classifyAcceptance("Push the base up by a few percent and we have a deal.").reasons,
    ).toContain("false-close-veto");
    expect(finalizesAtUnbumped40("Push the base up by a few percent and we have a deal.")).toBe(false);
  });

  it("CONTROL: 'I'm 100 percent in' is a full-acceptance idiom — no bump, closes cleanly at ₹40L", () => {
    // No increase cue → resolveConditionalCashTarget returns null and the veto
    // never fires; the acceptance idiom finalizes cleanly at the offer (NOT a
    // +100% bump to ₹80L). Finalizing at ₹40L here is CORRECT — nothing was demanded.
    expect(classifyAcceptance("I'm 100 percent in, send the letter.").reasons).not.toContain(
      "false-close-veto",
    );
    expect(finalizesAtUnbumped40("I'm 100 percent in, send the letter.")).toBe(true);
  });
});
