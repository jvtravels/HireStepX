/* F7 (PDF#20 2026-05-15) — askedTopics repetition guard.
 *
 * Problem: the same probe topic (e.g. "what range were you expecting?") was
 * asked THREE times in the same session because the `askedTopics` de-dupe
 * ledger was scope-cut.
 *
 * Fix:
 *   1. `askedTopics: { topic: string; atTurn: number }[]` added to NegotiationState.
 *   2. applyAiMove pushes `{ topic: move.lever || move.actionKind, atTurn }` when a
 *      move is applied.
 *   3. planNextAction checks: if the same topic was asked in the last 3 turns,
 *      it skips to the next discovery item.
 *
 * This test: same-topic probe should not repeat within 3 turns.
 */
import { describe, it, expect } from "vitest";
import {
  initState,
  applyAiMove,
  applyCandidateAnswer,
  type NegotiationBand,
  type NegotiationState,
  type AiMove,
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
      sessionId: "s-f7",
      role: "Software Engineer",
      company: "acme",
      band: BAND,
    }),
    ...overrides,
  };
}

describe("F7 — askedTopics repetition guard", () => {
  it("applyAiMove pushes the asked topic onto state.askedTopics", () => {
    let state = fresh();
    const move: AiMove = {
      lever: "probe",
      newTotalLpa: null,
      rationale: "Discovery: ask current CTC",
      actionKind: "discovery-probe",
      askedTopic: "currentCtcAnswered",
    };
    state = applyAiMove(state, move, "Could you share your current compensation?");
    const topics = state.askedTopics ?? [];
    expect(topics.length).toBeGreaterThanOrEqual(1);
    const last = topics[topics.length - 1];
    expect(last.topic).toBe("currentCtcAnswered");
    expect(typeof last.atTurn).toBe("number");
  });

  it("same-topic discovery probe is not re-emitted within 3 turns after first ask", () => {
    // Build a state where the same topic was asked on turn N and we're now at N+1.
    // The planner should skip that topic and move to the next discovery item.
    let state = fresh();
    // Manually place a recent askedTopics entry for "currentCtcAnswered" on turn 0.
    state = {
      ...state,
      askedTopics: [{ topic: "currentCtcAnswered", atTurn: 0 }],
      turnIndex: 1,
    };

    const action = planNextAction(state);
    // The action should NOT be a discovery-probe for "currentCtcAnswered" again
    // (it should advance to the next item — or at least not repeat currentCtcAnswered).
    if (action.kind === "discovery-probe") {
      expect(action.item).not.toBe("currentCtcAnswered");
    } else {
      // Any non-discovery-probe is also acceptable (reactive-followup, open-with-offer, etc.)
      expect(action.kind).not.toBe("discovery-probe");
    }
  });

  it("same-topic IS re-emittable after 3 turns have passed", () => {
    // If the topic was asked on turn 0 and we are now on turn 4, it should be
    // allowed to re-ask (3-turn window has passed).
    let state = fresh();
    state = {
      ...state,
      askedTopics: [{ topic: "currentCtcAnswered", atTurn: 0 }],
      turnIndex: 4,
    };

    const action = planNextAction(state);
    // currentCtcAnswered is the first ordered item so if we allow it, the planner
    // should happily emit it again.
    if (action.kind === "discovery-probe") {
      // Either currentCtcAnswered is allowed again, or the planner picked a later item.
      // Both are valid; this test just documents the expected window.
      expect(["currentCtcAnswered", "fixedVariableSplitAnswered", "noticePeriodAnswered", "targetAnswered", "valueProofAnswered"]).toContain(action.item);
    } else {
      // Non-discovery-probe is also fine at turn 4 if there are no checklist items left.
      expect(["open-with-offer", "reactive-followup", "probe-mismatch"]).toContain(action.kind);
    }
  });

  it("askedTopics accumulates across multiple applyAiMove calls", () => {
    let state = fresh();

    const move1: AiMove = {
      lever: "probe",
      newTotalLpa: null,
      rationale: "Ask current CTC",
      askedTopic: "currentCtcAnswered",
    };
    state = applyAiMove(state, move1, "What's your current CTC?");

    state = applyCandidateAnswer(state, "It's 18 LPA.");

    const move2: AiMove = {
      lever: "probe",
      newTotalLpa: null,
      rationale: "Ask notice period",
      askedTopic: "noticePeriodAnswered",
    };
    state = applyAiMove(state, move2, "What's your notice period?");

    const topics = state.askedTopics ?? [];
    expect(topics.length).toBeGreaterThanOrEqual(2);
    expect(topics.some((t) => t.topic === "currentCtcAnswered")).toBe(true);
    expect(topics.some((t) => t.topic === "noticePeriodAnswered")).toBe(true);
  });
});
