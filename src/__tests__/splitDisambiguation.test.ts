/* PDF#18 follow-up P3 (2026-05-15) — current-vs-expected fixed/variable
 * split disambiguation.
 *
 * When the candidate provides a "fixed + variable" split utterance the
 * kernel must know whether the bot was JUST asking about the CURRENT
 * CTC's split or the EXPECTED CTC's split, and route the flag
 * accordingly. lastDisclosureSubject ("current" | "expected") is set in
 * applyAiMove from the move-picker's ordered-discovery rationale; the
 * candidate's split utterance is then attributed to the right CTC.
 */
import { describe, it, expect } from "vitest";
import {
  initState,
  applyCandidateAnswer,
  type NegotiationBand,
  type NegotiationState,
} from "../../server-handlers/_negotiation-kernel";
import {
  EMPTY_DISCOVERY_CHECKLIST,
} from "../../server-handlers/_discovery-stage";

const BAND: NegotiationBand = {
  initialOffer: 18,
  maxStretch: 24,
  walkAway: 14,
  hasEquity: true,
};

const init = (overrides: Partial<NegotiationState> = {}): NegotiationState => ({
  ...initState({
    sessionId: "s-split-disambig",
    role: "Software Engineer",
    company: "acme",
    band: BAND,
  }),
  ...overrides,
  discoveryChecklist: { ...EMPTY_DISCOVERY_CHECKLIST, ...(overrides.discoveryChecklist ?? {}) },
});

describe("split disambiguation — current-vs-expected", () => {
  it("bot asked CURRENT split → candidate provides 10L fixed 3L variable → currentCtcFixedVariableSplitDisclosed", () => {
    const s = init({
      lastDisclosureSubject: "current",
      candidateCurrentCtc: 13,
    });
    const next = applyCandidateAnswer(s, "My current is fixed 10L and variable 3L.");
    expect(next.discoveryChecklist?.currentCtcFixedVariableSplitDisclosed).toBe(true);
    expect(next.discoveryChecklist?.expectedCtcFixedVariableSplitDisclosed).toBeFalsy();
  });

  it("bot asked EXPECTED split → same shape utterance → expectedCtcFixedVariableSplitDisclosed", () => {
    const s = init({
      lastDisclosureSubject: "expected",
      candidateTarget: 18,
    });
    const next = applyCandidateAnswer(s, "Targeting fixed 14L and variable 4L.");
    expect(next.discoveryChecklist?.expectedCtcFixedVariableSplitDisclosed).toBe(true);
    expect(next.discoveryChecklist?.currentCtcFixedVariableSplitDisclosed).toBeFalsy();
  });

  it("subject NOT set → only the legacy umbrella flag is flipped (conservative)", () => {
    const s = init({ lastDisclosureSubject: null });
    const next = applyCandidateAnswer(s, "My package is fixed 12L and variable 3L.");
    /* Conservative path: without a subject tag we don't guess which CTC
     * the split applies to. Neither subject-specific flag flips. */
    expect(next.discoveryChecklist?.currentCtcFixedVariableSplitDisclosed).toBeFalsy();
    expect(next.discoveryChecklist?.expectedCtcFixedVariableSplitDisclosed).toBeFalsy();
    /* The legacy umbrella flag also stays off in this path — the
     * routing only fires when subject is set. */
  });

  it("subject=current AND utterance has only fixed (no variable) → neither flag flips", () => {
    const s = init({ lastDisclosureSubject: "current" });
    /* Single-component utterance is not a "split" — both fixed and
     * variable must be parseable. */
    const next = applyCandidateAnswer(s, "Just fixed 10L for now.");
    expect(next.discoveryChecklist?.currentCtcFixedVariableSplitDisclosed).toBeFalsy();
  });

  it("subject=expected → only expectedCtcFixedVariableSplitDisclosed, NOT current", () => {
    const s = init({ lastDisclosureSubject: "expected" });
    const next = applyCandidateAnswer(s, "On the target, fixed 15L plus variable 4L.");
    expect(next.discoveryChecklist?.currentCtcFixedVariableSplitDisclosed).toBeFalsy();
    expect(next.discoveryChecklist?.expectedCtcFixedVariableSplitDisclosed).toBe(true);
  });

  it("legacy fixedVariableSplitAnswered also flips when a subject-tagged split arrives", () => {
    const s = init({ lastDisclosureSubject: "current" });
    const next = applyCandidateAnswer(s, "Current is fixed 10L and variable 3L.");
    expect(next.discoveryChecklist?.fixedVariableSplitAnswered).toBe(true);
  });
});
