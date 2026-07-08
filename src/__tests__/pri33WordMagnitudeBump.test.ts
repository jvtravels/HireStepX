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
