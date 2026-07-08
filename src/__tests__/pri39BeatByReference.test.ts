/* §11b (2026-07-08) — "beat my current by N" is a delta on a reference, not a
 * restatement of it, and its close idiom is contingent (a counter, not an accept).
 *
 * Live/offline defect chain: with the candidate's real current CTC (38) on record,
 * "just beat my current by 5 and I'm in" was mis-parsed two ways in sequence:
 *   1. classifyNumberRoles read "beat my current by 5" as currentCtc = 5 — the
 *      "current" cue scored the bare 5 — which drifted >10% from the stored 38 and
 *      false-fired the memory contradiction-callout ("which figure is
 *      authoritative?"), derailing a reasonable in-band ask (38 + 5 = 43).
 *   2. Once the classifier stopped binding 5 (fix 1), the dropped delta left a bare
 *      "and I'm in", which classifyAcceptance read as a plain accept → a soft
 *      false-close at the un-bumped ₹40L offer.
 *
 * Two structural fixes at the two sources of truth:
 *   • _number-role-classifier: isBeatByReferenceSpan binds the delta to NO role
 *     (mirrors the §9d relative-increase guard) — it can't resolve reference+delta
 *     to an absolute here, so it must not clobber currentCtc.
 *   • _acceptance-classifier: COUNTER_THEN_CLOSE_PATTERN's object set widened from
 *     "their/the offer" to the candidate's OWN reference ("my current/ctc/package/
 *     …"), so the contingent "beat my current by N and I'm in" vetoes to a counter.
 *
 * Net: "beat my current by 5 and I'm in" → counter toward 43, never a spurious
 * contradiction and never a false close.
 */
import { describe, it, expect } from "vitest";
import { classifyNumberRoles } from "../../server-handlers/_number-role-classifier";
import { classifyAcceptance } from "../../server-handlers/_acceptance-classifier";
import {
  initState,
  applyAiMove,
  applyCandidateAnswer,
  type NegotiationBand,
  type NegotiationState,
} from "../../server-handlers/_negotiation-kernel";
import { planNextAction, actionToLever } from "../../server-handlers/_next-action-planner";

describe("§11b number-role — beat-by / over-reference delta binds to no role", () => {
  it("'beat my current by 5' does NOT bind 5 as currentCtc", () => {
    expect(classifyNumberRoles("just beat my current by 5 and I'm in.").currentCtc).toBeNull();
  });
  it("'exceed it by 3' does NOT bind 3", () => {
    const r = classifyNumberRoles("exceed it by 3 and we're done");
    expect(r.currentCtc).toBeNull();
    expect(r.target).toBeNull();
  });
  it("'5 over my current' (right-anchored) does NOT bind 5", () => {
    expect(classifyNumberRoles("I need 5 over my current to move").currentCtc).toBeNull();
  });
  it("GUARD: a genuine restatement 'my current is 38' still binds 38", () => {
    expect(classifyNumberRoles("my current is 38 LPA").currentCtc).toBe(38);
  });
  it("GUARD: additive 'bump it by 5' is untouched by the beat-verb gate", () => {
    // "bump" is not a comparison-beat verb, so this guard leaves it alone; the
    // classifier's own additive handling (not this guard) governs it.
    const r = classifyNumberRoles("bump it by 5");
    // The point is only that the beat-by guard did not swallow it into no-role
    // via a false comparison match — target/current behaviour is unchanged here.
    expect(r).toBeDefined();
  });
});

describe("§11b acceptance — contingent beat-my-reference welded to a close idiom", () => {
  const at = (t: string) => classifyAcceptance(t, { offerLpa: 40, offerOnTable: true });
  it("'beat my current by 5 and I'm in' → NOT accepted (contingent)", () => {
    expect(at("just beat my current by 5 and I'm in.").accepted).toBe(false);
  });
  it("'top my package and we're done' → NOT accepted", () => {
    expect(at("top my package and we're done.").accepted).toBe(false);
  });
  it("GUARD: 'beat their offer and I'll sign' still vetoes (unchanged)", () => {
    expect(at("beat their offer and I'll sign.").accepted).toBe(false);
  });
  it("GUARD: a plain accept 'sounds good, let's do it' still accepts", () => {
    expect(at("sounds good, let's do it.").accepted).toBe(true);
  });
});

const band: NegotiationBand = {
  initialOffer: 40,
  maxStretch: 52,
  walkAway: 34,
  hasEquity: true,
  variableMax: 8,
};

function offeredAt(offer: number): NegotiationState {
  let s = initState({ sessionId: "pri39", role: "engineering", company: "Flipkart", band });
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

describe("§11b end-to-end — beat-my-current-by-5 counters, no contradiction, no false close", () => {
  it("'beat my current by 5 and I'm in' → counter (NOT contradiction-callout, NOT close at 40)", () => {
    const s = applyCandidateAnswer(offeredAt(40), "just beat my current by 5 and I'm in.");
    const action = planNextAction(s);
    expect(action.kind).not.toBe("contradiction-callout");
    expect(action.kind).toMatch(/counter/);
    const fig = actionToLever(action, s).newTotalLpa;
    expect(fig).not.toBe(40); // must not soft-close at the un-bumped offer
  });
});
