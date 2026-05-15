/* F9 (PDF#20 2026-05-15) — Directional expectation → value-proof routing.
 *
 * Problem: When candidate says "I'm looking for stronger growth opportunities"
 * (no number), the planner re-asked range instead of routing to a value-proof
 * probe.
 *
 * Fix: In planNextAction, after checking reactive followups, if expectedCtc
 * is unanswered AND the last reply contains directional keywords (growth,
 * ownership, upside, learning, culture, trajectory, impact, equity,
 * meaningful, long-term) without a specific number → emit a reactive-followup
 * with topic "value-proof".
 *
 * This test: feeds a directional-only answer and asserts the planner emits
 * kind: "reactive-followup", topic: "value-proof".
 */
import { describe, it, expect } from "vitest";
import {
  initState,
  applyCandidateAnswer,
  type NegotiationBand,
  type NegotiationState,
} from "../../../server-handlers/_negotiation-kernel";
import { planNextAction } from "../../../server-handlers/_next-action-planner";

const BAND: NegotiationBand = {
  initialOffer: 22,
  maxStretch: 30,
  walkAway: 18,
  hasEquity: false,
};

function fresh(overrides: Partial<NegotiationState> = {}): NegotiationState {
  return {
    ...initState({
      sessionId: "s-f9",
      role: "Software Engineer",
      company: "acme",
      band: BAND,
    }),
    ...overrides,
  };
}

describe("F9 — directional expectation → value-proof routing", () => {
  const directionalPhrases = [
    "I'm looking for stronger growth opportunities",
    "I care about the learning and ownership",
    "I want to work on something with real impact and meaning",
    "It's more about trajectory and culture for me",
    "I'm looking for upside and equity more than just base",
    "Long-term growth matters more to me than short-term salary",
    "I want meaningful work with a real equity stake",
  ];

  for (const phrase of directionalPhrases) {
    it(`routes to value-proof for: "${phrase.slice(0, 60)}"`, () => {
      let state = fresh({
        // Place in offer-presented so we don't get a discovery-probe barrier.
        phase: "offer-presented",
        // expectedCtc unanswered
        candidateTarget: null,
        // Simulate the candidate just gave this answer
        conversationLog: [
          { speaker: "candidate", text: phrase },
        ],
      });

      // Apply the answer so lastTurnDelta is populated
      state = applyCandidateAnswer(state, phrase);

      const action = planNextAction(state);
      expect(action.kind).toBe("reactive-followup");
      if (action.kind === "reactive-followup") {
        expect(action.topic).toBe("value-proof");
      }
    });
  }

  it("does NOT route to value-proof when the directional phrase also has a specific number", () => {
    const phraseWithNumber = "I'm looking for growth and I want 28 LPA";
    let state = fresh({
      phase: "offer-presented",
      candidateTarget: null,
    });
    state = applyCandidateAnswer(state, phraseWithNumber);

    const action = planNextAction(state);
    // Should NOT emit value-proof reactive-followup when a number was stated
    if (action.kind === "reactive-followup") {
      expect(action.topic).not.toBe("value-proof");
    }
    // Any other action kind is also fine
  });

  it("does NOT route to value-proof when expectedCtc is already answered", () => {
    const phrase = "I'm looking for growth opportunities";
    let state = fresh({
      phase: "offer-presented",
      candidateTarget: 28, // already answered
    });
    state = applyCandidateAnswer(state, phrase);

    const action = planNextAction(state);
    if (action.kind === "reactive-followup") {
      expect(action.topic).not.toBe("value-proof");
    }
  });
});
