/* PRI-68 — a conditional accept demanding MORE cash must not false-close at the
 * un-bumped offer (offline hostile sweep, 2026-07-07).
 *
 * A candidate who conditions acceptance on a relative cash increase —
 * "I'll accept if you bump the fixed by another 2L" — is flagged
 * `conditionalAcceptance=true` by the classifier (an `if` clause welded to a
 * commitment idiom), but the classifier records only a text snippet, never the
 * magnitude. The near-offer conditional-close gate, finding no bound counter
 * and no fixed ask, used to fall to the `else` and close at the STANDING offer,
 * silently dropping the candidate's condition — a PRI-63-class soft
 * false-close: the report reads "closed at ₹40L" when the candidate had
 * explicitly asked for ₹42L to sign.
 *
 * Structural fix: a single source of truth, `resolveConditionalCashTarget`,
 * parses the implied TOTAL of the cash-increase condition (delta form
 * "another 2L" / "2L more" / an increase-verb "by 2L" → offer + δ; absolute
 * "to 54L" welded to an increase verb → 54). The gate then MEETS a deliverable
 * bump (at/under the ceiling AND within the instant-close gap) and DECLINES an
 * undeliverable one (falls through to hold/counter). Sweetener-scoped
 * conditions stay with the PRI-63 joining-bonus path; pure non-cash conditions
 * and bare accepts carry no magnitude and close at the offer as before.
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

/* Band with real headroom: offer can sit below the ₹52L ceiling so a +2L bump
 * is deliverable, and can also be pinned AT the ceiling to make it not. */
const band: NegotiationBand = {
  initialOffer: 40,
  maxStretch: 52,
  walkAway: 34,
  hasEquity: true,
  variableMax: 8,
};

function offeredAt(offer: number): NegotiationState {
  let s = initState({ sessionId: "pri68", role: "engineering", company: "Flipkart", band });
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

describe("PRI-68 — conditional relative-bump close fidelity", () => {
  it("meets a DELIVERABLE +2L bump: closes AT ₹42L, not the un-bumped ₹40L", () => {
    const s = applyCandidateAnswer(
      offeredAt(40),
      "I'll accept if you bump the fixed by another 2L.",
    );
    const action = planNextAction(s);
    expect(action.kind === "close" || action.kind === "auto-accept").toBe(true);
    const move = actionToLever(action, s);
    expect(move.lever).toBe("close-acceptance");
    expect(move.newTotalLpa).toBe(42);
  });

  it("DECLINES an UNDELIVERABLE +2L bump at the ceiling: does NOT close", () => {
    // Offer pinned at the ₹52L ceiling → +2L = ₹54L is over the band. The gate
    // must fall through to hold/explore, never close at the un-bumped ₹52L.
    const s = applyCandidateAnswer(
      offeredAt(52),
      "I'll accept if you bump the fixed by another 2L.",
    );
    const action = planNextAction(s);
    expect(action.kind === "close" || action.kind === "auto-accept").toBe(false);
  });

  it("a PURE non-cash condition still closes at the standing offer (unchanged)", () => {
    const s = applyCandidateAnswer(
      offeredAt(40),
      "Once you confirm the band in writing, that's acceptable.",
    );
    const action = planNextAction(s);
    expect(action.kind === "close" || action.kind === "auto-accept").toBe(true);
    const move = actionToLever(action, s);
    expect(move.newTotalLpa).toBe(40);
  });

  it("resolves 'add another 2 lakh' as a total bump: closes AT ₹42L", () => {
    const s = applyCandidateAnswer(offeredAt(40), "I'll sign if you can add another 2 lakh.");
    const action = planNextAction(s);
    expect(action.kind === "close" || action.kind === "auto-accept").toBe(true);
    const move = actionToLever(action, s);
    expect(move.newTotalLpa).toBe(42);
  });
});
