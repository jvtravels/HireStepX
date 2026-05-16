/* FL5 / Audit Pass 4 (PDF#27, 2026-05-17) — uncertainty detection +
 * escape hatch.
 *
 * applyCandidateAnswer detects hedged replies and stamps
 * state.lastAnswerUncertainAt. The planner then deterministically
 * picks between (a) advancing past the stuck topic and (b) swapping
 * the canonical question to a range-shaped one so the bot doesn't
 * grind on an exact number after an uncertain reply.
 */
import { describe, it, expect } from "vitest";
import {
  initState,
  applyCandidateAnswer,
  type NegotiationBand,
  type NegotiationState,
} from "../../server-handlers/_negotiation-kernel";
import { planNextAction } from "../../server-handlers/_next-action-planner";

const BAND: NegotiationBand = {
  initialOffer: 22,
  maxStretch: 30,
  walkAway: 18,
  hasEquity: false,
};

function mkState(overrides: Partial<NegotiationState> = {}): NegotiationState {
  return Object.assign(
    initState({ sessionId: "fl5", role: "swe", company: "acme", band: BAND }),
    overrides,
  );
}

describe("FL5 — uncertainty detection in applyCandidateAnswer", () => {
  const HEDGE_SAMPLES = [
    "I'm not sure of the exact number",
    "I don't remember the breakdown",
    "approximately 18 LPA give or take",
    "around 22 LPA",
    "I think it was 20 LPA",
    "roughly 25 LPA",
    "maybe 17 or so",
    "I forget the exact split",
  ];

  for (const sample of HEDGE_SAMPLES) {
    it(`stamps lastAnswerUncertainAt for "${sample}"`, () => {
      const s = mkState({ turnIndex: 2 });
      const next = applyCandidateAnswer(s, sample);
      expect(next.lastAnswerUncertainAt).toBe(2);
    });
  }

  it("does NOT stamp lastAnswerUncertainAt for a confident exact reply", () => {
    const s = mkState({ turnIndex: 2 });
    const next = applyCandidateAnswer(s, "My current CTC is 18.5 LPA.");
    expect(next.lastAnswerUncertainAt).toBeFalsy();
  });
});

describe("FL5 — planner escape hatch on uncertain re-ask", () => {
  it("turnIndex even → swaps probe to range-shaped ask", () => {
    /* The pending discovery item is currentCtc; the candidate's last
     * recorded ask was on currentCtcAnswered AND the prior turn was
     * uncertain. The planner should now emit a range-shaped ask. */
    const s = mkState({
      turnIndex: 4,
      lastAnswerUncertainAt: 3,
      askedTopics: [{ topic: "currentCtcAnswered", atTurn: 3 }],
    });
    const action = planNextAction(s);
    if (action.kind === "discovery-probe") {
      expect(action.ask).toMatch(/range|under \d+|\d+-\d+/i);
    }
  });

  it("turnIndex odd → advances past the stuck topic", () => {
    const s = mkState({
      turnIndex: 5,
      lastAnswerUncertainAt: 4,
      askedTopics: [{ topic: "currentCtcAnswered", atTurn: 4 }],
      candidateCurrentCtc: null,
    });
    const action = planNextAction(s);
    /* The planner should not re-emit currentCtc as the pending item;
     * either it advances to another discovery topic or it routes to
     * a different action kind entirely. The escape hatch never
     * grinds on the same item. */
    if (action.kind === "discovery-probe") {
      expect(action.item).not.toMatch(/^currentCtc/);
    }
  });

  it("uncertainty stale (prior to last turn) → no escape hatch applies", () => {
    const s = mkState({
      turnIndex: 6,
      lastAnswerUncertainAt: 1, // stale by 5 turns
      askedTopics: [{ topic: "currentCtcAnswered", atTurn: 5 }],
    });
    const action = planNextAction(s);
    if (action.kind === "discovery-probe") {
      /* No range-ask phrasing should be injected; ask is the canonical
       * (non-range) prompt. */
      expect(action.ask).not.toMatch(/under \d+|\d+-\d+/i);
    }
  });

  it("uncertainty fresh but on a DIFFERENT topic → no escape hatch", () => {
    /* The candidate hedged on noticePeriod; we're now about to ask
     * currentCtc. No escape hatch — the cascade moved on naturally. */
    const s = mkState({
      turnIndex: 3,
      lastAnswerUncertainAt: 2,
      askedTopics: [{ topic: "noticePeriodAnswered", atTurn: 2 }],
    });
    const action = planNextAction(s);
    if (action.kind === "discovery-probe") {
      expect(action.ask).not.toMatch(/under \d+|\d+-\d+/i);
    }
  });
});
