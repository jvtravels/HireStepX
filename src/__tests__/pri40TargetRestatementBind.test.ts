/* #40 (live-staging 2026-07-08) — an explicitly-declared target restated
 * with a repetition cue ("I already told you: 55 lakhs is my target") must
 * bind to the TARGET axis, never CURRENT.
 *
 * Live defect (Flipkart / Senior Product Designer, driven as a candidate):
 * after stating target 55 and current CTC 42, pushing the recruiter with
 * "I already told you: 55 lakhs is my target" mis-parsed the 55 as CURRENT
 * CTC. Two root gaps at the number-role classifier (single source of truth):
 *   1. TARGET_CUES.right recognised "my number/ask/figure/expectation" but
 *      NOT "my target" — the most literal ask phrasing — so target scored 0.
 *   2. The restatement meta-cue "told you" (then living in CURRENT_CUES)
 *      scored current=1 and won the current>target tiebreak, binding 55 to
 *      current. That overwrote the stored current CTC (42) and stamped a
 *      phantom same-axis contradiction (42↔55). Because each side just
 *      restated its own number, the callout re-fired forever — the
 *      negotiation deadlocked on a contradiction that never happened, even
 *      after the candidate explicitly corrected the record.
 *
 * Fixes:
 *   • add `target` to the "my <noun>" TARGET right-cue alternation;
 *   • move the three restatement cues (told you / as I said / said already)
 *     into RESTATEMENT_CUES — a weakest-tier meta group that reinforces
 *     `current` ONLY when no explicit target/competing cue bound the span.
 *
 * End-to-end: the contradiction-callout never fires; currentCtc stays 42;
 * the planner proceeds to anchor/counter instead of deadlocking.
 */
import { describe, it, expect } from "vitest";
import { classifyNumberRoles } from "../../server-handlers/_number-role-classifier";
import {
  initState,
  applyAiMove,
  applyCandidateAnswer,
  type NegotiationBand,
} from "../../server-handlers/_negotiation-kernel";
import { planNextAction } from "../../server-handlers/_next-action-planner";

describe("#40 number-role — restated explicit target binds target, not current", () => {
  it("'I already told you: 55 lakhs is my target' → target=55, current=null", () => {
    const r = classifyNumberRoles(
      "I already told you: 55 lakhs is my target. I need a real figure from your side.",
    );
    expect(r.target).toBe(55);
    expect(r.currentCtc).toBeNull();
  });
  it("'55 lakhs is my target' → target=55 (was null before the right-cue add)", () => {
    expect(classifyNumberRoles("55 lakhs is my target").target).toBe(55);
  });
  it("'55 is my target' → target=55", () => {
    expect(classifyNumberRoles("55 is my target").target).toBe(55);
  });
  it("GUARD: restatement-only 'I told you, 24 LPA CTC overall' still binds current", () => {
    const r = classifyNumberRoles("I told you, 24 LPA CTC overall");
    expect(r.currentCtc).toBe(24);
    expect(r.target).toBeNull();
  });
  it("GUARD: 'as I mentioned, 17 LPA total CTC' still binds current", () => {
    const r = classifyNumberRoles("as I mentioned, 17 LPA total CTC");
    expect(r.currentCtc).toBe(17);
    expect(r.target).toBeNull();
  });
});

const band: NegotiationBand = {
  initialOffer: 40,
  maxStretch: 52,
  walkAway: 34,
  hasEquity: true,
  variableMax: 8,
};

describe("#40 end-to-end — restated target never deadlocks on a phantom contradiction", () => {
  it("target 55 → current 42 → restate 'told you 55 is my target' → no contradiction, current stays 42", () => {
    let s = initState({ sessionId: "pri40", role: "engineering", company: "Flipkart", band });
    s = { ...s, minTurnsBeforeClose: 0 };
    s = applyAiMove(s, { lever: "probe", newTotalLpa: null, rationale: "ctc" }, "current CTC?");
    s = applyCandidateAnswer(s, "I'd rather not anchor on my current number. What range is budgeted?");
    s = applyAiMove(s, { lever: "probe", newTotalLpa: null, rationale: "target" }, "what are you targeting?");
    s = applyCandidateAnswer(s, "Based on my track record, I'm targeting 55 lakhs total. Where can we land?");
    s = applyAiMove(s, { lever: "probe", newTotalLpa: null, rationale: "ctc2" }, "I still need your current total CTC.");
    s = applyCandidateAnswer(s, "Okay, my current total CTC is 42 lakhs. But I'd want a meaningful step up.");
    expect(s.userClaims?.currentCtc?.value).toBe(42);
    s = applyAiMove(s, { lever: "probe", newTotalLpa: null, rationale: "t2" }, "what's the fitment you were targeting?");
    s = applyCandidateAnswer(s, "I already told you: 55 lakhs is my target. I need a real figure from your side.");
    // The phantom contradiction (42↔55) must NOT be stamped.
    expect(s.lastContradiction).toBeNull();
    expect(s.userClaims?.currentCtc?.value).toBe(42);
    expect(planNextAction(s).kind).not.toBe("contradiction-callout");
  });
});
