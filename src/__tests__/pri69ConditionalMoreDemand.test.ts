/* PRI-69 — a first-person DEMAND for MORE money welded to a close idiom by a
 * NON-contrastive conjunction must not read as an unconditional accept and
 * false-close at the un-bumped offer (offline hostile close battery, 2026-07-08).
 *
 * "Give me 8% more and it's a deal." pairs a bare relative-increase demand
 * ("8% more") with a close idiom ("it's a deal") using "and" — no "if", no
 * "but". The close idioms match the acceptance banks; CONDITIONAL_DEMAND only
 * owns the absolute "make it / get it TO <target>" form; PARTIAL_ACCEPT and
 * NEGOTIATING_BUT both require a but/except/however CONTRASTIVE conjunction. So
 * the "and"-welded relative demand slipped every veto and the bot finalized at
 * the STANDING offer while the candidate was demanding a raise — a PRI-63-class
 * hard false-close.
 *
 * Structural fix (single source of truth): DEMAND_FOR_MORE_PATTERN — a
 * first-person demand verb (give/gimme/get/hand/throw/toss me · I want/need/…)
 * + an increase magnitude (N% / N<unit> / bare N) + an increase token
 * (more/higher/extra/additional/on top) — added to the SHARED
 * FALSE_CLOSE_VETO_PATTERNS so BOTH the medium (classifyAcceptance) and strict
 * (detectExplicitAcceptance) gates reject in lockstep. The utterance now routes
 * to a counter, never a close. The delta form with no increase token ("add
 * another 2L") carries no "more" and stays with the PRI-68 meet-and-close path;
 * gratitude phrasing ("3% more than I expected") is spared by a `(?!\s+than)`
 * guard.
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
import {
  classifyAcceptance,
  detectExplicitAcceptance,
} from "../../server-handlers/_acceptance-classifier";

const band: NegotiationBand = {
  initialOffer: 40,
  maxStretch: 52,
  walkAway: 34,
  hasEquity: true,
  variableMax: 8,
};

function offeredAt(offer: number): NegotiationState {
  let s = initState({ sessionId: "pri69", role: "engineering", company: "Flipkart", band });
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

describe("PRI-69 — 'give me N more and it's a deal' is a demand, not a close", () => {
  it("does NOT false-close at the un-bumped offer for a percent-more demand", () => {
    const s = applyCandidateAnswer(offeredAt(40), "Give me 8% more and it's a deal.");
    const action = planNextAction(s);
    expect(action.kind === "close" || action.kind === "auto-accept").toBe(false);
    const move = actionToLever(action, s);
    expect(move.lever).not.toBe("close-acceptance");
  });

  it("vetoes a first-person 'I want N% more' demand in BOTH gates (no clean accept)", () => {
    // The classifier — the single source both gates share — must reject the
    // demand. (The absolute-lakh "2L more" form additionally trips a separate
    // number-role misparse in the auto-accept-counter gate; that deeper parser
    // defect is tracked separately and is NOT what this veto owns.)
    expect(classifyAcceptance("I want 8% more and I'll sign.").accepted).toBe(false);
    expect(detectExplicitAcceptance("I want 8% more and I'll sign.").accepted).toBe(false);
  });

  it("PRESERVES the PRI-68 delta path: 'add another 2 lakh' still meets-and-closes at ₹42L", () => {
    // "another 2 lakh" carries no increase token (more/higher/extra), so the
    // PRI-69 veto does not fire and the deliverable bump still closes at 42.
    const s = applyCandidateAnswer(offeredAt(40), "I'll sign if you can add another 2 lakh.");
    const action = planNextAction(s);
    expect(action.kind === "close" || action.kind === "auto-accept").toBe(true);
    const move = actionToLever(action, s);
    expect(move.newTotalLpa).toBe(42);
  });

  it("spares gratitude phrasing: 'that's 3% more than I expected, deal' still closes", () => {
    // `(?!\s+than)` guard keeps the veto off gratitude — this must still close.
    const s = applyCandidateAnswer(offeredAt(40), "That's 3% more than I expected, deal.");
    const move = actionToLever(planNextAction(s), s);
    expect(move.lever).toBe("close-acceptance");
  });
});
