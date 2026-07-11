/* PRI-69b / §9d — a RELATIVE cash-increase demand ("2L more", "2 higher") must
 * never bind as an absolute total target/counter and must never false-close
 * (offline hostile close battery, 2026-07-08).
 *
 * Two complementary defects, one hostile class ("give me MORE, then deal"):
 *
 *  1. Number-role misparse. "I want 2L more and I'll sign." — the number-role
 *     classifier read "2L" as an ABSOLUTE ₹2L total target. totalScopedCounter
 *     then saw ₹2L ≤ the ₹40L offer and the planner's auto-accept-counter gate
 *     FALSE-ACCEPTED at the un-bumped offer, bypassing the acceptance
 *     classifier's veto entirely. Fix (single source): isRelativeIncreaseSpan
 *     in _number-role-classifier.ts binds a number trailed by an increase
 *     marker (more/higher/extra/additional/on top) to NO role — it is a delta,
 *     not an absolute figure.
 *
 *  2. Bare-demand false-close. "Just 2 higher and it's a deal." — with the
 *     figure now unbound, the acceptance classifier still accepted the close
 *     idiom because DEMAND_FOR_MORE (PRI-69) keys on a FIRST-PERSON demand verb
 *     ("give me"/"I want") the bare form lacks. Fix (single source):
 *     RELATIVE_DEMAND_THEN_CLOSE_PATTERN vetoes a magnitude+increase token
 *     abutting an and/then/& continuation, in the SHARED
 *     FALSE_CLOSE_VETO_PATTERNS so both gates reject in lockstep.
 *
 * Net: every "N more/higher + close idiom" now routes to a counter, never a
 * close. Legitimate absolute targets ("targeting 50 LPA") still bind; the
 * PRI-68 delta path ("add another 2L") still meets-and-closes; gratitude
 * ("3% more than I expected") is spared by a `(?!\s+than)` guard.
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
import { classifyNumberRoles } from "../../server-handlers/_number-role-classifier";
import { classifyAcceptance } from "../../server-handlers/_acceptance-classifier";

const band: NegotiationBand = {
  initialOffer: 40,
  maxStretch: 52,
  walkAway: 34,
  hasEquity: true,
  variableMax: 8,
};

function offeredAt(offer: number): NegotiationState {
  let s = initState({ sessionId: "pri69b", role: "engineering", company: "Flipkart", band });
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

function closes(utter: string): boolean {
  const action = planNextAction(applyCandidateAnswer(offeredAt(40), utter));
  return action.kind === "close" || action.kind === "auto-accept";
}

describe("PRI-69b — relative cash-increase demand never binds-absolute nor false-closes", () => {
  it("does NOT bind a relative increase as an absolute target/counter", () => {
    expect(classifyNumberRoles("I want 2L more and I'll sign.").target).toBeNull();
    expect(classifyNumberRoles("Give me 3 lakh more and we're done.").target).toBeNull();
    expect(classifyNumberRoles("Just 2 higher and it's a deal.").target).toBeNull();
  });

  it("does NOT false-accept 'I want 2L more and I'll sign' at the un-bumped offer", () => {
    expect(closes("I want 2L more and I'll sign.")).toBe(false);
  });

  it("does NOT false-close the BARE 'Just 2 higher and it's a deal' form", () => {
    expect(closes("Just 2 higher and it's a deal.")).toBe(false);
  });

  it("still binds a legitimate ABSOLUTE target (no increase marker)", () => {
    expect(classifyNumberRoles("I'm targeting 50 LPA total.").target).toBe(50);
    // "more" is not adjacent to 50 → 50 still binds; the trailing 45 is a
    // reference, not the ask.
    expect(classifyNumberRoles("I want 50, a bit more than the 45 you offered.").target).toBe(50);
  });

  it("PRESERVES the PRI-68 delta path: 'add another 2 lakh' still closes at ₹42L", () => {
    const s = applyCandidateAnswer(offeredAt(40), "I'll sign if you can add another 2 lakh.");
    const action = planNextAction(s);
    expect(action.kind === "close" || action.kind === "auto-accept").toBe(true);
    expect(actionToLever(action, s).newTotalLpa).toBe(42);
  });

  it("spares gratitude: the `(?!than)` guard keeps the relative-demand veto OFF '3% more than'", () => {
    // The veto must not fire on a "more than" comparison — proven at the
    // classifier: the reason is never a false-close-veto (it closes elsewhere).
    const r = classifyAcceptance("That's 3% more than I expected, deal.");
    expect(r.reasons).not.toContain("false-close-veto");
    // Closes (as close-acceptance) rather than routing to a counter.
    const s = applyCandidateAnswer(offeredAt(40), "That's 3% more than I expected, deal.");
    expect(actionToLever(planNextAction(s), s).lever).toBe("close-acceptance");
  });
});
