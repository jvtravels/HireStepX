import { describe, it, expect } from "vitest";
import {
  initState,
  applyCandidateAnswer,
  type NegotiationBand,
  type NegotiationState,
} from "../../server-handlers/_negotiation-kernel";

/**
 * Kernel-level regression for the scope-typed compensation upgrade.
 *
 * The live-QA failure: a candidate who discloses their pay as a breakdown
 * ("48 total → 36 base → 12 variable → 48 total") tripped the flat-scalar
 * contradiction detector THREE times — every component figure was compared
 * against the single stored `currentCtc` and read as a ±10%+ drift — firing a
 * spurious `contradiction-callout` each turn and starving the session into a
 * forced stalemate instead of a real close.
 *
 * After the rewire (applyCandidateAnswer folds figures onto distinct axes via
 * the compensation model), a consistent breakdown must fold cleanly:
 * `lastContradiction` stays null across the whole sequence, while a GENUINE
 * same-axis total move (48 → 60) still fires. This test drives the real kernel
 * end-to-end, not just the pure model.
 */

const BAND: NegotiationBand = {
  initialOffer: 22,
  maxStretch: 30,
  walkAway: 18,
  hasEquity: false,
};

function freshState(): NegotiationState {
  return initState({
    sessionId: "comp-contradiction-fixture",
    role: "react",
    company: "Razorpay",
    band: BAND,
  });
}

describe("negotiation-kernel — compensation breakdown no longer self-contradicts", () => {
  it("the live sequence (48 total → 36 base → 12 variable → 48 total) fires NO contradiction", () => {
    let s = freshState();
    const utterances = [
      "My current CTC is 48 lakhs total.",
      "The fixed base portion of that is around 36 lakhs.",
      "The remaining 12 lakhs is the variable component.",
      "So to be clear, it's 36 base plus 12 variable, which is 48 total.",
    ];
    for (const u of utterances) {
      s = applyCandidateAnswer(s, u);
      expect(s.lastContradiction, `utterance="${u}"`).toBeNull();
    }
    // The reconciled headline total survives; components are filed on their
    // own axes rather than overwriting the total.
    expect(s.candidateComp?.total?.value).toBe(48);
    expect(s.candidateComp?.fixed?.value).toBe(36);
    expect(s.candidateComp?.variable?.value).toBe(12);
    // Legacy flat claim is still mirrored for downstream readers.
    expect(s.userClaims?.currentCtc?.value).toBe(48);
  });

  it("a GENUINE same-axis total contradiction (48 → 60) still fires", () => {
    let s = freshState();
    s = applyCandidateAnswer(s, "My current CTC is 48 lakhs total.");
    expect(s.lastContradiction).toBeNull();
    s = applyCandidateAnswer(s, "Actually my current total package is 60 lakhs.");
    expect(s.lastContradiction).not.toBeNull();
    expect(s.lastContradiction?.topic).toBe("currentCtc");
    expect(s.lastContradiction?.oldValue).toBe(48);
    expect(s.lastContradiction?.newValue).toBe(60);
  });
});
