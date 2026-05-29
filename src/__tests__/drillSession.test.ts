/* Drill mode — pure-engine tests.
 *
 * Covers each skill flavor (5 skills), exhaustion at the 5-question
 * boundary, and the summary output shape. The drill engine is
 * deliberately small + deterministic; these tests pin the contract that
 * the UI scaffold and the parent report depend on. */

import { describe, expect, it } from "vitest";
import {
  startDrill,
  applyDrillTurn,
  summarizeDrill,
  currentQuestion,
  scoreAnswer,
  type DrillConfig,
  type DrillSkill,
} from "../../server-handlers/_drill-session";

function cfg(skill: DrillSkill): DrillConfig {
  return { skill, maxQuestions: 5 };
}

function runFive(skill: DrillSkill, answers: string[]) {
  let state = startDrill(cfg(skill));
  let last: ReturnType<typeof applyDrillTurn> | null = null;
  for (const a of answers) {
    last = applyDrillTurn(state, a);
    state = last.state;
  }
  return { state, last };
}

describe("drill mode — per-skill flavors", () => {
  it("esop drill scores keyword-rich answers higher than thin ones", () => {
    const thin = scoreAnswer("esop", "ok sure");
    const rich = scoreAnswer(
      "esop",
      "I'd want to see the 409a, the strike price, the vesting cliff, and the spread before agreeing.",
    );
    expect(rich).toBeGreaterThan(thin);
    expect(rich).toBeLessThanOrEqual(100);
  });

  it("notice-period drill exposes a 5-question script", () => {
    const state = startDrill(cfg("notice-period"));
    expect(state.script).toHaveLength(5);
    expect(currentQuestion(state)).toMatch(/notice/i);
  });

  it("anchoring drill rewards range/benchmark vocabulary", () => {
    const score = scoreAnswer(
      "anchoring",
      "My target is based on market benchmark data; I'm expecting a range of 42-48 lakh total comp.",
    );
    expect(score).toBeGreaterThanOrEqual(80);
  });

  it("red-flags drill rewards 'in writing' style pushback", () => {
    const score = scoreAnswer(
      "red-flags",
      "I'm not comfortable without something in writing — can we document the policy?",
    );
    expect(score).toBeGreaterThanOrEqual(70);
  });

  it("silence drill rewards holding the anchor instead of folding", () => {
    const score = scoreAnswer(
      "silence",
      "As I said, my ask is based on the market data I shared — happy to discuss.",
    );
    expect(score).toBeGreaterThanOrEqual(70);
  });
});

describe("drill mode — exhaustion at 5 questions", () => {
  it("terminates after exactly 5 turns and refuses further input", () => {
    const answers = ["a", "b", "c", "d", "e"];
    const { state, last } = runFive("esop", answers);
    expect(state.finished).toBe(true);
    expect(state.turns).toHaveLength(5);
    expect(last?.finished).toBe(true);
    expect(last?.questionsRemaining).toBe(0);

    // Further turns are no-ops.
    const extra = applyDrillTurn(state, "trying to push past 5");
    expect(extra.state.turns).toHaveLength(5);
    expect(extra.finished).toBe(true);
    expect(currentQuestion(state)).toBeNull();
  });

  it("decrements questionsRemaining each turn", () => {
    let state = startDrill(cfg("anchoring"));
    const remaining: number[] = [];
    for (let i = 0; i < 5; i++) {
      const res = applyDrillTurn(state, "answer " + i);
      remaining.push(res.questionsRemaining);
      state = res.state;
    }
    expect(remaining).toEqual([4, 3, 2, 1, 0]);
  });
});

describe("drill mode — summary shape", () => {
  it("returns the documented summary keys for every skill", () => {
    const skills: DrillSkill[] = ["esop", "notice-period", "anchoring", "red-flags", "silence"];
    for (const skill of skills) {
      const { state } = runFive(skill, [
        "short",
        "a much more substantive answer with detail and reasoning",
        "ok",
        "fair market value and strike spread and vesting cliff",
        "decent middling response",
      ]);
      const summary = summarizeDrill(state);
      expect(summary.skill).toBe(skill);
      expect(typeof summary.scorePct).toBe("number");
      expect(summary.scorePct).toBeGreaterThanOrEqual(0);
      expect(summary.scorePct).toBeLessThanOrEqual(100);
      expect(summary.strongestAnswerIdx).toBeGreaterThanOrEqual(0);
      expect(summary.weakestAnswerIdx).toBeGreaterThanOrEqual(0);
      expect(summary.strongestAnswerIdx).toBeLessThan(5);
      expect(summary.weakestAnswerIdx).toBeLessThan(5);
      expect(typeof summary.oneSentenceVerdict).toBe("string");
      expect(summary.oneSentenceVerdict.length).toBeGreaterThan(0);
    }
  });

  it("strongest is at least as high as weakest", () => {
    const { state } = runFive("esop", [
      "ok",
      "strike price 409a vesting cliff fair market value spread",
      "no",
      "vest",
      "fine",
    ]);
    const summary = summarizeDrill(state);
    const turns = state.turns;
    expect(turns[summary.strongestAnswerIdx].score).toBeGreaterThanOrEqual(
      turns[summary.weakestAnswerIdx].score,
    );
  });
});

describe("drill mode — guardrails", () => {
  it("rejects non-5 maxQuestions configs", () => {
    // @ts-expect-error — intentionally invalid maxQuestions
    expect(() => startDrill({ skill: "esop", maxQuestions: 3 })).toThrow();
  });
});
