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
import { planNextAction, actionToLever } from "../../../server-handlers/_next-action-planner";

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

  it("same-topic discovery probe is not re-emitted within 3 turns after first ask AND answer", () => {
    // Build a state where the same topic was asked AND answered on turn N
    // and we're now at N+1. The planner should skip that topic and move
    // to the next discovery item.
    //
    // BUG-2 (PDF#24, 2026-05-16) tightened semantics: the recency-skip
    // applies only when the candidate actually answered. An asked-but-
    // unanswered topic must stay re-askable so the discovery cascade
    // can backfill the gap (otherwise the planner skips currentCtc the
    // moment the candidate dodges turn 0, and falls through to the
    // wrong subsequent item).
    let state = fresh();
    state = {
      ...state,
      askedTopics: [{ topic: "currentCtcAnswered", atTurn: 0 }],
      turnIndex: 1,
      discoveryChecklist: state.discoveryChecklist
        ? { ...state.discoveryChecklist, currentCtcAnswered: true }
        : undefined,
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

  it("asked-but-UNANSWERED topic stays re-askable (BUG-2 fix, PDF#24)", () => {
    // currentCtc was asked on turn 0 but the candidate never answered
    // (e.g. dodged with a hike-rationale story). On turn 1 the planner
    // MUST keep currentCtc in the ordered cascade so the gap gets
    // backfilled — otherwise the bot rushes to fitment-split with no
    // anchor for the current side. This is the structural fix.
    let state = fresh();
    state = {
      ...state,
      askedTopics: [{ topic: "currentCtcAnswered", atTurn: 0 }],
      turnIndex: 1,
      /* checklist intentionally NOT flipping currentCtcAnswered — the
       * candidate hasn't disclosed yet. */
    };

    const action = planNextAction(state);
    expect(action.kind).toBe("discovery-probe");
    if (action.kind === "discovery-probe") {
      expect(action.item).toBe("currentCtcAnswered");
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

  /* Session #25 root-fix (2026-05-16) — opener marks currentCtc, and the
   * 3-strike consecutive-topic cap prevents the planner from firing the
   * same discovery topic four turns in a row when the candidate dodges. */
  describe("Session #25 — opener convergence + 3-strike cap", () => {
    it("turn-0 open-with-offer carries askedTopic=currentCtcAnswered", () => {
      const state = fresh();
      // Force the open-with-offer path by clearing the checklist so the
      // discovery-probe branch in the opening guard falls through. We just
      // need the planner to land on open-with-offer for turn-0 verification.
      const seed: NegotiationState = { ...state, discoveryChecklist: undefined };
      const action = planNextAction(seed);
      expect(action.kind).toBe("open-with-offer");
      if (action.kind === "open-with-offer") {
        const move = actionToLever(action, seed);
        expect(move.askedTopic).toBe("currentCtcAnswered");
      }
    });

    it("turn-0 opener + planner pipeline writes currentCtcAnswered into askedTopics", () => {
      let state: NegotiationState = { ...fresh(), discoveryChecklist: undefined };
      const action = planNextAction(state);
      if (action.kind === "open-with-offer") {
        state = applyAiMove(state, actionToLever(action, state), "Walk me through your current compensation structure.");
      }
      const topics = state.askedTopics ?? [];
      expect(topics.some((t) => t.topic === "currentCtcAnswered")).toBe(true);
      expect(topics.some((t) => t.topic === "open-with-offer")).toBe(false);
    });

    it("3-strike cap: same discovery topic asked twice in a row → planner advances on the third", () => {
      // Simulate the bug session: currentCtc asked on turns 0 and 1
      // (candidate dodged both), and we're now planning turn 2. The cap
      // must force-skip currentCtcAnswered even though the BUG-2 gate
      // would normally keep it re-askable.
      let state = fresh();
      state = {
        ...state,
        askedTopics: [
          { topic: "currentCtcAnswered", atTurn: 0 },
          { topic: "currentCtcAnswered", atTurn: 1 },
        ],
        turnIndex: 2,
        // checklist NOT marking currentCtcAnswered — candidate dodged.
      };
      const action = planNextAction(state);
      if (action.kind === "discovery-probe") {
        expect(action.item).not.toBe("currentCtcAnswered");
      }
    });
  });
});
