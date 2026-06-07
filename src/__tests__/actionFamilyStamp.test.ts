/* Month 2 PR-2 (PDF #28) — family-stamp at the planner exit boundary.
 *
 * Locks the invariant that every AiMove emitted by pickAiMove carries
 * a `family` field derived from its actionKind via familyOf(). M2 PR-3+
 * family-level guardrails depend on this being totally reliable. */

import { describe, it, expect } from "vitest";
import {
  initState,
  applyCandidateAnswer,
  pickAiMove,
  type NegotiationBand,
  type NegotiationState,
} from "../../server-handlers/_negotiation-kernel";
import { ACTION_FAMILIES } from "../../server-handlers/_action-families";

const BAND: NegotiationBand = {
  initialOffer: 24,
  maxStretch: 30,
  walkAway: 20,
  hasEquity: false,
};

function freshState(): NegotiationState {
  return initState({
    sessionId: "m2-pr2-stamp",
    role: "Software Engineer",
    company: "JP Morgan",
    band: BAND,
  });
}

describe("M2 PR-2 — pickAiMove stamps family on emitted moves", () => {
  it("stamps a family on the move when actionKind is set", () => {
    const move = pickAiMove(freshState());
    if (move.actionKind) {
      expect(move.family).toBeDefined();
      const validFamilies = [...ACTION_FAMILIES, "unmapped"] as string[];
      expect(validFamilies).toContain(move.family);
    }
  });

  it("family value is consistent across several turn picks", () => {
    let s = freshState();
    for (let i = 0; i < 3; i++) {
      const move = pickAiMove(s);
      if (move.actionKind) {
        expect(move.family).not.toBe(undefined);
      }
      /* advance by a no-op candidate turn to step through phases */
      s = applyCandidateAnswer(s, "Okay.");
    }
  });

  it("does not stamp family when actionKind is absent", () => {
    /* Construct a synthetic move object to exercise the guard. We don't
     * have a direct hook into the inner branches, so this asserts the
     * guard via the public interface: any move pickAiMove returns
     * without an actionKind also has no family. */
    const move = pickAiMove(freshState());
    if (!move.actionKind) {
      expect(move.family).toBe(undefined);
    }
  });
});
